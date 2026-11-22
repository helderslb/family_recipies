#!/usr/bin/env node
/**
 * Behavioural tests for the built site.
 * Loads real HTML from /dist into jsdom and exercises the inline scripts
 * (search, filters, reset, mobile menu, ingredient checklist).
 *
 * Usage: node tests/site.test.mjs
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';

const DIST_ROOT = process.cwd();
// With @astrojs/vercel, prerendered pages and assets land in .vercel/output/static.
const DIST = join(DIST_ROOT, '.vercel', 'output', 'static');
let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  \u2713 ${name}`);
  } catch (error) {
    failed += 1;
    failures.push({ name, error });
    console.log(`  \u2717 ${name}`);
    console.log(`      ${String(error.message).split('\n')[0]}`);
  }
}

async function load(pagePath, { url = 'http://localhost/', beforeParse } = {}) {
  const html = readFileSync(join(DIST, pagePath), 'utf8');
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error));

  const dom = new JSDOM(html, {
    url,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      if (beforeParse) beforeParse(window);
    },
  });

  await new Promise((resolve) => {
    if (dom.window.document.readyState === 'complete') return resolve();
    dom.window.addEventListener('load', resolve, { once: true });
  });

  return { dom, window: dom.window, document: dom.window.document, errors };
}

const cards = (document) => Array.from(document.querySelectorAll('[data-recipe-card]'));
const visibleCards = (document) =>
  cards(document).filter((card) => !card.classList.contains('hidden'));
const count = (document) => document.getElementById('results-count').textContent.trim();
const isHidden = (element) => element.classList.contains('hidden');

function type(window, input, value) {
  input.value = value;
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
}

function click(window, element) {
  element.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

const chip = (document, filter, value) =>
  document.querySelector(`[data-filter="${filter}"][data-value="${value}"]`);

console.log('\nHomepage: search, filters and empty state');
const home = await load('index.html');

await test('renders every recipe from the collection', () => {
  assert.equal(cards(home.document).length, 36);
  assert.equal(visibleCards(home.document).length, 36);
  assert.equal(count(home.document), '36');
  assert.ok(isHidden(home.document.getElementById('empty-state')));
});

await test('typing in the search filters cards live', () => {
  type(home.window, home.document.getElementById('search'), 'chocolate');
  assert.equal(visibleCards(home.document).length, 1);
  assert.equal(count(home.document), '1');
  assert.match(visibleCards(home.document)[0].dataset.searchText, /chocolate chip/);
});

await test('search also matches ingredients and author', () => {
  type(home.window, home.document.getElementById('search'), 'bacalhau');
  assert.equal(visibleCards(home.document).length, 5);

  type(home.window, home.document.getElementById('search'), 'grandma rose');
  assert.equal(visibleCards(home.document).length, 1);
});

await test('search inputs stay in sync', () => {
  type(home.window, home.document.getElementById('search'), 'cookies');
  assert.equal(home.document.getElementById('header-search').value, 'cookies');
  assert.equal(home.document.getElementById('mobile-search').value, 'cookies');
});

await test('clearing the search restores all recipes', () => {
  type(home.window, home.document.getElementById('search'), '');
  assert.equal(visibleCards(home.document).length, 36);
});

await test('family chips filter and highlight correctly', () => {
  click(home.window, chip(home.document, 'family', 'Mom'));
  assert.equal(visibleCards(home.document).length, 1);
  assert.equal(home.document.querySelectorAll('[data-filter="family"].chip-active').length, 1);
  assert.ok(chip(home.document, 'family', 'Mom').classList.contains('chip-active'));
});

await test('combined filters show the empty state', () => {
  click(home.window, chip(home.document, 'category', 'Mains'));
  assert.equal(visibleCards(home.document).length, 0);
  assert.equal(count(home.document), '0');
  assert.ok(!isHidden(home.document.getElementById('empty-state')));
});

await test('"Clear filters" resets search and every chip', () => {
  click(home.window, home.document.querySelector('[data-reset]'));
  assert.equal(visibleCards(home.document).length, 36);
  assert.equal(home.document.getElementById('search').value, '');
  assert.equal(home.document.querySelectorAll('.chip-active').length, 2);
  assert.ok(isHidden(home.document.getElementById('empty-state')));
});

await test('mobile menu opens on click and closes on Escape', () => {
  const toggle = home.document.getElementById('menu-toggle');
  const panel = home.document.getElementById('mobile-panel');
  assert.ok(isHidden(panel));

  click(home.window, toggle);
  assert.ok(!isHidden(panel));
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');

  home.document.dispatchEvent(
    new home.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
  );
  assert.ok(isHidden(panel));
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
});

await test('the inline scripts run without errors', () => {
  assert.equal(home.errors.length, 0, home.errors.map((error) => error.message).join('\n'));
});

home.dom.window.close();

console.log('\nHomepage: ?q= deep link');
const deepLinked = await load('index.html', { url: 'http://localhost/?q=arroz' });

await test('server-side query filters the page and pre-fills the inputs', () => {
  assert.equal(visibleCards(deepLinked.document).length, 6);
  assert.equal(deepLinked.document.getElementById('search').value, 'arroz');
  assert.equal(deepLinked.document.getElementById('header-search').value, 'arroz');
});

deepLinked.dom.window.close();

console.log('\nCollection routes');
const mom = await load('mom/index.html');

await test("Mom's page lists only Mom's recipes and highlights the tab", () => {
  assert.equal(cards(mom.document).length, 1);
  assert.equal(cards(mom.document)[0].dataset.family, 'Mom');
  assert.match(mom.document.querySelector('h1').textContent, /Mom's food/);

  const activeTabs = Array.from(mom.document.querySelectorAll('.nav-tab-active'));
  assert.equal(activeTabs.length, 2); // desktop + mobile nav
  for (const tab of activeTabs) assert.match(tab.textContent, /Mom's food/);
});

await test('collection page scripts run cleanly', () => {
  assert.equal(mom.errors.length, 0, mom.errors.map((error) => error.message).join('\n'));
});

mom.dom.window.close();

const popular = await load('popular/index.html');

await test('Popular page only shows featured recipes', () => {
  assert.equal(cards(popular.document).length, 1);
  assert.match(cards(popular.document)[0].dataset.searchText, /pot pie/);
  assert.match(popular.document.querySelector('h1').textContent, /Popular recipes/);
});

popular.dom.window.close();

const grandma = await load('grandma/index.html');

await test("Grandma's page only shows Grandma's recipes", () => {
  assert.equal(cards(grandma.document).length, 1);
  assert.equal(cards(grandma.document)[0].dataset.family, 'Grandma');
});

grandma.dom.window.close();

console.log('\nRecipe page');
const recipe = await load('recipes/arroz-de-bacalhau/index.html');

await test('renders the full ingredient checklist, method and related recipes', () => {
  assert.equal(
    recipe.document.querySelectorAll('#ingredients-list input[type="checkbox"]').length,
    15
  );
  assert.equal(recipe.document.querySelectorAll('.recipe-step').length, 6);
  assert.equal(cards(recipe.document).length, 3);
});

await test('ticking an ingredient marks it as done', () => {
  const box = recipe.document.querySelector('#ingredients-list input[type="checkbox"]');
  const item = box.closest('.recipe-ingredient');
  assert.ok(!item.classList.contains('is-done'));

  box.checked = true;
  box.dispatchEvent(new recipe.window.Event('change', { bubbles: true }));
  assert.ok(item.classList.contains('is-done'));

  box.checked = false;
  box.dispatchEvent(new recipe.window.Event('change', { bubbles: true }));
  assert.ok(!item.classList.contains('is-done'));
});

await test('has a print action and a working "jump to ingredients" target', () => {
  assert.ok(recipe.document.getElementById('print-btn'));
  assert.ok(recipe.document.querySelector('a[href="#ingredients"]'));
  assert.ok(recipe.document.getElementById('ingredients'));
});

await test('recipe scripts run without errors', () => {
  assert.equal(recipe.errors.length, 0, recipe.errors.map((error) => error.message).join('\n'));
});

await test('renders the recipe in English and Portuguese', () => {
  const heading = recipe.document.querySelector('h1').textContent;
  assert.match(heading, /Portuguese Salt Cod Rice/);
  assert.match(heading, /Arroz de Bacalhau à Portuguesa/);

  const ptIngredients = recipe.document.querySelectorAll('#ingredients-list [data-lang="pt"]');
  assert.equal(ptIngredients.length, 15);
  assert.match(ptIngredients[0].textContent, /bacalhau/);

  assert.equal(recipe.document.querySelectorAll('.recipe-step [data-lang="pt"]').length, 6);
});

await test('the switch changes the recipe page language and title', () => {
  click(recipe.window, recipe.document.querySelector('[data-set-lang="pt"]'));
  assert.equal(recipe.document.documentElement.lang, 'pt');
  assert.equal(recipe.document.documentElement.getAttribute('data-lang'), 'pt');
  assert.match(recipe.document.title, /Arroz de Bacalhau/);
});

recipe.dom.window.close();

console.log('\nAdd-recipe form');
const create = await load('create/index.html');

await test('exposes every field the API expects', () => {
  const form = create.document.getElementById('recipe-form');
  assert.ok(form);

  const names = [
    'title',
    'description',
    'author',
    'family',
    'category',
    'prepTime',
    'cookTime',
    'totalTime',
    'servings',
    'image',
    'ingredients',
    'steps',
  ];

  for (const name of names) assert.ok(form.elements[name], `missing field: ${name}`);
});

await test('accepts local image paths as well as full URLs', () => {
  assert.equal(create.document.getElementById('image').getAttribute('type'), 'text');
});

await test('the status message starts hidden', () => {
  assert.ok(isHidden(create.document.getElementById('form-message')));
});

create.dom.window.close();

console.log('\nLanguage switching');
const langPage = await load('index.html');

await test('every page string exists in both languages', () => {
  const doc = langPage.document;
  assert.equal(doc.documentElement.getAttribute('data-lang'), 'en');
  assert.ok(doc.querySelectorAll('[data-lang="en"]').length > 10);
  assert.ok(doc.querySelectorAll('[data-lang="pt"]').length > 10);

  const ptText = Array.from(doc.querySelectorAll('[data-lang="pt"]'))
    .map((element) => element.textContent)
    .join(' ');
  assert.match(ptText, /Todas as receitas/);
  assert.match(ptText, /Comida da avó/);
});

await test('the PT switch updates the document language, title and storage', () => {
  const doc = langPage.document;
  click(langPage.window, doc.querySelector('[data-set-lang="pt"]'));

  assert.equal(doc.documentElement.lang, 'pt');
  assert.equal(doc.documentElement.getAttribute('data-lang'), 'pt');
  assert.equal(langPage.window.localStorage.getItem('family-recipes-language'), 'pt');
  assert.equal(doc.querySelector('[data-set-lang="pt"]').getAttribute('aria-pressed'), 'true');
  assert.equal(doc.querySelector('[data-set-lang="en"]').getAttribute('aria-pressed'), 'false');
  assert.match(doc.title, /Receitas/);
});

await test('switching back to EN restores English labels', () => {
  const doc = langPage.document;
  click(langPage.window, doc.querySelector('[data-set-lang="en"]'));

  assert.equal(doc.documentElement.lang, 'en');
  assert.equal(langPage.window.localStorage.getItem('family-recipes-language'), 'en');
  assert.match(doc.title, /Family Recipes/);
});

await test('filters keep working while Portuguese is active', () => {
  const doc = langPage.document;
  click(langPage.window, doc.querySelector('[data-set-lang="pt"]'));
  click(langPage.window, chip(doc, 'family', 'Mom'));

  assert.equal(visibleCards(doc).length, 1);
  assert.equal(visibleCards(doc)[0].dataset.family, 'Mom');
});

await test('language switching runs without script errors', () => {
  assert.equal(langPage.errors.length, 0, langPage.errors.map((error) => error.message).join('\n'));
});

langPage.dom.window.close();

console.log('\nAdmin login');
const login = await load('admin/login/index.html');

await test('the login form posts to the auth endpoint', () => {
  const form = login.document.getElementById('login-form');
  assert.ok(form);
  assert.equal(form.getAttribute('action'), '/api/auth/login');
  assert.equal(form.getAttribute('method'), 'post');
  assert.equal(login.document.getElementById('username').getAttribute('name'), 'username');
  assert.equal(login.document.getElementById('password').getAttribute('type'), 'password');
  assert.equal(login.document.getElementById('login-next').value, '/admin');
  assert.ok(isHidden(login.document.getElementById('login-error')));
});

await test('shows the invalid-credentials message from ?error=', async () => {
  const failed = await load('admin/login/index.html', {
    url: 'http://localhost/admin/login/?error=invalid',
  });
  const box = failed.document.getElementById('login-error');
  assert.ok(!isHidden(box));
  assert.match(box.textContent, /Incorrect username or password/i);
  failed.dom.window.close();
});

await test('login page scripts run cleanly', () => {
  assert.equal(login.errors.length, 0, login.errors.map((error) => error.message).join('\n'));
});

login.dom.window.close();

console.log('\nAdmin recipe editor');
const admin = await load('admin/index.html');

await test('exposes every editable field in both languages', () => {
  const form = admin.document.getElementById('edit-form');
  assert.ok(form);

  const names = [
    'slug',
    'title',
    'description',
    'author',
    'family',
    'category',
    'servings',
    'image',
    'video',
    'prepTime',
    'cookTime',
    'totalTime',
    'ingredients',
    'steps',
    'titlePt',
    'descriptionPt',
    'ingredientsPt',
    'stepsPt',
    'story',
    'storyPt',
    'featured',
  ];

  for (const name of names) assert.ok(form.elements[name], `missing field: ${name}`);
});

await test('the editor stays hidden until a recipe is selected', () => {
  assert.ok(isHidden(admin.document.getElementById('edit-form')));
  assert.ok(!isHidden(admin.document.getElementById('editor-placeholder')));
});

await test('offers sign out, add-recipe and language controls', () => {
  assert.ok(admin.document.querySelector('form[action="/api/auth/logout"]'));
  assert.ok(admin.document.querySelector('a[href="/create"]'));
  assert.equal(admin.document.querySelectorAll('[data-set-lang]').length >= 2, true);
});

await test('admin page scripts run cleanly', () => {
  assert.equal(admin.errors.length, 0, admin.errors.map((error) => error.message).join('\n'));
});

admin.dom.window.close();

console.log('\nAdmin dashboard (stubbed API)');

const sampleRecipe = {
  slug: 'arroz-de-bacalhau',
  title: 'Portuguese Salt Cod Rice',
  titlePt: 'Arroz de Bacalhau à Portuguesa',
  description: 'Creamy, saucy and full of flavour.',
  descriptionPt: 'Malandrinho, cremoso e cheio de sabor',
  image: '/images/arroz-de-bacalhau-1.jpeg',
  author: 'Family',
  family: 'Family',
  category: 'Mains',
  prepTime: '15 min',
  cookTime: '25–30 min',
  totalTime: '40–45 min',
  servings: '2–3',
  ingredients: ['2 salt cod steaks', '200 g Carolino rice'],
  steps: ['Soak the cod.', 'Cook the rice.'],
  ingredientsPt: ['2 postas de bacalhau', '200 g de arroz carolino'],
  stepsPt: ['Demolha o bacalhau.', 'Cozinha o arroz.'],
  story: 'A family favourite.',
  storyPt: 'Um favorito da família.',
  featured: false,
};

const dashboard = await load('admin/index.html', {
  beforeParse(window) {
    window.HTMLElement.prototype.scrollIntoView = function () {};
    window.fetch = function (input, options) {
      const requestUrl = typeof input === 'string' ? input : input.url;
      const body = requestUrl.includes('/api/auth/session')
        ? { authenticated: true, username: 'admin' }
        : requestUrl.includes('/api/recipes/update')
          ? { success: true, slug: sampleRecipe.slug }
          : { recipes: [sampleRecipe] };

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      });
    };
  },
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 25));
await settle();

await test('lists the recipes returned by the API', () => {
  const rows = dashboard.document.querySelectorAll('#recipe-list .admin-row');
  assert.equal(rows.length, 1);
  assert.match(rows[0].textContent, /Portuguese Salt Cod Rice/);
  assert.match(rows[0].textContent, /Bilingual/);
  assert.equal(dashboard.document.getElementById('admin-user').textContent, 'admin');
});

await test('selecting a recipe fills the editor with both languages', () => {
  click(dashboard.window, dashboard.document.querySelector('[data-edit]'));
  const form = dashboard.document.getElementById('edit-form');

  assert.ok(!isHidden(form));
  assert.equal(form.elements.title.value, 'Portuguese Salt Cod Rice');
  assert.equal(form.elements.titlePt.value, 'Arroz de Bacalhau à Portuguesa');
  assert.equal(form.elements.ingredients.value, '2 salt cod steaks\n200 g Carolino rice');
  assert.equal(form.elements.stepsPt.value, 'Demolha o bacalhau.\nCozinha o arroz.');
  assert.equal(form.elements.slug.value, 'arroz-de-bacalhau');
});

await test('saving posts the form and shows the saved confirmation', async () => {
  const form = dashboard.document.getElementById('edit-form');
  form.elements.description.value = 'Updated description';

  form.dispatchEvent(new dashboard.window.Event('submit', { bubbles: true, cancelable: true }));
  await settle();

  const message = dashboard.document.getElementById('admin-message');
  assert.ok(!isHidden(message));
  assert.match(message.textContent, /Recipe saved/);
});

await test('the dashboard scripts run without errors', () => {
  assert.equal(dashboard.errors.length, 0, dashboard.errors.map((error) => error.message).join('\n'));
});

dashboard.dom.window.close();

console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) {
  for (const failure of failures) {
    console.log(`\n--- ${failure.name}\n${failure.error.stack}`);
  }
  process.exit(1);
}
