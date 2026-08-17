import { browser } from 'wxt/browser';

const KEY = 'tweakpage:share-settings';

export interface ShareSettings {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Everything is written under this prefix, so the IAM policy can be scoped to it. */
  prefix: string;
}

export const EMPTY_SETTINGS: ShareSettings = {
  bucket: '',
  region: '',
  accessKeyId: '',
  secretAccessKey: '',
  prefix: 'tweakpage/',
};

export function isConfigured(settings: ShareSettings): boolean {
  return Boolean(settings.bucket && settings.region && settings.accessKeyId && settings.secretAccessKey);
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
      prefix: normalizePrefix(str(value.prefix) || EMPTY_SETTINGS.prefix),
    };
  } catch {
    return EMPTY_SETTINGS;
  }
}

export async function saveShareSettings(settings: ShareSettings): Promise<void> {
  await browser.storage.local.set({ [KEY]: { ...settings, prefix: normalizePrefix(settings.prefix) } });
}

/** Where one shared file lives. Both ends compute this, so a link carries only the id. */
export function objectUrl(settings: ShareSettings, id: string): URL {
  return new URL(
    `https://${settings.bucket}.s3.${settings.region}.amazonaws.com/${settings.prefix}${id}.json`,
  );
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePrefix(prefix: string): string {
  const cleaned = prefix.replace(/^\/+/, '');
  return cleaned === '' || cleaned.endsWith('/') ? cleaned : `${cleaned}/`;
}
