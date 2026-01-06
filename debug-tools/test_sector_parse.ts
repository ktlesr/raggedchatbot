
import * as fs from 'fs';
import { parseSectorSearch } from './lib/parsing/sectorParser';

async function testSectorParsing() {
    const content = fs.readFileSync('d:/rag-index-tr/data/raw/sector_search2.txt', 'utf-8');
    const records = parseSectorSearch(content);

    console.log(`Total records parsed: ${records.length}`);
    if (records.length > 0) {
        console.log("First record:", JSON.stringify(records[0], null, 2));
        console.log("Last record:", JSON.stringify(records[records.length - 1], null, 2));
    }
}

testSectorParsing();
