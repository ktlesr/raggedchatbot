
import { BelgeYapisal, Tanimlar } from "@/lib/utils/structuredData";

export function parseStructure(fullText: string): BelgeYapisal {
    const result: BelgeYapisal = {
        belge_bilgisi: {
            ad: "Yatırımlarda Devlet Yardımları Hakkında Karar",
            tarih: "2023",
            yururluk_tarihi: "2026-01-01"
        },
        maddeler: [],
        tanimlar: {},
        ekler: {}
    };

    // Normalize text partially
    const normalized = fullText.replace(/\r\n/g, "\n");

    // --- 1. Maddeleri Ayrıştır ---
    const maddeRegex = /MADDE\s+(\d+)[\s\-\.–]+([^\n]+)\n([\s\S]*?)(?=\n\s*MADDE\s+\d+|\n\s*EK\s*[\-\d]|GEÇİCİ\s+MADDE|$)/gi;

    let match;
    while ((match = maddeRegex.exec(normalized)) !== null) {
        processMaddeMatch(match, result, false);
    }

    // --- 1.5 Geçici Maddeleri Ayrıştır ---
    const geciciRegex = /GEÇİCİ\s+MADDE\s+(\d+)[\s\-\.–]*([^\n]*)\n([\s\S]*?)(?=\n\s*MADDE\s+\d+|\n\s*EK\s*[\-\d]|GEÇİCİ\s+MADDE|$)/gi;
    while ((match = geciciRegex.exec(normalized)) !== null) {
        processMaddeMatch(match, result, true);
    }

    // --- 2. Ekleri Ayrıştır ---
    const ekRegex = /EK[\s\-](\d+)([^\n]*)\n([\s\S]*?)(?=\n\s*EK[\s\-]\d+|$)/gi;
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

    // --- 3. Fallback for non-standard structured docs (like HIT-30) ---
    if (result.maddeler.length === 0 && Object.keys(result.ekler).length === 0) {
        // Split by HIT- pattern with lookahead
        const blocks = normalized.split(/\n(?=HIT-[\s\n]*[A-Z0-9])/gi);

        blocks.forEach((block, idx) => {
            const trimmed = block.trim();
            if (!trimmed) return;

            // Extract title: Take first few short lines that start with HIT- or look like a header
            const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l);
            if (lines.length === 0) return;

            let title = lines[0];

            // If title is just "HIT-" or very short, try to append next lines if they are short
            if (title.startsWith("HIT-") && title.length < 25 && lines.length > 1) {
                if (lines[1].length < 40) {
                    title += " " + lines[1];
                    if (lines.length > 2 && lines[2].length < 40 && lines[2].startsWith("(")) {
                        title += " " + lines[2];
                    }
                }
            }

            result.maddeler.push({
                madde_no: title.substring(0, 50),
                başlık: title.substring(0, 100),
                içerik: trimmed
            });
        });

        // Ensure we didn't lose the very first part if it didn't start with HIT-
        if (result.maddeler.length === 0) {
            result.maddeler.push({
                madde_no: "Genel",
                başlık: "Döküman İçeriği",
                içerik: normalized
            });
        }
    }

    return result;
}

function parseDefinitions(text: string): Tanimlar {
    const defs: Tanimlar = {};
    // Format: "Tanım: Açıklama" veya "Tanım; Açıklama" veya satır başı "Tanım"
    // Genelde: "a) Yatırım: .... b) Teşvik: ...." formatı yaygındır Yönetmeliklerde.

    // Regex for "a) ... :" or just list items


    // Basit satır bazlı yaklaşım veya noktalı virgül
    // Bu örnek için varsayım: Satır başı Terim : Açıklama
    const lines = text.split('\n');
    lines.forEach(line => {
        if (line.includes(':')) {
            const parts = line.split(':');
            if (parts.length >= 2) {
                const key = parts[0].trim().replace(/^[a-z]\)\s+/, '');
                const val = parts.slice(1).join(':').trim();
                if (key && val) {
                    defs[key] = val;
                }
            }
        }
    });

    return defs;
}

