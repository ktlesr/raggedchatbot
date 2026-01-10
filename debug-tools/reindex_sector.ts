
import * as fs from 'fs';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { parseStructure } from '../lib/parsing/structureParser';
import { createChunks } from '../lib/chunking/semanticChunker';
import { storeEmbedding } from '../lib/vector/neonDb';
import { neon } from '@neondatabase/serverless';

dotenv.config();

async function reindexSector() {
    const openai = new OpenAI();
    const filePath = 'd:/rag-index-tr/data/raw/sector_search2.txt';
    const sourceName = 'sector_search2.txt';

    console.log(`Re-indexing ${sourceName}...`);

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }

    const fullText = fs.readFileSync(filePath, 'utf-8');

    console.log("Parsing structure...");
    const structure = parseStructure(fullText);

    console.log("Creating chunks...");
    const chunks = createChunks(structure, sourceName);
    console.log(`Created ${chunks.length} chunks.`);

    const sql = neon(process.env.DATABASE_URL!);
    console.log(`Deleting old ${sourceName} chunks...`);
    await sql`DELETE FROM rag_documents WHERE metadata->>'source' = ${sourceName}`;

    console.log("Storing new chunks...");
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        try {
            const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: chunk.text.replace(/\n/g, " "),
            });
            const embedding = embeddingResponse.data[0].embedding;
            await storeEmbedding(chunk.id, chunk.text, chunk.metadata, embedding);
            if (i % 10 === 0) process.stdout.write('.');
        } catch (e) {
            console.error(`\nError storing chunk ${chunk.id}:`, e);
        }
    }
    console.log("\nDone!");
}

reindexSector().catch(console.error);
