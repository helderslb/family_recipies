#!/usr/bin/env node
/**
 * Audits the generated static site in /dist.
 * Catches things a build can't: broken internal links, dead anchors,
 * missing local images, duplicate ids, missing Tailwind classes and
 * missing page landmarks.
 *
 * Usage: node scripts/check-build.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST_ROOT = process.cwd();
// With @astrojs/vercel, prerendered pages and assets land in .vercel/output/static.
const DIST = join(DIST_ROOT, '.vercel', 'output', 'static');
const errors = [];
const warnings = [];

/** Classes that exist purely as JS hooks / print hooks and never emit CSS. */
const CLASS_EXEMPT = new Set([
  'group',
  'is-done',
  'recipe-ingredient',
  'recipe-step',
  'no-print',
  'print-hide',
  'print-stack',
  'recipe-print',
  'photo-lightbox',
  'photo-lightbox-close',
  'photo-lightbox-nav',
  'photo-lightbox-prev',
  'photo-lightbox-next',
  'photo-lightbox-img',
  'photo-lightbox-count',
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

if (!existsSync(DIST)) {
  console.error('.vercel/output/static not found — run `npm run build` first.');
  process.exit(1);
}

const files = walk(DIST);
const pages = files.filter((file) => file.endsWith('.html'));
const css = files
  .filter((file) => file.endsWith('.css'))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');

if (pages.length === 0) errors.push('No HTML pages were generated.');

/** Turn a class token into its escaped CSS selector, e.g. `sm:grid-cols-2` -> `.sm\:grid-cols-2` */
const selectorFor = (token) => '.' + token.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);

function checkClasses(page, html) {
  const tokens = new Set();
  for (const match of html.matchAll(/class="([^"]+)"/g)) {
    for (const token of match[1].split(/\s+/)) {
      if (token && !token.includes('{')) tokens.add(token);
    }
  }

  for (const token of tokens) {
    if (CLASS_EXEMPT.has(token)) continue;
    const selector = selectorFor(token);
    const used = css.includes(selector) && !css.includes(selector + 'x');
    if (!used) {
      warnings.push(`${page}: class "${token}" has no CSS rule`);
    }
  }
}

function resolveInternal(href) {
  const path = href.split('#')[0].split('?')[0];
  if (!path || path === '/') return join(DIST, 'index.html');

  const clean = path.replace(/^\//, '');
  const candidates = [
    join(DIST, clean),
    join(DIST, clean, 'index.html'),
    join(DIST, clean + '.html'),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

for (const page of pages) {
  const rel = relative(DIST, page);
  const html = readFileSync(page, 'utf8');
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));

  for (const landmark of ['<html', '<head', '<header', '<main', '<footer', '<title>']) {
    if (!html.includes(landmark)) errors.push(`${rel}: missing ${landmark}`);
  }

  if (!/<html lang="[a-z-]+"/.test(html)) errors.push(`${rel}: <html> is missing a lang attribute`);
  if ((html.match(/<h1[\s>]/g) ?? []).length !== 1) {
    errors.push(`${rel}: expected exactly one <h1>, found ${(html.match(/<h1[\s>]/g) ?? []).length}`);
  }

  // Duplicate ids break anchors and label/for pairs.
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`${rel}: duplicate id "${id}"`);
    seen.add(id);
  }

  for (const match of html.matchAll(/\shref="([^"]+)"/g)) {
    const href = match[1];
    if (/^(https?:|mailto:|tel:|data:)/.test(href)) continue;
    if (href.startsWith('/api/')) continue; // server endpoint, no static file

    if (href.startsWith('#')) {
      const anchor = href.slice(1);
      if (anchor && !ids.has(anchor)) errors.push(`${rel}: anchor "${href}" has no target`);
      continue;
    }

    if (!href.startsWith('/')) continue; // relative links are not used in this project

    if (!resolveInternal(href)) {
      errors.push(`${rel}: internal link "${href}" does not resolve to a file`);
    }
  }

  for (const match of html.matchAll(/\ssrc="(\/images\/[^"]+)"/g)) {
    if (!existsSync(join(DIST, match[1].replace(/^\//, '')))) {
      errors.push(`${rel}: image "${match[1]}" is missing from dist`);
    }
  }

  checkClasses(rel, html);
}

const uniqueErrors = [...new Set(errors)];
const uniqueWarnings = [...new Set(warnings)];

// Guard against the Tailwind config silently not loading (the original bug):
// the theme colours, fonts and component classes must all reach the bundle.
const REQUIRED_CSS = [
  '.btn{',
  '.btn-outline{',
  '.input{',
  '.card{',
  '.chip-active{',
  '.nav-tab-active{',
  '.container-max{',
  '.eyebrow{',
  'rgb(221 235 248', // cream → clear light-blue canvas
  'rgb(45 123 184', // terracotta → coastal blue accent
  'rgb(14 27 44', // ink → deep navy
  'Playfair Display',
];

for (const needle of REQUIRED_CSS) {
  if (!css.includes(needle)) uniqueErrors.push(`compiled CSS is missing "${needle}"`);
}

console.log(`Checked ${pages.length} page(s) against ${files.length} built file(s).`);

if (uniqueWarnings.length) {
  console.log(`\n${uniqueWarnings.length} warning(s):`);
  for (const warning of uniqueWarnings.slice(0, 25)) console.log(`  ! ${warning}`);
}

if (uniqueErrors.length) {
  console.error(`\n${uniqueErrors.length} error(s):`);
  for (const error of uniqueErrors) console.error(`  ✗ ${error}`);
  process.exit(1);
}

console.log('\n✓ No broken links, dead anchors, duplicate ids or missing assets.');
