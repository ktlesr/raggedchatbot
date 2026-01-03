
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { token } = await req.json();
        const secretKey = process.env.RECAPTCHA_SECRET_KEY?.trim();

        if (!token) {
            return NextResponse.json({ success: false, error: "Token missing" }, { status: 400 });
        }

        // Verify token with Google
        const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                secret: secretKey || "",
                response: token,
            }).toString(),
        });

        const data = await verifyRes.json();

        if (data.success && data.score >= 0.5) {
            return NextResponse.json({ success: true, score: data.score });
        } else {
            console.error("reCAPTCHA Failure:", data);
            return NextResponse.json({
                success: false,
                error: "Captcha verification failed",
                details: data
            }, { status: 400 });
        }
    } catch {
        return NextResponse.json({ success: false, error: "Verification error" }, { status: 500 });
    }
}
