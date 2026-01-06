
import OpenAI from "openai";
import { neon } from "@neondatabase/serverless";
import * as dotenv from 'dotenv';
dotenv.config();

function normalizeTurkish(text: string): string {
    return text.replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase();
}

async function getEmbedding(text: string, openai: OpenAI): Promise<number[]> {
    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: normalizeTurkish(text).replace(/\n/g, " "),
    });
    return response.data[0].embedding;
}

async function testQuery(query: string) {
    const sql = neon(process.env.DATABASE_URL!);
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    console.log(`Querying: ${query}`);
    const embedding = await getEmbedding(query, openai);

    const results = await sql`
        SELECT content, metadata->>'source' as source, 1 - (embedding <=> ${JSON.stringify(embedding)}::vector) as similarity
        FROM rag_documents
        ORDER BY similarity DESC
        LIMIT 3
    `;

    results.forEach((r, i) => {
        console.log(`\nResult ${i + 1} [Sim: ${r.similarity.toFixed(4)}] [Source: ${r.source}]`);
        console.log(r.content);
    });
}

testQuery("01.19.99 NACE kodu için yatırım şartları nelerdir?");
