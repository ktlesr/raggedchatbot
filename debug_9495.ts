
import * as fs from 'fs';
import pdf from 'pdf-parse';

async function check9495() {
    const dataBuffer = fs.readFileSync('d:/rag-index-tr/data/raw/2016-9495_Proje_Bazli.pdf');
    const data = await pdf(dataBuffer);

    const regex = /Madde\s+(\d+)/gi;
    let match;
    console.log("Matches in 9495:");
    while ((match = regex.exec(data.text)) !== null) {
        const start = Math.max(0, match.index - 50);
        const end = Math.min(data.text.length, match.index + 200);
        console.log(`- Match at ${match.index}: ${match[0]}`);
        console.log(`  Context: ${data.text.substring(start, end).replace(/\n/g, ' ')}`);
        console.log("---------------------------------------------------");
    }
}

check9495();
