"use client";

import React, { useEffect, useMemo, useState } from "react";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";

const RecaptchaReadyContext = React.createContext(false);

export function useRecaptchaReady() {
  return React.useContext(RecaptchaReadyContext);
}

export function CaptchaProvider({ children }: { children: React.ReactNode }) {
  const [siteKey, setSiteKey] = useState<string>("");
  const [checked, setChecked] = useState(false);

  const isReady = useMemo(() => {
    return siteKey.length > 10 && siteKey !== "missing-site-key";
  }, [siteKey]);

  useEffect(() => {
    let cancelled = false;

    const loadKey = async () => {
      try {
        console.log("reCAPTCHA anahtarı sunucudan isteniyor...");
        const res = await fetch("/api/recaptcha-site-key");
        const data = await res.json();

        if (!cancelled && data.siteKey) {
          console.log("reCAPTCHA anahtarı başarıyla alındı.");
          setSiteKey(data.siteKey);
        } else {
          console.error(
            "Sunucu anahtar dönmedi! Lütfen Dokploy'da RECAPTCHA_SITE_KEY tanımlayın.",
          );
        }
      } catch (err) {
        console.error("Anahtar çekilirken hata oluştu:", err);
      } finally {
        if (!cancelled) setChecked(true);
      }
    };

    loadKey();
    return () => {
      cancelled = true;
    };
  }, []);

  // Show a loading or empty state until we've checked the key
  if (!checked) return <>{children}</>;

  // If we don't have a valid key, render children but mark context as not ready
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
