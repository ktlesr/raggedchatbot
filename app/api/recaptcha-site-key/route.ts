import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const siteKey = (process.env.RECAPTCHA_SITE_KEY || process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "")?.trim();
  return NextResponse.json({ siteKey });
}
