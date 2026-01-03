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
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { signIn, signOut, useSession } from "next-auth/react";

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const { data: session, status } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";

  return (
    <nav className="h-12 border-b border-border bg-background/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-[100] transition-colors duration-300">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
            <span className="font-bold text-xs">T</span>
          </div>
          <span className="font-bold text-sm tracking-tight hidden sm:inline-block">
            TESVİKSOR AI
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-4">
          <Link
            href="/chat"
            className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <MessageSquare size={14} />
            CHAT
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Theme Switcher Mini */}
        <div className="flex items-center bg-secondary/50 rounded-lg p-0.5 border border-border">
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

        <div className="h-4 w-[1px] bg-border mx-1" />

        {/* Auth / Inventory */}
        {status === "authenticated" ? (
          <div className="flex items-center gap-4">
            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 text-[10px] font-bold text-primary hover:opacity-80 transition-opacity uppercase tracking-wider"
              >
                <Package size={14} />
                INVENTORY
              </Link>
            )}
            <Link
              href="/profile"
              className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider"
            >
              <User size={14} />
              PROFILE
            </Link>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1.5 text-[10px] font-bold text-destructive hover:opacity-80 transition-opacity uppercase tracking-wider"
            >
              <LogOut size={14} />
              EXIT
            </button>
          </div>
        ) : (
          <button
            onClick={() => signIn("google")}
            className="flex items-center gap-2 bg-primary text-white text-[10px] font-bold px-3 py-1.5 rounded-lg hover:opacity-90 shadow-lg shadow-primary/20 transition-all active:scale-95"
          >
            <LogIn size={13} />
            LOGIN WITH GOOGLE
          </button>
        )}
      </div>
    </nav>
  );
}
