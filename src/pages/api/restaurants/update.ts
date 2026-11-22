import type { APIRoute } from 'astro';
import { isAuthenticated, jsonResponse } from '@/lib/auth';
import { triggerDeploy } from '@/lib/deploy';
import { restaurantFromFormData, updateRestaurant, validateRestaurant } from '@/lib/restaurant-store';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isAuthenticated(request)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const form = await request.formData();
    const id = Number(form.get('id') ?? '');

    if (!Number.isInteger(id)) {
      return jsonResponse({ error: 'Invalid restaurant' }, 400);
    }

    const input = restaurantFromFormData(form);
    const problem = validateRestaurant(input);

    if (problem) {
      return jsonResponse({ error: problem }, 400);
    }

    const ok = await updateRestaurant(id, input);
    if (!ok) {
      return jsonResponse({ error: 'Restaurant not found' }, 404);
    }

    await triggerDeploy();
    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Error updating restaurant:', error);
    return jsonResponse({ error: 'Failed to update restaurant' }, 500);
  }
};