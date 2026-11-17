import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { isAuthenticated, jsonResponse } from '@/lib/auth';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthenticated(request)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const recipes = await getCollection('recipes');

  const items = recipes
    .map((recipe) => ({
      slug: recipe.slug,
      story: (recipe.body ?? '').trim(),
      ...recipe.data,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return jsonResponse({ recipes: items });
};
