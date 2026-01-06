
import * as fs from 'fs';
import pdf from 'pdf-parse';
import { parseStructure } from './lib/parsing/structureParser';

async function debugHit30Detailed() {
    const dataBuffer = fs.readFileSync('d:/rag-index-tr/data/raw/HIT30.pdf');
    const data = await pdf(dataBuffer);

    const structure = parseStructure(data.text);

    console.log("Structure info:");
    console.log("Maddeler count:", structure.maddeler.length);
    for (let i = 0; i < Math.min(5, structure.maddeler.length); i++) {
        const m = structure.maddeler[i];
        console.log(`\n--- BLOCK [${i + 1}] ID: ${m.madde_no.replace(/\n/g, ' ')} ---`);
        console.log("TITLE:", m.başlık);
        console.log("CONTENT PREVIEW (200 chars):", m.içerik.substring(0, 200).replace(/\n/g, ' '));
        console.log("CONTENT FULL:", m.içerik);
    }
}

debugHit30Detailed();
