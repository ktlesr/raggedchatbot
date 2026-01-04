import { neon } from "@neondatabase/serverless";
import * as fs from "fs";
import * as path from "path";

// Manually read .env
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), ".env");
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, "utf-8");
            envContent.split("\n").forEach(line => {
                const parts = line.split("=");
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const value = parts.slice(1).join("=").trim();
                    if (key && value && !process.env[key]) {
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

    if (!process.env.DATABASE_URL) {
        console.error("Error: DATABASE_URL is not set.");
        return;
    }

    const sql = neon(process.env.DATABASE_URL);

    try {
        // Check for any metadata containing 'cmp1'
        const results = await sql`
            SELECT id, metadata->>'source' as source, content 
            FROM rag_documents 
            WHERE metadata->>'source' ILIKE '%cmp1%'
            LIMIT 5;
        `;

        if (results.length === 0) {
            console.log("cmp1.pdf NOT found in metadata 'source' field.");
            // Check literal search in content
            const contentResults = await sql`
                SELECT id, content 
                FROM rag_documents 
                WHERE content ILIKE '%Cazibe Merkezleri Programı Kapsamındaki İller%'
                LIMIT 5;
            `;
            if (contentResults.length === 0) {
                console.log("Title string NOT found in content either.");
            } else {
                console.log(`Found string in ${contentResults.length} chunks. Example ID: ${contentResults[0].id}`);
            }
        } else {
            console.log(`Found ${results.length} chunks from source: ${results[0].source}`);
        }

        // List all sources to see what's in there
        const sources = await sql`
            SELECT DISTINCT metadata->>'source' as source
            FROM rag_documents
            LIMIT 20;
        `;
        console.log("\nRecent unique sources in DB:");
        sources.forEach(s => console.log(`- ${s.source}`));

    } catch (error) {
        console.error("DB Error:", error);
    }
}

checkIndex();
