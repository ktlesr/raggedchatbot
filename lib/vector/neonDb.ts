
import { neon } from '@neondatabase/serverless';

function getSql() {
  if (!process.env.DATABASE_URL) {
    // We only throw if we are actually trying to use the DB
    throw new Error('DATABASE_URL is not defined. Please set it in your environment variables.');
  }
  return neon(process.env.DATABASE_URL);
}

// Function to store embeddings
export async function storeEmbedding(id: string, text: string, metadata: any, embedding: number[]) {
  const sql = getSql();

  // Ensure extension and table exist
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  await sql`
      CREATE TABLE IF NOT EXISTS rag_documents (
        id TEXT PRIMARY KEY,
        content TEXT,
        metadata JSONB,
        embedding vector(1536)
      );
    `;

  // Insert data
  await sql`
      INSERT INTO rag_documents (id, content, metadata, embedding)
      VALUES (${id}, ${text}, ${JSON.stringify(metadata)}, ${JSON.stringify(embedding)})
      ON CONFLICT (id) DO UPDATE SET
      content = EXCLUDED.content,
      metadata = EXCLUDED.metadata,
      embedding = EXCLUDED.embedding;
    `;
}

// Function to search similar documents
export async function searchSimilarDocuments(embedding: number[], topK: number = 5) {
  const sql = getSql();
  const vectorStr = JSON.stringify(embedding);

  // Cosine similarity search using pgvector (<=> is distance, so ORDER BY ASC)
  const result = await sql`
      SELECT id, content, metadata, 1 - (embedding <=> ${vectorStr}::vector) as similarity
      FROM rag_documents
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${topK};
    `;

  return result;
}
