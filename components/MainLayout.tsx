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
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  React.useEffect(() => {
    const handleToggle = () => setIsSidebarOpen((prev) => !prev);
    window.addEventListener("toggle-sidebar", handleToggle);
    return () => window.removeEventListener("toggle-sidebar", handleToggle);
  }, []);

  return (
    <SessionProvider>
      <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
        <Navbar />
        <div className="flex flex-1 overflow-hidden relative">
          {/* Overlay for mobile */}
          {isSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          <div
            className={`
            absolute md:relative z-50 h-full transition-transform duration-300 ease-in-out
            ${
              isSidebarOpen
                ? "translate-x-0"
                : "-translate-x-full md:translate-x-0"
            }
          `}
          >
            <Sidebar />
          </div>

          <main className="flex-1 overflow-hidden relative flex flex-col w-full">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
