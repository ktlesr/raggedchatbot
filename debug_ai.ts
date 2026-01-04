
import * as fs from 'fs';
import pdf from 'pdf-parse';

async function debugAroundAI() {
    const dataBuffer = fs.readFileSync('d:/rag-index-tr/data/raw/HIT30.pdf');
    const data = await pdf(dataBuffer);
    const text = data.text;
    console.log("TEXT AROUND HIT-AI:");
    console.log(text.substring(6400, 10000));
}

debugAroundAI();
