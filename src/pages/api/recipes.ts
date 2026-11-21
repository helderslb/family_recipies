import type { APIRoute } from 'astro';
import { isAuthenticated, jsonResponse } from '@/lib/auth';
import { listRecipes } from '@/lib/recipe-store';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthenticated(request)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const items = await listRecipes();
  return jsonResponse({ recipes: items });
};
