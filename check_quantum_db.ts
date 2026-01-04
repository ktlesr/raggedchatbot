
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkQuantumChunk() {
    const sql = neon(process.env.DATABASE_URL!);
    const results = await sql`
        SELECT id, content 
        FROM rag_documents 
        WHERE id ILIKE '%HIT30.pdf_madde_HIT-%Quantum%'
        LIMIT 1;
    `;
    console.log("HIT-Quantum Chunk Found:", results.length > 0);
    if (results[0]) {
        console.log(results[0].content);
    }
}
checkQuantumChunk();
