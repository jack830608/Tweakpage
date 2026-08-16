import { expect, test } from 'vitest';
import { MAX_IMAGE_BYTES, readImageFile } from './image-file';

const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

test('reads an image into a data url', async () => {
  const file = new File([PNG_BYTES], 'hero.png', { type: 'image/png' });
  const result = await readImageFile(file);
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
});

test('refuses a file that is not an image', async () => {
  const file = new File(['{}'], 'edits.json', { type: 'application/json' });
  const result = await readImageFile(file);
  expect(result).toEqual({ ok: false, reason: 'not-an-image' });
});

test('refuses an image too big to store', async () => {
  const file = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], 'huge.png', { type: 'image/png' });
  const result = await readImageFile(file);
  expect(result).toEqual({ ok: false, reason: 'too-large' });
});
