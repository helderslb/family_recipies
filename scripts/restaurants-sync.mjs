import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client/web';

const DATA_FILE = path.join(process.cwd(), 'src', 'data', 'restaurants.json');

function clientOrNull() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) return null;
  return createClient({ url, authToken });
}

async function ensureSchema(db) {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS restaurants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`
  );
}

// One-time migration: upload the local JSON into Turso.
async function seed(db) {
  await ensureSchema(db);
  const list = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  for (const item of list) {
    await db.execute({
      sql: 'INSERT INTO restaurants (data, updated_at) VALUES (?, ?)',
      args: [JSON.stringify(item), Date.now()],
    });
  }
  console.log(`Seeded ${list.length} restaurant(s) into Turso.`);
}

// Build-time sync: pull Turso → regenerate the JSON the page reads.
async function pull(db) {
  await ensureSchema(db);
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

  const result = await db.execute('SELECT data FROM restaurants');
  const rows = result.rows.map((row) => JSON.parse(String(row.data)));

  if (rows.length === 0) {
    console.warn('Turso has no restaurants — keeping the existing restaurants.json.');
    return;
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));
  fs.writeFileSync(DATA_FILE, JSON.stringify(rows, null, 2) + '\n');
  console.log(`Synced ${rows.length} restaurant(s) from Turso into src/data/restaurants.json.`);
}

const [command] = process.argv.slice(2);
const db = clientOrNull();

if (!db) {
  console.warn('TURSO_DATABASE_URL / TURSO_AUTH_TOKEN not set — skipping restaurants sync.');
  process.exit(0);
}

try {
  if (command === 'seed') await seed(db);
  else if (command === 'pull') await pull(db);
  else {
    console.error('Usage: node scripts/restaurants-sync.mjs <seed|pull>');
    process.exit(1);
  }
} catch (error) {
  if (command === 'pull') {
    console.warn('Restaurants sync skipped (could not reach Turso):', error?.message ?? error);
    process.exit(0);
  }
  console.error('Restaurants sync failed:', error);
  process.exit(1);
}