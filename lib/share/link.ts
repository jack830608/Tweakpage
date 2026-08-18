/** The query parameter that turns a page URL into a shared-edits link. */
export const SHARE_PARAM = 'tweakpage';

/** Every share is written here, so one IAM policy and one lifecycle rule cover them all. */
export const SHARE_PREFIX = 'tweakpage/';
/** Everything lives under SHARE_PREFIX, sorted by what it is, so one policy covers all. */
const SHARES = 'shares/';
const IMAGES = 'images/';

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 22;
const ID = new RegExp(`^[a-z0-9]{${ID_LENGTH}}$`);
const BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const REGION = /^[a-z]{2}-[a-z]+-\d$/;

export interface ShareRef {
  id: string;
  bucket: string;
  region: string;
}

/**
 * The id is the capability: whoever holds the link can read that one object, and nobody
 * can guess another. 22 characters of this alphabet is about 113 bits.
 */
export function makeShareId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH));
  return [...bytes].map((b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
}

/**
 * A link names the bucket and region, not a URL.
 *
 * Carrying the location is what lets someone read a share without an AWS account of
 * their own. Carrying it in pieces is what stops a link from pointing anywhere it likes:
 * the address is always one we build, from parts that have to look like a bucket and a
 * region before they are used at all.
 */
export function encodeRef({ id, bucket, region }: ShareRef): string {
  // Underscore because a query parameter leaves it alone, and neither a bucket name nor
  // a region can contain one — so the parts can never run together.
  return `${id}_${bucket}_${region}`;
}

export function decodeRef(value: string): ShareRef | null {
  const [id, bucket, region, ...rest] = value.split('_');
  if (rest.length > 0) return null;
  if (!ID.test(id ?? '') || !BUCKET.test(bucket ?? '') || !REGION.test(region ?? '')) return null;
  return { id, bucket, region };
}

/**
 * The shapes S3 will actually answer to.
 *
 * Shared by the settings check and by the validation of a link that arrives, so what a
 * sender is told is configured is exactly what a recipient will accept.
 */
export function isBucketName(value: string): boolean {
  return /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(value) && !value.includes('..');
}

export function isRegionName(value: string): boolean {
  return /^[a-z]{2}(-[a-z]+)+-\d$/.test(value);
}

export function objectUrl({ id, bucket, region }: ShareRef): URL {
  return new URL(`https://${bucket}.s3.${region}.amazonaws.com/${SHARE_PREFIX}${SHARES}${id}.json`);
}

/**
 * Images live beside the shares, under the same prefix.
 *
 * One prefix means one bucket policy line covers both, so the setup instructions do not
 * grow as the layout does.
 */
export function imageUrl(bucket: string, region: string, key: string): URL {
  return new URL(`https://${bucket}.s3.${region}.amazonaws.com/${SHARE_PREFIX}${IMAGES}${key}`);
}

/** Adds the reference to the page's own URL, so the link lands on the page it describes. */
export function shareLink(pageUrl: string, ref: ShareRef): string {
  const url = new URL(pageUrl);
  url.searchParams.set(SHARE_PARAM, encodeRef(ref));
  return url.toString();
}

export function shareRefFrom(href: string): ShareRef | null {
  try {
    const value = new URL(href).searchParams.get(SHARE_PARAM);
    return value ? decodeRef(value) : null;
  } catch {
    return null;
  }
}
