# Family Recipes

A warm, two-language (English / Portuguese) family cookbook built with
[Astro 4](https://astro.build), Tailwind CSS and Markdown content collections.

## Getting started

```bash
npm install
npm run dev        # http://localhost:4321
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with live reload (port 4321) |
| `npm run build` | Builds the static pages plus the on-demand API server into `dist/` |
| `npm run check` | Audits the built site (links, anchors, duplicate ids, missing assets/CSS) |
| `npm test` | Build + audit + jsdom behaviour tests |
| `npm start` | Serves the built site with the Node adapter (`dist/server/entry.mjs`) |
| `npm run preview` | Preview the production build |

## Languages (English / Português)

Every page renders **both** languages in the markup and the `EN` / `PT` switch in
the header (also in the mobile menu) shows the active one instantly. The choice
is stored in `localStorage` (`family-recipes-language`) and applied before paint,
so it persists across pages.

- UI strings live in [`src/i18n/ui.ts`](src/i18n/ui.ts). Each key has an English
  and a Portuguese value; the `<T k="some.key" />` component renders both.
- Recipe content lives in `src/content/recipes/*.md`:
  - canonical fields: `title`, `description`, `ingredients`, `steps` (English)
  - Portuguese overrides: `titlePt`, `descriptionPt`, `ingredientsPt`, `stepsPt`,
    `storyPt` (the English story is the markdown body; the Portuguese story is
    frontmatter).
  - If a Portuguese field is missing the English one is shown, so a half
    translated recipe still works.
- Category and family values (`Mains`, `Grandma`, …) stay canonical for
  filtering; their labels are translated through `category.*` / `family.*` keys.

## Admin area (edit the recipes)

Sign in at **`/admin/login`**:

| Username | Password |
| --- | --- |
| `admin` | `admin` |

The dashboard at `/admin` lists everything in the cookbook. Pick a recipe, change
any field (English and Portuguese, ingredients, steps, story, image, featured
flag…) and save — the Markdown file in `src/content/recipes/` is rewritten. The
"Add a recipe" page (`/create`) is behind the same login.

Default credentials and the session secret can be overridden with environment
variables — **please change them before deploying**:

```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
ADMIN_SESSION_SECRET=a-long-random-string
```

Notes:

- Sessions are signed HttpOnly cookies (12 h) — looked after in
  [`src/lib/auth.ts`](src/lib/auth.ts). All write endpoints verify the session,
  so the API cannot be used anonymously.
- Admin pages and API routes need the Node server. In `npm run dev` a saved
  recipe shows up immediately (the Vite watcher is set to polling so it also
  works on bind-mounted workspaces).
- The public pages are prerendered at build time. If you run the production
  build (`npm start`), edits are written to disk but the published HTML only
  changes after the next `npm run build` — that is why the dashboard reminds you
  in production mode.

## Project layout

```
src/
  components/     RecipeCard, RecipeCollection, <T> translation helper
  content/        Markdown recipes + collection schema
  i18n/           EN/PT dictionaries and category/family labels
  layouts/        Shared page shell, header, footer, language script
  lib/            auth, recipe file (read/serialise Markdown), localisation
  pages/
    api/          auth (login/logout/session), create, recipes list/update
    admin/        login screen + dashboard
    recipes/      prerendered recipe pages
public/images/    photography used by the recipes
```

## Deployment

The site deploys on Vercel. Recipes live in Turso; a `prebuild` step
(`scripts/recipes-sync.mjs pull`) regenerates `src/content/recipes/*.md` from
Turso before Astro prerenders the pages.

Required environment variables (`.env` locally, Vercel Environment Variables in
production):

| Variable | Purpose |
| --- | --- |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Admin login |
| `ADMIN_SESSION_SECRET` | Signs the session cookie — generate a long random string |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | Recipe storage |
| `VERCEL_DEPLOY_HOOK` | Optional — redeploys after a recipe edit |

Recipe edits are written to Turso. Set `VERCEL_DEPLOY_HOOK` so a save triggers a
Vercel redeploy and the prerendered pages pick up the change (~a minute).
