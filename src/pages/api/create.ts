import type { APIRoute } from 'astro';
import { isAuthenticated, jsonResponse } from '@/lib/auth';
import { triggerDeploy } from '@/lib/deploy';
import {
  buildRecipeMarkdown,
  recipeFromFormData,
  slugify,
  validateRecipe,
  writeRecipeFile,
} from '@/lib/recipe-file';
import { recipeExists, upsertRecipe } from '@/lib/recipe-store';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isAuthenticated(request)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const form = await request.formData();
    const input = recipeFromFormData(form);
    const problem = validateRecipe(input);

    if (problem) {
      return jsonResponse({ error: problem }, 400);
    }

    const slug = slugify(input.title);
    if (!slug) {
      return jsonResponse({ error: 'Invalid recipe title' }, 400);
    }

    if (await recipeExists(slug)) {
      return jsonResponse({ error: 'A recipe with this title already exists' }, 409);
    }

    // Write the local markdown for instant updates in development (best-effort —
    // the filesystem is read-only on Vercel, where Turso is the source of truth).
    try {
      writeRecipeFile(slug, input);
    } catch {
      /* read-only filesystem on Vercel — ignore */
    }

    await upsertRecipe(slug, buildRecipeMarkdown(input));
    await triggerDeploy();

    return jsonResponse({ success: true, slug, message: 'Recipe created successfully' });
  } catch (error) {
    console.error('Error creating recipe:', error);
    return jsonResponse({ error: 'Failed to create recipe' }, 500);
  }
};
