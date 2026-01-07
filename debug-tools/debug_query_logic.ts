
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';
import * as fs from 'fs';
dotenv.config();

const normalizeTurkish = (text: string) => {
    return text.toLocaleLowerCase('tr-TR').trim();
};

async function debugChatSearch() {
    const sql = neon(process.env.DATABASE_URL!);
    const openai = new OpenAI();

    const query = "hangi çağrı kapalı";
    const normalizedQuery = normalizeTurkish(query);

    console.log(`Query: ${query}`);

    // Vector search simulation
    const embeddingRes = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: normalizedQuery,
    });
    const embedding = embeddingRes.data[0].embedding;

    const vectorRows = await sql`
        SELECT id, 1 - (embedding <=> ${JSON.stringify(embedding)}::vector) as similarity, content
        FROM rag_documents 
        WHERE metadata->>'source' = 'HIT30.pdf'
        ORDER BY similarity DESC
        LIMIT 10
    `;

    const query2 = "kapalı çağrı hangisi";
    const normalizedQuery2 = normalizeTurkish(query2);
    const embeddingRes2 = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: normalizedQuery2,
    });
    const embedding2 = embeddingRes2.data[0].embedding;

    const vectorRows2 = await sql`
        SELECT id, 1 - (embedding <=> ${JSON.stringify(embedding2)}::vector) as similarity, content
        FROM rag_documents 
        WHERE metadata->>'source' = 'HIT30.pdf'
        ORDER BY similarity DESC
        LIMIT 10
    `;

    let output = `Query: ${query}\n`;
    output += "\n--- Vector Search Results (HIT30) ---\n";
    vectorRows.forEach((r: any) => {
        output += `Sim: ${r.similarity.toFixed(4)} | ID: ${r.id}\n`;
        output += `Content subset: ${r.content.substring(0, 500).replace(/\n/g, ' ')}\n`;
        output += "-".repeat(50) + "\n";
    });

    output += `\nQuery 2: ${query2}\n`;
    output += "\n--- Vector Search Results for 'kapalı çağrı hangisi' (HIT30) ---\n";
    vectorRows2.forEach((r: any) => {
        output += `Sim: ${r.similarity.toFixed(4)} | ID: ${r.id}\n`;
        output += `Content subset: ${r.content.substring(0, 500).replace(/\n/g, ' ')}\n`;
        output += "-".repeat(50) + "\n";
    });

    fs.writeFileSync('d:/rag-index-tr/debug_results.txt', output);
    console.log("Results written to debug_results.txt");
}

debugChatSearch();
