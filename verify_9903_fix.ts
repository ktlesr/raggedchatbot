
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

async function verifyFix() {
    const sql = neon(process.env.DATABASE_URL!);
    console.log("Verifying Madde 21 and 22 segments in 9903...");

    const rows = await sql`
        SELECT id, metadata->>'konu' as konu, content 
        FROM rag_documents 
        WHERE (id = '9903_karar.pdf_madde_21')
           OR (id = '9903_karar.pdf_madde_22')
    `;

    rows.forEach(r => {
        console.log(`\n--- ID: ${r.id} | Konu: ${r.konu} ---`);
        console.log(r.content);
    });
}

verifyFix();
