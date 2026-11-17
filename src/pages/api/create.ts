import type { APIRoute } from 'astro';
import { isAuthenticated, jsonResponse } from '@/lib/auth';
import {
  recipeFilePath,
  recipeFromFormData,
  slugify,
  validateRecipe,
  writeRecipeFile,
} from '@/lib/recipe-file';

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

    if (recipeFilePath(slug)) {
      return jsonResponse({ error: 'A recipe with this title already exists' }, 409);
    }

    if (!writeRecipeFile(slug, input)) {
      return jsonResponse({ error: 'Invalid recipe title' }, 400);
    }

    return jsonResponse({ success: true, slug, message: 'Recipe created successfully' });
  } catch (error) {
    console.error('Error creating recipe:', error);
    return jsonResponse({ error: 'Failed to create recipe' }, 500);
  }
};
