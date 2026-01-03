
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { neon } from "@neondatabase/serverless";
import { getGA4Stats } from "@/lib/analytics/ga4";

export const dynamic = 'force-dynamic';

async function isAdmin(email: string) {
    const sql = neon(process.env.DATABASE_URL!);
    const result = await sql`SELECT role FROM users WHERE email = ${email} LIMIT 1`;
    return result.length > 0 && result[0].role === "admin";
}

export async function GET() {
    try {
        const session = await getServerSession();
        if (!session || !session.user?.email || !(await isAdmin(session.user.email))) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const stats = await getGA4Stats();
        return NextResponse.json(stats);
    } catch (error: any) {
        console.error("GA4 Fetch Error:", error);
        return NextResponse.json({
            error: error.message,
            // Return empty structure if it fails due to missing envs
            realtimeUsers: 0,
            totalUsers: 0,
            avgDuration: 0,
            trend: []
        }, { status: 500 });
    }
}
