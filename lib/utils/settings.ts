
import { neon } from "@neondatabase/serverless";

export type ChatModel = "gpt-4o" | "gpt-4o-mini" | "gemini-2.0-flash" | "gemini-1.5-pro" | "gemini-1.5-flash";

const DEFAULT_MODEL: ChatModel = "gpt-4o";

export async function getActiveModel(): Promise<ChatModel> {
    const sql = neon(process.env.DATABASE_URL!);
    try {
        // Ensure table exists
        await sql`
      CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `;

        const result = await sql`SELECT value FROM site_settings WHERE key = 'active_model' LIMIT 1`;
        if (result.length > 0) {
            return result[0].value as ChatModel;
        }

        // Fallback and seed if not exists
        await sql`INSERT INTO site_settings (key, value) VALUES ('active_model', ${DEFAULT_MODEL}) ON CONFLICT (key) DO NOTHING`;
        return DEFAULT_MODEL;
    } catch (error) {
        console.error("Failed to get active model:", error);
        return DEFAULT_MODEL;
    }
}

export async function setActiveModel(model: ChatModel) {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
    INSERT INTO site_settings (key, value)
    VALUES ('active_model', ${model})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}
