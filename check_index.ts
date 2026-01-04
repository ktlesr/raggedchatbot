import { neon } from "@neondatabase/serverless";
import * as fs from "fs";
import * as path from "path";

// Manually read .env
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), ".env");
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, "utf-8");
            envContent.split(/\r?\n/).forEach(line => {
                const parts = line.split("=");
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const value = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, '');
                    if (key && value) {
                        process.env[key] = value;
                    }
                }
            });
        }
    } catch (e) {
        console.error("Failed to load .env manually:", e);
    }
}

loadEnv();

async function checkIndex() {
    console.log("Checking if cmp1.pdf is indexed...");

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("Error: DATABASE_URL is not set.");
        return;
    }
    const sql = neon(dbUrl);

    try {
        // Check for any metadata containing 'cmp1'
        const results = await sql`
            SELECT id, metadata->>'source' as source, content 
            FROM rag_documents 
            WHERE metadata->>'source' ILIKE '%cmp1%'
            LIMIT 5;
        `;

        // Check for Ek-1 and Ek-2 specifically
        console.log("\nVerifying Ek-1 and Ek-2 contents...");
        const ekResults = await sql`
            SELECT id, metadata->>'source' as source, content, length(content) as len
            FROM rag_documents 
            WHERE id LIKE 'ek_1%' OR id LIKE 'ek_2%'
            ORDER BY id ASC;
        `;

        if (ekResults.length === 0) {
            console.log("Ek-1 or Ek-2 NOT found!");
        } else {
            ekResults.forEach(r => {
                console.log(`- ID: ${r.id} (Len: ${r.len}) | Source: ${r.source}`);
                console.log(`  Preview: ${r.content.substring(0, 100).replace(/\n/g, ' ')}...`);
            });
        }

        // List all sources to see what's in there
        const sources = await sql`
            SELECT DISTINCT metadata->>'source' as source
            FROM rag_documents
            LIMIT 20;
        `;
        console.log("\nUnique sources in DB:");
        sources.forEach(s => console.log(`- ${s.source}`));

    } catch (error) {
        console.error("DB Error:", error);
    }
}

checkIndex();
