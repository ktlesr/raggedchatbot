"use client";

import React, { useEffect, useMemo, useState } from "react";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";

const RecaptchaReadyContext = React.createContext(false);

export function useRecaptchaReady() {
  return React.useContext(RecaptchaReadyContext);
}

export function CaptchaProvider({ children }: { children: React.ReactNode }) {
  // Use a placeholder initially to avoid build-time issues
  const [siteKey, setSiteKey] = useState<string>("missing-site-key");
  const [checked, setChecked] = useState(false);

  // A key is ready if it's been updated and isn't the placeholder
  const isReady = useMemo(() => {
    return siteKey !== "missing-site-key" && siteKey.length > 5;
  }, [siteKey]);

  useEffect(() => {
    // Initial check for inlined env variable
    const inlinedKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();
    if (inlinedKey && inlinedKey.length > 5) {
      setSiteKey(inlinedKey);
      setChecked(true);
      return;
    }

    let cancelled = false;
    console.log("Fetching reCAPTCHA site key from dynamic API...");

    fetch("/api/recaptcha-site-key")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { siteKey?: string; diagnostics?: any } | null) => {
        if (cancelled) return;

        const key = data?.siteKey?.trim();
        if (key && key.length > 5) {
          console.log("reCAPTCHA key successfully loaded from API.");
          setSiteKey(key);
        } else {
          console.warn(
            "API did not return a valid siteKey. Diagnostics:",
            data?.diagnostics,
          );
        }
      })
      .catch((err) => console.error("Could not fetch reCAPTCHA key:", err))
      .finally(() => {
        if (!cancelled) {
          setChecked(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (checked && !isReady && typeof window !== "undefined") {
      console.error(
        "reCAPTCHA Error: No valid site key found. Please check your Dokploy Environment Variables (RECAPTCHA_SITE_KEY).",
      );
    }
  }, [checked, isReady]);

  return (
    <RecaptchaReadyContext.Provider value={isReady}>
      {/* We only render the provider with the key if we have it, otherwise we use a dummy 
          to keep the context alive but unusable until fixed. */}
      <GoogleReCaptchaProvider
        reCaptchaKey={
          isReady ? siteKey : "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
        }
      >
        {children}
      </GoogleReCaptchaProvider>
    </RecaptchaReadyContext.Provider>
  );
}
