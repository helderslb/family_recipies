import type { APIRoute } from 'astro';
import fs from 'node:fs';
import { isAuthenticated, jsonResponse } from '@/lib/auth';
import {
  buildRecipeMarkdown,
  recipeFilePath,
  recipeFromFormData,
  validateRecipe,
} from '@/lib/recipe-file';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isAuthenticated(request)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const form = await request.formData();
    const slug = String(form.get('slug') ?? '').trim();
    const filePath = recipeFilePath(slug);

    if (!filePath) {
      return jsonResponse({ error: 'Recipe not found' }, 404);
    }

    const input = recipeFromFormData(form);
    const problem = validateRecipe(input);

    if (problem) {
      return jsonResponse({ error: problem }, 400);
    }

    fs.writeFileSync(filePath, buildRecipeMarkdown(input), 'utf8');

    return jsonResponse({ success: true, slug });
  } catch (error) {
    console.error('Error updating recipe:', error);
    return jsonResponse({ error: 'Failed to update recipe' }, 500);
  }
};
