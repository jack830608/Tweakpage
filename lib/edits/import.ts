import { isSafeRecordId } from './css';
import { MAX_IMAGE_BYTES } from '../image-file';
import { isCustomProperty, isSafeCustomValue } from './custom-css';
import { MAX_CONTEXT_DEPTH, type ContextNode } from '../selector/context';
import { textNodeIndex } from './text-nodes';
import { loadPageEdits, normalizePageUrl, savePageEdits } from './storage';
import type { EditRecord, PageEdits, Variant } from './types';

/** The style properties the panel owns a field for. The Advanced box owns the rest. */
export const PANEL_STYLE_PROPERTIES = new Set([
  'color',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'backgroundColor',
  'width',
  'height',
  'display',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'textAlign',
  'letterSpacing',
  'textTransform',
  'borderRadius',
  'opacity',
  'backgroundImage',
  'fontFamily',
  'borderWidth',
  'borderStyle',
  'borderColor',
  'display',
  'flexDirection',
  'justifyContent',
  'alignItems',
  'gap',
  'position',
  'boxShadow',
]);
const BACKGROUND_IMAGE_PATTERN = /^(none|url\("(https?:\/\/|data:image\/|\/)[^"\\]+"\))$/;
const MAX_BACKGROUND_IMAGE_LENGTH = 2000;
const MAX_RECORDS = 500;
const MAX_VARIANTS = 20;
const MAX_VARIANT_NAME = 60;
const MAX_STYLE_VALUE_LENGTH = 500;
const MAX_TEXT_LENGTH = 10000;
const MAX_SRC_LENGTH = 2000;
const MAX_SRCSET_LENGTH = 8000;
/**
 * A picked image travels inside the record as base64.
 *
 * The limits above were written for URLs, before picking a local file was possible, and
 * they quietly rejected every real photo: exporting a page and importing it elsewhere —
 * the path that needs no setup at all — dropped the picture without a word. The bound
 * that matters is the one the picker already enforces, in base64's ~4/3 characters per
 * byte, plus room for the data: prefix.
 */
const MAX_EMBEDDED_IMAGE_LENGTH = Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 100;
const EMBEDDED_IMAGE = /^(url\(")?data:image\//;

function withinLimit(value: string, urlLimit: number): boolean {
  return value.length <= (EMBEDDED_IMAGE.test(value) ? MAX_EMBEDDED_IMAGE_LENGTH : urlLimit);
}
const ATTR_PROPERTIES = new Set(['src', 'srcset', 'sizes', 'href', 'alt']);
const MAX_SELECTOR_LENGTH = 1000;
const MAX_FALLBACK_SELECTORS = 10;
const MAX_LABEL_LENGTH = 200;
const MAX_TIMESTAMP_LENGTH = 40;
const MAX_URL_LENGTH = 2000;
const MAX_TITLE_LENGTH = 300;
/**
 * The most a share or an export may weigh.
 *
 * Whoever controls the object controls its size, so this is both what we refuse to send
 * and what we refuse to read — one constant, so the two cannot drift.
 *
 * Bounded by what chrome.storage.local will actually hold. It was 24MB, which is more
 * than the 10MB an extension gets without unlimitedStorage, so a large file passed every
 * check here and then failed to save with nowhere for that failure to appear. Better to
 * refuse it while there is still somebody to tell.
 */
export const MAX_SHARE_BYTES = 8 * 1024 * 1024;

export type ParseImportResult =
  | { ok: true; page: PageEdits; skipped: number }
  | { ok: false; error: string };

export function parseImport(json: string): ParseImportResult {
  if (json.length > MAX_SHARE_BYTES) return { ok: false, error: 'too large' };
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: 'not valid JSON' };
  }
  if (typeof data !== 'object' || data === null) return { ok: false, error: 'not a Tweakpage export' };
  const page = data as Partial<PageEdits>;
  if (page.version !== 1) return { ok: false, error: 'unsupported version' };
  if (typeof page.url !== 'string' || page.url.length > MAX_URL_LENGTH) {
    return { ok: false, error: 'missing url' };
  }
  let url: string;
  try {
    url = normalizePageUrl(page.url);
  } catch {
    return { ok: false, error: 'invalid url' };
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return { ok: false, error: 'invalid url' };
  }
  if (!Array.isArray(page.records)) return { ok: false, error: 'missing records' };
  if (page.records.length > MAX_RECORDS) return { ok: false, error: 'too many records' };
  // Variants carry records too; bounding each list separately bounds nothing.
  const variantRecords = Array.isArray(page.variants)
    ? (page.variants as Variant[]).reduce((n, v) => n + (Array.isArray(v?.records) ? v.records.length : 0), 0)
    : 0;
  if (page.records.length + variantRecords > MAX_RECORDS * 2) {
    return { ok: false, error: 'too many records' };
  }
  const records = page.records.filter(isValidRecord);
  const variants = Array.isArray(page.variants)
    ? page.variants.filter(isValidVariant).slice(0, MAX_VARIANTS)
    : undefined;
  return {
    ok: true,
    skipped: page.records.length - records.length,
    page: {
      version: 1,
      url,
      title: typeof page.title === 'string' ? page.title.slice(0, MAX_TITLE_LENGTH) : '',
      records,
      ...(variants && variants.length > 0 ? { variants } : {}),
      updatedAt: typeof page.updatedAt === 'string' ? page.updatedAt : '',
    },
  };
}

function isValidVariant(value: unknown): value is Variant {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<Variant>;
  return (
    typeof v.id === 'string' &&
    isSafeRecordId(v.id) &&
    typeof v.name === 'string' &&
    v.name.length <= MAX_VARIANT_NAME &&
    Array.isArray(v.records) &&
    v.records.length <= MAX_RECORDS &&
    v.records.every(isValidRecord)
  );
}

const CONTEXT_KEYS = new Set(['tag', 'id', 'role', 'label', 'testId', 'classes', 'heading']);
const MAX_CONTEXT_VALUE = 120;
const MAX_CONTEXT_CLASSES = 8;

/**
 * Context is carried for a reader and never resolved against, so what has to hold is
 * that it is strings and that it is bounded: an unbounded one is a way to make a share
 * heavy with nothing in it that shows up as an edit.
 */
function isValidContext(value: unknown): value is ContextNode[] {
  if (!Array.isArray(value) || value.length > MAX_CONTEXT_DEPTH) return false;
  return value.every((node) => {
    if (typeof node !== 'object' || node === null) return false;
    const n = node as Record<string, unknown>;
    if (Object.keys(n).some((key) => !CONTEXT_KEYS.has(key))) return false;
    if (typeof n.tag !== 'string' || n.tag.length === 0 || n.tag.length > 40) return false;
    for (const key of ['id', 'role', 'label', 'testId', 'heading']) {
      const held = n[key];
      if (held !== undefined && (typeof held !== 'string' || held.length > MAX_CONTEXT_VALUE)) {
        return false;
      }
    }
    if (n.classes === undefined) return true;
    return (
      Array.isArray(n.classes) &&
      n.classes.length <= MAX_CONTEXT_CLASSES &&
      n.classes.every((cls) => typeof cls === 'string' && cls.length <= MAX_CONTEXT_VALUE)
    );
  });
}

const IMPOSSIBLE_IN_A_SELECTOR = /[{}<]|@|\/\*/;

function isPlausibleSelector(selector: string): boolean {
  return !IMPOSSIBLE_IN_A_SELECTOR.test(selector);
}

function isValidRecord(value: unknown): value is EditRecord {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Partial<EditRecord>;
  if (
    typeof r.id !== 'string' ||
    typeof r.selector !== 'string' ||
    typeof r.elementLabel !== 'string' ||
    typeof r.property !== 'string' ||
    typeof r.oldValue !== 'string' ||
    typeof r.newValue !== 'string' ||
    typeof r.enabled !== 'boolean' ||
    typeof r.createdAt !== 'string' ||
    typeof r.updatedAt !== 'string'
  ) {
    return false;
  }
  if (r.textFingerprint !== undefined && typeof r.textFingerprint !== 'string') return false;
  if (r.absent !== undefined && typeof r.absent !== 'boolean') return false;
  if (r.note !== undefined && (typeof r.note !== 'string' || r.note.length > 500)) return false;
  if (r.context !== undefined && !isValidContext(r.context)) return false;
  if (!Array.isArray(r.fallbackSelectors) || !r.fallbackSelectors.every((s) => typeof s === 'string')) {
    return false;
  }
  // Every string in a record is attacker-controlled once it arrives over a link.
  if (r.fallbackSelectors.length > MAX_FALLBACK_SELECTORS) return false;
  if (r.elementLabel.length > MAX_LABEL_LENGTH) return false;
  if ((r.textFingerprint?.length ?? 0) > MAX_LABEL_LENGTH) return false;
  if (r.createdAt.length > MAX_TIMESTAMP_LENGTH || r.updatedAt.length > MAX_TIMESTAMP_LENGTH) {
    return false;
  }
  if (r.selector.length > MAX_SELECTOR_LENGTH) return false;
  // Braces, comments and at-rules cannot appear in a selector. They can't reach the
  // injected stylesheet — that targets our marker attribute — but they do reach the CSS
  // export, and a record that could never match is not one worth keeping. Note what is
  // NOT here: '>' is the child combinator, and banning it rejects ordinary selectors.
  if (!isPlausibleSelector(r.selector)) return false;
  if (r.fallbackSelectors.some((s) => !isPlausibleSelector(s) || s.length > MAX_SELECTOR_LENGTH)) {
    return false;
  }
  // Ids end up inside an attribute selector, so a hostile one could break out of it.
  if (!isSafeRecordId(r.id)) return false;
  if (r.scope !== undefined && r.scope !== 'element' && r.scope !== 'similar') return false;
  if (r.viewport !== undefined && (typeof r.viewport !== 'number' || !Number.isFinite(r.viewport))) {
    return false;
  }
  if (r.type === 'style') {
    if (!PANEL_STYLE_PROPERTIES.has(r.property)) {
      // The Advanced box writes properties the panel has no field for; they import
      // under the same rules that gated typing them.
      return isCustomProperty(r.property) && isSafeCustomValue(r.newValue) && r.oldValue.length <= MAX_STYLE_VALUE_LENGTH;
    }
    if (r.property === 'backgroundImage') {
      return (
        withinLimit(r.newValue, MAX_BACKGROUND_IMAGE_LENGTH) &&
        withinLimit(r.oldValue, MAX_BACKGROUND_IMAGE_LENGTH) &&
        BACKGROUND_IMAGE_PATTERN.test(r.newValue)
      );
    }
    return isSafeStyleValue(r.oldValue) && isSafeStyleValue(r.newValue);
  }
  if (r.type === 'text') {
    const addressed = r.property === 'textContent' || textNodeIndex(r.property) !== null;
    return addressed && r.newValue.length <= MAX_TEXT_LENGTH;
  }
  if (r.type === 'clone') {
    // The copy is stamped with the record id, which isSafeRecordId already vetted.
    return r.property === 'clone' && r.oldValue === '' && r.newValue === '';
  }
  if (r.type === 'move') {
    // An index, both sides, within anything a real page could hold.
    const index = /^\d{1,5}$/;
    return r.property === 'domIndex' && index.test(r.oldValue) && index.test(r.newValue);
  }
  if (r.type === 'attr') {
    if (!ATTR_PROPERTIES.has(r.property)) return false;
    // srcset holds a list, so it is allowed to be much longer than a single src.
    const limit = r.property === 'srcset' ? MAX_SRCSET_LENGTH : MAX_SRC_LENGTH;
    return (
      withinLimit(r.newValue, limit) &&
      withinLimit(r.oldValue, limit) &&
      // Both sides. oldValue is what a revert writes back into the page, and flipping to
      // the Original preview is the first thing the recipient of a shared link does.
      isSafeUrlValue(r.property, r.newValue) &&
      isSafeUrlValue(r.property, r.oldValue)
    );
  }
  return false;
}

/**
 * Whether this value is still harmless once a browser has read it.
 *
 * The old check was a substring test for "javascript:" — but the URL parser strips TAB,
 * LF and CR before it reads the scheme, so `java&#9;script:` is a script URL and was not
 * that string. Everything a parser ignores, this ignores too, and then it looks at what
 * is left. srcset carries a list, so every entry is checked, not the first.
 */
function isSafeUrlValue(property: string, value: string): boolean {
  const parts = property === 'srcset' ? value.split(',') : [value];
  return parts.every((part) => {
    const bare = part.replace(/[\u0000-\u0020]/g, '').toLowerCase();
    if (/^(javascript|vbscript):/.test(bare)) return false;
    // A picture may be inline; a link may not — data:text/html is a page of its own.
    if (bare.startsWith('data:')) return property !== 'href' && bare.startsWith('data:image/');
    return true;
  });
}

function isSafeStyleValue(value: string): boolean {
  return value.length <= MAX_STYLE_VALUE_LENGTH && !/[;{}]/.test(value);
}

export function mergeRecords(existing: EditRecord[], incoming: EditRecord[]): EditRecord[] {
  const incomingKeys = new Set(incoming.map((r) => `${r.selector} ${r.property}`));
  return [
    ...existing.filter((r) => !incomingKeys.has(`${r.selector} ${r.property}`)),
    ...incoming,
  ];
}

export async function importPageEdits(page: PageEdits): Promise<void> {
  const existing = await loadPageEdits(page.url);
  const merged = existing
    ? { ...existing, records: mergeRecords(existing.records, page.records), updatedAt: page.updatedAt }
    : page;
  await savePageEdits(merged);
}
