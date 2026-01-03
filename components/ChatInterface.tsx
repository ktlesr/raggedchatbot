"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Send,
  User,
  Bot,
  Loader2,
  Paperclip,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import ReactMarkdown from "react-markdown";
import { useSessions } from "@/lib/context/SessionContext";

export default function ChatInterface() {
  const {
    activeSessionId,
    sessions,
    addMessage,
    createSession,
    updateLastMessage,
  } = useSessions();

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId),
    [sessions, activeSessionId],
  );
  const messages = useMemo(
    () => activeSession?.messages || [],
    [activeSession],
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "auto",
      });
    }
  }, [messages, isTyping]);

  const sendMessage = async () => {
    if (!input.trim() || loading || isTyping) return;

    let targetSessionId = activeSessionId;
    if (!targetSessionId) {
      targetSessionId = createSession();
    }

    const userMsg = { role: "user" as const, content: input };
    addMessage(targetSessionId, userMsg);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content }),
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        setIsTyping(true);
        const fullText = data.reply;

        // Add empty bot message
        addMessage(targetSessionId, { role: "bot", content: "" });

        const typingSpeed = 10;

        // We use a small delay to ensure the empty message is actually in the state
        // before we start updating it.
        setTimeout(() => {
          const typeChar = (index: number, text: string) => {
            if (index < fullText.length) {
              const nextChar = fullText.charAt(index);
              const updatedText = text + nextChar;
              updateLastMessage(targetSessionId!, updatedText);

              setTimeout(() => typeChar(index + 1, updatedText), typingSpeed);
            } else {
              setIsTyping(false);
            }
          };
          typeChar(0, "");
        }, 50);
      } else {
        addMessage(targetSessionId, {
          role: "bot",
          content:
            "Üzgünüm, bir hata oluştu: " + (data.error || res.statusText),
        });
      }
    } catch (err) {
      console.error("Chat error:", err);
      setLoading(false);
      if (targetSessionId) {
        addMessage(targetSessionId, {
          role: "bot",
          content: "Sunucuya bağlanırken bir hata oluştu.",
        });
      }
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-background relative transition-colors duration-300">
      {/* Header */}
      <div className="h-16 px-8 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm z-10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg">
            <MessageSquare size={20} />
          </div>
          <div>
            <h2 className="font-bold text-base truncate max-w-[300px]">
              {activeSession?.title || "Yeni Sohbet"}
            </h2>
            <p className="text-[10px] text-emerald-500 font-bold tracking-widest uppercase">
              • YASAL UZMAN AKTİF
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-8 md:px-20 space-y-12"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-30 select-none">
            <Bot size={80} className="text-primary" />
            <div className="space-y-2">
              <h3 className="text-2xl font-bold">Nasıl yardımcı olabilirim?</h3>
              <p className="max-w-xs text-sm">
                Yatırım teşvikleri ve mevzuat hakkında her şeyi sorabilirsiniz.
              </p>
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "flex w-full group transition-all duration-300 animate-in fade-in slide-in-from-bottom-4",
              m.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "flex gap-4 max-w-[85%] md:max-w-[75%]",
                m.role === "user" ? "flex-row" : "flex-row",
              )}
            >
              {m.role === "bot" && (
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full bg-slate-900 dark:bg-slate-800 flex items-center justify-center border border-border shadow-md">
                    <Bot size={20} className="text-primary" />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div
                  className={cn(
                    "p-5 rounded-3xl text-[15px] leading-relaxed",
                    m.role === "user"
                      ? "bg-primary text-white rounded-tr-none shadow-lg shadow-primary/20"
                      : "bg-secondary text-foreground rounded-tl-none border border-border",
                  )}
                >
                  {m.role === "bot" ? (
                    <ReactMarkdown
                      components={{
                        ul: ({ children }) => (
                          <ul className="list-disc pl-5 my-3 space-y-2">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal pl-5 my-3 space-y-2">
                            {children}
                          </ol>
                        ),
                        p: ({ children }) => (
                          <p className="mb-3 last:mb-0">{children}</p>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-bold text-primary">
                            {children}
                          </strong>
                        ),
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                </div>
              </div>

              {m.role === "user" && (
                <div className="shrink-0 pt-1">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
                    <User size={20} className="text-primary" />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center border border-border shadow-md">
              <Bot size={20} className="text-primary" />
            </div>
            <div className="bg-secondary border border-border rounded-3xl rounded-tl-none p-5 flex items-center gap-3">
              <Loader2 size={18} className="animate-spin text-primary" />
              <span className="text-sm font-medium text-muted-foreground italic">
                Yanıt oluşturuluyor...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-6 md:px-20 bg-background/80 backdrop-blur-md border-t border-border shrink-0">
        <div className="max-w-5xl mx-auto relative group">
          <textarea
            className="w-full bg-card border-2 border-border focus:border-primary/50 rounded-4xl py-5 px-8 pr-32 text-[15px] placeholder:text-muted-foreground/50 ring-0 focus:ring-4 focus:ring-primary/5 transition-all outline-none resize-none shadow-xl shadow-black/5 min-h-[72px] max-h-48"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Teşvik mevzuatında arayın (Ör: Vergi İndirimi oranları)..."
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 h-12 px-6 rounded-2xl font-bold text-sm tracking-widest flex items-center gap-2 transition-all active:scale-95",
              input.trim() && !loading
                ? "bg-primary text-white shadow-lg shadow-primary/30 hover:opacity-90"
                : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed",
            )}
          >
            <Send size={18} />
            SOR
          </button>
        </div>

        <div className="flex items-center justify-center gap-4 mt-4 opacity-40">
          <span className="text-[10px] font-bold tracking-widest uppercase">
            GEMINI 1.5 PRO (REASONING)
          </span>
          <span className="w-1 h-1 rounded-full bg-foreground" />
          <span className="text-[10px] font-bold tracking-widest uppercase">
            FLASH (INGESTION)
          </span>
          <span className="w-1 h-1 rounded-full bg-foreground" />
          <span className="text-[10px] font-bold tracking-widest uppercase">
            LEGAL PARSING
          </span>
        </div>
      </div>
    </div>
  );
}
