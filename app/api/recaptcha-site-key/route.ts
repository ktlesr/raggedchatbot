import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
  const allEnv = process.env as Record<string, string>;

  // Try different variations to find the key in runtime environment
  const siteKey = (
    allEnv["RECAPTCHA_SITE_KEY"] ||
    allEnv["NEXT_PUBLIC_RECAPTCHA_SITE_KEY"] ||
    ""
  ).trim();

  // Diagnostics: Log all keys containing 'RECAPTCHA' (redacted values)
  const availableKeys = Object.keys(allEnv)
    .filter(k => k.toLowerCase().includes("recaptcha"))
    .map(k => `${k}: ${allEnv[k] ? allEnv[k].substring(0, 4) + '...' : 'EMPTY'}`);

  console.log("Runtime reCAPTCHA Key Check:", {
    hasKey: siteKey.length > 5,
    keysFound: availableKeys
  });

  return NextResponse.json({
    siteKey,
    isReady: siteKey.length > 5,
    diagnostics: availableKeys
  });
}
