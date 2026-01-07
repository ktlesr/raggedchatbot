
import * as fs from 'fs';
import OpenAI from 'openai';
import pdfParse from 'pdf-parse';
import * as dotenv from 'dotenv';
import { parseStructure } from '../lib/parsing/structureParser';
import { createChunks } from '../lib/chunking/semanticChunker';
import { storeEmbedding } from '../lib/vector/neonDb';
import { neon } from '@neondatabase/serverless';

dotenv.config();

async function reindexHit30() {
    const openai = new OpenAI();
    const pdfPath = 'd:/rag-index-tr/data/raw/HIT30.pdf';
    const sourceName = 'HIT30.pdf';

    console.log(`Re-indexing ${sourceName}...`);

    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdfParse(dataBuffer);
    const fullText = pdfData.text;

    console.log("Parsing structure...");
    const structure = parseStructure(fullText);

    console.log("Creating chunks...");
    const chunks = createChunks(structure, sourceName);
    console.log(`Created ${chunks.length} chunks.`);

    const sql = neon(process.env.DATABASE_URL!);
    console.log("Deleting old HIT30.pdf chunks...");
    await sql`DELETE FROM rag_documents WHERE metadata->>'source' = ${sourceName}`;

    console.log("Storing new chunks...");
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: chunk.text.replace(/\n/g, " "),
        });
        const embedding = embeddingResponse.data[0].embedding;
        await storeEmbedding(chunk.id, chunk.text, chunk.metadata, embedding);
        if (i % 5 === 0) process.stdout.write('.');
    }
    console.log("\nDone!");
}

reindexHit30().catch(console.error);
