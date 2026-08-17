/** The query parameter that turns a page URL into a shared-edits link. */
export const SHARE_PARAM = 'tweakpage';

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 22;

/**
 * The id is the capability: anyone holding the link can read that one object, and
 * nobody can guess another. 22 characters of this alphabet is about 113 bits.
 */
export function makeShareId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH));
  return [...bytes].map((b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
}

export function isShareId(value: string): boolean {
  return new RegExp(`^[a-z0-9]{${ID_LENGTH}}$`).test(value);
}

/** Adds the id to the page's own URL, so opening the link lands on the page it describes. */
export function shareLink(pageUrl: string, id: string): string {
  const url = new URL(pageUrl);
  url.searchParams.set(SHARE_PARAM, id);
  return url.toString();
}

export function shareIdFrom(href: string): string | null {
  try {
    const value = new URL(href).searchParams.get(SHARE_PARAM);
    return value && isShareId(value) ? value : null;
  } catch {
    return null;
  }
}
