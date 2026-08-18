import { browser } from 'wxt/browser';
import { isBucketName, isRegionName } from './link';

const KEY = 'tweakpage:share-settings';

export interface ShareSettings {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** tinify.com key. Empty means images are uploaded as they were picked. */
  tinypngKey: string;
  /**
   * Which hand-offs lift embedded images out to the bucket.
   *
   * Per destination because they want different things. A share link is a public object
   * and a hosted URL is what makes it work at all; a JSON export's virtue is being
   * self-contained and needing no AWS account, so it stays embedded unless asked.
   */
  uploadImages: Record<HandOff, boolean>;
  /**
   * Compress before uploading. Separate from holding a key on purpose: this sends the
   * user's images to a third party, which is a decision, not a side effect of pasting.
   */
  compressImages: boolean;
}

/** The four buttons that can carry an image somewhere. */
export const HAND_OFFS = ['summary', 'json', 'download', 'share'] as const;
export type HandOff = (typeof HAND_OFFS)[number];

export const EMPTY_SETTINGS: ShareSettings = {
  bucket: '',
  region: '',
  accessKeyId: '',
  secretAccessKey: '',
  tinypngKey: '',
  uploadImages: { summary: true, json: true, download: true, share: true },
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

/**
 * The TinyPNG key, asked for beside the AWS ones.
 *
 * Not part of SHARE_FIELDS because it is optional and sharing works without it, but it
 * is a credential and belongs in the same place: the extension's own page.
 */
export const TINYPNG_FIELD = {
  key: 'tinypngKey' as const,
  label: 'TinyPNG key',
  env: 'TINYPNG_API_KEY',
  secret: true,
  hint: undefined as string | undefined,
};

/**
 * Sharing is offered only when the settings could actually work.
 *
 * Not merely "all four are non-empty": a bucket named "x" or a region named "region"
 * passed that test, unlocked the button, and failed at S3 — or worse, produced a link
 * whose reference the recipient's own validation would refuse.
 */
export function isConfigured(settings: ShareSettings): boolean {
  return (
    REQUIRED.every((key) => settings[key] !== '') &&
    isBucketName(settings.bucket) &&
    isRegionName(settings.region)
  );
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
      uploadImages: handOffs(value.uploadImages),
      compressImages: value.compressImages === true,
    };
  } catch {
    return EMPTY_SETTINGS;
  }
}

/**
 * What the in-page panel is allowed to know.
 *
 * The panel is rendered inside whatever site the user is on, so anything it holds is
 * readable by that site's own JavaScript. Credentials therefore never reach it — it
 * gets the answers it needs to draw itself and nothing that could be stolen.
 */
export interface ShareStatus {
  configured: boolean;
  /** Named in the consent prompt. A bucket name is not a secret; the keys to it are. */
  bucket: string;
  compressionAvailable: boolean;
  compressImages: boolean;
  uploadImages: Record<HandOff, boolean>;
}

export async function getShareStatus(): Promise<ShareStatus> {
  const settings = await getShareSettings();
  return {
    configured: isConfigured(settings),
    bucket: settings.bucket,
    compressionAvailable: settings.tinypngKey !== '',
    compressImages: settings.compressImages,
    uploadImages: settings.uploadImages,
  };
}

/** The preferences the panel may change. Credentials are not among them. */
export async function saveSharePreferences(
  preferences: Pick<ShareSettings, 'uploadImages' | 'compressImages'>,
): Promise<void> {
  const settings = await getShareSettings();
  await saveShareSettings({ ...settings, ...preferences });
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

/**
 * Reads the per-hand-off switches, tolerating what earlier versions stored.
 *
 * A boolean is what the first version wrote, when the choice was share-only; it means
 * that answer for every destination. Anything unreadable falls back to the defaults,
 * which are on: with no bucket configured nothing uploads anyway, so "on" reads as
 * "upload when there is somewhere to upload to".
 */
function handOffs(value: unknown): Record<HandOff, boolean> {
  const defaults = EMPTY_SETTINGS.uploadImages;
  if (typeof value === 'boolean') {
    return Object.fromEntries(HAND_OFFS.map((k) => [k, value])) as Record<HandOff, boolean>;
  }
  if (typeof value !== 'object' || value === null) return { ...defaults };
  const stored = value as Partial<Record<HandOff, unknown>>;
  return Object.fromEntries(
    HAND_OFFS.map((k) => [k, typeof stored[k] === 'boolean' ? stored[k] : defaults[k]]),
  ) as Record<HandOff, boolean>;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
