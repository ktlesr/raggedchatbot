
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function GET() {
    try {
        const sql = neon(process.env.DATABASE_URL!);

        // Define "active" as seen in the last 5 minutes
        const activeWindowMinutes = 5;

        const activeUsers = await sql`
            SELECT id, name, email, last_seen_at, image
            FROM users
            WHERE last_seen_at > NOW() - INTERVAL '5 minutes'
            ORDER BY last_seen_at DESC
        `;

        return NextResponse.json({
            count: activeUsers.length,
            users: activeUsers,
            windowMinutes: activeWindowMinutes
        });
    } catch (error) {
        console.error("Active users query error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
