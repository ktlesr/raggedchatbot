
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

async function migrate() {
    const sql = neon(process.env.DATABASE_URL!);
    console.log("Adding last_seen_at column...");
    try {
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`;
        console.log("Column last_seen_at added successfully.");
    } catch (error) {
        console.error("Migration failed:", error);
    }
}

migrate();
