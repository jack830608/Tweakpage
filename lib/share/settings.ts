import { browser } from 'wxt/browser';

const KEY = 'tweakpage:share-settings';

export interface ShareSettings {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export const EMPTY_SETTINGS: ShareSettings = {
  bucket: '',
  region: '',
  accessKeyId: '',
  secretAccessKey: '',
};

/** Sharing is offered only when a whole set is present — a partial one just fails at S3. */
export function isConfigured(settings: ShareSettings): boolean {
  return Object.values(settings).every((value) => value !== '');
}

export async function getShareSettings(): Promise<ShareSettings> {
  try {
    const result = await browser.storage.local.get(KEY);
    const value = (result[KEY] ?? {}) as Partial<ShareSettings>;
    return {
      bucket: str(value.bucket),
      region: str(value.region),
      accessKeyId: str(value.accessKeyId),
      secretAccessKey: str(value.secretAccessKey),
    };
  } catch {
    return EMPTY_SETTINGS;
  }
}

export async function saveShareSettings(settings: ShareSettings): Promise<void> {
  await browser.storage.local.set({ [KEY]: settings });
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
