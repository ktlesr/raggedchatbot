"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

interface Message {
  role: "user" | "bot";
  content: string;
}

interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

interface SessionContextType {
  sessions: Session[];
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  createSession: (title?: string) => string;
  addMessage: (sessionId: string, message: Message) => void;
  updateLastMessage: (sessionId: string, content: string) => void;
  deleteSession: (id: string) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rag_sessions");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse sessions", e);
        }
      }
    }
    return [];
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rag_sessions");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.length > 0) return parsed[0].id;
        } catch (e) {}
      }
    }
    return null;
  });

  // Use a ref for isLoaded to avoid cascading renders
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // This is fine as it only runs once on mount
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("rag_sessions", JSON.stringify(sessions));
    }
  }, [sessions, isLoaded]);

  const createSession = useCallback((title = "Yeni Sohbet") => {
    const newId = Date.now().toString();
    const newSession: Session = {
      id: newId,
      title,
      messages: [
        {
          role: "bot",
          content:
            "Merhaba! Yatırım Teşvik Mevzuatı hakkında sorularınızı cevaplamaya hazırım. Size nasıl yardımcı olabilirim?",
        },
      ],
      createdAt: Date.now(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
    return newId;
  }, []);

  const addMessage = useCallback((sessionId: string, message: Message) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === sessionId) {
          let newTitle = s.title;
          if (s.messages.length === 1 && message.role === "user") {
            newTitle =
              message.content.substring(0, 30) +
              (message.content.length > 30 ? "..." : "");
          }
          return { ...s, title: newTitle, messages: [...s.messages, message] };
        }
        return s;
      }),
    );
  }, []);

  const updateLastMessage = useCallback(
    (sessionId: string, content: string) => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === sessionId) {
            const newMessages = [...s.messages];
            if (newMessages.length > 0) {
              newMessages[newMessages.length - 1] = {
                ...newMessages[newMessages.length - 1],
                content,
              };
            }
            return { ...s, messages: newMessages };
          }
          return s;
        }),
      );
    },
    [],
  );

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setActiveSessionId((prev) => (prev === id ? null : prev));
  }, []);

  if (!isLoaded) return null;

  return (
    <SessionContext.Provider
      value={{
        sessions,
        activeSessionId,
        setActiveSessionId,
        createSession,
        addMessage,
        updateLastMessage,
        deleteSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSessions() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSessions must be used within a SessionProvider");
  }
  return context;
}
