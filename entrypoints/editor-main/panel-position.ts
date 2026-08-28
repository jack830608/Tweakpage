import { browser } from 'wxt/browser';
import { safeStorageSet } from '../../lib/extension-context';
import type { Position } from './hooks/useDraggable';

const KEY = 'tweakpage:panel-position';

export async function getSavedPanelPosition(): Promise<Position | null> {
  try {
    const result = await browser.storage.local.get(KEY);
    const value = result[KEY] as Position | undefined;
    return value && typeof value.x === 'number' && typeof value.y === 'number' ? value : null;
  } catch {
    return null;
  }
}

export function savePanelPosition(position: Position): void {
  safeStorageSet({ [KEY]: position });
}

const PREFS_KEY = 'tweakpage:panel-prefs';

export type ThemeChoice = 'system' | 'light' | 'dark';

export interface PanelPrefs {
  width: number;
  theme: ThemeChoice;
  /** Which sections are open. Remembered so the panel reopens the way it was left. */
  openSections: Record<string, boolean>;
}

export const DEFAULT_PREFS: PanelPrefs = {
  width: 320,
  theme: 'system',
  // Everything open at once is a wall of fields; the rest is one click away.
  // 'text' was a section id before content came out of its drawer; nothing has read this
  // key since. The first group is what a panel should open with.
  openSections: { typography: true },
};
export const MIN_WIDTH = 280;
export const MAX_WIDTH = 560;

export async function getPanelPrefs(): Promise<PanelPrefs> {
  try {
    const result = await browser.storage.local.get(PREFS_KEY);
    const value = result[PREFS_KEY] as Partial<PanelPrefs> | undefined;
    return {
      width: clampWidth(typeof value?.width === 'number' ? value.width : DEFAULT_PREFS.width),
      theme: value?.theme === 'light' || value?.theme === 'dark' ? value.theme : 'system',
      openSections:
        value?.openSections && typeof value.openSections === 'object'
          ? value.openSections
          : DEFAULT_PREFS.openSections,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePanelPrefs(prefs: PanelPrefs): void {
  safeStorageSet({ [PREFS_KEY]: prefs });
}

export function clampWidth(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));
}
