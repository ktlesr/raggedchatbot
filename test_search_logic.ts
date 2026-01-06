
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';
dotenv.config();

const normalizeTurkish = (text: string) => {
    return text.replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase();
};

async function testSearch() {
    const sql = neon(process.env.DATABASE_URL!);
    const openai = new OpenAI();

    const query = "9903 sayılı karar kapsamında yatırım tahsisi nedir";
    const normalizedQuery = normalizeTurkish(query);

    console.log(`Query: ${query}`);

    // Simulating the logic in app/api/chat/route.ts
    const activeSourceHints = ["9903"];
    const maddeMatch = query.match(/madde\s*(\d+)/i);
    const isDefinitionQuery = /tanim|nedir|ne\s*demek|un\s*anlami/i.test(normalizedQuery);

    const safeMaddeNo = maddeMatch ? maddeMatch[1] : (isDefinitionQuery ? "2" : "");

    console.log(`Active Hints: ${activeSourceHints}`);
    console.log(`Madde Match: ${maddeMatch}, Is Definition: ${isDefinitionQuery}`);

    // Direct article lookup
    if (activeSourceHints.length > 0) {
        console.log("Searching for Direct Article hits...");
        // In the route.ts it uses ILIKE %madde_X
        const results = await sql`
             SELECT id, metadata->>'source' as source, LEFT(content, 100) as snippet
             FROM rag_documents
             WHERE (id ILIKE ${`%madde_21%`} OR id ILIKE ${`%madde_2%`})
               AND metadata->>'source' ILIKE '%9903%'
             LIMIT 10
        `;
        console.log("Direct matching candidates for 9903:");
        results.forEach(r => console.log(`- ${r.id}: ${r.snippet}`));
    }

    // Keyword search simulation
    const searchTerms = ["yatirim", "tahsisi"];
    const rows = await sql`
        SELECT id, metadata->>'source' as source, LEFT(content, 100) as snippet
        FROM rag_documents
        WHERE content ILIKE '%yatirim%' AND content ILIKE '%tahsisi%'
          AND metadata->>'source' ILIKE '%9903%'
        LIMIT 5
    `;
    console.log("\nKeyword search matches for 9903:");
    rows.forEach(r => console.log(`- ${r.id}: ${r.snippet}`));
}

testSearch();
