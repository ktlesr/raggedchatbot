
import * as fs from 'fs';
import pdf from 'pdf-parse';

async function debugHit30Pages() {
    const dataBuffer = fs.readFileSync('d:/rag-index-tr/data/raw/HIT30.pdf');

    // Custom pagerender to keep page separation
    const options = {
        pagerender: function (pageData: any) {
            return pageData.getTextContent().then(function (textContent: any) {
                let lastY, text = '';
                for (let item of textContent.items) {
                    if (lastY == item.transform[5] || !lastY) {
                        text += item.str;
                    } else {
                        text += '\n' + item.str;
                    }
                    lastY = item.transform[5];
                }
                return text + '\n---PAGE_BREAK---\n';
            });
        }
    };

    const data = await pdf(dataBuffer, options);
    const pages = data.text.split('---PAGE_BREAK---');

    pages.forEach((page, i) => {
        console.log(`\n\n--- PAGE ${i + 1} START ---`);
        console.log(page.substring(0, 1000));
        console.log(`--- PAGE ${i + 1} END ---`);
    });
}

debugHit30Pages();
