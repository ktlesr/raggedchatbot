
import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { loadPDFWithMetadata } from "@/lib/parsing/pdfParser";
import { parseStructure } from "@/lib/parsing/structureParser";
import { createChunks } from "@/lib/chunking/semanticChunker";
import OpenAI from "openai";


// NOTE: In a real app, this would push to a Vector DB.
// For now, we return the parsed structure and chunks.

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        // Save to disk (temp)
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const fileName = file.name.replace(/\s+/g, "_");
        const rawDir = path.join(process.cwd(), "data/raw");
        const tempPath = path.join(rawDir, fileName);

        // Ensure directory exists
        await import("fs/promises").then(fs => fs.mkdir(rawDir, { recursive: true }));
        await writeFile(tempPath, buffer);

        // 1. Parse Text
        // This loads the PDF page by page
        const docs = await loadPDFWithMetadata(tempPath);

        // Join text for structure parsing logic which expects full text
        // (Ideally we would map back, but for simplicity we re-join)
        const fullText = docs.map(d => d.text).join("\n\n");

        // 2. Parse Structure
        const structure = parseStructure(fullText);

        // 3. Chunking
        const chunks = createChunks(structure);

        // Save structured JSON for reference
        const parsedDir = path.join(process.cwd(), "data/parsed");
        const jsonPath = path.join(parsedDir, `${fileName}.json`);
        await import("fs/promises").then(fs => fs.mkdir(parsedDir, { recursive: true }));
        await writeFile(jsonPath, JSON.stringify(structure, null, 2));

        // 4. Generate Embeddings & Store in DB
        // Initialize OpenAI
        const openai = new OpenAI();
        // Import storeEmbedding
        const { storeEmbedding } = await import("@/lib/vector/neonDb");

        // Iterate chunks and store
        for (const chunk of chunks) {
            // Generate embedding
            const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: chunk.text.replace(/\n/g, " "),
            });
            const embedding = embeddingResponse.data[0].embedding;

            // Store in Neon
            await storeEmbedding(chunk.id, chunk.text, { ...chunk.metadata, source: fileName }, embedding);
        }

        return NextResponse.json({
            message: "Processed successfully and indexed in Vector DB",
            stats: {
                pages: docs.length,
                maddeler: structure.maddeler.length,
                ekler: Object.keys(structure.ekler).length,
                chunks: chunks.length
            },
            files: {
                structure: jsonPath,
                chunks: "Stored in Neon Vector DB"
            }
        });

    } catch (error: unknown) {
        console.error("Ingest Error:", error);
        const message = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
