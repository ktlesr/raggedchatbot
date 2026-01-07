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

    // 1. Detect Source Hints
    const sourcePatterns = [
        { key: "9903", pattern: /9903/ },
        { key: "proje_bazli", pattern: /9495|proje\s*bazli/i },
        { key: "ytak", pattern: /ytak/i },
        { key: "hit30", pattern: /hit-?30|acik\s*cagri|aktif\s*cagri|sona\s*ermis|kapali\s*cagri/i },
        { key: "cmp", pattern: /cmp|cazibe/i },
        { key: "sector_search", pattern: /nace|yatirim\s*konusu|asgari\s*yatirim|kategorisi|sektor/i },
    ];

    const activeSourceHints = sourcePatterns
        .filter(p => p.pattern.test(normalizedQuery))
        .map(p => p.key);

    // 2. Extract meaningful search terms (remove short words)
    const searchTerms = normalizedQuery
        .split(/\s+/)
        .filter(w => w.length > 3 && !["sayili", "karar", "karari", "gore", "oldugu", "hakkinda"].includes(w));

    // A. Vector Search (Unfiltered but we'll prioritize later)
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

    // B. Direct Article Lookup (Prioritizing Article 2 if "tanim" or "nedir" is in query)
    let directHits: SearchResult[] = [];
    const isDefinitionQuery = /tanim|nedir|ne\s*demek|un\s*anlami/i.test(normalizedQuery);
    const maddeMatch = query.match(/madde\s*(\d+)/i);

    try {
        if (maddeMatch || (isDefinitionQuery && activeSourceHints.length > 0)) {
            const maddeNo = maddeMatch ? maddeMatch[1] : "2"; // Default to definitions if it's a definition query
            const safeMaddeNo = maddeNo.replace(/\s+/g, '_');
            const sourceFilter = activeSourceHints.length > 0
                ? sql`AND metadata->>'source' ILIKE ${`%${activeSourceHints[0]}%`}`
                : sql``;

            const rows = await sql`
                SELECT id, content, metadata
                FROM rag_documents 
                WHERE (id ILIKE ${`%madde_${safeMaddeNo}`} 
                   OR id ILIKE ${`%madde_${safeMaddeNo}_p_%`}
                   OR id ILIKE ${`%madde_Geçici_${safeMaddeNo}%`})
                   ${sourceFilter}
                ORDER BY id ASC
                LIMIT 15;
            `;
            directHits = (rows as unknown as DbRow[]).map((r) => ({
                id: r.id,
                content: r.content,
                source: r.metadata?.source
            }));
        }
    } catch (e) {
        console.error("Direct hit search failed", e);
    }

    // C. Smart Keyword Search (Multi-term)
    let keywordHits: SearchResult[] = [];
    if (searchTerms.length > 0) {
        try {
            // Rank by how many search terms are present
            const sourceFilter = activeSourceHints.length > 0
                ? sql`AND metadata->>'source' ILIKE ${`%${activeSourceHints[0]}%`}`
                : sql``;

            // Simple multi-term ILIKE (at least 2 terms or just 1 if only 1 is available)
            const termsToMatch = searchTerms.slice(0, 3);
            let ilikeClause = sql``;
            if (termsToMatch.length === 1) {
                ilikeClause = sql`content ILIKE ${`%${termsToMatch[0]}%`}`;
            } else {
                ilikeClause = sql`content ILIKE ${`%${termsToMatch[0]}%`} AND content ILIKE ${`%${termsToMatch[1]}%`}`;
            }

            // Forcefully look for EK content if query asks for lists/provinces
            const isListQuery = /liste|hangileri|iller|ilceler|ekler|ekleri/i.test(normalizedQuery);
            const listClause = isListQuery ? sql`OR id ILIKE '%ek_%'` : sql``;

            const rows = await sql`
                SELECT id, content, metadata
                FROM rag_documents 
                WHERE ((${ilikeClause}) ${listClause})
                   ${sourceFilter}
                ORDER BY (id ILIKE '%ek_%') DESC
                LIMIT 25;
            `;
            keywordHits = (rows as unknown as DbRow[]).map((r) => ({
                id: r.id,
                content: r.content,
                source: r.metadata?.source
            }));
        } catch (e) {
            console.error("Multi-term keyword search failed", e);
        }
    }

    // D. NACE Hierarchy Search
    let naceHits: SearchResult[] = [];
    const nacePattern = /\b\d{2}(?:\.\d{1,3}){0,3}\b/g;
    const potentialNaces = query.match(nacePattern);

    if (potentialNaces) {
        try {
            for (const n of potentialNaces) {
                if (["9903", "9495", "2024", "2025", "2023"].includes(n)) continue;

                // Generic prefix: if 23.40, also look for 23.4
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

    // E. Final Combination & Source Loyalty Ranking
    const combined = [...naceHits, ...directHits, ...keywordHits, ...vectorResults];

    // Sort logic: 
    // 1. NACE hits (for sector queries)
    // 2. Source hinted matches first
    // 3. Direct article hits second
    // 4. Vector matches with high similarity
    combined.sort((a, b) => {
        // Boost NACE matches from sector_search.txt
        const aIsNace = a.id.startsWith("sector_") ? 1 : 0;
        const bIsNace = b.id.startsWith("sector_") ? 1 : 0;
        if (aIsNace !== bIsNace) return bIsNace - aIsNace;

        // Boost strictly hinted matches first
        const aIsHinted = activeSourceHints.some(h => a.source?.toLowerCase().includes(h.toLowerCase())) ? 1 : 0;
        const bIsHinted = activeSourceHints.some(h => b.source?.toLowerCase().includes(h.toLowerCase())) ? 1 : 0;

        // If a specific decree is hinted (like 9903), it must win over non-hinted
        if (aIsHinted !== bIsHinted) return bIsHinted - aIsHinted;

        // If both hinted or both not hinted, check for specific "madde" match in query
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
        const sourcePrefix = r.source ? `[Kaynak: ${r.source} | ID: ${r.id}]\n` : "";
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
Döküman 7: HIT30.pdf - Yüksek teknoloji yatırımları (HIT-30) program rehberi. "AKTİF AÇIK ÇAĞRILAR" ve "SONA ERMİŞ (KAPALI) ÇAĞRILAR" tablolarını içerir (Elektrikli Araç, Batarya, Çip, Rüzgar, Güneş, Yapay Zeka, Kuantum vb.). Kullanıcı aktif veya kapalı/sona ermiş çağrıları sorduğunda bu dökümana bak. Aranan çağrının DURUM bilgisi (Aktif/Kapalı) döküman içeriğinde belirtilmiştir.
Döküman 8: cmp1.pdf - Cazibe Merkezleri Programı ana çatısıdır ve programın temel kapsamını oluşturur.
Döküman 9: cmp_teblig.pdf - Cazibe Merkezleri Programı (CMP) kapsamındaki temel konuların işleyişini ve detaylarını sunar.
Döküman 10: sector_search2.txt (Sektörel Referans Tablosu) - NACE kodu ve yatırım konusu bazında yatırımın kategorisini (Hedef, Öncelikli, Teknoloji seviyesi vb.), şartlarını ve bölgelere göre asgari yatırım tutarlarını belirlemek için kullanılır. Kullanıcı NACE veya yatırım konusu sorduğunda BURAYA BAK.

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
- Kaynak Sadakati (Source Loyalty) [KRİTİK]: Eğer kullanıcı sorusunda belirli bir Karar veya dosya adı (Örn: "9903", "HIT-30", "YTAK", "Proje Bazlı", "9495") belirtmişse, cevabını MÜNHASIRAN (yalnızca) o kaynağa dayandır. Diğer dökümanlarda (Örn: Proje Bazlı Karar'da) Madde 12 "Yatırım Yeri Tahsisi" olabilir, ancak kullanıcı "9903" sormuşsa o 12. maddeyi KESİNLİKLE kullanma, 9903'teki ilgili maddeye (Madde 21) git. Eğer aranan bilgi belirtilen kaynakta yoksa "Belirttiğiniz 9903 sayılı kararda bu konuda bilgi bulunmamaktadır" de.
- Zorunlu Netlik Cümlesi: "Bu destek unsuru, teşvik rejimine göre farklı koşullarla uygulanmaktadır." veya "Bu açıklama yalnızca [Karar No] kapsamındaki uygulamayı ifade eder." cümlelerini benzer destekler (KDV, Vergi, Yer Tahsisi vb.) için mutlaka kullan.
- YTAK Vurgusu: YTAK ile ilgili cevaplarda "Bu bir yatırım teşviki değil, finansman/kredi mekanizmasıdır" ibaresini ekle.
- Bölgesel Ayrım: İllerin teşvik bölgesi için 9903_karar.pdf EK-2'ye bak.
- [SEKTÖR ARAMA ÖZEL KURALLARI]
  1. Kullanıcı NACE kodu veya yatırım konusu (Örn: "06.20.01" veya "Doğal gaz çıkarımı") verirse: Öncelikle sector_search2.txt dökümanında eşleştirme yap.
  2. "Şartlar/Dipnotlar" alanındaki kısıtları (Örn: "İstanbul'da desteklenmez", "ruhsat zorunluluğu") mutlaka belirt.
  3. Yatırımın "Hedef Yatırım" ve/veya "Öncelikli Yatırım" durumunu açıkça bildir.
  4. İl Belirtilmemişse: Asgari yatırım tutarlarını bölge bazında listele ve ilini sor.
  5. İl Belirtilmişse: İlin bölgesini tespit et ve sadece o bölgeye ait asgari yatırım tutarını yaz.
  6. Birden fazla NACE kodu eşleşirse (hiyerarşik alt dallar gibi), bunları bir liste veya hiyerarşik yapıda özetleyerek kullanıcıya en uygun olanı seçebileceği bir sunum yap.
  7. Asgari Yatırım Tutarları [KESİN KURAL]: Bölgeleri listelerken dökümandaki bölge numaralarına (1, 2, 3, 4, 5, 6) BİREBİR sadık kal. Her satırın başına "1." yazma hatasına düşme. Aynı tutara sahip olan bölgeleri "X. ve Y. Bölgeler" veya "X, Y, Z ve T. Bölgeler" şeklinde gruplandır. 
     - Örn: "1. ve 2. Bölgeler: 12.000.000 TL", "3, 4, 5 ve 6. Bölgeler: 6.000.000 TL".
     - DİKKAT: Bölge rakamlarının (3, 4, 5, 6) doğruluğunu dökümandan teyit et.
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
