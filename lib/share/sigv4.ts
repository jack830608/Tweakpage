/**
 * AWS Signature Version 4, enough of it to PUT and GET one object.
 *
 * Written against the spec rather than pulled in as a dependency: the AWS SDK is
 * megabytes of code for one request, and a content script pays for every byte.
 */

export interface SignedRequest {
  headers: Record<string, string>;
}

export interface SigningInput {
  method: 'PUT' | 'GET';
  url: URL;
  region: string;
  service?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Empty for GET. */
  body?: string;
  /** Extra headers to sign, lower-cased by the signer. */
  headers?: Record<string, string>;
  now?: Date;
}

const encoder = new TextEncoder();

export async function signRequest({
  method,
  url,
  region,
  service = 's3',
  accessKeyId,
  secretAccessKey,
  body = '',
  headers = {},
  now = new Date(),
}: SigningInput): Promise<SignedRequest> {
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(body);

  const all: Record<string, string> = {
    ...lowerKeys(headers),
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  const names = Object.keys(all).sort();
  const canonicalHeaders = names.map((n) => `${n}:${all[n].trim()}`).join('\n');
  const signedHeaders = names.join(';');

  const canonicalRequest = [
    method,
    encodePath(url.pathname),
    url.searchParams.toString(),
    canonicalHeaders,
    '',
    signedHeaders,
    payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  let key = encoder.encode(`AWS4${secretAccessKey}`);
  for (const part of [dateStamp, region, service, 'aws4_request']) {
    key = new Uint8Array(await hmac(key, part));
  }
  const signature = toHex(await hmac(key, stringToSign));

  return {
    headers: {
      ...all,
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

/**
 * The canonical request wants RFC 3986 encoding, which is stricter than what the URL
 * parser leaves behind — it keeps $ ! ' ( ) * as-is. Decoding first avoids encoding the
 * percent signs of an already-encoded path a second time.
 */
function encodePath(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) =>
      encodeURIComponent(decodeURIComponent(segment)).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join('/');
}

function lowerKeys(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
}

function toAmzDate(now: Date): string {
  return `${now.toISOString().replace(/[:-]|\.\d{3}/g, '')}`.replace(/Z$/, 'Z');
}

async function hmac(key: Uint8Array, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as unknown as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

async function sha256Hex(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
