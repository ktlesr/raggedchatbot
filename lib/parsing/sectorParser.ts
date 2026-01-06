
export interface SectorRecord {
    nace: string;
    topic: string;
    target: string; // EVET/HAYIR
    priority: string;
    highTech: string;
    midHighTech: string;
    hamle: string;
    conditions: string;
    minInvestments: string; // We can keep it as string for the chunk, or parse it
}

export function parseSectorSearch(content: string): SectorRecord[] {
    // Split by "NACE KODU:" but keep the delimiter
    const blocks = content.split(/(?=NACE KODU:)/);
    const records: SectorRecord[] = [];

    for (const block of blocks) {
        if (!block.trim()) continue;

        const record: Partial<SectorRecord> = {};

        // Extract fields using regex
        const naceMatch = block.match(/NACE KODU:\s*(.*?),\s*YATIRIM KONUSU:/s);
        const topicMatch = block.match(/YATIRIM KONUSU:\s*(.*?),\s*HEDEF YATIRIM DURUMU:/s);
        const targetMatch = block.match(/HEDEF YATIRIM DURUMU:\s*(.*?),\s*ÖNCELİKLİ YATIRIM DURUMU:/s);
        const priorityMatch = block.match(/ÖNCELİKLİ YATIRIM DURUMU:\s*(.*?),\s*YÜKSEK TEKNOLOJİ YATIRIM DURUMU:/s);
        const highTechMatch = block.match(/YÜKSEK TEKNOLOJİ YATIRIM DURUMU:\s*(.*?),\s*ORTA-YÜKSEK TEKNOLOJİ YATIRIM DURUMU:/s);
        const midHighTechMatch = block.match(/ORTA-YÜKSEK TEKNOLOJİ YATIRIM DURUMU:\s*(.*?),\s*TEKNOLOJİ HAMLESİ YATIRIM DURUMU:/s);
        const hamleMatch = block.match(/TEKNOLOJİ HAMLESİ YATIRIM DURUMU:\s*(.*?),\s*YATIRIM ŞARTLARI VE DİPNOTLAR:/s);
        const conditionsMatch = block.match(/YATIRIM ŞARTLARI VE DİPNOTLAR:\s*(.*?),\s*BÖLGELERE GÖRE ASGARİ YATIRIM TUTARLARI:/s);
        const minInvestMatch = block.match(/BÖLGELERE GÖRE ASGARİ YATIRIM TUTARLARI:\s*(.*)$/s);

        record.nace = naceMatch ? naceMatch[1].trim() : "";
        record.topic = topicMatch ? topicMatch[1].trim() : "";
        record.target = targetMatch ? targetMatch[1].trim() : "";
        record.priority = priorityMatch ? priorityMatch[1].trim() : "";
        record.highTech = highTechMatch ? highTechMatch[1].trim() : "";
        record.midHighTech = midHighTechMatch ? midHighTechMatch[1].trim() : "";
        record.hamle = hamleMatch ? hamleMatch[1].trim() : "";
        record.conditions = conditionsMatch ? conditionsMatch[1].trim().replace(/_x000D_/g, "") : "";
        record.minInvestments = minInvestMatch ? minInvestMatch[1].trim().replace(/_x000D_/g, "") : "";

        if (record.nace) {
            records.push(record as SectorRecord);
        }
    }

    return records;
}
