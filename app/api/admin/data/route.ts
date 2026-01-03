
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth/next";
import { neon } from "@neondatabase/serverless";

// Helper to check if user is admin
async function isAdmin(email: string) {
    const sql = neon(process.env.DATABASE_URL!);
    const result = await sql`SELECT role FROM users WHERE email = ${email} LIMIT 1`;
    return result.length > 0 && result[0].role === "admin";
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession();
        if (!session || !session.user?.email || !(await isAdmin(session.user.email))) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const sql = neon(process.env.DATABASE_URL!);

        // Fetch users
        const users = await sql`SELECT id, name, email, role, image, created_at FROM users ORDER BY created_at DESC`;

        // Fetch feedback with user info
        const feedbacks = await sql`
      SELECT f.id, f.message, f.status, f.created_at, u.name, u.email 
      FROM feedback f
      JOIN users u ON f.user_id = u.id
      ORDER BY f.created_at DESC
    `;

        // Fetch some basic stats (count of documents from RAG table)
        const docStats = await sql`SELECT COUNT(DISTINCT(metadata->>'source')) as count FROM rag_documents`;
        const chunkStats = await sql`SELECT COUNT(*) as count FROM rag_documents`;

        return NextResponse.json({
            users,
            feedbacks,
            stats: {
                totalDocs: docStats[0].count,
                totalChunks: chunkStats[0].count,
                totalUsers: users.length,
                totalFeedback: feedbacks.length
            }
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const session = await getServerSession();
        if (!session || !session.user?.email || !(await isAdmin(session.user.email))) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { userId, role } = await req.json();
        if (!userId || !role) {
            return NextResponse.json({ error: "Missing data" }, { status: 400 });
        }

        const sql = neon(process.env.DATABASE_URL!);
        await sql`UPDATE users SET role = ${role} WHERE id = ${userId}`;

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
