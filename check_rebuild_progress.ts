
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkCount() {
    const sql = neon(process.env.DATABASE_URL!);
    const counts = await sql`SELECT metadata->>'source' as src, count(*) as count FROM rag_documents GROUP BY 1`;
    console.log("Counts per source:");
    counts.forEach((c: any) => console.log(`${c.src}: ${c.count}`));
}
checkCount();
