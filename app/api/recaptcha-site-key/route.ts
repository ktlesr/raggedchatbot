import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
  // Use a non-prefixed variable name to bypass Next.js build-time inlining.
  // This variable MUST be set in Dokploy environment settings.
  const siteKey = (process.env.RECAPTCHA_SITE_KEY || "").trim();

  // Debug logs for server side (visible in Dokploy logs)
  console.log("Dinamik reCAPTCHA sorgusu yapıldı. Anahtar durumu:", siteKey ? "BULUNDU" : "YOK");

  return NextResponse.json({
    siteKey,
    success: siteKey.length > 10
  });
}
