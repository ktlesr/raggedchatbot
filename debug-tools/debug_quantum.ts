
import * as fs from 'fs';
import pdf from 'pdf-parse';

async function findQuantum() {
    const dataBuffer = fs.readFileSync('d:/rag-index-tr/data/raw/HIT30.pdf');
    const data = await pdf(dataBuffer);
    const text = data.text;
    const index = text.indexOf("Quantum");
    const index2 = text.indexOf("Kuantum");
    console.log("Quantum index:", index);
    console.log("Kuantum index:", index2);
    if (index !== -1) {
        console.log("Context around Quantum:");
        console.log(text.substring(index - 50, index + 200));
    }
}

findQuantum();
