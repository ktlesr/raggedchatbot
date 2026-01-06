import { neon } from "@neondatabase/serverless";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";

// Manually read .env
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), ".env");
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, "utf-8");
            envContent.split("\n").forEach(line => {
                const parts = line.split("=");
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const value = parts.slice(1).join("=").trim();
                    if (key && value && !process.env[key]) {
                        process.env[key] = value;
                    }
                }
            });
        }
    } catch (e) {
        console.error("Failed to load .env manually:", e);
    }
}

loadEnv();

async function getEmbedding(text: string, openai: OpenAI): Promise<number[]> {
    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text.replace(/\n/g, " "),
    });
    return response.data[0].embedding;
}

async function debugRetrieval() {
    const query = "Cazibe Merkezleri Programı kapsamında yer alan iller";
    console.log(`Query: ${query}`);

    if (!process.env.DATABASE_URL || !process.env.OPENAI_API_KEY) {
        console.error("Missing ENV vars");
        return;
    }

    const openai = new OpenAI();
    const sql = neon(process.env.DATABASE_URL);

    const embedding = await getEmbedding(query, openai);
    const vectorStr = JSON.stringify(embedding);

    const results = await sql`
        SELECT id, content, 1 - (embedding <=> ${vectorStr}::vector) as similarity
        FROM rag_documents
        ORDER BY embedding <=> ${vectorStr}::vector
        LIMIT 10;
    `;

    console.log("\n--- Top Vector Results ---");
    results.forEach((r, i) => {
        console.log(`[${i + 1}] ID: ${r.id} | Sim: ${r.similarity.toFixed(4)}`);
        console.log(`Content: ${r.content.substring(0, 200)}...\n`);
    });

    const keyword = "Cazibe";
    const keywordResults = await sql`
        SELECT id, content 
        FROM rag_documents 
        WHERE content ILIKE ${`%${keyword}%`}
        LIMIT 5;
    `;

    console.log("\n--- Keyword Results (Cazibe) ---");
    keywordResults.forEach((r, i) => {
        console.log(`[${i + 1}] ID: ${r.id}`);
        console.log(`Content: ${r.content.substring(0, 200)}...\n`);
    });
}

debugRetrieval();
