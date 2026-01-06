
import * as fs from 'fs';
import pdf from 'pdf-parse';

async function readRawPdf() {
    const dataBuffer = fs.readFileSync('d:/rag-index-tr/data/raw/9903_karar.pdf');
    const data = await pdf(dataBuffer);
    console.log("Raw Text Sample (around 5000-8000 chars):");
    const index = data.text.indexOf("Madde 21-");
    if (index !== -1) {
        console.log(data.text.substring(index - 500, index + 1500));
    } else {
        console.log("Madde 21- not found in raw text.");
        console.log(data.text.substring(0, 2000));
    }
}

readRawPdf();
