"use client";

import React from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { SessionProvider } from "@/lib/context/SessionContext";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-hidden relative flex flex-col">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
