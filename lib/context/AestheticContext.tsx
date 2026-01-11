"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Aesthetic = "default" | "regulatory";

interface AestheticContextType {
  aesthetic: Aesthetic;
  setAesthetic: (aesthetic: Aesthetic) => void;
}

const AestheticContext = createContext<AestheticContextType | undefined>(
  undefined,
);

export function AestheticProvider({ children }: { children: React.ReactNode }) {
  const [aesthetic, setAesthetic] = useState<Aesthetic>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aesthetic") as Aesthetic;
      if (saved && (saved === "default" || saved === "regulatory")) {
        return saved;
      }
    }
    return "default";
  });

  useEffect(() => {
    // Sync with server on mount for global consistency
    const fetchGlobalAesthetic = async () => {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (
          data.aesthetic &&
          (data.aesthetic === "default" || data.aesthetic === "regulatory")
        ) {
          setAesthetic(data.aesthetic);
        }
      } catch (e) {
        console.error("Failed to sync aesthetic:", e);
      }
    };
    fetchGlobalAesthetic();
  }, []);

  useEffect(() => {
    localStorage.setItem("aesthetic", aesthetic);
    if (aesthetic === "regulatory") {
      document.documentElement.classList.add("aesthetic-regulatory");
    } else {
      document.documentElement.classList.remove("aesthetic-regulatory");
    }
  }, [aesthetic]);

  return (
    <AestheticContext.Provider value={{ aesthetic, setAesthetic }}>
      {children}
    </AestheticContext.Provider>
  );
}

export function useAesthetic() {
  const context = useContext(AestheticContext);
  if (context === undefined) {
    throw new Error("useAesthetic must be used within an AestheticProvider");
  }
  return context;
}
