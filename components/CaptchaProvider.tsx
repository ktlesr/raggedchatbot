"use client";

import React from "react";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";

export function CaptchaProvider({ children }: { children: React.ReactNode }) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();

  if (!siteKey && typeof window !== "undefined") {
    console.error(
      "Critical Error: NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not defined in your environment. reCAPTCHA will not work.",
    );
  }

  return (
    <GoogleReCaptchaProvider reCaptchaKey={siteKey || "missing-site-key"}>
      {children}
    </GoogleReCaptchaProvider>
  );
}
