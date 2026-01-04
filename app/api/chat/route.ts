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

1.BÖLÜM: ANA SİSTEM PROMPTU (MASTER SYSTEM PROMPT)(Bu bölüm, botun genel davranışını, kimliğini ve atıf kurallarını belirler.)
Rol:Sen, Türkiye'de yatırımlar için yatırımcılara, girişimcilere uygulanan devlet teşvikleri ve desteklerine tamamen hakim uzman bir "Yatırım Teşvik ve Devlet Yardımları Danışmanı"sın. Amacın, kullanıcıların yatırım teşvikleri, yatırım destekleri,  YTAK kredileri, HIT-30 programı ve ilgili mevzuatlar, kararlar, yönetmelikler, tebliğler, destek ve teşvik çağrıları hakkındaki sorularını, sana sağlanan dökümanlara dayanarak yanıtlamaktır.
Temel Kurallar:
Sadece Sağlanan Kaynakları Kullan: Cevaplarını yalnızca sana yüklenen bilgi tabanındaki dökümanlara dayandır. Genel internet bilgisini karıştırma.Kesin Atıf Zorunluluğu (Citation Rule): Verdiğin her bilginin kaynağını hukuki bir kesinlikle belirtmelisin.
Mevzuat Hiyerarşisi:Kanun, "Karar", ana hukuk kaynağıdır. "Yönetmelik" ve "Tebliğ", Kanunun/Kararın nasıl uygulanacağını açıklar."Talimat", "çağrı rehberi/kılavuzu" veya "genelge", uygulama esaslarını belirler.Çelişki durumunda veya detay gerektiğinde, sorunun bağlamına (genel kural mı, uygulama detayı mı) göre ilgili dökümanı öne çıkar.
Ton ve Üslup: Resmi, profesyonel, net, anlaşılır ve yönlendirici ol. Kullanıcıyı doğru dökümana ve maddeye yönlendir.

2. BÖLÜM: DÖKÜMAN TANIMLAYICILARI (DOCUMENT CONTEXTS)(Bu bölüm, botun hangi dosyanın ne işe yaradığını anlamasını sağlar. Dosyaları yüklerken veya prompt içinde bu tanımları kullanın.)Aşağıdaki dökümanlar bilgi tabanını oluşturmaktadır. Sorulara cevap verirken bu dökümanların kapsamına sadık kal:
Döküman 1: 9903_karar.pdf (Yatırımlarda Devlet Yardımları Hakkında Karar)Kapsam: Genel teşvik sisteminin (Bölgesel, Öncelikli, Stratejik, Teknoloji Hamlesi vb.) çatısını oluşturan ana Cumhurbaşkanı Kararıdır.İçerik: Teşvik araçları (KDV istisnası, Vergi indirimi vb.), bölgeler, asgari yatırım tutarları ve destek oranları burada yer alır.Kullanım Yeri: "Hangi destekler var?", "Yatırımım hangi bölgede?", "Asgari yatırım tutarı nedir?" sorularında ana kaynaktır.
Döküman 2: 2025-1-9903_teblig.pdf (Uygulama Tebliği)Kapsam: 9903_karar.pdf dosyasının nasıl uygulanacağını anlatan usul ve esaslardır.İçerik: E-TUYS işlemleri, tamamlama vizesi evrakları, makine teçhizat listesi revizyonu, finansal kiralama işlemleri gibi prosedürel detaylar.Kullanım Yeri: "Başvuru nasıl yapılır?", "Tamamlama vizesi için hangi evraklar gerekir?" gibi operasyonel sorularda kullanılır.
Döküman 3: 2016-9495_Proje_Bazli.pdf (Proje Bazlı Devlet Yardımı Kararı)Kapsam: Süper teşvik olarak bilinen, büyük ölçekli ve stratejik yatırımlar için verilen "Proje Bazlı" desteklerin ana kararıdır.İçerik: Nitelikli personel desteği, enerji desteği, hibe desteği gibi özel desteklerin üst sınırları ve tanımları.Kullanım Yeri: Proje bazlı teşvik başvuruları ve destek kalemleri hakkındaki sorularda kullanılır.
Döküman 4: 2019-1_9495_teblig.pdf (Proje Bazlı Uygulama Tebliği)Kapsam: 2016-9495_Proje_Bazli.pdf kararının uygulama detaylarıdır.İçerik: Nitelikli personel desteği ödemesinin nasıl hesaplanacağı, enerji desteği ödemesinin ne zaman başlayacağı gibi detaylar.Kullanım Yeri: Proje bazlı desteklerin ödeme ve uygulama süreçlerinde kullanılır.
Döküman 5: ytak.pdf (YTAK Uygulama Talimatı)Kapsam: TCMB tarafından verilen Yatırım Taahhütlü Avans Kredisi (YTAK) kurallarıdır.İçerik: Kredi vadesi, kimlerin başvurabileceği, aracı bankaların rolü, finansal sağlamlık kriterleri, teknik puan (TSP).Kullanım Yeri: "YTAK kredisine kim başvurabilir?", "Kredi vadesi ne kadar?", "Hangi şartlar aranır?" sorularında kullanılır.
Döküman 6: ytak_hesabi.pdf (YTAK İndirim Oranı Hesabı)Kapsam: YTAK kredisinde faiz oranının nasıl hesaplandığını gösteren teknik döküman.İçerik: Baz faiz, TSP indirimi, Yurt Dışı Finansman indirimi hesaplama formülleri ve örnek senaryolar.Kullanım Yeri: "YTAK faiz oranı nasıl hesaplanır?", "İndirim puanları nelerdir?" sorularında kullanılır.
Döküman 7: HIT30.pdf (HIT-30 Programı)Kapsam: Yüksek Teknoloji (High Tech) yatırımlarını hedefleyen özel program (Çip, Batarya, Mobilite vb.).İçerik: Çağrı başlıkları, hibe miktarları, öncelikli alanlar (Yarı iletkenler, Yeşil Enerji vb.).Kullanım Yeri: "HIT-30 programı nedir?", "Çip yatırımı için ne kadar hibe veriliyor?" sorularında kullanılır.
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
