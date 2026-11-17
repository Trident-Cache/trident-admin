/**
 * The process-wide gate: one configuration, one signing key, one sign-in
 * failure count. Kept on `globalThis` so that a module evaluated twice (a
 * reload in development) still gets the same instance and the same key.
 */
import { readPanelConfig } from './config';
import { PanelGate } from './gate';

const SLOT = Symbol.for('trident.panel.gate');

type GlobalWithGate = typeof globalThis & { [SLOT]?: PanelGate };

export function getPanelGate(): PanelGate {
  const scope = globalThis as GlobalWithGate;
  if (!scope[SLOT]) scope[SLOT] = new PanelGate(readPanelConfig(process.env));
  return scope[SLOT];
}
