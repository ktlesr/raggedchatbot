"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useSession } from "next-auth/react";

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
  syncSession: (sessionId: string) => void;
  deleteSession: (id: string) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const syncToDb = useCallback(
    async (session: Session) => {
      if (status !== "authenticated") return;
      try {
        await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(session),
        });
      } catch (e) {
        console.error("Failed to sync session to DB", e);
      }
    },
    [status],
  );

  // Load Initial Data
  useEffect(() => {
    const loadSessions = async () => {
      if (isAuthenticated) {
        try {
          const res = await fetch("/api/sessions");
          if (res.ok) {
            const data = await res.json();
            setSessions(data);
            if (data.length > 0) setActiveSessionId(data[0].id);
          }
        } catch (error) {
          console.error("Failed to fetch sessions", error);
        }
      } else {
        const saved = localStorage.getItem("rag_sessions");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setSessions(parsed);
            if (parsed.length > 0) setActiveSessionId(parsed[0].id);
          } catch (e) {}
        }
      }
      setIsLoaded(true);
    };

    loadSessions();
  }, [isAuthenticated]);

  // Local Storage Sync (Only for Anon)
  useEffect(() => {
    if (!isLoaded) return;
    if (!isAuthenticated) {
      localStorage.setItem("rag_sessions", JSON.stringify(sessions));
    } else {
      localStorage.removeItem("rag_sessions");
    }
  }, [sessions, isAuthenticated, isLoaded]);

  const createSession = useCallback(
    (title = "Yeni Sohbet") => {
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

      if (isAuthenticated) {
        syncToDb(newSession);
      }

      return newId;
    },
    [isAuthenticated, syncToDb],
  );

  const addMessage = useCallback(
    (sessionId: string, message: Message) => {
      setSessions((prev) => {
        const updated = prev.map((s) => {
          if (s.id === sessionId) {
            let newTitle = s.title;
            if (s.messages.length === 1 && message.role === "user") {
              newTitle =
                message.content.substring(0, 30) +
                (message.content.length > 30 ? "..." : "");
            }
            const updatedSession = {
              ...s,
              title: newTitle,
              messages: [...s.messages, message],
            };

            if (isAuthenticated) {
              syncToDb(updatedSession);
            }

            return updatedSession;
          }
          return s;
        });
        return updated;
      });
    },
    [isAuthenticated, syncToDb],
  );

  const updateLastMessage = useCallback(
    (sessionId: string, content: string) => {
      setSessions((prev) => {
        const updated = prev.map((s) => {
          if (s.id === sessionId) {
            const newMessages = [...s.messages];
            if (newMessages.length > 0) {
              newMessages[newMessages.length - 1] = {
                ...newMessages[newMessages.length - 1],
                content,
              };
            }
            const updatedSession = { ...s, messages: newMessages };

            // We only sync to DB on complete messages or after stream usually,
            // but for simplicity we sync here too (or skip until message end)
            // If streaming, this might be too frequent.
            // Let's only sync when content is not empty or at end.
            return updatedSession;
          }
          return s;
        });
        return updated;
      });
    },
    [],
  );

  // Sync back last message once bot finishes typing (custom logic)
  useEffect(() => {
    // In a real scenario, ChatInterface would call a final sync.
    // For now, we'll assume addMessage handles the user input sync,
    // and we might need an explicit sync for the bot's final answer.
  }, []);

  const syncSession = useCallback(
    async (sessionId: string) => {
      if (!isAuthenticated) return;
      // We need to get the latest session from the state
      setSessions((prev) => {
        const session = prev.find((s) => s.id === sessionId);
        if (session) {
          syncToDb(session);
        }
        return prev;
      });
    },
    [isAuthenticated, syncToDb],
  );

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setActiveSessionId((prev) => (prev === id ? null : prev));

      if (isAuthenticated) {
        fetch(`/api/sessions?id=${id}`, { method: "DELETE" }).catch(
          console.error,
        );
      }
    },
    [isAuthenticated],
  );

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
        syncSession,
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
