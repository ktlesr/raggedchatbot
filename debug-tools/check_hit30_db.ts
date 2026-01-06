
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkHit30Chunks() {
    const sql = neon(process.env.DATABASE_URL!);
    const results = await sql`
        SELECT id, content 
        FROM rag_documents 
        WHERE id ILIKE '%HIT30.pdf_madde_HIT-Electric%'
        LIMIT 1;
    `;
    console.log("HIT-Electric Chunk:");
    console.log(results[0]?.content);
}
checkHit30Chunks();
