// Sync the recipe collection with the `pictures/` folder and Cloudinary.
//
// For every folder in `pictures/`:
//   - creates a TBC recipe draft when there's no matching recipe file yet;
//   - uploads the hero photo plus up to 9 extra photos (10 in total) to Cloudinary;
//   - uploads a video if present and the recipe still points at a local path.
// Then removes any recipe whose `pictures/` folder no longer exists.
//
// Requirements (in .env):
//   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
//   TURSO_DATABASE_URL / TURSO_AUTH_TOKEN (so orphan removal also cleans the DB)
//
// Idempotent: already-migrated assets are skipped (incremental).
//
// Usage:
//   node scripts/cloudinary-upload.mjs
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import matter from 'gray-matter';
import sharp from 'sharp';
import { createClient } from '@libsql/client/web';

const ROOT = process.cwd();
const RECIPES_DIR = path.join(ROOT, 'src', 'content', 'recipes');
const PICTURES_DIR = path.join(ROOT, 'pictures');

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

const CLOUDINARY_FOLDER = 'family-recipes';
const MAX_PHOTOS = 10;

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.m4v']);
const DESSERT_KEYWORDS = ['chessecake', 'cheesecake', 'leite creme', 'pudim', 'sobremesa', 'bolo', 'doce', 'mousse', 'tarte'];

function slugify(title) {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function humanize(name) {
  const fixed = name.trim().replace(/á/g, 'à');
  return fixed.charAt(0).toUpperCase() + fixed.slice(1);
}

function isDessert(name) {
  const n = name.toLowerCase();
  return DESSERT_KEYWORDS.some((keyword) => new RegExp(`\\b${keyword}\\b`).test(n));
}

if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
  console.error('Missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET in .env');
  process.exit(1);
}

console.log(`Cloud name: ${CLOUD_NAME}`);

/** Core signed upload of an in-memory blob. */
async function uploadBlob(blob, filename, resourceType, publicId) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params = {
    overwrite: 'true',
    public_id: publicId,
    timestamp,
    unique_filename: 'false',
  };

  const toSign =
    Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&') + API_SECRET;
  const signature = crypto.createHash('sha1').update(toSign).digest('hex');

  const form = new FormData();
  form.append('file', blob, filename);
  form.append('api_key', API_KEY);
  for (const [key, value] of Object.entries(params)) form.append(key, value);
  form.append('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, {
    method: 'POST',
    body: form,
  });
  const body = await response.json();

  if (!response.ok || body.error) {
    throw new Error(`Upload failed for ${publicId}: ${body.error?.message ?? JSON.stringify(body)}`);
  }
  return body;
}

/** Optimise then upload a photo from disk. */
async function uploadResized(filePath, publicId) {
  const buffer = await sharp(filePath)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
  return uploadBlob(new Blob([buffer]), `${publicId.split('/').pop()}.jpg`, 'image', publicId);
}

/** Delivery URL with quality/format auto-optimisation for images. */
function imageUrl(data) {
  return data.secure_url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');
}

function tursoClient() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) return null;
  return createClient({ url, authToken });
}

/** Write a TBC draft for a folder that has no recipe yet. */
function createDraft(slug, title, category) {
  const data = {
    title,
    description: 'TBC',
    image: '/images/placeholder.svg',
    author: 'Family',
    family: 'Family',
    category,
    prepTime: 'TBC',
    cookTime: 'TBC',
    totalTime: 'TBC',
    servings: 'TBC',
    titlePt: title,
    descriptionPt: 'TBC',
    ingredients: ['TBC'],
    steps: ['TBC'],
  };
  fs.writeFileSync(path.join(RECIPES_DIR, `${slug}.md`), matter.stringify('', data), 'utf8');
  console.log(`draft  ${slug} (${category})`);
}

