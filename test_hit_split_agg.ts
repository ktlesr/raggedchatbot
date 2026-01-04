
import * as fs from 'fs';
import pdf from 'pdf-parse';

async function testSplitAggressive() {
    const dataBuffer = fs.readFileSync('d:/rag-index-tr/data/raw/HIT30.pdf');
    const data = await pdf(dataBuffer);
    const text = data.text;

    // Split by HIT- anywhere, but try to avoid false positives
    const blocks = text.split(/(?=HIT\-[A-Z][a-zA-Z\s\&\-]+)/g);

    console.log("Blocks found:", blocks.length);
    blocks.forEach((b, i) => {
        const title = b.substring(0, 100).replace(/\s+/g, ' ').trim();
        console.log(`[${i}] Title: ${title}...`);
    });
}

testSplitAggressive();
