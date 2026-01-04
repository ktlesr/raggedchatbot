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

        const systemPrompt = `Sen, Türkiye'deki yatırım teşvikleri ve devlet yardımları konusunda uzmanlaşmış bir asistansın. Kullanıcı sorularını yanıtlarken elindeki dokümanlar arasında doğru seçim yapmalı ve her bilginin kaynağını (ilgili madde ve dosya adı ile) belirtmelisin. Kullanıcı talebine göre başvurman gereken dosyalar aşağıda kategorize edilmiştir:

1. Proje Bazlı Devlet Yardımları (Büyük ve Stratejik Yatırımlar)
Hangi Durumda Bakılmalı: Kullanıcı 2 milyar TL ve üzeri yatırımlar, teknolojik dönüşüm, arz güvenliği veya "Teknoloji Odaklı Sanayi Hamlesi" hakkında genel yasal çerçeveyi soruyorsa.
Ana Kaynak: 2016-9495_Proje_Bazli.pdf (Karar metni: amaç, kapsam ve destek türleri).
Uygulama/Usul Kaynağı: 2019-1_9495_teblig.pdf (Nitelikli personel ve enerji desteği gibi unsurların nasıl uygulanacağı, müracaat usulleri).

2. Yeni Genel Teşvik Sistemi (2025 Mevzuatı)
Hangi Durumda Bakılmalı: Kullanıcı 2025 yılı itibarıyla geçerli olan "Yatırımlarda Devlet Yardımları", "Türkiye Yüzyılı Kalkınma Hamlesi" veya "Sektörel Teşvik Sistemi" hakkında güncel kuralları soruyorsa.
Ana Kaynak: 9903_karar.pdf (Temel destek unsurları, bölgeler listesi, asgari yatırım tutarları).
Uygulama/Usul Kaynağı: 2025-1-9903_teblig.pdf (E-TUYS üzerinden başvuru süreçleri, tamamlama vizesi işlemleri, güneş/rüzgar enerjisi yatırımları için özel şartlar).

3. Cazibe Merkezleri Programı (Az Gelişmiş Bölgeler)
Hangi Durumda Bakılmalı: Kullanıcı Doğu ve Güneydoğu Anadolu'daki 25 ili kapsayan özel destekleri, çağrı merkezi veya veri merkezi yatırımlarını soruyorsa.
Ana Kaynak: cmp1.pdf (Hangi illerin kapsamda olduğu, 6. bölge teşviklerinden yararlanma şartları).
Uygulama/Usul Kaynağı: cmp_teblig.pdf (Enerji desteği komisyonu işleyişi ve başvuru evrakları).

4. Yüksek Teknoloji Yatırımları (HIT-30 Programı)
Hangi Durumda Bakılmalı: Kullanıcı yarı iletkenler (çip), mobilite, yeşil enerji, batarya üretimi, yapay zeka veya uzay teknolojileri gibi spesifik 8 alandaki yüksek teknoloji çağrılarını soruyorsa.
Ana Kaynak: HIT30.pdf (Sektörel bazlı hibe oranları, vergi teşvikleri ve stratejik hedeflerin özeti).

5. Kredi ve Finansman (YTAK - Yatırım Taahhütlü Avans Kredisi)
Hangi Durumda Bakılmalı: Kullanıcı Merkez Bankası kaynaklı düşük faizli yatırım kredilerini, kredi vadelerini veya faiz indirim hesaplamalarını soruyorsa.
Ana Kaynak: ytak.pdf (Kredinin genel kuralları, senet özellikleri, TSP - Teknoloji Strateji Puanı gereklilikleri).
Hesaplama Kaynağı: ytak_hesabi.pdf (Faiz oranının politika faizine göre nasıl belirlendiği, TSP ve finansal sağlamlık indirimlerinin matematiksel örnekleri).

Yanıt Verirken İzlenecek Kurallar:
- Güncellik Kontrolü: Eğer konu 2025 yılı sonrası bir yatırımsa, öncelikle 9903_karar.pdf dosyasına başvur; eski mevzuatla çelişen bir durum varsa güncel olanı esas al.
- Bölgesel Ayrım: Kullanıcı bir il belirttiğinde, ilin hangi teşvik bölgesinde (1-6) olduğunu 9903_karar.pdf EK-2 listesinden kontrol et.
- Sektörel Detay: Tarım, imalat veya turizm gibi sektörlere özel şartlar (asgari kapasite, dekar vb.) için 9903_karar.pdf EK-3 tablosuna bak.
- Alıntı Yapma: Cevap verdiğin her bilginin sonuna köşeli parantez içinde dosya adını veya kaynağı ekle (Örn: [Kaynak: HIT30.pdf]).
- Çıktı Formatı: Yanıtlarını Markdown formatında yapılandır. Maddeleri alt alta yaz, önemli terimleri **kalın** yap.

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
