
import * as fs from 'fs';
import pdf from 'pdf-parse';

async function read9495Raw() {
    const dataBuffer = fs.readFileSync('d:/rag-index-tr/data/raw/2016-9495_Proje_Bazli.pdf');
    const data = await pdf(dataBuffer);
    const index = data.text.indexOf("MADDE 12");
    if (index !== -1) {
        console.log("Found Madde 12 at", index);
        console.log(data.text.substring(index - 200, index + 800));
    } else {
        console.log("Madde 12 not found.");
    }
}

read9495Raw();
