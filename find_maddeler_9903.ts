
import * as fs from 'fs';
import pdf from 'pdf-parse';

async function findMaddeler() {
    const dataBuffer = fs.readFileSync('d:/rag-index-tr/data/raw/9903_karar.pdf');
    const data = await pdf(dataBuffer);

    const regex = /Madde\s+(\d+)/gi;
    let match;
    console.log("Found Madde patterns:");
    while ((match = regex.exec(data.text)) !== null) {
        const start = Math.max(0, match.index - 50);
        const end = Math.min(data.text.length, match.index + 200);
        console.log(`- Match: "${match[0]}" at ${match.index}`);
        console.log(`  Context: ${data.text.substring(start, end).replace(/\n/g, ' ')}`);
        console.log("---------------------------------------------------");
    }
}

findMaddeler();