/** Sync the hero photos, gallery and video for one pictures/ folder → Cloudinary. */
async function syncFolder(folder) {
  const slug = slugify(folder);
  if (!slug || slug === 'arroz-de-bacalhau') return false; // pre-existing recipe, kept as-is

  const title = humanize(folder);
  const mdPath = path.join(RECIPES_DIR, `${slug}.md`);
  if (!fs.existsSync(mdPath)) createDraft(slug, title, isDessert(folder) ? 'Desserts' : 'Mains');

  const parsed = matter.read(mdPath);

  const photos = fs
    .readdirSync(path.join(PICTURES_DIR, folder))
    .filter((file) => IMAGE_EXTS.has(path.extname(file).toLowerCase()))
    .sort();
  const videos = fs
    .readdirSync(path.join(PICTURES_DIR, folder))
    .filter((file) => VIDEO_EXTS.has(path.extname(file).toLowerCase()))
    .sort();

  let changed = false;

  // Hero (photo #1) — set whenever the recipe still points at a local image.
  if (photos.length > 0 && (!parsed.data.image || String(parsed.data.image).startsWith('/images/'))) {
    const data = await uploadResized(path.join(PICTURES_DIR, folder, photos[0]), `${CLOUDINARY_FOLDER}/${slug}-1`);
    parsed.data.image = imageUrl(data);
    changed = true;
    console.log(`hero   ${folder} -> ${parsed.data.image}`);
  }

  // Gallery (up to MAX_PHOTOS total, including the hero).
  const gallery = Array.isArray(parsed.data.gallery) ? parsed.data.gallery.slice() : [];
  const maxGallery = Math.min(photos.length, MAX_PHOTOS) - 1;
  for (let j = gallery.length; j < maxGallery; j++) {
    const data = await uploadResized(path.join(PICTURES_DIR, folder, photos[j + 1]), `${CLOUDINARY_FOLDER}/${slug}-${j + 2}`);
    gallery.push(imageUrl(data));
    console.log(`gallery ${folder} #${j + 2}`);
  }
  if (gallery.length > 0 && gallery.length > (parsed.data.gallery?.length ?? 0)) {
    parsed.data.gallery = gallery;
    changed = true;
  }

  // Video — upload only if still pointing at a local path.
  if (videos.length > 0 && (!parsed.data.video || String(parsed.data.video).startsWith('/videos/'))) {
    const src = path.join(PICTURES_DIR, folder, videos[0]);
    const publicId = `${CLOUDINARY_FOLDER}/${slug}`;
    const data = await uploadBlob(new Blob([fs.readFileSync(src)]), videos[0], 'video', publicId);
    parsed.data.video = data.secure_url;
    changed = true;
    console.log(`video  ${folder} -> ${parsed.data.video}`);
  }

  if (changed) {
    fs.writeFileSync(mdPath, matter.stringify(parsed.content, parsed.data), 'utf8');
    console.log(`rewrote ${slug}.md`);
  }

  return changed;
}

/** Delete recipe files whose pictures/ folder no longer exists. */
async function pruneOrphans(validSlugs) {
  const files = fs.readdirSync(RECIPES_DIR).filter((file) => file.endsWith('.md'));
  const db = tursoClient();
  if (db) {
    await db.execute(
      `CREATE TABLE IF NOT EXISTS recipes (slug TEXT PRIMARY KEY, markdown TEXT NOT NULL, updated_at INTEGER NOT NULL)`
    );
  }

  let removed = 0;
  for (const file of files) {
    const slug = file.slice(0, -3);
    if (validSlugs.has(slug)) continue;

    fs.rmSync(path.join(RECIPES_DIR, file), { force: true });
    if (db) await db.execute({ sql: 'DELETE FROM recipes WHERE slug = ?', args: [slug] });
    console.log(`removed ${slug} (no pictures folder)`);
    removed += 1;
  }
  return removed;
}

async function main() {
  if (!fs.existsSync(PICTURES_DIR)) {
    console.error(`No pictures directory at ${PICTURES_DIR}`);
    process.exit(1);
  }
  fs.mkdirSync(RECIPES_DIR, { recursive: true });

  const folders = fs
    .readdirSync(PICTURES_DIR)
    .filter((entry) => fs.statSync(path.join(PICTURES_DIR, entry)).isDirectory())
    .sort();

  let updated = 0;
  for (const folder of folders) {
    if (await syncFolder(folder)) updated += 1;
  }

  const validSlugs = new Set(folders.map(slugify).filter(Boolean));
  const removed = await pruneOrphans(validSlugs);

  console.log(`\nDone. Updated ${updated} recipe(s); removed ${removed} orphan recipe(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});