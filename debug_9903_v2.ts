
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

async function check9903() {
    const sql = neon(process.env.DATABASE_URL!);
    console.log("Checking Madde 20 and 21 of 9903...");

    const rows = await sql`
        SELECT id, content 
        FROM rag_documents 
        WHERE (id ILIKE '%9903%' AND id ILIKE '%madde_20%')
           OR (id ILIKE '%9903%' AND id ILIKE '%madde_21%')
    `;

    rows.forEach(r => {
        console.log(`\n--- ID: ${r.id} ---`);
        console.log(r.content);
    });
}

check9903();
