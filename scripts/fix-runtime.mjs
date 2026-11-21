import fs from 'node:fs';
import path from 'node:path';

// @astrojs/vercel@7 (Astro 4) can only emit nodejs18.x / nodejs20.x, both of
// which Vercel has now removed. After the build, rewrite every Node function's
// runtime to a supported one. (Proper fix: upgrade to Astro 5 + a newer adapter.)
const RUNTIME = process.env.FUNCTION_RUNTIME || 'nodejs22.x';
const FUNCTIONS_DIR = path.join(process.cwd(), '.vercel', 'output', 'functions');

function collect(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (entry.name === '.vc-config.json') out.push(full);
  }
  return out;
}

const files = collect(FUNCTIONS_DIR);
if (files.length === 0) {
  console.warn('No .vc-config.json files found — runtime patch skipped.');
  process.exit(0);
}

for (const file of files) {
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (typeof config.runtime !== 'string' || !config.runtime.startsWith('nodejs')) continue;
  config.runtime = RUNTIME;
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n', 'utf8');
  console.log(`Patched ${path.relative(process.cwd(), file)} → ${RUNTIME}`);
}