
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { neon } from "@neondatabase/serverless";

export async function POST() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user || !session.user.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const sql = neon(process.env.DATABASE_URL!);
        await sql`
            UPDATE users 
            SET last_seen_at = CURRENT_TIMESTAMP 
            WHERE email = ${session.user.email}
        `;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Heartbeat error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
