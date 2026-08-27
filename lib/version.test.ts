import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test, vi } from 'vitest';
import { extensionVersion, producedBy, stamped } from './version';
import { parseImport } from './edits/import';
import { emptyPageEdits } from './edits/types';

beforeEach(() => {
  fakeBrowser.reset();
  vi.restoreAllMocks();
});

test('the version comes from the manifest, so it is declared once', () => {
  vi.spyOn(fakeBrowser.runtime, 'getManifest').mockReturnValue({ version: '9.9.9' } as never);
  expect(extensionVersion()).toBe('9.9.9');
  expect(producedBy()).toBe('Tweakpage 9.9.9');
});

/**
 * A hand-off must not fail because the extension context went away mid-share. A version
 * is useful, not load-bearing.
 */
test('an unreadable manifest costs the stamp, not the export', () => {
  vi.spyOn(fakeBrowser.runtime, 'getManifest').mockImplementation(() => {
    throw new Error('Extension context invalidated.');
  });
  expect(extensionVersion()).toBe('unknown');
});

/**
 * The stamp travels in files that older builds will open. parseImport keeps only the
 * fields it knows, so a version that has never heard of producedBy drops it rather than
 * refusing the file.
 */
test('a stamped page is still readable by a build that does not know the key', () => {
  const page = { ...emptyPageEdits('https://example.com/p', 'T', 'now'), records: [] };
  const result = parseImport(JSON.stringify({ ...stamped(page), records: [] }));
  expect(result.ok).toBe(true);
});
