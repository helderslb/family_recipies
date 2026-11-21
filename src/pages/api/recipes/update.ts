import type { APIRoute } from 'astro';
import { isAuthenticated, jsonResponse } from '@/lib/auth';
import { triggerDeploy } from '@/lib/deploy';
import {
  buildRecipeMarkdown,
  recipeFromFormData,
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
    const slug = String(form.get('slug') ?? '').trim();

    if (!(await recipeExists(slug))) {
      return jsonResponse({ error: 'Recipe not found' }, 404);
    }

    const input = recipeFromFormData(form);
    const problem = validateRecipe(input);

    if (problem) {
      return jsonResponse({ error: problem }, 400);
    }

    try {
      writeRecipeFile(slug, input);
    } catch {
      /* read-only filesystem on Vercel — ignore */
    }

    await upsertRecipe(slug, buildRecipeMarkdown(input));
    await triggerDeploy();

    return jsonResponse({ success: true, slug });
  } catch (error) {
    console.error('Error updating recipe:', error);
    return jsonResponse({ error: 'Failed to update recipe' }, 500);
  }
};
