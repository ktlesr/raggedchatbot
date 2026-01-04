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
  const isReady = useMemo(() => siteKey !== "missing-site-key", [siteKey]);

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
      .then((data: { siteKey?: string } | null) => {
        if (cancelled) return;
        console.log("API data received:", data);
        const key = data?.siteKey?.trim();
        if (key) {
          console.log(
            "Updating siteKey state with:",
            key.substring(0, 4) + "...",
          );
          setSiteKey(key);
        } else {
          console.warn("API returned empty siteKey");
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
  }, [isReady, siteKey]);

  useEffect(() => {
    if (checked && siteKey === "missing-site-key") {
      console.error(
        "Critical Error: NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not defined in your environment. reCAPTCHA will not work.",
      );
    }
  }, [checked, siteKey]);

  return (
    <RecaptchaReadyContext.Provider value={isReady}>
      <GoogleReCaptchaProvider reCaptchaKey={siteKey}>
        {children}
      </GoogleReCaptchaProvider>
    </RecaptchaReadyContext.Provider>
  );
}
