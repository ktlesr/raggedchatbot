
import * as fs from 'fs';
import pdf from 'pdf-parse';

async function searchIn9495() {
    const dataBuffer = fs.readFileSync('d:/rag-index-tr/data/raw/2016-9495_Proje_Bazli.pdf');
    const data = await pdf(dataBuffer);
    const searchStr = "Yatırım yeri tahsisi";
    const index = data.text.indexOf(searchStr);
    if (index !== -1) {
        console.log(`Found "${searchStr}" at ${index}`);
        console.log(data.text.substring(index - 50, index + 500));
    } else {
        console.log(`"${searchStr}" not found in 9495.`);
    }
}

searchIn9495();
