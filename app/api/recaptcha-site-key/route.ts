import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
  // Use a more dynamic way to access env to prevent build-time inlining
  const allEnv = process.env as Record<string, string>;

  const envKey = allEnv["RECAPTCHA_SITE_KEY"];
  const legacyKey = allEnv["NEXT_PUBLIC_RECAPTCHA_SITE_KEY"];

  // Choose the best available key
  let siteKey = "";
  if (envKey && envKey.trim().startsWith("6L")) {
    siteKey = envKey.trim();
  } else if (legacyKey && legacyKey.trim().startsWith("6L")) {
    siteKey = legacyKey.trim();
  }

  // Diagnostics for debugging (redacted)
  const diagnostics: Record<string, string> = {};
  Object.keys(allEnv).forEach(k => {
    if (k.includes("RECAPTCHA")) {
      const v = allEnv[k] || "";
      diagnostics[k] = v ? `${v.substring(0, 4)}... (${v.length} chars)` : "EMPTY";
    }
  });

  return NextResponse.json({
    siteKey,
    isReady: !!siteKey,
    diagnostics
  });
}
