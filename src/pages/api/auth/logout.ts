import type { APIRoute } from 'astro';
import { expiredSessionCookie, getSession, jsonResponse, redirectResponse } from '@/lib/auth';

export const prerender = false;

export const POST: APIRoute = async () => {
  return redirectResponse('/', [expiredSessionCookie()]);
};

export const GET: APIRoute = async ({ request }) => {
  const session = getSession(request);
  if (!session) return jsonResponse({ error: 'Unauthorized' }, 401);
  return redirectResponse('/');
};
