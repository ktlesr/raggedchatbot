"use client";

import React, { useEffect, useMemo, useState } from "react";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";

const RecaptchaReadyContext = React.createContext(false);

export function useRecaptchaReady() {
  return React.useContext(RecaptchaReadyContext);
}

export function CaptchaProvider({ children }: { children: React.ReactNode }) {
  const [siteKey, setSiteKey] = useState<string>(
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() || "missing-site-key",
  );
  const [checked, setChecked] = useState(false);

  // A key is only "ready" if it's not the placeholder and has a valid prefix (6L)
  const isReady = useMemo(() => {
    return (
      !!siteKey && siteKey !== "missing-site-key" && siteKey.startsWith("6L")
    );
  }, [siteKey]);

  useEffect(() => {
    if (isReady) {
      setChecked(true);
      return;
    }

    let cancelled = false;
    console.log("Fetching reCAPTCHA site key from API...");

    fetch("/api/recaptcha-site-key")
      .then((res) => {
        console.log("API response status:", res.status);
        return res.ok ? res.json() : null;
      })
      .then((data: { siteKey?: string; diagnostics?: any } | null) => {
        if (cancelled) return;

        console.log("API Diagnostics:", data?.diagnostics);
        const key = data?.siteKey?.trim();

        if (key && key.startsWith("6L")) {
          console.log(
            "Valid reCAPTCHA key found:",
            key.substring(0, 4) + "...",
          );
          setSiteKey(key);
        } else {
          console.warn("API returned invalid or empty siteKey:", key);
        }
      })
      .catch((err) => console.error("Fetch reCAPTCHA key error:", err))
      .finally(() => {
        if (!cancelled) {
          setChecked(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isReady]);

  useEffect(() => {
    if (checked && !isReady) {
      console.error(
        "Critical Error: NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not defined or invalid in your environment. reCAPTCHA will not work. Current value:",
        siteKey,
      );
    }
  }, [checked, isReady, siteKey]);

  return (
    <RecaptchaReadyContext.Provider value={isReady}>
      <GoogleReCaptchaProvider reCaptchaKey={isReady ? siteKey : "dummy-key"}>
        {children}
      </GoogleReCaptchaProvider>
    </RecaptchaReadyContext.Provider>
  );
}
