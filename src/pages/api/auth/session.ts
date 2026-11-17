import type { APIRoute } from 'astro';
import { getSession, jsonResponse } from '@/lib/auth';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const session = getSession(request);

  return jsonResponse({
    authenticated: session !== null,
    username: session?.username ?? null,
  });
};
