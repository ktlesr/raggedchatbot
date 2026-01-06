
import * as fs from 'fs';
import pdf from 'pdf-parse';

async function findMaddeler() {
    const dataBuffer = fs.readFileSync('d:/rag-index-tr/data/raw/9903_karar.pdf');
    const data = await pdf(dataBuffer);

    // We want to see how "Madde 21" looks like in the raw text.
    // It might be split like "Mad\nde 21" or "M a d d e 2 1" if it's a weird PDF.

    // Let's search for "21" and look at context
    const regex = /21/g;
    let match;
    const items = [];
    while ((match = regex.exec(data.text)) !== null) {
        const context = data.text.substring(match.index - 30, match.index + 100).replace(/\n/g, ' ');
        if (context.includes("Madde") || context.includes("MADDE") || context.includes("tahsis")) {
            items.push({ index: match.index, context });
        }
    }
    console.log("Found context for '21' with 'Madde' or 'tahsis':");
    console.log(JSON.stringify(items, null, 2));
}

findMaddeler();
