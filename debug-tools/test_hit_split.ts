
import * as fs from 'fs';
import pdf from 'pdf-parse';

async function testSplit() {
    const dataBuffer = fs.readFileSync('d:/rag-index-tr/data/raw/HIT30.pdf');
    const data = await pdf(dataBuffer);
    const text = data.text;

    // Split by HIT- even if no newline
    const blocks = text.split(/(?=HIT-[A-Z][a-zA-Z\s\&\-]+(?:\(|\n|$))/g);

    console.log("Blocks found:", blocks.length);
    blocks.forEach((b, i) => {
        if (i < 15) {
            console.log(`[${i}] Title candidate: ${b.substring(0, 50).replace(/\n/g, ' ')}...`);
        }
    });
}

testSplit();
