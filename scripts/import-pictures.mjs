// Import recipe drafts from the `pictures/` folder.
//
// Each subfolder of `pictures/` becomes one recipe draft:
//   - title        = the folder name, lightly humanised
//   - description  = "TBC" (the author fills the real recipe in later)
//   - image        = the first photo (optimised into public/images/)
//   - video        = the first video, if present (copied into public/videos/)
//
// Folders whose recipe already exists (e.g. arroz de bacalhau) are skipped, so
// re-running this script never overwrites recipes you have already edited.
//
// Usage:
//   node scripts/import-pictures.mjs
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const PICTURES_DIR = path.join(ROOT, 'pictures');
const IMAGES_OUT = path.join(ROOT, 'public', 'images');
const VIDEOS_OUT = path.join(ROOT, 'public', 'videos');
const RECIPES_DIR = path.join(ROOT, 'src', 'content', 'recipes');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.m4v']);

// Folder-name keywords that map a draft to the "Desserts" category instead of "Mains".
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
  const fixed = name.trim().replace(/á/g, 'à'); // "á" is not a valid PT word; the preposition is "à"
  return fixed.charAt(0).toUpperCase() + fixed.slice(1);
}

/** JSON.stringify produces a valid double-quoted YAML scalar for any value. */
function yaml(value) {
  return JSON.stringify(String(value));
}

function buildMarkdown(data) {
  const lines = ['---'];
  lines.push(`title: ${yaml(data.title)}`);
  lines.push(`description: ${yaml(data.description)}`);
  lines.push(`image: ${yaml(data.image)}`);
  lines.push(`author: ${yaml(data.author)}`);
  lines.push(`family: ${yaml(data.family)}`);
  lines.push(`category: ${yaml(data.category)}`);
  lines.push(`prepTime: ${yaml(data.prepTime)}`);
  lines.push(`cookTime: ${yaml(data.cookTime)}`);
  lines.push(`totalTime: ${yaml(data.totalTime)}`);
  lines.push(`servings: ${yaml(data.servings)}`);
  if (data.video) lines.push(`video: ${yaml(data.video)}`);
  lines.push(`titlePt: ${yaml(data.titlePt)}`);
  lines.push(`descriptionPt: ${yaml(data.descriptionPt)}`);
  lines.push('ingredients:');
  data.ingredients.forEach((item) => lines.push(`  - ${yaml(item)}`));
  lines.push('steps:');
  data.steps.forEach((item) => lines.push(`  - ${yaml(item)}`));
  lines.push('---');
  lines.push('');
  return lines.join('\n');
}

async function optimizeImage(src, dest) {
  await sharp(src)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(dest);
}

function isDessert(name) {
  const n = name.toLowerCase();
  return DESSERT_KEYWORDS.some((keyword) => n.includes(keyword));
}

async function main() {
  if (!fs.existsSync(PICTURES_DIR)) {
    console.error(`No pictures directory at ${PICTURES_DIR}`);
    process.exit(1);
  }

  fs.mkdirSync(IMAGES_OUT, { recursive: true });
  fs.mkdirSync(VIDEOS_OUT, { recursive: true });

  const folders = fs
    .readdirSync(PICTURES_DIR)
    .filter((entry) => fs.statSync(path.join(PICTURES_DIR, entry)).isDirectory())
    .sort();

  let created = 0;
  let skipped = 0;

  for (const folder of folders) {
    const slug = slugify(folder);
    if (!slug) continue;

    const mdPath = path.join(RECIPES_DIR, `${slug}.md`);
    if (fs.existsSync(mdPath)) {
      console.log(`skip    ${folder} (recipe already exists: ${slug}.md)`);
      skipped += 1;
      continue;
    }

    const files = fs.readdirSync(path.join(PICTURES_DIR, folder));
    const images = files.filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase())).sort();
    const videos = files.filter((f) => VIDEO_EXTS.has(path.extname(f).toLowerCase())).sort();

    let imagePath = '/images/placeholder.svg';
    if (images.length > 0) {
      const src = path.join(PICTURES_DIR, folder, images[0]);
      const destName = `${slug}-1.jpg`;
      await optimizeImage(src, path.join(IMAGES_OUT, destName));
      imagePath = `/images/${destName}`;
      console.log(`image   ${folder} -> public/images/${destName}`);
    }

    let videoPath;
    if (videos.length > 0) {
      const src = path.join(PICTURES_DIR, folder, videos[0]);
      const destName = `${slug}${path.extname(videos[0]).toLowerCase()}`;
      fs.copyFileSync(src, path.join(VIDEOS_OUT, destName));
      videoPath = `/videos/${destName}`;
      console.log(`video   ${folder} -> public/videos/${destName}`);
    }

    const title = humanize(folder);
    const category = isDessert(folder) ? 'Desserts' : 'Mains';
    const markdown = buildMarkdown({
      title,
      description: 'TBC',
      image: imagePath,
      author: 'Family',
      family: 'Family',
      category,
      prepTime: 'TBC',
      cookTime: 'TBC',
      totalTime: 'TBC',
      servings: 'TBC',
      video: videoPath,
      titlePt: title,
      descriptionPt: 'TBC',
      ingredients: ['TBC'],
      steps: ['TBC'],
    });

    fs.writeFileSync(mdPath, markdown, 'utf8');
    console.log(`recipe  ${folder} -> src/content/recipes/${slug}.md (${category})`);
    created += 1;
  }

  console.log(`\nDone. Created ${created} recipe draft(s), skipped ${skipped} existing.`);
}

main().catch((error) => {
  console.error('Import failed:', error);
  process.exit(1);
});