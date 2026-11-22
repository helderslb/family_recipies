import type { APIRoute } from 'astro';
import { isAuthenticated, jsonResponse } from '@/lib/auth';
import { triggerDeploy } from '@/lib/deploy';
import { deleteRecipeFile } from '@/lib/recipe-file';
import { deleteRecipe, recipeExists } from '@/lib/recipe-store';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isAuthenticated(request)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const form = await request.formData();
    const slug = String(form.get('slug') ?? '').trim().toLowerCase();

    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      return jsonResponse({ error: 'Invalid slug' }, 400);
    }

    if (!(await recipeExists(slug))) {
      return jsonResponse({ error: 'Recipe not found' }, 404);
    }

    // Remove the local markdown for instant updates in development (best-effort —
    // the filesystem is read-only on Vercel, where Turso is the source of truth).
    try {
      deleteRecipeFile(slug);
    } catch {
      /* read-only filesystem on Vercel — ignore */
    }

    await deleteRecipe(slug);
    await triggerDeploy();

    return jsonResponse({ success: true, slug });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    return jsonResponse({ error: 'Failed to delete recipe' }, 500);
  }
};