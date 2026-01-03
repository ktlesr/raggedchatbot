
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { token } = await req.json();
        const secretKey = process.env.RECAPTCHA_SECRET_KEY;

        if (!token) {
            return NextResponse.json({ success: false, error: "Token missing" }, { status: 400 });
        }

        // Verify token with Google
        const response = await fetch(`https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`, {
            method: "POST",
        });

        const data = await response.json();

        if (data.success && data.score >= 0.5) {
            return NextResponse.json({ success: true, score: data.score });
        } else {
            return NextResponse.json({ success: false, error: "Captcha verification failed", details: data }, { status: 400 });
        }
    } catch (err) {
        return NextResponse.json({ success: false, error: "Verification error" }, { status: 500 });
    }
}