function processMaddeMatch(match: RegExpExecArray, result: BelgeYapisal, isGecici: boolean) {
    const maddeNo = match[1].trim();
    const baslikRaw = match[2]?.trim() || "";
    const icerik = match[3].trim();

    // Prefix if Gecici
    const displayMaddeNo = isGecici ? `Geçici ${maddeNo}` : maddeNo;
    const baslik = isGecici && !baslikRaw ? "Geçici Madde" : baslikRaw;
    // Alt paragrafları ayır ( (1), (2) gibi ) ve Başlıklı maddeleri ayır
    const altParagraflar: { paragraf: string, metin: string }[] = [];

    const lines = icerik.split('\n');
    let currentParagraf = "";
    let currentMetin: string[] = [];
    let k = 1; // Counter for colon headers

    // Regex helpers
    // Stricter Regex: Must have parentheses like (1), (2) to avoid matching "400 Bin TL"
    const numberedParaRegex = /^\s*\((\d+)\)\s+(.*)/;
    const colonHeaderRegex = /^\s*([A-ZİĞÜŞÖÇ][^:\n\(\)]+):\s+(.*)/;

    for (const line of lines) {
        if (!line.trim()) continue; // Skip empty lines

        const numMatch = line.match(numberedParaRegex);
        const colonMatch = line.match(colonHeaderRegex);

        if (numMatch) {
            // Save previous
            if (currentParagraf) {
                altParagraflar.push({ paragraf: currentParagraf, metin: currentMetin.join(" ").trim() });
            }
            // Start new numbered paragraph
            currentParagraf = numMatch[1];
            currentMetin = [numMatch[2].trim()];
        } else if (colonMatch) {
            // Save previous
            if (currentParagraf) {
                altParagraflar.push({ paragraf: currentParagraf, metin: currentMetin.join(" ").trim() });
            }
            // Start new colon header paragraph
            currentParagraf = `ek_${k++}`;
            // Include the Title in the text? Yes, usually good context.
            // The regex captures Title in [1] and Content in [2].
            // We want the full line "Title: Content"
            currentMetin = [line.trim()];
        } else {
            // Continuation of previous paragraph or initial text
            if (currentParagraf) {
                currentMetin.push(line.trim());
            } else {
                // Should belong to the main 'content' (which we store in 'icerik' usually) but here 
                // we are parsing sub-structures. If it's the very start, it might not have caught a number yet.
                // But typically Madde text starts with (1). 
                // Any text before the first (1) or Header is usually part of the main clause index, 
                // but processMaddeMatch separates title/icerik.
                // Let's assume it belongs to the 'main' content or attach to previous if any.
                // If it's at the start and we have no currentParagraf, we can discard or add to a "intro" section.
                // Actually 'icerik' variable of the Madde holds the full text. 
                // alt_paragraflar is extracting *pieces'.
                // Just dropping unconnected lines might mean losing data if we purely rely on alt_paragraflar for chunks? 
                // No, createChunks uses 'icerik' for the main chunk. 
                // So adding continuation here is only relevant if we are INSIDE a sub-paragraph.
                // If we haven't started a sub-paragraph yet, this line is part of the preamble, which is already in 'icerik'.
                // So we can ignore it here IF we only want structured sub-parts.
            }
        }
    }

    // Push the last one
    if (currentParagraf) {
        altParagraflar.push({ paragraf: currentParagraf, metin: currentMetin.join(" ").trim() });
    }


    // Özel: Tanımlar Maddesi (Genellikle Madde 2 veya 3)
    if (!isGecici && baslik.toLowerCase().includes("tanımlar")) {
        // Tanımları parse et
        const definitions = parseDefinitions(icerik);
        result.tanimlar = definitions;
    }

    result.maddeler.push({
        madde_no: displayMaddeNo,
        başlık: baslik,
        içerik: icerik,
        alt_paragraflar: altParagraflar.length > 0 ? altParagraflar : undefined
    });
}
