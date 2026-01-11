
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from "openai";
import { neon } from "@neondatabase/serverless";
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("Missing DATABASE_URL!");
        process.exit(1);
    }
    const sql = neon(dbUrl);
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const mdPath = 'd:/rag-index-tr/data/raw/hit30.md';
    const sourceName = 'hit30.md';
    const oldSourceName = 'HIT30.pdf';

    console.log(`Deleting old data for ${oldSourceName} and ${sourceName}...`);
    await sql`DELETE FROM rag_documents WHERE metadata->>'source' IN (${oldSourceName}, ${sourceName})`;

    if (!fs.existsSync(mdPath)) {
        console.error(`Markdown file not found: ${mdPath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(mdPath, 'utf-8');

    // Simple header-based chunking for hit30.md
    console.log("Chunking hit30.md...");
    const sections = content.split(/\n(?=## )/);
    const chunks: { text: string, id: string, metadata: any }[] = [];

    sections.forEach((section, index) => {
        const lines = section.trim().split('\n');
        const title = lines[0].replace('## ', '').trim();
        const text = section.trim();

        chunks.push({
            id: `hit30_md_chunk_${index}`,
            text: text,
            metadata: {
                source: sourceName,
                title: title,
                type: 'hit30_manual'
            }
        });
    });

    console.log(`Storing ${chunks.length} chunks...`);
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        try {
            const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: chunk.text.replace(/\n/g, " "),
            });
            const embedding = embeddingResponse.data[0].embedding;

            await sql`
                INSERT INTO rag_documents (id, content, metadata, embedding)
                VALUES (${chunk.id}, ${chunk.text}, ${JSON.stringify(chunk.metadata)}, ${JSON.stringify(embedding)}::vector)
                ON CONFLICT (id) DO UPDATE SET
                    content = EXCLUDED.content,
                    metadata = EXCLUDED.metadata,
                    embedding = EXCLUDED.embedding
            `;

            if (i % 2 === 0) process.stdout.write(`.`);
        } catch (e) {
            console.error(`\nError storing chunk ${chunk.id}:`, e);
        }
    }

    console.log("\nRe-indexing complete!");
}

main().catch(console.error);
