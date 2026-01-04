
import { BelgeYapisal, DocumentChunk } from "@/lib/utils/structuredData";

export function createChunks(data: BelgeYapisal): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const seenIds = new Map<string, number>();

    // 1. Maddeler Chunks
    data.maddeler.forEach(madde => {
        let safeMaddeNo = madde.madde_no.replace(/\s+/g, '_');
        let baseId = `madde_${safeMaddeNo}`;

        // Ensure Uniqueness
        if (seenIds.has(baseId)) {
            const count = seenIds.get(baseId)! + 1;
            seenIds.set(baseId, count);
            baseId = `${baseId}_v${count}`;
        } else {
            seenIds.set(baseId, 1);
        }

        const fullText = `MADDE ${madde.madde_no} - ${madde.başlık}\n\n${madde.içerik}`;
        const maddeChunks = splitTextRecursive(fullText, 20000);

        maddeChunks.forEach((chunkText, index) => {
            chunks.push({
                id: maddeChunks.length > 1 ? `${baseId}_part_${index + 1}` : baseId,
                text: chunkText,
                metadata: {
                    doc_id: baseId,
                    doc_type: "madde",
                    konu: madde.başlık
                }
            });
        });

        // Alt Paragraflar (Sub-clauses)
        if (madde.alt_paragraflar && madde.alt_paragraflar.length > 0) {
            madde.alt_paragraflar.forEach(p => {
                const headerMatch = p.metin.match(/^([^:\n]+):/);
                const subKonu = headerMatch ? headerMatch[1].trim() : `${madde.başlık} (Prg. ${p.paragraf})`;
                const pBaseId = `${baseId}_p_${p.paragraf}`;

                const pText = `MADDE ${madde.madde_no} / Paragraf ${p.paragraf}\n${p.metin}`;
                const pChunks = splitTextRecursive(pText, 20000);

                pChunks.forEach((chunkText, idx) => {
                    chunks.push({
                        id: pChunks.length > 1 ? `${pBaseId}_part_${idx + 1}` : pBaseId,
                        text: chunkText,
                        metadata: {
                            doc_id: baseId,
                            doc_type: "madde",
                            konu: subKonu,
                            baglantili_maddeler: [baseId]
                        }
                    });
                });
            });
        }
    });

    // 2. Tanımlar Chunks
    Object.entries(data.tanimlar).forEach(([term, desc]) => {
        const fullText = `TANIM: ${term}\n${desc}`;
        const tanimChunks = splitTextRecursive(fullText, 20000);
        const baseId = `tanim_${term.replace(/\s+/g, '_')}`;

        tanimChunks.forEach((chunkText, index) => {
            chunks.push({
                id: tanimChunks.length > 1 ? `${baseId}_part_${index + 1}` : baseId,
                text: chunkText,
                metadata: {
                    doc_id: `tanim_${term}`,
                    doc_type: "tanim",
                    konu: term
                }
            });
        });
    });

    // 3. Ekler Chunks
    Object.entries(data.ekler).forEach(([key, ek]) => {
        const fullText = `${ek.baslik}\n${ek.icerik}`;

        // Split massive lists (like Ek-4) into manageable chunks
        const subChunks = splitTextRecursive(fullText, 4000); // ~1000 tokens

        subChunks.forEach((chunkText, index) => {
            chunks.push({
                id: `${key}_part_${index + 1}`,
                text: chunkText,
                metadata: {
                    doc_id: key,
                    doc_type: "ek",
                    konu: `${ek.baslik} (Bölüm ${index + 1})`
                }
            });
        });
    });

    return chunks;
}

// Helper: Split text recursively by delimiters or length
function splitTextRecursive(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) return [text];

    // Try splitting by double newline (paragraphs)
    const paragraphs = text.split("\n\n");
    const chunks: string[] = [];
    let currentChunk = "";

    for (const p of paragraphs) {
        if ((currentChunk.length + p.length) < maxLength) {
            currentChunk += (currentChunk ? "\n\n" : "") + p;
        } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = p;
        }
    }
    if (currentChunk) chunks.push(currentChunk);

    // If a single paragraph is still too huge, force split by single newline
    return chunks.flatMap(c => {
        if (c.length <= maxLength) return [c];
        return splitByLine(c, maxLength);
    });
}

function splitByLine(text: string, maxLength: number): string[] {
    const lines = text.split("\n");
    const chunks: string[] = [];
    let currentChunk = "";

    for (const line of lines) {
        if ((currentChunk.length + line.length) < maxLength) {
            currentChunk += (currentChunk ? "\n" : "") + line;
        } else {
            if (currentChunk) chunks.push(currentChunk);
            // If a single line is massive (unlikely in PDF text but possible), hard slice it
            if (line.length > maxLength) {
                let tempLine = line;
                while (tempLine.length > 0) {
                    chunks.push(tempLine.slice(0, maxLength));
                    tempLine = tempLine.slice(maxLength);
                }
                currentChunk = "";
            } else {
                currentChunk = line;
            }
        }
    }
    if (currentChunk) chunks.push(currentChunk);
    return chunks;


}
