
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkNaceData() {
    const sql = neon(process.env.DATABASE_URL!);
    const nace = '28.94.04';
    console.log(`Checking data for NACE: ${nace}`);

    const rows = await sql`
        SELECT id, content, metadata
        FROM rag_documents 
        WHERE metadata->>'madde_no' = ${nace}
        OR content ILIKE ${`%${nace}%`}
        LIMIT 5
    `;

    console.log(`Found ${rows.length} rows.`);
    rows.forEach((row, i) => {
        console.log("------------------- CONTENT START -------------------");
        console.log(row.content);
        console.log("------------------- CONTENT END ---------------------");
        console.log("Metadata:", JSON.stringify(row.metadata, null, 2));
    });
}

checkNaceData().catch(console.error);
