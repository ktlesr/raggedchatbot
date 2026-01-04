import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { normalizeTurkish } from "@/lib/utils/text";
import { searchSimilarDocuments } from "@/lib/vector/neonDb";
import { neon } from "@neondatabase/serverless";
import { getActiveModel } from "@/lib/utils/settings";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';

// --- Types ---
interface SearchResult {
    id: string;
    content: string;
    source?: string;
    similarity?: number;
}

interface DbRow {
    id: string;
    content: string;
    metadata?: {
        source?: string;
        [key: string]: unknown;
    };
    similarity?: number;
}

// 1. Get Embedding from OpenAI
async function getEmbedding(text: string, openai: OpenAI): Promise<number[]> {
    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: normalizeTurkish(text).replace(/\n/g, " "),
    });
    return response.data[0].embedding;
}

// 2. Find Relevant Chunks (Hybrid Search)
async function findRelevantContext(query: string, openai: OpenAI): Promise<string> {
    const sql = neon(process.env.DATABASE_URL!);
    const normalizedQuery = normalizeTurkish(query);

    // A. Vector Search
    const queryEmbedding = await getEmbedding(query, openai);
    let vectorResults: SearchResult[] = [];
    try {
        const results = await searchSimilarDocuments(queryEmbedding, 10);
        vectorResults = (results as unknown as DbRow[]).map((r) => ({
            id: r.id,
            content: r.content,
            source: r.metadata?.source,
            similarity: r.similarity
        }));
    } catch (e) {
        console.error("Vector search failed", e);
    }

    // B. Specific Article Lookup
    const maddeMatch = query.match(/madde\s*(\d+)/i);
    let directHits: SearchResult[] = [];

    if (maddeMatch) {
        const maddeNo = maddeMatch[1];
        try {
            const safeMaddeNo = maddeNo.replace(/\s+/g, '_');
            const rows = await sql`
                SELECT id, content 
                FROM rag_documents 
                WHERE id = ${`madde_${safeMaddeNo}`} 
                   OR id LIKE ${`madde_${safeMaddeNo}_p_%`}
                   OR id LIKE ${`madde_Geçici_${safeMaddeNo}%`}
                LIMIT 10;
            `;
            directHits = (rows as unknown as DbRow[]).map((r) => ({
                id: r.id,
                content: r.content,
                source: r.metadata?.source
            }));
        } catch (e) {
            console.error("Direct hit search failed", e);
        }
    }

    // C. Keyword Search
    let keywordHits: SearchResult[] = [];
    const keywords = ["vergi", "indirim", "muafiyet", "teşvik", "kdv", "faiz", "destek", "il", "ilçe", "liste"];
    const foundKeywords = keywords.filter(k => normalizedQuery.includes(k));

    if (foundKeywords.length > 0 || (vectorResults.length > 0 && (vectorResults[0].similarity || 0) < 0.35)) {
        try {
            const primaryKeyword = foundKeywords[0] || normalizedQuery.split(' ')[0];
            const rows = await sql`
                SELECT id, content, metadata
                FROM rag_documents 
                WHERE content ILIKE ${`%${primaryKeyword}%`}
                   OR id LIKE 'ek_%'
                ORDER BY (id LIKE 'ek_%') DESC, length(content) ASC
                LIMIT 10;
            `;
            keywordHits = (rows as unknown as DbRow[]).map((r) => ({
                id: r.id,
                content: r.content,
                source: r.metadata?.source
            }));
        } catch (e) {
            console.error("Keyword search failed", e);
        }
    }

    // D. Combine and Limit
    const combined = [...directHits, ...vectorResults, ...keywordHits];
    const seen = new Set<string>();
    const uniqueResults: SearchResult[] = [];

    let totalChars = 0;
    const MAX_CONTEXT_CHARS = 16000; // Even tighter focus

    for (const r of combined) {
        if (!seen.has(r.id)) {
            seen.add(r.id);
            if (totalChars + r.content.length > MAX_CONTEXT_CHARS) {
                // If the next chunk is too large, we still add it but truncate the final string if needed
                // Or we can stop here to be safe
                uniqueResults.push({
                    id: r.id,
                    content: r.content.substring(0, MAX_CONTEXT_CHARS - totalChars) + "... (Bağlam burada kesildi)"
                });
                break;
            }
            uniqueResults.push(r);
            totalChars += r.content.length + (r.source ? r.source.length + 10 : 0);
        }
    }

    if (uniqueResults.length === 0) return "";
    return uniqueResults.map((r) => {
        const sourcePrefix = r.source ? `[Kaynak: ${r.source}]\n` : "";
        return `${sourcePrefix}${r.content}`;
    }).join("\n\n---\n\n");
}

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as { message?: string };
        const message = body.message;

        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ reply: "OpenAI API Key eksik." });
        }

        const openai = new OpenAI();
        const normalizedMessage = normalizeTurkish(message);
        const isCorrection = /(yanlış|hatalı|öyle değil|hayır|emin misin|doğru değil|bilmiyorsun)/i.test(normalizedMessage);

        const context = await findRelevantContext(message, openai);

        if (isCorrection) {
            console.log("Correction detected, focusing search...");
            // Extra logic could be added here if needed
        }

        const systemPrompt = `Sen uzman bir Yatırım Teşvik Mevzuatı Danışmanısın.
Adın: Teşvik Asistanı.
Görevin: Kullanıcının yatırım teşvikleri hakkındaki sorularını yanıtlamak.

Kural 1: Öncelikle verilen [BAĞLAM] bilgisini kullanarak yanıt ver. 
Kural 2: Bağlamdaki terimler ile kullanıcının sorduğu terimler arasında anlamca benzerlik varsa bunu kabul et.
Kural 3: Bilgi yoksa, kestirip atma, yapıcı bir yanıt ver. "Bilgim yok" deme.
Kural 4: Yanıtların resmi olsun.
Kural 5: ÇIKTI FORMATI: Yanıtlarını her zaman Markdown formatında yapılandır. 
    - Maddeleri (bullet points) veya liste numaralarını alt alta ve okunaklı yaz. 
    - Önemli terimleri **kalın (bold)** yap.
    - İçeriği paragraflara böl. 
    - Listeleri asla tek satırda (inline) verme, her madde yeni bir satırda olsun.

Kural 6: Her bilgi parçasının başında [Kaynak: dosya_adi.pdf] etiketi bulunmaktadır. Yanıt verirken SADECE sorulan konuyla doğrudan ilgili dökümandaki bilgileri kullan. 
Kural 7: BELGE ÖNCELİĞİ: "Cazibe Merkezleri Programı" (CMP) soruluyorsa, SADECE adında 'cmp' veya 'cazibe' geçen dökümanlardaki (örn: cmp1.pdf) listeleri esas al. 
Kural 8: Genel teşvik mevzuatındaki (örn: ytak.pdf) "6. Bölge İlçe Listesi" gibi listeleri CMP il listesiyle ASLA karıştırma. CMP sadece 25 ili kapsayan spesifik bir programdır.
Kural 9: Eğer bağlamda çelişkili iki liste varsa, kaynak etiketine bak ve sorulan programın adıyla eşleşen dökümana sadık kal.
Kural 10: "Yatırım Taahhütlü Avans Kredisi" (YTAK) ile ilgili sorular sorulduğunda, [Kaynak: ytak.pdf] etiketli parçaları temel alarak yanıt ver.

[BAĞLAM]
${context || "Mevzuat belgelerinde bu konuda spesifik bir bilgi bulunamadı."}
`;

        const activeModel = await getActiveModel();
        let reply = "";

        if (activeModel.startsWith("gpt-")) {
            const completion = await openai.chat.completions.create({
                model: activeModel as string,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: message }
                ],
                temperature: 0.3,
            });
            reply = completion.choices[0].message.content || "";
        } else if (activeModel.startsWith("gemini-")) {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "");
            const model = genAI.getGenerativeModel({ model: activeModel });

            const result = await model.generateContent({
                contents: [
                    { role: "user", parts: [{ text: systemPrompt + "\n\nKullanıcı Sorusu: " + message }] }
                ],
                generationConfig: {
                    temperature: 0.3,
                }
            });
            reply = result.response.text();
        } else {
            // Assume Ollama for local models
            try {
                const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
                const response = await fetch(`${ollamaUrl}/api/chat`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: activeModel,
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: message }
                        ],
                        stream: false,
                        options: {
                            temperature: 0.3
                        }
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    reply = data.message?.content || "";
                } else {
                    throw new Error(`Ollama error: ${response.statusText}`);
                }
            } catch (ollamaErr) {
                console.error("Local model error:", ollamaErr);
                reply = "Lokal model (Ollama) ile bağlantı kurulamadı. Lütfen Ollama'nın çalıştığından ve modelin indirildiğinden emin olun.";
            }
        }

        return NextResponse.json({ reply });

    } catch (error: unknown) {
        console.error("Chat Error:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
    }
}
