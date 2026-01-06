
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

async function check9903() {
    const sql = neon(process.env.DATABASE_URL!);
    console.log("Checking for 9903 Karar Madde 21 and Yatırım yeri tahsisi...");

    const rows = await sql`
        SELECT id, metadata->>'source' as source, content 
        FROM rag_documents 
        WHERE (metadata->>'source' ILIKE '%9903%' AND content ILIKE '%Madde 21%')
           OR (metadata->>'source' ILIKE '%9903%' AND (content ILIKE '%Yatırım yeri tahsisi%' OR content ILIKE '%Yatırım yeri tahsisine%'))
        LIMIT 10
    `;

    console.log(`Found ${rows.length} matches.`);
    rows.forEach(r => {
        console.log(`--- ID: ${r.id} | Source: ${r.source} ---`);
        console.log(`Content Snippet: ${r.content.substring(0, 300)}...`);
    });
}

check9903();
