
import { neon } from "@neondatabase/serverless";

export type ChatModel =
  | "gpt-4o" | "gpt-4o-mini"
  | "gemini-2.5-flash" | "gemini-2.5-pro" | "gemini-1.5-pro" | "gemini-1.5-flash"
  | "deepseek-r1:latest" | "llama3.1:8b" | "gpt-oss:latest" | "llama3:latest"
  | string;

const DEFAULT_MODEL: ChatModel = "gpt-4o";

function getSafeSql() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return null;
  }
  return neon(dbUrl);
}

export async function getActiveModel(): Promise<ChatModel> {
  const sql = getSafeSql();
  if (!sql) return DEFAULT_MODEL;
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
  const sql = getSafeSql();
  if (!sql) return;
  await sql`
    INSERT INTO site_settings (key, value)
    VALUES ('active_model', ${model})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

export async function getActiveAesthetic(): Promise<string> {
  const sql = getSafeSql();
  if (!sql) return "default";
  try {
    const result = await sql`SELECT value FROM site_settings WHERE key = 'aesthetic' LIMIT 1`;
    if (result.length > 0) {
      return result[0].value;
    }
    // Seed
    await sql`INSERT INTO site_settings (key, value) VALUES ('aesthetic', 'default') ON CONFLICT (key) DO NOTHING`;
    return "default";
  } catch (error) {
    console.error("Failed to get active aesthetic:", error);
    return "default";
  }
}

export async function setActiveAesthetic(aesthetic: string) {
  const sql = getSafeSql();
  if (!sql) return;
  await sql`
    INSERT INTO site_settings (key, value)
    VALUES ('aesthetic', ${aesthetic})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}
