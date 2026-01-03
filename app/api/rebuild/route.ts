import { NextResponse } from "next/server";
import * as fs from 'fs/promises';
import * as path from 'path';
import { parseStructure } from "@/lib/parsing/structureParser";
import { createChunks } from "@/lib/chunking/semanticChunker";
import { storeEmbedding } from "@/lib/vector/neonDb";
import { normalizeTurkish } from "@/lib/utils/text";
import { neon } from "@neondatabase/serverless";
import OpenAI from "openai";

export async function GET() {
    try {
        console.log("Starting Rebuild via API...");

        const pdfPath = path.join(process.cwd(), 'data', 'raw', '9903_karar.pdf');

        let fileBuffer;
        try {
            fileBuffer = await fs.readFile(pdfPath);
        } catch (err) {
            console.error("PDF read error:", err);
            return NextResponse.json({ error: "PDF file not found" }, { status: 404 });
        }

        const pdf = await import('pdf-parse/lib/pdf-parse.js');
        const pdfData = await pdf.default(fileBuffer);
        const fullText = pdfData.text;

        const structure = parseStructure(fullText);
        const chunks = createChunks(structure);

        const openai = new OpenAI();
        const sql = neon(process.env.DATABASE_URL!);
        await sql`DELETE FROM rag_documents`;
        console.log("Database cleared.");

        let storedCount = 0;

        for (const chunk of chunks) {
            try {
                const normalizedText = normalizeTurkish(chunk.text.replace(/\n/g, " "));
                const embeddingResponse = await openai.embeddings.create({
                    model: "text-embedding-3-small",
                    input: normalizedText,
                });
                const embedding = embeddingResponse.data[0].embedding;

                await storeEmbedding(chunk.id, chunk.text, chunk.metadata, embedding);
                storedCount++;
            } catch (error) {
                console.error(`Error storing chunk ${chunk.id}`, error);
            }
        }

        return NextResponse.json({
            message: "Rebuild completed successfully",
            stats: {
                total_chunks: chunks.length,
                stored_chunks: storedCount
            }
        });

    } catch (error: unknown) {
        console.error("Rebuild error:", error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Rebuild Error"
        }, { status: 500 });
    }
}
