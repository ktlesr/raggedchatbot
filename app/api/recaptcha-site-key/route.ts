import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
  const envLogs: Record<string, string> = {};

  // List all env keys for debugging (values obscured)
  Object.keys(process.env).forEach(key => {
    if (key.includes("RECAPTCHA") || key.includes("NEXT_PUBLIC_RECAPTCHA")) {
      const val = process.env[key] || "";
      envLogs[key] = val ? `${val.substring(0, 4)}... (${val.length} chars)` : "EMPTY";
    }
  });

  const envKey = process.env.RECAPTCHA_SITE_KEY;
  const legacyKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const siteKey = (envKey || legacyKey || "")?.trim();

  console.log("DIAGNOSTICS reCAPTCHA API:", {
    foundKeys: Object.keys(envLogs),
    resolvedKeyPrefix: siteKey ? siteKey.substring(0, 4) : "NONE"
  });

  return NextResponse.json({
    siteKey,
    diagnostics: envLogs
  });
}
