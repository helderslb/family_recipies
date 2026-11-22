import matter from 'gray-matter';
import { ensureSchema, getDb } from '@/lib/db';
import { recipeFilePath } from '@/lib/recipe-file';

/**
 * Turso-backed persistence for recipes.
 *
 * Recipes are stored as their full markdown file content (frontmatter + story
 * body). This keeps the build-time "pull" trivial (just write the markdown back
 * to src/content/recipes/*.md), while the admin reads the parsed frontmatter at
 * runtime via gray-matter.
 */
export interface RecipeListItem {
  slug: string;
  story: string;
  [key: string]: unknown;
}

const SLUG_PATTERN = /^[a-z0-9-]+$/;

export async function listRecipes(): Promise<RecipeListItem[]> {
  const db = getDb();
  if (!db) return [];

  await ensureSchema();
  const result = await db.execute('SELECT slug, markdown FROM recipes');

  const items = result.rows.map((row) => {
    const slug = String(row.slug);
    const parsed = matter(String(row.markdown));
    return {
      slug,
      story: (parsed.content ?? '').trim(),
      ...(parsed.data as Record<string, unknown>),
    };
  });

  return items.sort((a, b) => String(a.title).localeCompare(String(b.title)));
}

/** True when a recipe exists in the store (falls back to the local file in dev). */
export async function recipeExists(slug: string): Promise<boolean> {
  if (!SLUG_PATTERN.test(slug)) return false;

  const db = getDb();
  if (!db) return recipeFilePath(slug) !== null;

  await ensureSchema();
  const result = await db.execute({ sql: 'SELECT 1 FROM recipes WHERE slug = ?', args: [slug] });
  return result.rows.length > 0;
}

export async function upsertRecipe(slug: string, markdown: string): Promise<void> {
  if (!SLUG_PATTERN.test(slug)) return;

  const db = getDb();
  if (!db) return;

  await ensureSchema();
  await db.execute({
    sql: `INSERT INTO recipes (slug, markdown, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(slug) DO UPDATE SET
            markdown = excluded.markdown,
            updated_at = excluded.updated_at`,
    args: [slug, markdown, Date.now()],
  });
}

/** Delete a recipe. Returns true when a row was removed (false when no DB/row). */
export async function deleteRecipe(slug: string): Promise<boolean> {
  if (!SLUG_PATTERN.test(slug)) return false;

  const db = getDb();
  if (!db) return false;

  await ensureSchema();
  const result = await db.execute({ sql: 'DELETE FROM recipes WHERE slug = ?', args: [slug] });
  return result.rowsAffected > 0;
}