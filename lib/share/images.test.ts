import { describe, expect, test } from 'vitest';
import { embeddedImages, imageKey, withHostedImages } from './images';
import type { EditRecord, PageEdits } from '../edits/types';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APn+iiigD//Z';

const record = (o: Partial<EditRecord>): EditRecord => ({
  id: 'r1', selector: 'img', fallbackSelectors: [], elementLabel: 'img',
  type: 'attr', property: 'src', oldValue: '/old.png', newValue: PNG,
  enabled: true, createdAt: 'n', updatedAt: 'n', ...o,
});
const page = (records: EditRecord[]): PageEdits => ({
  version: 1, url: 'https://a.com/p', title: 'T', updatedAt: 'n', records,
});

describe('finding the images a share would have to carry', () => {
  test('picks up src, background-image and srcset', () => {
    const found = embeddedImages(page([
      record({ id: 'a', property: 'src', newValue: PNG }),
      record({ id: 'b', property: 'backgroundImage', type: 'style', newValue: `url("${JPG}")` }),
      record({ id: 'c', property: 'srcset', newValue: `${PNG} 1x, ${JPG} 2x` }),
    ]));
    expect(found.map((i) => i.mediaType).sort()).toEqual(['image/jpeg', 'image/png']);
  });

  test('the same picture twice is one upload', () => {
    const found = embeddedImages(page([
      record({ id: 'a', newValue: PNG }),
      record({ id: 'b', selector: 'img.other', newValue: PNG }),
    ]));
    expect(found).toHaveLength(1);
  });

  test('ordinary URLs are left alone', () => {
    expect(embeddedImages(page([record({ newValue: 'https://cdn.example.com/a.png' })]))).toHaveLength(0);
  });

  test('a value that is not really an image is not decoded', () => {
    expect(embeddedImages(page([record({ newValue: 'data:text/html;base64,PHNjcmlwdD4=' })]))).toHaveLength(0);
  });
});

describe('rewriting the copy that gets uploaded', () => {
  test('swaps every occurrence, including inside srcset and url()', () => {
    const hosted = new Map([[PNG, 'https://b.s3.amazonaws.com/tweakpage/images/abc.png']]);
    const rewritten = withHostedImages(page([
      record({ id: 'a', property: 'src', newValue: PNG }),
      record({ id: 'b', property: 'backgroundImage', type: 'style', newValue: `url("${PNG}")` }),
      record({ id: 'c', property: 'srcset', newValue: `${PNG} 1x` }),
    ]), hosted);
    for (const r of rewritten.records) {
      expect(r.newValue, r.property).not.toContain('base64');
      expect(r.newValue).toContain('images/abc.png');
    }
  });

  test('proposals carry their images too', () => {
    const hosted = new Map([[PNG, 'https://host/x.png']]);
    const source: PageEdits = { ...page([]), variants: [{ id: 'v1', name: 'A', savedAt: 'n', records: [record({})] }] };
    expect(withHostedImages(source, hosted).variants![0]!.records[0]!.newValue).toBe('https://host/x.png');
  });

  test('a record we could not upload keeps its bytes rather than losing the image', () => {
    const rewritten = withHostedImages(page([record({ newValue: PNG })]), new Map([['other', 'x']]));
    expect(rewritten.records[0]!.newValue).toBe(PNG);
  });
});

describe('naming', () => {
  test('the same bytes always land on the same object', async () => {
    const [image] = embeddedImages(page([record({ newValue: PNG })]));
    const [again] = embeddedImages(page([record({ id: 'z', newValue: PNG })]));
    expect(await imageKey(image!)).toBe(await imageKey(again!));
    expect(await imageKey(image!)).toMatch(/^[0-9a-f]{64}\.png$/);
  });

  test('jpeg gets the extension people expect', async () => {
    const [image] = embeddedImages(page([record({ newValue: JPG })]));
    expect(await imageKey(image!)).toMatch(/\.jpg$/);
  });
});
