
import fs from "fs/promises";


export async function loadPDFWithMetadata(filePath: string) {
    const buffer = await fs.readFile(filePath);

    // pdf-parse v1.1.1 works well with a simple function call
    // It returns { text, numpages, info, metadata, version }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdf = require("pdf-parse-fork");
    try {
        const data = await pdf(buffer);

        return [{
            text: data.text,
            page: 1, // pdf-parse extracts all text at once, so we treat it as 1 big page/doc
            totalPages: data.numpages
        }];
    } catch (error) {
        console.error("PDF Parse Error:", error);
        throw error;
    }
}
