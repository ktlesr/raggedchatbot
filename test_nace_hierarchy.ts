
import { neon } from "@neondatabase/serverless";
import * as dotenv from 'dotenv';
dotenv.config();

async function testNaceHierarchy(naceQuery: string) {
    const sql = neon(process.env.DATABASE_URL!);

    console.log(`Testing NACE Hierarchy for: ${naceQuery}`);

    // Logic from Chat API
    // const nacePrefix = naceQuery.endsWith(".00") ? naceQuery.slice(0, -3) : (naceQuery.endsWith(".0") ? naceQuery.slice(0, -2) : naceQuery);

    const rows = await sql`
        SELECT id, metadata->>'nace' as nace
        FROM rag_documents 
        WHERE metadata->>'nace' LIKE '23.4%'
          AND metadata->>'source' = 'sector_search2.txt'
        ORDER BY nace ASC;
    `;

    console.log(`Matching records for 23.4%:`);
    rows.forEach(r => console.log(`- ${r.nace} (${r.id})`));
}

async function checkCount() {
    await testNaceHierarchy("23.41");
}

checkCount(); // Renamed or just call it
