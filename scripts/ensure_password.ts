
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function main() {
    try {
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT`;
        console.log('Password column ensured');
    } catch (error) {
        console.error('Error ensuring password column:', error);
    }
}

main();
