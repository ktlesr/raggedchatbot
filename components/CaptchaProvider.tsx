"use client";

import React from "react";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";

export function CaptchaProvider({ children }: { children: React.ReactNode }) {
  // Using a dummy site key if not provided, user needs to set this in .env
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "dummy-key";

  return (
    <GoogleReCaptchaProvider reCaptchaKey={siteKey}>
      {children}
    </GoogleReCaptchaProvider>
  );
}
