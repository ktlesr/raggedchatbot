
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

async function verify9495() {
    const sql = neon(process.env.DATABASE_URL!);
    console.log("Checking Madde 12 of 9495...");

    const rows = await sql`
        SELECT id, metadata->>'konu' as konu, content 
        FROM rag_documents 
        WHERE (id ILIKE '%9495%' AND id ILIKE '%madde_12%')
    `;

    rows.forEach(r => {
        console.log(`\n--- ID: ${r.id} | Konu: ${r.konu} ---`);
        console.log(r.content);
    });
}

verify9495();
