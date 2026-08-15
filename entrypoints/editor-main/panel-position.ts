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
