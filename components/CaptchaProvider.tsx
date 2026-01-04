"use client";

import React, { useEffect, useMemo, useState } from "react";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";

const RecaptchaReadyContext = React.createContext(false);

export function useRecaptchaReady() {
  return React.useContext(RecaptchaReadyContext);
}

export function CaptchaProvider({ children }: { children: React.ReactNode }) {
  const [siteKey, setSiteKey] = useState<string>("missing-site-key");
  const [checked, setChecked] = useState(false);

  const isReady = useMemo(() => {
    return siteKey !== "missing-site-key" && siteKey.length > 5;
  }, [siteKey]);

  useEffect(() => {
    // 1. Try to use build-time env if available
    const inlinedKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();
    if (inlinedKey && inlinedKey.length > 5) {
      setSiteKey(inlinedKey);
      setChecked(true);
      return;
    }

    // 2. Fallback to runtime API
    let cancelled = false;
    fetch("/api/recaptcha-site-key")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { siteKey?: string; diagnostics?: string[] } | null) => {
        if (cancelled) return;

        const key = data?.siteKey?.trim();
        if (key && key.length > 5) {
          setSiteKey(key);
        } else {
          console.warn(
            "reCAPTCHA Key missing in runtime too. Server-side keys found:",
            data?.diagnostics,
          );
        }
      })
      .catch((err) => console.error("API Error fetching recaptcha key:", err))
      .finally(() => {
        if (!cancelled) setChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Show nothing until we checked
  if (!checked) return <>{children}</>;

  // If we have a key, use it. If not, render children without provider
  // (which will trigger our friendly 'loading...' error in LoganPage instead of a Google error)
  if (!isReady) {
    return (
      <RecaptchaReadyContext.Provider value={false}>
        {children}
      </RecaptchaReadyContext.Provider>
    );
  }

  return (
    <RecaptchaReadyContext.Provider value={true}>
      <GoogleReCaptchaProvider reCaptchaKey={siteKey}>
        {children}
      </GoogleReCaptchaProvider>
    </RecaptchaReadyContext.Provider>
  );
}
