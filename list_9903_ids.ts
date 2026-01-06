
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

async function listIds() {
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`SELECT id FROM rag_documents WHERE id ILIKE '%9903%' ORDER BY id ASC`;
    console.log("IDs for 9903:");
    rows.forEach(r => console.log(r.id));
}

listIds();
