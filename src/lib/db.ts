import { createClient } from '@libsql/client/web';

let client: ReturnType<typeof createClient> | null = null;

function configured(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
}

/** Turso client, or null when the environment isn't configured (e.g. file-only dev). */
export function getDb(): ReturnType<typeof createClient> | null {
  if (!configured()) return null;

  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL as string,
      authToken: process.env.TURSO_AUTH_TOKEN as string,
    });
  }

  return client;
}

let schemaReady: Promise<void> | null = null;

/** Create the recipes table once per process if it doesn't exist yet. */
export function ensureSchema(): Promise<void> {
  const db = getDb();
  if (!db) return Promise.resolve();

  if (!schemaReady) {
    schemaReady = db
      .execute(
        `CREATE TABLE IF NOT EXISTS recipes (
          slug TEXT PRIMARY KEY,
          markdown TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        )`
      )
      .then(() => undefined);
  }

  return schemaReady;
}