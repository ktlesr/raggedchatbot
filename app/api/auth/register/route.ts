
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
    try {
        const { name, email, password, captchaToken } = await req.json();

        if (!email || !password || !name) {
            return NextResponse.json({ error: "Eksik bilgi" }, { status: 400 });
        }

        // reCAPTCHA verification
        const secretKey = process.env.RECAPTCHA_SECRET_KEY;
        const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${captchaToken}`;
        const captchaRes = await fetch(verifyUrl, { method: "POST" });
        const captchaData = await captchaRes.json();

        if (!captchaData.success || captchaData.score < 0.5) {
            return NextResponse.json({ error: "reCAPTCHA doğrulaması başarısız" }, { status: 400 });
        }

        const sql = neon(process.env.DATABASE_URL!);

        // Check if user exists
        const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
        if (existing.length > 0) {
            return NextResponse.json({ error: "Bu email zaten kayıtlı" }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = Date.now().toString();

        await sql`
      INSERT INTO users (id, name, email, password, role)
      VALUES (${userId}, ${name}, ${email}, ${hashedPassword}, 'user')
    `;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Register Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
