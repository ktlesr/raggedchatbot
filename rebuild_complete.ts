
import * as fs from 'fs';
import * as path from 'path';
import { parseStructure } from './lib/parsing/structureParser';
import { createChunks } from './lib/chunking/semanticChunker';

import OpenAI from "openai";
import { neon } from "@neondatabase/serverless";

// Manually load .env
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
        console.error("Failed to load .env:", e);
    }
}
loadEnv();

async function main() {
    console.log("Starting Rebuild Process...");

    // 1. Setup
    if (!process.env.OPENAI_API_KEY || !process.env.DATABASE_URL) {
        console.error("Missing API Keys!");
        process.exit(1);
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const sql = neon(process.env.DATABASE_URL);

    // 2. Read PDF using pdf-parse
    // We need to import pdf-parse. In tsx/node, standard import might work if types are there, 
    // otherwise require or dynamic import.
    let pdfParse: any;
    try {
        // Try standard require first
        pdfParse = require('pdf-parse');
    } catch (e) {
        console.log("Could not require pdf-parse, trying dynamic import...");
        try {
            const mod = await import('pdf-parse/lib/pdf-parse.js');
            pdfParse = mod.default || mod;
        } catch (e2) {
            console.error("Failed to load pdf-parse:", e2);
            process.exit(1);
        }
    }

    const pdfPath = 'd:/rag-index-tr/9903_karar.pdf';
    console.log(`Reading PDF from ${pdfPath}...`);

    if (!fs.existsSync(pdfPath)) {
        console.error("PDF file not found!");
        process.exit(1);
    }

    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdfParse(dataBuffer);
    const fullText = pdfData.text;
    console.log(`PDF Text Extracted. Length: ${fullText.length} chars.`);

    // 3. Parse Structure
    console.log("Parsing structure...");
    const structure = parseStructure(fullText);
    console.log(`Structure parsed. Found ${structure.maddeler.length} maddeler.`);

    // Debug Madde 4
    const m4 = structure.maddeler.find(m => m.madde_no.includes("4"));
    if (m4) {
        console.log("Madde 4 Alt Paragraflar:", JSON.stringify(m4.alt_paragraflar, null, 2));
    }

    // 4. Create Chunks
    console.log("Creating chunks...");
    const chunks = createChunks(structure);
    console.log(`Created ${chunks.length} chunks.`);

    // Debug: Check for specific chunks
    const m4Chunks = chunks.filter(c => c.id.startsWith("madde_4"));
    console.log("Madde 4 chunks:", m4Chunks.map(c => c.id));

    // 5. Store in DB
    console.log("Storing in DB (this may take a while)...");

    // Dynamic import to ensure env is loaded
    const { storeEmbedding } = await import('./lib/vector/neonDb');

    // Clear table first?? No, duplicate IDs will be updated. But maybe we want clean slate?
    // Let's just update. Upsert logic in storeEmbedding handles it.

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        try {
            const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: chunk.text.replace(/\n/g, " "),
            });
            const embedding = embeddingResponse.data[0].embedding;

            await storeEmbedding(chunk.id, chunk.text, chunk.metadata, embedding);

            if (i % 10 === 0) process.stdout.write(`.`);
        } catch (e) {
            console.error(`\nError storing chunk ${chunk.id}:`, e);
        }
    }

    console.log("\nDone!");
}

main();
