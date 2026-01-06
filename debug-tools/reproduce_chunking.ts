
import * as fs from 'fs';
import { createChunks } from './lib/chunking/semanticChunker';
import { BelgeYapisal } from './lib/utils/structuredData';

const parsedPath = 'd:/rag-index-tr/data/parsed/9903_kararr.pdf.json';

try {
    const rawData = fs.readFileSync(parsedPath, 'utf8');
    const data = JSON.parse(rawData) as BelgeYapisal;

    console.log(`Loaded data. Maddeler count: ${data.maddeler.length}`);

    // Find Madde 4
    const madde4 = data.maddeler.find(m => m.madde_no === "4" || m.madde_no === "(4)");
    if (madde4) {
        console.log("Madde 4 found.");
        console.log("Alt Paragraflar:", JSON.stringify(madde4.alt_paragraflar, null, 2));
    } else {
        console.log("Madde 4 NOT found.");
    }

    console.log("Generating chunks...");
    const chunks = createChunks(data);

    const madde4Chunks = chunks.filter(c => c.id.startsWith("madde_4"));
    console.log(`Madde 4 chunks count: ${madde4Chunks.length}`);
    madde4Chunks.forEach(c => {
        console.log(`- ${c.id}: ${c.metadata.konu}`);
    });

} catch (e) {
    console.error("Error:", e);
}
