import type { APIRoute } from 'astro';
import {
  checkCredentials,
  createSessionToken,
  jsonResponse,
  redirectResponse,
  safeNextPath,
  sessionCookie,
} from '@/lib/auth';
import { clientIp, isRateLimited } from '@/lib/rate-limit';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (isRateLimited(clientIp(request))) {
    return jsonResponse({ error: 'Too many login attempts. Please try again later.' }, 429);
  }

  const form = await request.formData();
  const username = String(form.get('username') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const next = safeNextPath(String(form.get('next') ?? '/admin'));

  if (!checkCredentials(username, password)) {
    return redirectResponse(`/admin/login/?error=invalid&next=${encodeURIComponent(next)}`);
  }

  return redirectResponse(next, [sessionCookie(createSessionToken(username))]);
};
