import { browser } from 'wxt/browser';

const KEY = 'tweakpage:share-settings';

export interface ShareSettings {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** tinify.com key. Empty means images are uploaded as they were picked. */
  tinypngKey: string;
  /** Lift embedded images out to the bucket when sharing. */
  uploadImages: boolean;
  /**
   * Compress before uploading. Separate from holding a key on purpose: this sends the
   * user's images to a third party, which is a decision, not a side effect of pasting.
   */
  compressImages: boolean;
}

export const EMPTY_SETTINGS: ShareSettings = {
  bucket: '',
  region: '',
  accessKeyId: '',
  secretAccessKey: '',
  tinypngKey: '',
  uploadImages: true,
  compressImages: false,
};

/**
 * The fields, in the order they are asked for.
 *
 * Both the in-panel settings and the options page render from this list, so a fifth
 * field appears in both places or neither.
 */
/** Only the text fields are rendered as inputs; the switches have their own control. */
type TextKey = {
  [K in keyof ShareSettings]: ShareSettings[K] extends string ? K : never;
}[keyof ShareSettings];

export const SHARE_FIELDS: ReadonlyArray<{
  key: TextKey;
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

/** The four that have to be there before S3 will answer at all. */
const REQUIRED = ['bucket', 'region', 'accessKeyId', 'secretAccessKey'] as const;

/** Sharing is offered only when a whole set is present — a partial one just fails at S3. */
export function isConfigured(settings: ShareSettings): boolean {
  return REQUIRED.every((key) => settings[key] !== '');
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
      tinypngKey: str(value.tinypngKey),
      // Absent means "written before this existed": uploading is the behaviour that
      // makes a share work, so it is the default; sending images to a third party is not.
      uploadImages: value.uploadImages !== false,
      compressImages: value.compressImages === true,
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
