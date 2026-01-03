
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth/next";
import { neon } from "@neondatabase/serverless";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session || !session.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { message } = await req.json();
        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        const sql = neon(process.env.DATABASE_URL!);

        // Get internal user ID
        const user = await sql`SELECT id FROM users WHERE email = ${session.user.email} LIMIT 1`;
        if (user.length === 0) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        await sql`
      INSERT INTO feedback (user_id, message)
      VALUES (${user[0].id}, ${message})
    `;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Feedback error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
