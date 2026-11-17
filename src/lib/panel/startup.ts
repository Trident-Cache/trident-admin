/**
 * What the panel says, and whether it goes on, when its process starts.
 * Called once from `src/instrumentation.ts`.
 */
import { readPanelConfig } from './config';

export function checkPanelConfigAtStart(): void {
  const config = readPanelConfig(process.env);

  if (config.errors.length > 0) {
    for (const error of config.errors) {
      console.error(`[trident-admin] refusing to start: ${error}`);
    }
    process.exit(1);
  }

  if (!config.loginEnabled) {
    console.warn(
      '[trident-admin] WARNING: no login is configured (TRIDENT_PANEL_PASSWORD is not set). ' +
        'Anyone who can reach this port can purge the cache, drain backends and start a launch.',
    );
    return;
  }

  if (!config.sessionSecret) {
    console.log(
      '[trident-admin] login is on. TRIDENT_PANEL_SESSION_SECRET is not set, so sessions are signed with a ' +
        'random key and end when this process restarts.',
    );
  } else {
    console.log('[trident-admin] login is on.');
  }
}
