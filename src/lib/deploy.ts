/**
 * Triggers a Vercel redeploy after recipe edits so the prerendered public pages
 * get refreshed from Turso. No-op when VERCEL_DEPLOY_HOOK isn't configured.
 */
export async function triggerDeploy(): Promise<void> {
  const hook = process.env.VERCEL_DEPLOY_HOOK;
  if (!hook) return;

  try {
    await fetch(hook, { method: 'POST' });
  } catch (error) {
    console.error('Failed to trigger Vercel deploy hook:', error);
  }
}