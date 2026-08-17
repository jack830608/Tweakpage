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

/**
 * The fields, in the order they are asked for.
 *
 * Both the in-panel settings and the options page render from this list, so a fifth
 * field appears in both places or neither.
 */
export const SHARE_FIELDS: ReadonlyArray<{
  key: keyof ShareSettings;
  /** What AWS's own console calls it. */
  label: string;
  /** The environment variable of the same value, for matching against an existing .env. */
  env: string;
  secret?: boolean;
  hint?: string;
}> = [
  { key: 'bucket', label: 'Bucket', env: 'AWS_S3_BUCKET', hint: 'my-bucket' },
  { key: 'region', label: 'Region', env: 'AWS_REGION', hint: 'ap-northeast-1' },
  { key: 'accessKeyId', label: 'Access key ID', env: 'AWS_ACCESS_KEY_ID', hint: 'AKIA…' },
  { key: 'secretAccessKey', label: 'Secret access key', env: 'AWS_SECRET_ACCESS_KEY', secret: true },
];

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

/**
 * Calls back whenever the credentials change, including from another tab or the
 * options page. Settings and the button they unlock are now one click apart, so a
 * value read once at mount is stale as soon as someone types.
 */
export function watchShareSettings(onChange: (settings: ShareSettings) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>) => {
    if (!(KEY in changes)) return;
    void getShareSettings().then(onChange);
  };
  try {
    browser.storage.local.onChanged.addListener(listener);
  } catch {
    return () => {};
  }
  return () => {
    try {
      browser.storage.local.onChanged.removeListener(listener);
    } catch {
      // context invalidated — the listener went with it
    }
  };
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
