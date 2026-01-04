import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
  // Use a completely dynamic way to access process.env 
  // to avoid Next.js's build-time inlining of NEXT_PUBLIC_ variables.
  const envKey = process.env["RECAPTCHA_SITE_KEY"];
  const legacyKey = process.env["NEXT_PUBLIC_RECAPTCHA_SITE_KEY"];

  // LOGS FOR YOU TO SEE IN DOKPLOY LOGS:
  console.log("RECAPTCHA KEY FETCH ATTEMPT:", {
    has_REC_SITE: !!envKey,
    has_NP_REC_SITE: !!legacyKey
  });

  let siteKey = "";

  // Priority 1: RECAPTCHA_SITE_KEY (Runtime Env - Best for production)
  if (envKey && envKey.trim().length > 10) {
    siteKey = envKey.trim();
  }
  // Priority 2: NEXT_PUBLIC_RECAPTCHA_SITE_KEY (Build/Mixed Env)
  else if (legacyKey && legacyKey.trim().length > 10) {
    siteKey = legacyKey.trim();
  }

  return NextResponse.json({
    siteKey,
    isReady: !!siteKey
  });
}
