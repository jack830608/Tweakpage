import { browser } from 'wxt/browser';
import { DEFAULT_EXCLUSIONS, saveExclusions } from './exclusions';
import { EMPTY_SETTINGS, saveSharePreferences, saveShareSettings } from './share/settings';

/**
 * Putting it back the way it came.
 *
 * Settings accumulate, and somewhere in there is the one that broke something. A way out
 * that does not involve reinstalling is worth having — but "everything" spans three
 * things with wildly different costs. Losing a theme costs a click; losing a bucket key
 * costs a trip to the AWS console; losing a month of edits costs a month. So the act is
 * itemised: you say which, and the count says what that means before you press it.
 */
export type ResetTarget = 'preferences' | 'edits' | 'credentials';

/**
 * Preferences, in the sense of "things the editor remembers about how you like it".
 *
 * Removed rather than rewritten: every reader of these already falls back to a default
 * when the key is absent, and a key that is gone cannot disagree with a default that
 * later changes.
 */
const PREFERENCE_KEYS = [
  'tweakpage:panel-prefs',
  'tweakpage:panel-position',
  'tweakpage:recent-colors',
  'tweakpage:transfer-consent',
  'tweakpage:hosted-images',
  // Back to being new, which is also how you can tell the reset happened.
  'tweakpage:onboarded',
];

const PAGE_PREFIX = 'page:';

export interface ResetInventory {
  pages: number;
  records: number;
  variants: number;
  hasCredentials: boolean;
}

/**
 * What is actually there, so the offer can say so.
 *
 * "Delete all your changes" means nothing until it says three sites and seventeen
 * changes. The number is the warning.
 */
export async function takeInventory(): Promise<ResetInventory> {
  const empty = { pages: 0, records: 0, variants: 0, hasCredentials: false };
  try {
    const all = (await browser.storage.local.get(null)) as Record<string, unknown>;
    const pages = Object.entries(all).filter(([key]) => key.startsWith(PAGE_PREFIX));
    const settings = all['tweakpage:share-settings'] as { accessKeyId?: string; tinypngKey?: string } | undefined;
    return {
      pages: pages.length,
      records: pages.reduce((n, [, page]) => n + countRecords(page), 0),
      variants: pages.reduce((n, [, page]) => n + countVariants(page), 0),
      hasCredentials: Boolean(settings?.accessKeyId || settings?.tinypngKey),
    };
  } catch {
    return empty;
  }
}

function countRecords(page: unknown): number {
  const records = (page as { records?: unknown })?.records;
  return Array.isArray(records) ? records.length : 0;
}

function countVariants(page: unknown): number {
  const variants = (page as { variants?: unknown })?.variants;
  return Array.isArray(variants) ? variants.length : 0;
}

/**
 * Does exactly what was asked for and nothing beside it.
 *
 * Credentials and the upload switches live in one stored object, so clearing one without
 * the other has to go through the preferences-only write. Asking for both is not two
 * requests that fight: the credentials wipe carries the default switches with it.
 */
export async function resetTo(targets: ResetTarget[]): Promise<void> {
  const wanted = new Set(targets);
  try {
    if (wanted.has('edits')) {
      const all = await browser.storage.local.get(null);
      const pages = Object.keys(all).filter((key) => key.startsWith(PAGE_PREFIX));
      if (pages.length > 0) await browser.storage.local.remove(pages);
    }
    if (wanted.has('credentials')) {
      await saveShareSettings(EMPTY_SETTINGS);
    }
    if (wanted.has('preferences')) {
      await browser.storage.local.remove(PREFERENCE_KEYS);
      // Shipped state, not an empty list: the attribute convention is one of the
      // defaults, and a reset that removed it would be a reset to somewhere new.
      await saveExclusions([...DEFAULT_EXCLUSIONS]);
      if (!wanted.has('credentials')) {
        await saveSharePreferences({
          uploadImages: { ...EMPTY_SETTINGS.uploadImages },
          compressImages: EMPTY_SETTINGS.compressImages,
        });
      }
    }
  } catch {
    // Storage is gone, which is the one case where there is nothing left to reset.
  }
}
