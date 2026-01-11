
import { NextResponse } from "next/server";
import { getActiveModel, setActiveModel } from "@/lib/utils/settings";

export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth/next";
import { neon } from "@neondatabase/serverless";

// Helper to check if user is admin
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

        const sql = neon(process.env.DATABASE_URL!);

        // Fetch users
        const users = await sql`SELECT id, name, email, role, image, created_at, last_seen_at FROM users ORDER BY created_at DESC`;

        // Fetch feedback with user info
        const feedbacks = await sql`
      SELECT f.id, f.message, f.status, f.created_at, u.name, u.email 
      FROM feedback f
      JOIN users u ON f.user_id = u.id
      ORDER BY f.created_at DESC
    `;

        // Fetch some basic stats (count of documents from RAG table)
        const docCountResult = await sql`SELECT COUNT(DISTINCT(metadata->>'source')) as count FROM rag_documents`;
        const chunkCountResult = await sql`SELECT COUNT(*) as count FROM rag_documents`;
        const activeUsersCountResult = await sql`SELECT COUNT(*) as count FROM users WHERE last_seen_at > NOW() - INTERVAL '5 minutes'`;

        const totalChunks = parseInt(chunkCountResult[0].count);
        let totalDocs = parseInt(docCountResult[0].count);
        const activeUsers = parseInt(activeUsersCountResult[0].count);

        // Fallback: If we have chunks but 0 distinct sources (pre-metadata update), count it as 1 doc
        if (totalChunks > 0 && totalDocs === 0) {
            totalDocs = 1;
        }

        const activeModel = await getActiveModel();
        const activeAesthetic = await import("@/lib/utils/settings").then(m => m.getActiveAesthetic());

        return NextResponse.json({
            users,
            feedbacks,
            settings: {
                activeModel,
                aesthetic: activeAesthetic
            },
            stats: {
                totalDocs,
                totalChunks,
                totalUsers: users.length,
                totalFeedback: feedbacks.length,
                activeUsers
            }
        });
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const session = await getServerSession();
        if (!session || !session.user?.email || !(await isAdmin(session.user.email))) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { userId, role, type, key, value } = await req.json();
        const sql = neon(process.env.DATABASE_URL!);

        if (type === "setting") {
            if (!key || !value) return NextResponse.json({ error: "Missing data" }, { status: 400 });
            if (key === "active_model") {
                await setActiveModel(value);
            } else if (key === "aesthetic") {
                const { setActiveAesthetic } = await import("@/lib/utils/settings");
                await setActiveAesthetic(value);
            }
            return NextResponse.json({ success: true });
        }

        if (!userId || !role) {
            return NextResponse.json({ error: "Missing data" }, { status: 400 });
        }

        await sql`UPDATE users SET role = ${role} WHERE id = ${userId}`;

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
    }
}
