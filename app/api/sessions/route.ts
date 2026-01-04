
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { neon } from "@neondatabase/serverless";
// Use the handler's options or a common config if available. 
// For now, next-auth usually needs the same config. 
// Since I don't have a separate authConfig file, I'll just use the session directly.

export async function GET() {
    const session = await getServerSession();
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sql = neon(process.env.DATABASE_URL!);

    // Get user id first
    const users = await sql`SELECT id FROM users WHERE email = ${session.user.email} LIMIT 1`;
    if (users.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const userId = users[0].id;

    // Get conversations with messages
    const conversations = await sql`
        SELECT c.*, 
        (SELECT json_agg(m ORDER BY m.created_at) FROM messages m WHERE m.conversation_id = c.id) as messages
        FROM conversations c
        WHERE c.user_id = ${userId}
        ORDER BY c.updated_at DESC
    `;

    // Map to frontend format
    const formatted = conversations.map(c => ({
        id: c.id,
        title: c.title,
        messages: (c.messages || []).map((m: { role: "user" | "bot", content: string }) => ({
            role: m.role,
            content: m.content
        })),
        createdAt: new Date(c.created_at).getTime()
    }));

    return NextResponse.json(formatted);
}

export async function POST(req: NextRequest) {
    const session = await getServerSession();
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, title, messages } = await req.json();
    const sql = neon(process.env.DATABASE_URL!);

    const users = await sql`SELECT id FROM users WHERE email = ${session.user.email} LIMIT 1`;
    if (users.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const userId = users[0].id;

    // Upsert conversation
    await sql`
        INSERT INTO conversations (id, user_id, title, updated_at)
        VALUES (${id}, ${userId}, ${title}, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        updated_at = CURRENT_TIMESTAMP
    `;

    // For simplicity, we'll sync messages by deleting and re-inserting or just appending.
    // If it's a new session, we just insert.
    // In current frontend repo, updateLastMessage is used during streaming. 
    // To avoid too many DB calls, frontend could sync at certain points, 
    // but the most reliable is to have a "save message" endpoint.

    // However, if we want to sync the whole messages array at once:
    if (messages && messages.length > 0) {
        // Delete old messages for this conversation to keep it in sync
        await sql`DELETE FROM messages WHERE conversation_id = ${id}`;

        for (const msg of messages) {
            await sql`
                INSERT INTO messages (conversation_id, role, content)
                VALUES (${id}, ${msg.role}, ${msg.content})
            `;
        }
    }

    return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
    const session = await getServerSession();
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const sql = neon(process.env.DATABASE_URL!);

    const users = await sql`SELECT id FROM users WHERE email = ${session.user.email} LIMIT 1`;
    if (users.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const userId = users[0].id;

    // Ensure the conversation belongs to the user
    await sql`DELETE FROM conversations WHERE id = ${id} AND user_id = ${userId}`;

    return NextResponse.json({ success: true });
}
