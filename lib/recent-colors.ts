import { browser } from 'wxt/browser';

const KEY = 'tweakpage:recent-colors';
const MAX_RECENT = 8;

export async function getRecentColors(): Promise<string[]> {
  try {
    const result = await browser.storage.local.get(KEY);
    return Array.isArray(result[KEY]) ? (result[KEY] as string[]) : [];
  } catch {
    return [];
  }
}

export async function addRecentColor(hex: string): Promise<string[]> {
  const current = await getRecentColors();
  const next = [hex, ...current.filter((c) => c !== hex)].slice(0, MAX_RECENT);
  try {
    await browser.storage.local.set({ [KEY]: next });
  } catch {
    // storage failure only loses the convenience list
  }
  return next;
}
