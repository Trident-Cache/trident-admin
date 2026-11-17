/**
 * Runs once when the server process starts, before it accepts requests.
 * Not run while `next build` collects pages: the build has no deployment
 * settings to judge.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  const { checkPanelConfigAtStart } = await import('@/lib/panel/startup');
  checkPanelConfigAtStart();
}
