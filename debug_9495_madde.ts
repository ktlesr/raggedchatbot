
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

async function check9495() {
    const sql = neon(process.env.DATABASE_URL!);
    console.log("Checking Madde 12 of 9495...");

    const rows = await sql`
        SELECT id, content 
        FROM rag_documents 
        WHERE (id ILIKE '%9495%' AND id ILIKE '%madde_12%')
    `;

    rows.forEach(r => {
        console.log(`\n--- ID: ${r.id} ---`);
        console.log(r.content);
    });
}

check9495();
