
const testText = `
Amaç ve kapsam
MADDE 1- (1) Bu Kararın amacı...

Tanımlar
MADDE 2- (1) Bu Kararda geçen;
a) Bakanlık: Sanayi ve Teknoloji Bakanlığını...

Yatırım yeri tahsisi
Madde 21- (1) Bakanlıkça teşvik belgesi...
Vergi indirimi öngörülmeyen yatırımlar...

ALT BÖLGE DESTEĞİNDEN YARARLANACAK YATIRIMLAR
Madde 22- (1) Bu Karar kapsamında...
`;

function testParse(text) {
    const regex = /\n\s*(?:MADDE|GEÇİCİ\s+MADDE)\s+(\d+)[\s\-\.–]*/gi;

    let match;
    const markers = [];
    while ((match = regex.exec(text)) !== null) {
        markers.push({
            no: match[1],
            index: match.index,
            length: match[0].length
        });
    }

    for (let i = 0; i < markers.length; i++) {
        const current = markers[i];
        const next = markers[i + 1];

        const maddeStart = current.index + current.length;
        const maddeEnd = next ? next.index : text.length;

        const rawContent = text.substring(maddeStart, maddeEnd).trim();

        // Find title: Look at text BEFORE current.index
        const prevStart = i === 0 ? 0 : markers[i - 1].index + markers[i - 1].length;
        const pretext = text.substring(prevStart, current.index).trim();
        const lines = pretext.split('\n').filter(l => l.trim());
        const title = lines.length > 0 ? lines[lines.length - 1].trim() : "";

        console.log(`--- Madde ${current.no} ---`);
        console.log(`Title: ${title}`);
        console.log(`Snippet: ${rawContent.substring(0, 60)}...`);
    }
}

testParse(testText);
