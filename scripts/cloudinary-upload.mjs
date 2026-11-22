// Upload the locally-imported recipe media (public/images + public/videos) to
// Cloudinary using signed uploads, then rewrite each recipe's `image`/`video`
// frontmatter to the Cloudinary delivery URLs.
//
// Requirements (in .env):
//   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
//
// Idempotent: recipes already pointing at Cloudinary are skipped, and re-running
// overwrites the same Cloudinary assets (unique_filename is disabled) so the
// URLs stay stable.
//
// Usage:
//   node scripts/cloudinary-upload.mjs
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import matter from 'gray-matter';

const ROOT = process.cwd();
const RECIPES_DIR = path.join(ROOT, 'src', 'content', 'recipes');
const IMAGES_DIR = path.join(ROOT, 'public', 'images');
const VIDEOS_DIR = path.join(ROOT, 'public', 'videos');

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

const FOLDER = 'family-recipes'; // Cloudinary folder the assets live under.

if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
  console.error('Missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET in .env');
  process.exit(1);
}

console.log(`Cloud name: ${CLOUD_NAME}`);

/**
 * Signed Upload API request. The signature covers every POST parameter except
 * `file`, `cloud_name`, `resource_type` and `api_key`, sorted alphabetically,
 * joined with `&`, with the API secret appended (no delimiter) and SHA-1 hashed.
 */
async function upload(filePath, resourceType, publicId) {
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
  form.append('file', new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
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

/**
 * Delete an asset. Also used to remove the extension-bearing `public_id` created
 * by an earlier run of this script (self-healing cleanup).
 */
async function destroy(publicId, resourceType) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params = { public_id: publicId, timestamp };
  const toSign =
    Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&') + API_SECRET;
  const signature = crypto.createHash('sha1').update(toSign).digest('hex');

  const form = new URLSearchParams();
  form.set('public_id', publicId);
  form.set('timestamp', timestamp);
  form.set('signature', signature);
  form.set('api_key', API_KEY);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/destroy`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    }
  );
  return response.json();
}

/** Delivery URL with quality/format auto-optimisation for images. */
function imageUrl(data) {
  return data.secure_url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');
}

async function main() {
  const imageFiles = fs
    .readdirSync(IMAGES_DIR)
    .filter((file) => /-1\.(jpe?g|png|webp|gif)$/i.test(file));

  const videoFiles = fs.existsSync(VIDEOS_DIR)
    ? fs.readdirSync(VIDEOS_DIR).filter((file) => /\.(mp4|mov|webm|m4v)$/i.test(file))
    : [];

  const updates = {}; // slug -> { image?, video? }

  for (const file of imageFiles) {
    const slug = file.replace(/-1\.(jpe?g|png|webp|gif)$/i, '');
    const mdPath = path.join(RECIPES_DIR, `${slug}.md`);
    if (!fs.existsSync(mdPath)) continue;

    const current = matter.read(mdPath);
    if (current.data.image && !String(current.data.image).startsWith('/images/')) {
      console.log(`skip   ${file} (already migrated)`);
      continue;
    }

    const publicId = `${FOLDER}/${slug}-1`;
    const data = await upload(path.join(IMAGES_DIR, file), 'image', publicId);
    updates[slug] = updates[slug] || {};
    updates[slug].image = imageUrl(data);
    console.log(`image  ${file} -> ${updates[slug].image}`);

    const legacyId = `${FOLDER}/${slug}-1${path.extname(file).toLowerCase()}`;
    if (legacyId !== publicId) {
      const removed = await destroy(legacyId, 'image');
      if (removed?.result === 'ok') console.log(`cleaned legacy image ${legacyId}`);
    }
  }

  for (const file of videoFiles) {
    const slug = file.replace(/\.[a-z0-9]+$/i, '');
    const mdPath = path.join(RECIPES_DIR, `${slug}.md`);
    if (!fs.existsSync(mdPath)) continue;

    const current = matter.read(mdPath);
    if (current.data.video && !String(current.data.video).startsWith('/videos/')) {
      console.log(`skip   ${file} (already migrated)`);
      continue;
    }

    const publicId = `${FOLDER}/${slug}`;
    const data = await upload(path.join(VIDEOS_DIR, file), 'video', publicId);
    updates[slug] = updates[slug] || {};
    updates[slug].video = data.secure_url;
    console.log(`video  ${file} -> ${updates[slug].video}`);

    const legacyId = `${FOLDER}/${file.toLowerCase()}`;
    if (legacyId !== publicId) {
      const removed = await destroy(legacyId, 'video');
      if (removed?.result === 'ok') console.log(`cleaned legacy video ${legacyId}`);
    }
  }

  let rewritten = 0;
  for (const [slug, fields] of Object.entries(updates)) {
    const filePath = path.join(RECIPES_DIR, `${slug}.md`);
    if (!fs.existsSync(filePath)) {
      console.warn(`No recipe file for slug "${slug}" — skipping rewrite.`);
      continue;
    }

    const parsed = matter.read(filePath);
    if (fields.image) parsed.data.image = fields.image;
    if (fields.video) parsed.data.video = fields.video;
    fs.writeFileSync(filePath, matter.stringify(parsed.content, parsed.data), 'utf8');
    console.log(`rewrote src/content/recipes/${slug}.md`);
    rewritten += 1;
  }

  console.log(
    `\nDone. Uploaded ${imageFiles.length} image(s) and ${videoFiles.length} video(s); rewrote ${rewritten} recipe(s).`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});