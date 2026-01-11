import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { sql } from '@/lib/vector/neonDb';
import { getEmbedding } from '@/lib/vector/embeddings';
import { normalizeTurkish } from '@/lib/utils/structuredData';

export const dynamic = 'force-dynamic';

// Types for search results
interface SearchResult {
    id: string;
    content: string;
    source?: string;
    similarity?: number;
}

interface DbRow {
    id: string;
    content: string;
    metadata: {
        source?: string;
        madde_no?: string;
        nace?: string;
    };
    similarity?: number;
}

// Helper to get matching model
async function getActiveModel() {
    return process.env.NEXT_PUBLIC_ACTIVE_MODEL || "gpt-4o";
}

async function searchSimilarDocuments(embedding: number[], limit: number = 10) {
    try {
        const results = await sql`
            SELECT id, content, metadata, 1 - (embedding <=> ${JSON.stringify(embedding)}::vector) as similarity
            FROM rag_documents
            ORDER BY embedding <=> ${JSON.stringify(embedding)}::vector
            LIMIT ${limit};
        `;
        return results;
    } catch (e) {
        console.error("Vector search specifically failed:", e);
        return [];
    }
}

async function findRelevantContext(query: string, openai: OpenAI) {
    const normalizedQuery = normalizeTurkish(query);
    const words = normalizedQuery.split(/\s+/);

    // Detect potential source hints
    const sourceHints = ["9903", "HIT30", "YTAK", "Proje_Bazli", "Cazibe", "CMP", "9495"];
    const activeSourceHints = sourceHints.filter(hint => normalizedQuery.includes(normalizeTurkish(hint)));

    const searchTerms = words
        .filter((w: string) => w.length > 3 && !["sayili", "karar", "karari", "gore", "oldugu", "hakkinda"].includes(w));

    // A. Vector Search
    const queryEmbedding = await getEmbedding(query, openai);
    let vectorResults: SearchResult[] = [];
    try {
        const results = await searchSimilarDocuments(queryEmbedding, 20);
        vectorResults = (results as unknown as DbRow[]).map((r) => ({
            id: r.id,
            content: r.content,
            source: r.metadata?.source,
            similarity: r.similarity
        }));
    } catch (e) {
        console.error("Vector search failed", e);
    }

    // B. Direct Article Lookup
    let directHits: SearchResult[] = [];
    const isDefinitionQuery = /tanim|nedir|ne\s*demek|un\s*anlami/i.test(normalizedQuery);
    const maddeMatch = query.match(/madde\s*(\d+)/i);

    // Improved NACE detection & normalization
    let normalizedNace: string | null = null;
    const naceRawMatch = query.match(/\b(?:\d{2}[.\-\s]?){0,2}\d{2}\b/);
    if (naceRawMatch) {
        const digits = naceRawMatch[0].replace(/[^0-9]/g, '');
        if (digits.length === 2) {
            normalizedNace = digits;
        } else if (digits.length === 4) {
            normalizedNace = `${digits.substring(0, 2)}.${digits.substring(2, 4)}`;
        } else if (digits.length === 6) {
            normalizedNace = `${digits.substring(0, 2)}.${digits.substring(2, 4)}.${digits.substring(4, 6)}`;
        }
    }

    try {
        if (maddeMatch || normalizedNace || (isDefinitionQuery && activeSourceHints.length > 0)) {
            const searchId = maddeMatch ? maddeMatch[1] : (normalizedNace ? normalizedNace : "2");
            const safeSearchId = searchId.replace(/\s+/g, '_');
            const sourceFilter = activeSourceHints.length > 0
                ? sql`AND metadata->>'source' ILIKE ${`%${activeSourceHints[0]}%`}`
                : sql``;

            const rows = await sql`
                SELECT id, content, metadata
                FROM rag_documents 
                WHERE (id ILIKE ${`%madde_${safeSearchId}`} 
                   OR id ILIKE ${`%madde_${safeSearchId}_part_%`}
                   OR id ILIKE ${`%madde_Geçici_${safeSearchId}%`}
                   OR metadata->>'madde_no' = ${searchId})
                   ${sourceFilter}
                ORDER BY id ASC
                LIMIT 15;
            `;
            directHits = (rows as unknown as DbRow[]).map((r) => ({
                id: r.id,
                content: r.content,
                source: r.metadata?.source
            }));

            if (normalizedNace && directHits.length === 0) {
                const parts = normalizedNace.split('.');
                const searchPrefix = parts[0] + (parts[1] ? '.' + parts[1].substring(0, 1) : '');

                const nearRows = await sql`
                    SELECT id, content, metadata
                    FROM rag_documents 
                    WHERE (metadata->>'madde_no' LIKE ${`${searchPrefix}%`}
                       OR metadata->>'madde_no' LIKE ${`${parts[0]}%`})
                    AND metadata->>'source' = 'sector_search2.txt'
                    ORDER BY metadata->>'madde_no' ASC
                    LIMIT 10;
                ` as any[];
                if (nearRows.length > 0) {
                    const relatedHits = (nearRows as unknown as DbRow[]).map((r) => ({
                        id: r.id,
                        content: `[ÖNERİ / BENZER KOD] ${r.content}`,
                        source: r.metadata?.source
                    }));
                    directHits.push(...relatedHits);
                }
            }
        }
    } catch (e) {
        console.error("Direct hit search failed", e);
    }

    // C. Smart Keyword Search
    let keywordHits: SearchResult[] = [];
    if (searchTerms.length > 0) {
        try {
            const sourceFilter = activeSourceHints.length > 0
                ? sql`AND metadata->>'source' ILIKE ${`%${activeSourceHints[0]}%`}`
                : sql``;

            const termsToMatch = searchTerms.slice(0, 3);
            let ilikeClause = sql``;
            if (termsToMatch.length === 1) {
                ilikeClause = sql`content ILIKE ${`%${termsToMatch[0]}%`}`;
            } else if (termsToMatch.length >= 2) {
                ilikeClause = sql`content ILIKE ${`%${termsToMatch[0]}%`} AND content ILIKE ${`%${termsToMatch[1]}%`}`;
            }

            if (termsToMatch.length > 0) {
                const rows = await sql`
                    SELECT id, content, metadata
                    FROM rag_documents 
                    WHERE ${ilikeClause}
                    ${sourceFilter}
                    LIMIT 10;
                `;
                keywordHits = (rows as unknown as DbRow[]).map((r) => ({
                    id: r.id,
                    content: r.content,
                    source: r.metadata?.source
                }));
            }
        } catch (e) {
            console.error("Keyword search failed", e);
        }
    }

    // D. NACE Hierarchy Search
    let naceHits: SearchResult[] = [];
    if (normalizedNace) {
        try {
            const parts = normalizedNace.split('.');
            const ancestors: string[] = [];
            let current = "";
            for (const p of parts) {
                current = current ? current + "." + p : p;
                ancestors.push(current);
            }

            for (const n of ancestors) {
                const cleanNace = n.endsWith(".00") ? n.slice(0, -3) : (n.endsWith(".0") ? n.slice(0, -2) : n);

                const rows = await sql`
                    SELECT id, content, metadata
                    FROM rag_documents 
                    WHERE (metadata->>'nace' LIKE ${`${cleanNace}%`}
                       OR metadata->>'nace' LIKE ${`${n}%`}
                       OR ${n} LIKE (metadata->>'nace' || '%'))
                       AND metadata->>'source' = 'sector_search2.txt'
                    LIMIT 20;
                `;
                const hits = (rows as unknown as DbRow[]).map((r) => ({
                    id: r.id,
                    content: r.content,
                    source: r.metadata?.source
                }));
                naceHits = [...naceHits, ...hits];
            }
        } catch (e) {
            console.error("NACE hierarchy search failed", e);
        }
    }

    const combined = [...naceHits, ...directHits, ...keywordHits, ...vectorResults];

    combined.sort((a, b) => {
        const aIsNace = a.id.startsWith("sector_") ? 1 : 0;
        const bIsNace = b.id.startsWith("sector_") ? 1 : 0;
        if (aIsNace !== bIsNace) return bIsNace - aIsNace;

        const aIsHinted = activeSourceHints.some(h => a.source?.toLowerCase().includes(h.toLowerCase())) ? 1 : 0;
        const bIsHinted = activeSourceHints.some(h => b.source?.toLowerCase().includes(h.toLowerCase())) ? 1 : 0;
        if (aIsHinted !== bIsHinted) return bIsHinted - aIsHinted;

        const aIsDirect = directHits.some(d => d.id === a.id) ? 1 : 0;
        const bIsDirect = directHits.some(d => d.id === b.id) ? 1 : 0;
        if (aIsDirect !== bIsDirect) return bIsDirect - aIsDirect;

        return (b.similarity || 0) - (aIsDirect === bIsDirect ? (a.similarity || 0) : 0);
    });

    const seen = new Set<string>();
    const uniqueResults: SearchResult[] = [];
    let totalChars = 0;
    const MAX_CONTEXT_CHARS = 18000;

    for (const r of combined) {
        if (!seen.has(r.id)) {
            seen.add(r.id);
            if (totalChars + r.content.length > MAX_CONTEXT_CHARS) break;
            uniqueResults.push(r);
            totalChars += r.content.length + 50;
        }
    }

    if (uniqueResults.length === 0) return "";
    return uniqueResults.map((r) => {
        let finalContent = r.content;

        if (r.source === 'sector_search2.txt') {
            if (finalContent.includes("TEKNOLOJİ HAMLESİ YATIRIM DURUMU: EVET")) {
                finalContent = "[SİSTEM UYARISI: BU SEKTÖR TEKNOLOJİ HAMLESİ KAPSAMINDADIR. DURUM 1 KURALINI MUTLAK SURETLE UYGULA!]\n" + finalContent;
            } else if (finalContent.includes("YÜKSEK TEKNOLOJİ YATIRIM DURUMU: EVET")) {
                finalContent = "[SİSTEM UYARISI: BU SEKTÖR YÜKSEK TEKNOLOJİDİR. DURUM 2 KURALINI MUTLAK SURETLE UYGULA!]\n" + finalContent;
            } else if (finalContent.includes("ORTA-YÜKSEK TEKNOLOJİ YATIRIM DURUMU: EVET")) {
                finalContent = "[SİSTEM UYARISI: BU SEKTÖR ORTA-YÜKSEK TEKNOLOJİDİR. DURUM 3 KURALINI MUTLAK SURETLE UYGULA!]\n" + finalContent;
            }
        }

        const sourcePrefix = r.source ? `[Kaynak: ${r.source} | ID: ${r.id}]\n` : "";
        return `${sourcePrefix}${finalContent}`;
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
        const context = await findRelevantContext(message, openai);

        const systemPrompt = `1. BÖLÜM: [BİRİNCİ ÖNCELİKLİ ALGORİTMA - MUTLAK SURETLE UYULACAK]
Bu silsile, dökümanlardaki ham verilerden ÜSTÜNDÜR. Bağlamda (Context) "[SİSTEM UYARISI]" etiketi gördüğünüzde dökümandaki statik statüleri (Örn: Öncelikli: Hayır) YOK SAYIN ve aşağıdaki kuralları uygulayın:

- DURUM 1 (Teknoloji Hamlesi): "[SİSTEM UYARISI: ... TEKNOLOJİ HAMLESİ ...]" etiketi varsa:
  * Yanıt Paragrafı (ZORUNLU): "**Teknoloji Hamlesi Programı** kapsamında yer aldığından, 9903 sayılı Karar kapsamında **Öncelikli Yatırım** olarak değerlendirilir. Bu kapsamda asgari yatırım tutarı **1. ve 2. Bölgeler için 15.100.000 TL**, **3., 4., 5. ve 6. Bölgeler için 7.500.000 TL** olmalıdır."

- DURUM 2 (Yüksek Teknoloji): "[SİSTEM UYARISI: ... YÜKSEK TEKNOLOJİDİR ...]" etiketi varsa:
  * Yanıt Paragrafı (ZORUNLU): "Teknoloji Hamlesi Programı kapsamında yer almamakla birlikte **yüksek teknoloji** yatırımı niteliğinde olduğundan iki farklı teşvik yolu mevcuttur:
    1. **Öncelikli Yatırım Yolu:** Asgari yatırım tutarının en az **627.000.000 TL** olması kaydıyla 9903 sayılı Karar kapsamında **Öncelikli Yatırım** olarak değerlendirilir.
    2. **Hedef Yatırım Yolu:** Yatırım tutarının bu limitin altında kalması durumunda ise **Hedef Yatırım** olarak değerlendirilir. Bu durumda asgari tutarlar **1. ve 2. Bölgeler için 15.100.000 TL**, **3., 4., 5. ve 6. Bölgeler için 7.500.000 TL**'dir."

- DURUM 3 (Orta-Yüksek Teknoloji): "[SİSTEM UYARISI: ... ORTA-YÜKSEK TEKNOLOJİDİR ...]" etiketi varsa:
  * Yanıt Paragrafı (ZORUNLU): "Teknoloji Hamlesi Programı kapsamında yer almamakla birlikte **orta-yüksek teknoloji** yatırımı niteliğinde olduğundan iki farklı teşvik yolu mevcuttur:
    1. **Öncelikli Yatırım Yolu:** Yatırımın **İstanbul ili dışında** gerçekleştirilmesi ve asgari yatırım tutarının en az **1.255.000.000 TL** olması kaydıyla 9903 sayılı Karar kapsamında **Öncelikli Yatırım** olarak değerlendirilir.
    2. **Hedef Yatırım Yolu:** Bu şartların (tutar veya il) sağlanamaması durumunda yatırım **Hedef Yatırım** olarak değerlendirilir. Bu durumda asgari tutarlar **1. ve 2. Bölgeler için 15.100.000 TL**, **3., 4., 5. ve 6. Bölgeler için 7.500.000 TL**'dir."

2. BÖLÜM: HIT-30 PROGRAMI ÖZEL KURALLARI [KRİTİK]
- [KAYNAK]: Bu bölümdeki bilgiler münhasıran **hit30.md** dosyasına dayanmaktadır.
- [KAPSAM AYRIMI]: HIT-30 iki temel katmandan oluşur ve kullanıcı hangisini soruyorsa ona odaklanın:
  1. **8 Ana Yatırım Alanı ve Konuları**: (Yarı İletkenler, Mobilite, Yeşil Enerji, İleri İmalat, Sağlıklı Yaşam, Dijital Teknolojiler, İletişim ve Uzay, Değer Zinciri). Bu alanların altındaki **detaylı konuları** mutlaka bağlamdaki (hit30.md) listeden çekin.
  2. **Çağrı Durumları (Aktif/Kapalı)**: Aktif çağrı duyurularını ve kapalı çağrıları aşağıdaki listeye göre verin.
- [ÇAĞRI LİSTESİ]:
  * AKTİF / AÇIK ÇAĞRILAR: HIT-Electric Vehicles, HIT-Battery, HIT-Chip, HIT-R&D, HIT-Wind, HIT-Data Center, HIT-AI, HIT-Quantum, HIT-Industrial Robot.
  * SONA ERMİŞ / KAPALI ÇAĞRILAR: Sadece **HIT-Solar** (Güneş Enerjisi) kapalıdır.
- [ÖNEMLİ]: İlgili alanda ilan edilmiş aktif bir çağrı olmasa dahi, HIT-30 kapsamındaki 8 ana teknoloji alanındaki konulara her zaman başvuru yapılabilmektedir.
- [YASAK]: Döküman başlıklarını (Örn: "Sağlanacak Destekler") çağrı ismi olarak sunmayın.
- [GÜNCEL BİLGİ]: Destekler, sabit yatırım tutarının %100'üne kadar ulaşabilir.

3. BÖLÜM: ANA SİSTEM PROMPTU (MASTER SYSTEM PROMPT)
Rol: Sen, Türkiye'de yatırımlar için yatırımcılara uygulanan devlet teşviklerine tamamen hakim bir "Yatırım Teşvik ve Devlet Yardımları Danışmanı"sın. Amacın, kullanıcıların yatırım teşvikleri, YTAK kredileri, HIT-30 programı ve ilgili mevzuat hakkındaki sorularını, sağlanan dökümanlara dayanarak yanıtlamaktır.

Temel Kurallar:
- Sadece Sağlanan Kaynakları Kullan: Cevaplarını yalnızca sana yüklenen bilgi tabanındaki dökümanlara dayandır.
- Mevzuat Hiyerarşisi: "Karar" ana hukuk kaynağıdır; "Tebliğ" uygulama detaylarını açıklar.
- [KRİTİK]: Yukarıdaki BİRİNCİ ÖNCELİKLİ ALGORİTMA ve HIT-30 KURALLARI, dökümandaki ham kelimelerden daha değerlidir.
- [YTAK]: "YTAK bir yatırım teşviki değil, finansman/kredi mekanizmasıdır" vurgusunu her zaman yapın.

4. BÖLÜM: DÖKÜMAN TANIMLAYICILARI (CONTEXTS)
Döküman 1: 9903_karar.pdf - Genel teşvik rejimi ana kararı.
Döküman 2: 2025-1-9903_teblig.pdf - 9903 uygulama detayları.
Döküman 7: hit30.md - Yüksek Teknoloji Yatırım Programı (HIT-30) güncel rehberi.
Döküman 10: sector_search2.txt - NACE kodu bazlı yatırım kategorileri.

5. BÖLÜM: SEKTÖR ARAMA ÖZEL KURALLARI
- Bölge ve Tutarlar [ZORUNLU FORMAT]:
  * Tüm bölgelere "1. Bölge" yazmak YASAKTIR.
  * Şablon: **1. ve 2. Bölgeler:** 15.100.000 TL | **3., 4., 5. ve 6. Bölgeler:** 7.500.000 TL.

6. BÖLÜM: ÇIKTI FORMATI [EMİR]
- Her zaman Markdown kullanın. Kritik ifadeleri **kalın** yapın.
- Atıf Yap: Bilginin sonuna [Kaynak: Dosya Adı] ekle.

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
                temperature: 0.1, // Lower temperature for more consistency
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
                    temperature: 0.1,
                }
            });
            reply = result.response.text();
        } else {
            // Ollama
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
                    options: { temperature: 0.1 }
                }),
            });
            if (response.ok) {
                const data = await response.json();
                reply = data.message.content;
            }
        }

        return NextResponse.json({ reply });
    } catch (error: unknown) {
        console.error("Chat API error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Something went wrong" },
            { status: 500 }
        );
    }
}
