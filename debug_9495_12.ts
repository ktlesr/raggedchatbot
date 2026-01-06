
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

async function check9495Madde12() {
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`SELECT content, metadata->>'konu' as konu FROM rag_documents WHERE id = '2016-9495_Proje_Bazli.pdf_madde_12'`;
    if (rows.length > 0) {
        console.log(`Konu: ${rows[0].konu}`);
        console.log("Content:");
        console.log(rows[0].content);
    } else {
        console.log("Not found.");
    }
}

check9495Madde12();
