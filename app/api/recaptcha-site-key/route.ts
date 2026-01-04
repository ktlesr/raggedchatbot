import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
  const envKey = process.env.RECAPTCHA_SITE_KEY;
  const legacyKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const siteKey = (envKey || legacyKey || "")?.trim();

  console.log("DEBUG reCAPTCHA API:", {
    hasEnvKey: !!envKey,
    hasLegacyKey: !!legacyKey,
    keyPrefix: siteKey ? siteKey.substring(0, 4) : "NONE"
  });

  return NextResponse.json({ siteKey });
}
