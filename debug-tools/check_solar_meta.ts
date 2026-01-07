
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkSolarMeta() {
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`SELECT id, metadata, content FROM rag_documents WHERE id LIKE '%Solar%'`;
    rows.forEach(r => {
        console.log(`\n--- ID: ${r.id} ---`);
        console.log(`Metadata: ${JSON.stringify(r.metadata)}`);
        console.log(`Content (subset):\n${r.content.substring(0, 300)}...`);
    });
}

checkSolarMeta();
