
import { BelgeYapisal, Tanimlar } from "@/lib/utils/structuredData";

export function parseStructure(fullText: string): BelgeYapisal {
    const result: BelgeYapisal = {
        belge_bilgisi: {
            ad: "Yatırımlarda Devlet Yardımları Hakkında Karar",
            tarih: "2024",
            yururluk_tarihi: "2026-01-01"
        },
        maddeler: [],
        tanimlar: {},
        ekler: {}
    };

    const normalized = fullText.replace(/\r\n/g, "\n");

    // --- 1. Identify all Madde markers (Standard & Gecici) ---
    // Combined regex to identify split points
    const markerRegex = /\n\s*(MADDE|GEÇİCİ\s+MADDE)\s+(\d+)[\s\-\.–]*/gi;

    let match;
    const markers: { type: string, no: string, index: number, length: number }[] = [];
    while ((match = markerRegex.exec(normalized)) !== null) {
        markers.push({
            type: match[1].toUpperCase(),
            no: match[2],
            index: match.index,
            length: match[0].length
        });
    }

    // --- 2. Process based on markers ---
    for (let i = 0; i < markers.length; i++) {
        const current = markers[i];
        const next = markers[i + 1];

        const maddeStart = current.index + current.length;
        const maddeEnd = next ? next.index : normalized.length;

        const icerik = normalized.substring(maddeStart, maddeEnd).trim();

        // Find title: Look at text before current.index
        const prevEnd = i === 0 ? 0 : markers[i - 1].index + markers[i - 1].length;
        const pretext = normalized.substring(prevEnd, current.index).trim();
        const lines = pretext.split('\n').filter(l => l.trim());

        // The title is the last line before "MADDE X"
        // But exclude things that look like "YEDİNCİ BÖLÜM" or page numbers
        let baslikRaw = lines.length > 0 ? lines[lines.length - 1].trim() : "";
        if (baslikRaw.match(/^\d+$/) && lines.length > 1) { // It's probably a page number
            baslikRaw = lines[lines.length - 2].trim();
        }

        const isGecici = current.type.includes("GEÇİCİ");
        const displayMaddeNo = isGecici ? `Geçici ${current.no}` : current.no;
        const baslik = baslikRaw || (isGecici ? "Geçici Madde" : "Madde");

        // Parse sub-clauses
        const altParagraflar = extractSubClauses(icerik);

        // Tanımlar check
        if (!isGecici && baslik.toLowerCase().includes("tanımlar")) {
            result.tanimlar = parseDefinitions(icerik);
        }

        result.maddeler.push({
            madde_no: displayMaddeNo,
            başlık: baslik,
            içerik: icerik,
            alt_paragraflar: altParagraflar.length > 0 ? altParagraflar : undefined
        });
    }

    // --- 3. Ekleri Ayrıştır ---
    const ekRegex = /\n\s*EK\s*[\-\–]?\s*(\d+)([^\n]*)\n([\s\S]*?)(?=\n\s*EK\s*[\-\–]?\s*\d+|\n\s*(?:MADDE|GEÇİCİ\s+MADDE)\s+\d+|$)/gi;
    while ((match = ekRegex.exec(normalized)) !== null) {
        const ekNo = match[1];
        const ekBaslik = match[2]?.trim() || "";
        const content = match[3].trim();

        result.ekler[`ek_${ekNo}`] = {
            id: `ek_${ekNo}`,
            baslik: `Ek-${ekNo} ${ekBaslik}`,
            icerik: content
        };
    }

    // --- 4. Fallback (if no standard structure) ---
    if (result.maddeler.length === 0 && Object.keys(result.ekler).length === 0) {
        fallbackParse(normalized, result);
    }

    return result;
}

function extractSubClauses(icerik: string) {
    const altParagraflar: { paragraf: string, metin: string }[] = [];
    const numberedParaRegex = /^\s*\((\d+)\)\s+(.*)/;
    const colonHeaderRegex = /^\s*([A-ZİĞÜŞÖÇ][^:\n\(\)]{2,}):\s+(.*)/;

    const lines = icerik.split('\n');
    let currentParagraf = "";
    let currentMetin: string[] = [];
    let k = 1;

    for (const line of lines) {
        if (!line.trim()) continue;

        const numMatch = line.match(numberedParaRegex);
        const colonMatch = line.match(colonHeaderRegex);

        if (numMatch) {
            if (currentParagraf) {
                altParagraflar.push({ paragraf: currentParagraf, metin: currentMetin.join(" ").trim() });
            }
            currentParagraf = numMatch[1];
            currentMetin = [numMatch[2].trim()];
        } else if (colonMatch) {
            if (currentParagraf) {
                altParagraflar.push({ paragraf: currentParagraf, metin: currentMetin.join(" ").trim() });
            }
            currentParagraf = `ek_${k++}`;
            currentMetin = [line.trim()];
        } else if (currentParagraf) {
            currentMetin.push(line.trim());
        }
    }

    if (currentParagraf) {
        altParagraflar.push({ paragraf: currentParagraf, metin: currentMetin.join(" ").trim() });
    }
    return altParagraflar;
}

function parseDefinitions(text: string): Tanimlar {
    const defs: Tanimlar = {};
    const lines = text.split('\n');
    lines.forEach(line => {
        if (line.includes(':')) {
            const parts = line.split(':');
            if (parts.length >= 2) {
                const key = parts[0].trim().replace(/^[a-zçğıöşuü]\)\s+/, '');
                const val = parts.slice(1).join(':').trim();
                if (key && val && key.length < 50) {
                    defs[key] = val;
                }
            }
        }
    });
    return defs;
}

function fallbackParse(normalized: string, result: BelgeYapisal) {
    const blocks = normalized.split(/(?=HIT\-[\s\n]*[A-Z0-9])/gi);
    blocks.forEach((block, idx) => {
        const trimmed = block.trim();
        if (!trimmed) return;
        const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l);
        let title = lines[0];
        if (title === "HIT-" && lines.length > 1) {
            title += " " + lines[1];
        }
        const maddeNo = title.startsWith("HIT-") ? title.substring(0, 50) : (idx === 0 ? "Giriş" : `Bölüm ${idx}`);
        result.maddeler.push({
            madde_no: maddeNo,
            başlık: title.substring(0, 100),
            içerik: trimmed
        });
    });

    if (result.maddeler.length === 0) {
        result.maddeler.push({
            madde_no: "Genel",
            başlık: "Döküman İçeriği",
            içerik: normalized
        });
    }
}
