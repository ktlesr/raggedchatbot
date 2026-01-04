
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
            envContent.split(/\r?\n/).forEach(line => {
                const parts = line.split("=");
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const value = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, '');
                    if (key && value) {
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

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("Missing DATABASE_URL!");
        process.exit(1);
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

    const pdfFiles = [
        'd:/rag-index-tr/data/raw/9903_karar.pdf',
        'd:/rag-index-tr/data/raw/cmp1.pdf',
        'd:/rag-index-tr/data/raw/cmp_teblig.pdf'
    ];

    for (const pdfPath of pdfFiles) {
        console.log(`\nProcessing PDF: ${pdfPath}...`);

        if (!fs.existsSync(pdfPath)) {
            console.error(`PDF file not found: ${pdfPath}`);
            continue;
        }

        const dataBuffer = fs.readFileSync(pdfPath);
        const pdfData = await pdfParse(dataBuffer);
        const fullText = pdfData.text;
        const sourceName = path.basename(pdfPath);

        console.log(`PDF Text Extracted from ${sourceName}. Length: ${fullText.length} chars.`);

        // 3. Parse Structure
        console.log("Parsing structure...");
        const structure = parseStructure(fullText);

        // 4. Create Chunks
        console.log("Creating chunks...");
        const chunks = createChunks(structure);
        console.log(`Created ${chunks.length} chunks.`);

        // 5. Store in DB
        console.log(`Storing ${chunks.length} chunks in DB...`);
        const { storeEmbedding } = await import('./lib/vector/neonDb');

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            try {
                // Attach source to metadata if not present
                if (!chunk.metadata.source) {
                    chunk.metadata.source = sourceName;
                }

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
    }

    console.log("\nDone!");
}

main();
