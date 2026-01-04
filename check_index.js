const { neon } = require("@neondatabase/serverless");
require("dotenv").config();

async function checkIndex() {
  console.log("Checking if cmp1.pdf is indexed...");

  if (!process.env.DATABASE_URL) {
    console.error("Error: DATABASE_URL is not set.");
    return;
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    const results = await sql`
            SELECT id, metadata->>'source' as source, LEFT(content, 100) as preview 
            FROM rag_documents 
            WHERE metadata->>'source' ILIKE '%cmp1%'
            LIMIT 10;
        `;

    if (results.length === 0) {
      console.log("cmp1.pdf NOT found in metadata 'source' field.");
      const contentResults = await sql`
                SELECT id, LEFT(content, 100) as preview 
                FROM rag_documents 
                WHERE content ILIKE '%Adıyaman%' AND content ILIKE '%Ağrı%'
                LIMIT 5;
            `;
      console.log("Adıyaman/Ağrı search results:", contentResults.length);
    } else {
      console.log(
        `Found ${results.length} chunks from source: ${results[0].source}`,
      );
      results.forEach((r) => console.log(`- ${r.id}: ${r.preview}...`));
    }

    const distinctSources =
      await sql`SELECT DISTINCT metadata->>'source' as source FROM rag_documents LIMIT 50`;
    console.log(
      "\nSources in DB:",
      distinctSources.map((s) => s.source).join(", "),
    );
  } catch (error) {
    console.error("DB Error:", error);
  }
}

checkIndex();
