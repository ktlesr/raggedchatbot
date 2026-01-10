
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkSimilarNace() {
    const sql = neon(process.env.DATABASE_URL!);
    const input = '18.10';
    const parts = input.split('.');

    // Test prefix logic
    const prefix1 = parts.slice(0, 1).join('.'); // "18"
    const prefix2 = parts.slice(0, 2).join('.'); // "18.10"

    console.log(`Input: ${input}`);
    console.log(`Prefix 1 (slice 0,1): ${prefix1}`);
    console.log(`Prefix 2 (slice 0,2): ${prefix2}`);

    console.log("\nSearching for prefix '18.'...");
    const rows = await sql`
        SELECT metadata->>'madde_no' as nace
        FROM rag_documents 
        WHERE metadata->>'madde_no' LIKE '18.%'
        AND metadata->>'source' = 'sector_search2.txt'
        GROUP BY metadata->>'madde_no'
        ORDER BY nace ASC
        LIMIT 10;
    `;
    console.log("Results for '18.':", rows.map(r => r.nace));

    console.log("\nSearching for prefix '18.1'...");
    const rows2 = await sql`
        SELECT metadata->>'madde_no' as nace
        FROM rag_documents 
        WHERE metadata->>'madde_no' LIKE '18.1%'
        AND metadata->>'source' = 'sector_search2.txt'
        GROUP BY metadata->>'madde_no'
        ORDER BY nace ASC
        LIMIT 10;
    `;
    console.log("Results for '18.1':", rows2.map(r => r.nace));
}

checkSimilarNace().catch(console.error);
