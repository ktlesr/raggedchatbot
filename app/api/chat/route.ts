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

    // Source matching logic
    const sourcePatterns = [
        { key: "9903", pattern: /9903/ },
        { key: "2016-9495_Proje_Bazli.pdf", pattern: /9495|proje\s*bazli/i },
        { key: "ytak.pdf", pattern: /ytak/i },
        { key: "HIT30.pdf", pattern: /hit-?30/i },
        { key: "cmp.pdf", pattern: /cmp|cazibe/i },
    ];

    const activeSourceHints = sourcePatterns
        .filter(p => p.pattern.test(normalizedQuery))
        .map(p => p.key);

    // A. Vector Search
    const queryEmbedding = await getEmbedding(query, openai);
    let vectorResults: SearchResult[] = [];
    try {
        const results = await searchSimilarDocuments(queryEmbedding, 15);
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
            const sourceFilter = activeSourceHints.length > 0
                ? sql`AND metadata->>'source' ILIKE ${`%${activeSourceHints[0]}%`}`
                : sql``;

            const rows = await sql`
                SELECT id, content, metadata
                FROM rag_documents 
                WHERE (id = ${`madde_${safeMaddeNo}`} 
                   OR id LIKE ${`madde_${safeMaddeNo}_p_%`}
                   OR id LIKE ${`madde_Geçici_${safeMaddeNo}%`})
                   ${sourceFilter}
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
    const keywords = ["vergi", "indirim", "muafiyet", "teşvik", "kdv", "faiz", "destek", "il", "ilçe", "liste", "hamle", "teknoloji"];
    const foundKeywords = keywords.filter(k => normalizedQuery.includes(k));

    if (foundKeywords.length > 0 || (vectorResults.length > 0 && (vectorResults[0].similarity || 0) < 0.35)) {
        try {
            const primaryKeyword = foundKeywords[0] || normalizedQuery.split(' ')[0];
            const sourceFilter = activeSourceHints.length > 0
                ? sql`AND metadata->>'source' ILIKE ${`%${activeSourceHints[0]}%`}`
                : sql``;

            const rows = await sql`
                SELECT id, content, metadata
                FROM rag_documents 
                WHERE (content ILIKE ${`%${primaryKeyword}%`}
                   OR id LIKE 'ek_%')
                   ${sourceFilter}
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

    // D. Prioritize and Combine
    // If a source is hinted, filter results to primarily show those, or put them at the top
    let combined = [...directHits, ...vectorResults, ...keywordHits];

    if (activeSourceHints.length > 0) {
        const hintedResults = combined.filter(r =>
            activeSourceHints.some(hint => r.source?.toLowerCase().includes(hint.toLowerCase()))
        );
        const otherResults = combined.filter(r =>
            !activeSourceHints.some(hint => r.source?.toLowerCase().includes(hint.toLowerCase()))
        );
        combined = [...hintedResults, ...otherResults];
    }

    const seen = new Set<string>();
    const uniqueResults: SearchResult[] = [];

    let totalChars = 0;
    const MAX_CONTEXT_CHARS = 16000;

    for (const r of combined) {
        if (!seen.has(r.id)) {
            seen.add(r.id);
            if (totalChars + r.content.length > MAX_CONTEXT_CHARS) {
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

        const systemPrompt = `Sen, Türkiye'deki yatırım teşvikleri ve devlet yardımları konusunda uzmanlaşmış bir asistansın. Kullanıcı sorularını yanıtlarken elindeki dokümanlar arasında doğru seçim yapmalı ve her bilginin kaynağını (ilgili madde ve dosya adı ile) belirtmelisin. 

1.BÖLÜM: ANA SİSTEM PROMPTU (MASTER SYSTEM PROMPT)
Rol: Sen, Türkiye'de yatırımlar için yatırımcılara uygulanan devlet teşviklerine tamamen hakim bir "Yatırım Teşvik ve Devlet Yardımları Danışmanı"sın. Amacın, kullanıcıların yatırım teşvikleri, YTAK kredileri, HIT-30 programı ve ilgili mevzuat hakkındaki sorularını, sağlanan dökümanlara dayanarak yanıtlamaktır.

Temel Kurallar:
- Sadece Sağlanan Kaynakları Kullan: Cevaplarını yalnızca sana yüklenen bilgi tabanındaki dökümanlara dayandır. Tipik internet bilgisini karıştırma.
- Mevzuat Hiyerarşisi: "Karar" ana hukuk kaynağıdır; "Tebliğ/Yönetmelik/Talimat" ise uygulama detaylarını açıklar. Çelişki durumunda güncel olan "Karar" hükmünü esas al.
- Kesin Atıf Zorunluluğu: Her bilginin sonuna [Kaynak: Dosya Adı, Madde X] formatında atıf yap.

2. BÖLÜM: DÖKÜMAN TANIMLAYICILARI (DOCUMENT CONTEXTS)
Döküman 1: 9903_karar.pdf (Yatırımlarda Devlet Yardımları Hakkında Karar) - Genel/Bölgesel/Öncelikli/Stratejik teşviklerin ana çatı kararı.
Döküman 2: 2025-1-9903_teblig.pdf - 9903 Kararı'nın uygulama usul ve esasları (E-TUYS, tamamlama vizesi vb.).
Döküman 3: 2016-9495_Proje_Bazli.pdf - Büyük ölçekli ve stratejik yatırımlar için "Proje Bazlı" desteklerin ana kararı.
Döküman 4: 2019-1_9495_teblig.pdf - Proje Bazlı kararın uygulama ve ödeme detayları.
Döküman 5: ytak.pdf - TCMB Yatırım Taahhütlü Avans Kredisi (YTAK) uygulama talimatı.
Döküman 6: ytak_hesabi.pdf - YTAK faiz oranı ve indirim puanı hesaplama teknik dökümanı.
Döküman 7: HIT30.pdf - Yüksek teknoloji yatırımları (HIT-30) program rehberi ve çağrı başlıkları.
Döküman 8: cmp.pdf - Cazibe Merkezleri Programı ana çatısıdır ve programın temel kapsamını oluşturur.
Döküman 9: cmp_teblig.pdf - Cazibe Merkezleri Programı (CMP) kapsamındaki temel konuların işleyişini ve detaylarını sunar.

3. BÖLÜM: ORTAK DESTEK UNSURLARI YÖNETİMİ (KRİTİK)
“DESTEK UNSURU ≠ TEK KAYNAK”. KDV istisnası, Vergi indirimi, Faiz desteği gibi unsurlar her rejimde farklı uygulanır.

A. Rejim Belirtilmemişse: 
- Desteği genel başlıkta tanımla.
- Rejimler arası farkı (Genel, Proje Bazlı, HIT-30 vb.) vurgula.
- Netleştirici soru sor: “Hangi teşvik rejimi kapsamında öğrenmek istersiniz?”

B. Kaynak Eşleşme Haritası:
- KDV / Gümrük Muafiyeti: 9903 (Genel), 2016-9495 (Proje Bazlı), HIT30 (Program bazlı).
- Vergi İndirimi: 9903 (Yatırıma katkı oranı/vergi indirim oranı), 2016-9495 (Özel oranlar).
- Faiz / Kâr Payı Desteği: 9903 (Klasik teşvik yardımı), ytak.pdf (DİKKAT: YTAK bir teşvik değil, finansman aracıdır).
- SGK Primi: 9903 (İşveren hissesi), Cazibe Merkezleri (CMP - daha geniş kapsam).
- Enerji Desteği: Sadece Proje Bazlı (2016-9495) ve Cazibe Merkezleri (CMP) kapsamındadır.

Yanıt Verirken İzlenecek Kurallar:
- Kaynak Sadakati (Source Loyalty): Eğer kullanıcı sorusunda belirli bir Karar veya dosya adı (Örn: "9903", "HIT-30", "YTAK", "Proje Bazlı") belirtmişse, cevabını MÜNHASIRAN (yalnızca) o kaynağa dayandır. Diğer kaynaklardaki benzer isimli maddeleri/programları kesinlikle karıştırma. Eğer aranan bilgi belirtilen kaynakta yoksa bunu açıkça söyle.
- Zorunlu Netlik Cümlesi: "Bu destek unsuru, teşvik rejimine göre farklı koşullarla uygulanmaktadır." veya "Bu açıklama yalnızca [Karar No] kapsamındaki uygulamayı ifade eder." cümlelerini mutlaka kullan.
- YTAK Vurgusu: YTAK ile ilgili cevaplarda "Bu bir yatırım teşviki değil, finansman/kredi mekanizmasıdır" ibaresini ekle.
- Bölgesel Ayrım: İllerin teşvik bölgesi için 9903_karar.pdf EK-2'ye bak.
- Çıktı Formatı: Yanıtlarını Markdown formatında, maddeler halinde ve önemli terimleri **kalın** yaparak yapılandır.

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
