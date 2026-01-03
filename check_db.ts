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

async function main() {
    console.log("Checking Database Content...");

    if (!process.env.DATABASE_URL) {
        console.error("Error: DATABASE_URL is not set.");
        process.exit(1);
    }

    const sql = neon(process.env.DATABASE_URL);


    try {
        // 1. Check total count
        const countResult = await sql`SELECT count(*) FROM rag_documents`;
        console.log(`Total documents in DB: ${countResult[0].count}`);

        // 2. Check for specific chunks related to Madde 4
        console.log("\nSearching for chunks with ID starting 'madde_4'...");
        const chunks = await sql`SELECT id, content, metadata FROM rag_documents WHERE id LIKE 'madde_4%'`;

        if (chunks.length === 0) {
            console.log("No chunks found for madde_4!");
        } else {
            chunks.forEach(c => {
                console.log(`- ID: ${c.id}`);
                console.log(`  Preview: ${c.content.substring(0, 50)}...`);
                console.log(`  Metadata: ${JSON.stringify(c.metadata)}`);
            });
        }

    } catch (error) {
        console.error("Database connection error:", error);
    }
}

main();
