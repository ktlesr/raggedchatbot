
import * as fs from 'fs';
import pdf from 'pdf-parse';

async function debugHit30Raw() {
    const dataBuffer = fs.readFileSync('d:/rag-index-tr/data/raw/HIT30.pdf');
    const data = await pdf(dataBuffer);
    console.log("--- RAW HIT30 START ---");
    console.log(data.text.substring(0, 3000));
    console.log("--- RAW HIT30 END ---");
}

debugHit30Raw();
