
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

async function init() {
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL is not set');
        return;
    }

    const sql = neon(process.env.DATABASE_URL);

    console.log('Initializing user tables...');

    // Dropping to ensure clean state
    await sql`DROP TABLE IF EXISTS feedback CASCADE;`;
    await sql`DROP TABLE IF EXISTS users CASCADE;`;

    await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, 
      name TEXT,
      email TEXT UNIQUE NOT NULL,
      image TEXT,
      role TEXT DEFAULT 'user',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

    await sql`
    CREATE TABLE IF NOT EXISTS feedback (
      id SERIAL PRIMARY KEY,
      user_id TEXT, 
      message TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `;

    console.log('Tables initialized.');
}

init().catch(console.error);
