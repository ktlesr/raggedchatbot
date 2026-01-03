"use client";

import React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  Sun,
  Moon,
  Monitor,
  LogIn,
  LogOut,
  Package,
  User,
  MessageSquare,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { signOut, useSession } from "next-auth/react";
import { Session } from "next-auth";

// Define a custom interface for the session user to include the 'role' property
interface CustomSessionUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string; // Add the role property
}

// Extend the default Session interface
interface CustomSession extends Session {
  user?: CustomSessionUser;
  expires: string;
}

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  // Use the custom session type
  const { data: session, status } = useSession() as {
    data: CustomSession | null;
    status: "loading" | "authenticated" | "unauthenticated";
  };
  const isAdmin = session?.user?.role === "admin";

  return (
    <nav className="h-16 border-b border-border bg-background/80 backdrop-blur-md px-4 md:px-6 flex items-center justify-between sticky top-0 z-100 transition-colors duration-300">
      <div className="flex items-center gap-3">
        {/* Mobile Menu Button - Hidden on Desktop */}
        <button
          className="p-2 -ml-2 hover:bg-secondary rounded-lg md:hidden"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("toggle-sidebar"))
          }
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
            <Bot size={22} />
          </div>
          <span className="font-bold text-lg md:text-xl tracking-tight text-foreground">
            TESVİKSOR AI
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-4 ml-2">
          <Link
            href="/chat"
            className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <MessageSquare size={14} />
            CHAT
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Theme Switcher Mini - Hidden on Mobile */}
        <div className="hidden md:flex items-center bg-secondary/50 rounded-lg p-0.5 border border-border">
          <button
            onClick={() => setTheme("light")}
            className={cn(
              "p-1 rounded-md transition-all",
              theme === "light"
                ? "bg-card shadow-sm text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="Light Mode"
          >
            <Sun size={14} />
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={cn(
              "p-1 rounded-md transition-all",
              theme === "dark"
                ? "bg-card shadow-sm text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="Dark Mode"
          >
            <Moon size={14} />
          </button>
          <button
            onClick={() => setTheme("system")}
            className={cn(
              "p-1 rounded-md transition-all",
              theme === "system"
                ? "bg-card shadow-sm text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="System Mode"
          >
            <Monitor size={14} />
          </button>
        </div>

        <div className="hidden md:block h-4 w-px bg-border mx-1" />

        {/* Auth / Inventory */}
        {status === "authenticated" ? (
          <div className="flex items-center gap-2 md:gap-4">
            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 text-[10px] font-bold text-primary hover:opacity-80 transition-opacity uppercase tracking-wider"
              >
                <Package size={14} />
                <span className="hidden sm:inline">INVENTORY</span>
              </Link>
            )}
            <Link
              href="/profile"
              className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider"
            >
              <User size={14} />
              <span className="hidden sm:inline">PROFILE</span>
            </Link>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1.5 text-[10px] font-bold text-destructive hover:opacity-80 transition-opacity uppercase tracking-wider"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">EXIT</span>
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-2 bg-primary text-white text-[10px] font-bold px-3 py-2 rounded-lg hover:opacity-90 shadow-lg shadow-primary/20 transition-all active:scale-95 whitespace-nowrap"
          >
            <LogIn size={13} />
            <span className="md:hidden">GİRİŞ</span>
            <span className="hidden md:inline">LOGIN / ÜYE OL</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
