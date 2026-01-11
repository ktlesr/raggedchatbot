"use client";

import React from "react";
import {
  Plus,
  MessageSquare,
  Package,
  Monitor,
  Moon,
  Sun,
  Bot,
  Trash2,
  LogOut as LogOutIcon,
} from "lucide-react";
import { useSessions } from "@/lib/context/SessionContext";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils/cn";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function Sidebar() {
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
    deleteSession,
  } = useSessions();
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const pathname = usePathname();
  const router = useRouter();

  const [showSettings, setShowSettings] = React.useState(false);

  const handleNewSession = () => {
    createSession();
    if (pathname !== "/chat") router.push("/chat");
  };

  return (
    <div className="w-72 h-screen flex flex-col bg-card border-r border-border shrink-0 z-50 transition-colors duration-300">
      {/* New Session Button */}
      <div className="px-4 mb-6 mt-6">
        <button
          onClick={handleNewSession}
          className="w-full h-12 rounded-xl bg-slate-900 dark:bg-primary text-white dark:text-primary-foreground font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98] shadow-md"
        >
          <Plus size={16} />
          Yeni Sohbet
        </button>
      </div>

      {/* Recent Memory */}
      <div className="flex-1 overflow-y-auto px-4">
        <div className="mb-4">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2">
            Sohbet Geçmişi
          </span>
        </div>
        <div className="space-y-1">
          {sessions.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground bg-secondary/30 rounded-xl border border-dashed border-border text-center italic">
              Henüz geçmiş yok
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => {
                  setActiveSessionId(session.id);
                  if (pathname !== "/chat") router.push("/chat");
                }}
                className={cn(
                  "group relative w-full px-4 py-3 rounded-xl text-sm flex items-center gap-3 cursor-pointer transition-all",
                  activeSessionId === session.id
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent",
                )}
              >
                <div
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    activeSessionId === session.id
                      ? "bg-primary"
                      : "bg-muted-foreground/30",
                  )}
                />
                <span className="truncate flex-1 font-medium">
                  {session.title}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="p-4 space-y-2 border-t border-border mt-auto">
        <Link
          href="/chat"
          className={cn(
            "w-full h-11 px-4 rounded-xl flex items-center gap-3 font-medium transition-all shadow-sm",
            pathname === "/chat"
              ? "bg-primary text-primary-foreground text-center shadow-primary/20"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent",
          )}
        >
          <MessageSquare size={20} />
          Sohbete Git
        </Link>
        {isAdmin && (
          <Link
            href="/admin"
            className={cn(
              "w-full h-11 px-4 rounded-xl flex items-center gap-3 font-medium transition-all shadow-sm",
              pathname === "/admin"
                ? "bg-primary text-primary-foreground text-center shadow-primary/20"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent",
            )}
          >
            <Package size={20} />
            Admin Paneli
          </Link>
        )}
      </div>

      {/* User & Theme Footer */}
      <div className="p-4 bg-secondary/30 border-t border-border space-y-3">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={cn(
            "w-full flex items-center gap-3 p-2 rounded-xl bg-card border border-border transition-all hover:border-primary/50",
            showSettings && "border-primary shadow-md ring-2 ring-primary/10",
          )}
        >
          {session?.user?.image ? (
            <img
              src={session.user.image}
              alt={session.user.name || "User"}
              className="w-10 h-10 rounded-full object-cover border border-border"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shadow-inner uppercase">
              {session?.user?.name?.[0] || session?.user?.email?.[0] || "U"}
            </div>
          )}
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold truncate text-foreground">
              {session?.user?.name ||
                session?.user?.email?.split("@")[0] ||
                "Giriş Yapılmadı"}
            </p>
            <p className="text-[10px] text-emerald-500 font-bold tracking-tight uppercase">
              {(session?.user as any)?.role === "admin"
                ? "YÖNETİCİ"
                : "AKTİF KULLANICI"}
            </p>
          </div>
          <div
            className={cn(
              "transition-transform duration-300",
              showSettings ? "rotate-180" : "rotate-0",
            )}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </div>
        </button>

        {/* Expandable Settings Menu */}
        {showSettings && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Theme Switcher */}
            <div className="flex items-center justify-between gap-1 p-1 bg-card rounded-xl border border-border">
              <button
                onClick={() => setTheme("light")}
                className={cn(
                  "flex-1 flex items-center justify-center p-2 rounded-lg transition-all",
                  theme === "light"
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Aydınlık"
              >
                <Sun size={14} />
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex-1 flex items-center justify-center p-2 rounded-lg transition-all",
                  theme === "dark"
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Karanlık"
              >
                <Moon size={14} />
              </button>
              <button
                onClick={() => setTheme("system")}
                className={cn(
                  "flex-1 flex items-center justify-center p-2 rounded-lg transition-all",
                  theme === "system"
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Sistem"
              >
                <Monitor size={14} />
              </button>
            </div>

            <button
              onClick={() => {
                localStorage.removeItem("rag_sessions");
                signOut({ callbackUrl: "/login" });
              }}
              className="w-full flex items-center justify-center gap-2 p-2 rounded-xl bg-destructive/10 text-destructive text-xs font-bold hover:bg-destructive/20 transition-all uppercase tracking-widest border border-destructive/10"
            >
              <LogOutIcon size={14} />
              Oturumu Kapat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
