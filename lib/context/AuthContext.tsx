"use client";

import React from "react";
import { SessionProvider } from "next-auth/react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

// Fallback for current imports while migrating
export function useAuth() {
  // This will be replaced by useSession() where needed
  return {
    isAuthenticated: false, // Dummy
    login: () => false,
    logout: () => {},
  };
}
