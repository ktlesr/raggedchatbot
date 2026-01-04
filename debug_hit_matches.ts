
import * as fs from 'fs';
import pdf from 'pdf-parse';

async function debugHit30Matches() {
    const dataBuffer = fs.readFileSync('d:/rag-index-tr/data/raw/HIT30.pdf');
    const data = await pdf(dataBuffer);
    const text = data.text;

    const regex = /HIT-[A-Z][a-zA-Z\s\&\-]+/g;
    let match;
    console.log("Matches found:");
    while ((match = regex.exec(text)) !== null) {
        console.log(`- Match: "${match[0].replace(/\n/g, ' ')}" at index ${match.index}`);
    }
}

debugHit30Matches();
