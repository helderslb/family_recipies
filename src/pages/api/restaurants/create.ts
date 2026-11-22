import type { APIRoute } from 'astro';
import { isAuthenticated, jsonResponse } from '@/lib/auth';
import { triggerDeploy } from '@/lib/deploy';
import { createRestaurant, restaurantFromFormData, validateRestaurant } from '@/lib/restaurant-store';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isAuthenticated(request)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const form = await request.formData();
    const input = restaurantFromFormData(form);
    const problem = validateRestaurant(input);

    if (problem) {
      return jsonResponse({ error: problem }, 400);
    }

    await createRestaurant(input);
    await triggerDeploy();

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Error creating restaurant:', error);
    return jsonResponse({ error: 'Failed to create restaurant' }, 500);
  }
};