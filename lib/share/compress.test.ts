import { afterEach, expect, test, vi } from 'vitest';
import { compressImage } from './compress';

const BYTES = new Uint8Array(1000).fill(7);
afterEach(() => vi.restoreAllMocks());

interface Stubbed {
  ok?: boolean;
  headers?: Record<string, string>;
  body?: unknown;
}

const respond = (...responses: Stubbed[]) => {
  let call = 0;
  vi.stubGlobal('fetch', vi.fn(async () => {
    const r = responses[Math.min(call++, responses.length - 1)]!;
    return {
      ok: r.ok ?? true,
      headers: new Headers(r.headers ?? {}),
      json: async () => r.body,
      arrayBuffer: async () => new Uint8Array(100).buffer,
    } as Response;
  }));
};

test('with no key the bytes go up exactly as they were picked', async () => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('must not be called'); }));
  const result = await compressImage(BYTES, 'image/png', '');
  expect(result).toEqual({ bytes: BYTES, compressed: false });
});

test('a compressed image comes back smaller, with the month’s count', async () => {
  respond(
    { body: { output: { url: 'https://api.tinify.com/output/x' } }, headers: { 'Compression-Count': '42' } },
    {},
  );
  const result = await compressImage(BYTES, 'image/png', 'key');
  expect(result.compressed).toBe(true);
  expect(result.bytes.length).toBe(100);
  expect(result.used).toBe(42);
});

test('an exhausted quota degrades to the original instead of failing the share', async () => {
  respond({ ok: false, headers: { 'Compression-Count': '500' } });
  const result = await compressImage(BYTES, 'image/png', 'key');
  expect(result).toMatchObject({ bytes: BYTES, compressed: false, used: 500 });
});

test('a network error degrades too', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
  expect(await compressImage(BYTES, 'image/png', 'key')).toEqual({ bytes: BYTES, compressed: false });
});

test('a format tinify does not handle is left alone without a round trip', async () => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('must not be called'); }));
  expect(await compressImage(BYTES, 'image/svg+xml', 'key')).toEqual({ bytes: BYTES, compressed: false });
});

test('a "compressed" result that grew is discarded', async () => {
  const tiny = new Uint8Array(50);
  respond({ body: { output: { url: 'https://api.tinify.com/output/x' } } }, {});
  const result = await compressImage(tiny, 'image/png', 'key');
  expect(result.compressed, 'bigger is not smaller').toBe(false);
  expect(result.bytes).toBe(tiny);
});
