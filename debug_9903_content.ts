
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

async function check9903Content() {
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`SELECT id, content FROM rag_documents WHERE id = '9903_karar.pdf_madde_21'`;
    if (rows.length > 0) {
        console.log(`ID: ${rows[0].id}`);
        console.log("--- CONTENT START ---");
        console.log(rows[0].content);
        console.log("--- CONTENT END ---");
    } else {
        console.log("Not found.");
    }
}

check9903Content();
