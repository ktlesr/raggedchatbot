
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined');
}

const sql = neon(process.env.DATABASE_URL);

// Function to store embeddings
export async function storeEmbedding(id: string, text: string, metadata: any, embedding: number[]) {
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
