"use client";

import React from "react";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";

export function CaptchaProvider({
  children,
  siteKey,
}: {
  children: React.ReactNode;
  siteKey?: string;
}) {
  const finalSiteKey =
    siteKey || process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "dummy-key";

  return (
    <GoogleReCaptchaProvider reCaptchaKey={finalSiteKey}>
      {children}
    </GoogleReCaptchaProvider>
  );
}
