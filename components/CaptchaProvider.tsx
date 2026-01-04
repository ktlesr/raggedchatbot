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
    // Priority 1: Check if Next.js already has the key inlined
    const inlinedKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();
    if (inlinedKey && inlinedKey.length > 10) {
      console.log("reCAPTCHA key detected from build-time environment.");
      setSiteKey(inlinedKey);
      setChecked(true);
      return;
    }

    // Priority 2: Fetch dynamically from server to bypass build-time inlining issues
    let cancelled = false;
    const fetchKey = async () => {
      try {
        const res = await fetch("/api/recaptcha-site-key");
        if (res.ok) {
          const data = await res.json();
          const key = data?.siteKey?.trim();
          if (!cancelled && key && key.length > 10) {
            console.log("reCAPTCHA key fetched successfully from dynamic API.");
            setSiteKey(key);
          } else if (!cancelled) {
            console.error(
              "No valid reCAPTCHA key found in dynamic API. Diagnostics:",
              data?.diagnostics,
            );
          }
        }
      } catch (err) {
        console.error("Failed to fetch reCAPTCHA key from API:", err);
      } finally {
        if (!cancelled) setChecked(true);
      }
    };

    fetchKey();
    return () => {
      cancelled = true;
    };
  }, []);

  // We ALWAYS render the GoogleReCaptchaProvider to prevent "Context not implemented" errors in hooks.
  // If the key isn't ready, we use a placeholder that will trigger a console warning
  // but let the app render so we can see the diagnostic logs.
  const finalKey = isReady
    ? siteKey
    : "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI";

  return (
    <RecaptchaReadyContext.Provider value={isReady}>
      <GoogleReCaptchaProvider reCaptchaKey={finalKey}>
        {children}
      </GoogleReCaptchaProvider>
    </RecaptchaReadyContext.Provider>
  );
}
