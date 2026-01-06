
import * as fs from 'fs';
import pdf from 'pdf-parse';
import { parseStructure } from './lib/parsing/structureParser';

async function debugHit30() {
    const dataBuffer = fs.readFileSync('d:/rag-index-tr/data/raw/HIT30.pdf');
    const data = await pdf(dataBuffer);

    const structure = parseStructure(data.text);

    console.log("Structure info:");
    console.log("Maddeler count:", structure.maddeler.length);
    const log = structure.maddeler.map((m, idx) => `[${idx + 1}] ${m.madde_no.replace(/\n/g, ' ')}`).join('\n');
    fs.writeFileSync('hit30_parse_debug.txt', log);
    console.log("Titles written to hit30_parse_debug.txt");
}

debugHit30();
