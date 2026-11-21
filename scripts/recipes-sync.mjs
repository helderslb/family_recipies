import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client/web';

const RECIPES_DIR = path.join(process.cwd(), 'src', 'content', 'recipes');

function clientOrNull() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) return null;
  return createClient({ url, authToken });
}

async function ensureSchema(db) {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS recipes (
      slug TEXT PRIMARY KEY,
      markdown TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`
  );
}

// One-time migration: copy the committed markdown recipes into Turso.
async function seed(db) {
  await ensureSchema(db);
  if (!fs.existsSync(RECIPES_DIR)) {
    console.error(`No recipes directory at ${RECIPES_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(RECIPES_DIR).filter((f) => f.endsWith('.md'));
  for (const file of files) {
    const slug = file.slice(0, -3);
    const markdown = fs.readFileSync(path.join(RECIPES_DIR, file), 'utf8');
    await db.execute({
      sql: `INSERT INTO recipes (slug, markdown, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET markdown = excluded.markdown, updated_at = excluded.updated_at`,
      args: [slug, markdown, Date.now()],
    });
    console.log(`seeded ${slug}`);
  }

  console.log(`Seeded ${files.length} recipe(s) into Turso.`);
}

// Build-time sync: pull Turso → regenerate the markdown the content collection reads.
async function pull(db) {
  await ensureSchema(db);
  fs.mkdirSync(RECIPES_DIR, { recursive: true });

  const result = await db.execute('SELECT slug, markdown FROM recipes');
  const rows = result.rows;

  if (rows.length === 0) {
    console.warn('Turso has no recipes — leaving existing markdown files untouched.');
    return;
  }

  for (const row of rows) {
    const file = path.join(RECIPES_DIR, `${row.slug}.md`);
    fs.writeFileSync(file, String(row.markdown), 'utf8');
  }

  console.log(`Synced ${rows.length} recipe(s) from Turso into src/content/recipes.`);
}

const [command] = process.argv.slice(2);
const db = clientOrNull();

if (!db) {
  console.warn('TURSO_DATABASE_URL / TURSO_AUTH_TOKEN not set — skipping recipe sync.');
  process.exit(0);
}

try {
  if (command === 'seed') await seed(db);
  else if (command === 'pull') await pull(db);
  else {
    console.error('Usage: node scripts/recipes-sync.mjs <seed|pull>');
    process.exit(1);
  }
} catch (error) {
  // A build must never hard-fail just because the content sync couldn't reach
  // Turso — fall back to whatever markdown is already checked in / generated.
  if (command === 'pull') {
    console.warn('Recipe sync skipped (could not reach Turso):', error?.message ?? error);
    process.exit(0);
  }
  console.error('Recipe sync failed:', error);
  process.exit(1);
}