"use client";

import React, { useEffect, useState } from "react";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";

export function CaptchaProvider({ children }: { children: React.ReactNode }) {
  const [siteKey, setSiteKey] = useState<string | null>(
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() || null,
  );
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (siteKey) {
      setChecked(true);
      return;
    }

    let cancelled = false;
    fetch("/api/recaptcha-site-key")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { siteKey?: string } | null) => {
        if (cancelled) {
          return;
        }
        const key = data?.siteKey?.trim();
        if (key) {
          setSiteKey(key);
        }
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) {
          setChecked(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [siteKey]);

  useEffect(() => {
    if (checked && !siteKey) {
      console.error(
        "Critical Error: NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not defined in your environment. reCAPTCHA will not work.",
      );
    }
  }, [checked, siteKey]);

  if (!siteKey) {
    return <>{children}</>;
  }

  return (
    <GoogleReCaptchaProvider reCaptchaKey={siteKey}>
      {children}
    </GoogleReCaptchaProvider>
  );
}
