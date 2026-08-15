# PG Visual Editor MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP of a Chrome extension that lets marketing colleagues visually edit any web page (hover → outline, click → panel edits text/typography/spacing/colors/img src), persists edits per URL, replays them on reload, and exports JSON + Markdown change lists.

**Architecture:** A tiny always-on "applier" content script replays stored edits and watches for SPA re-renders; a lazy-loaded React editor (Shadow DOM) records edits as structured diffs (selector + property + old→new) through a shared pure-function core (`lib/`). Style edits go through one injected `<style data-pg-editor>` tag; text/attr edits mutate the DOM idempotently. `chrome.storage.local` (keyed `page:<origin><pathname>`) is the single source of truth; the applier syncs via `storage.onChanged`.

**Tech Stack:** WXT (MV3 framework) + React 19 + TypeScript (strict), @medv/finder (selector generation), vitest + happy-dom + @testing-library/react (unit/component), Playwright (smoke E2E). Package manager: **pnpm** (v10 — build-script approvals apply).

**Spec:** `docs/superpowers/specs/2026-08-15-pg-visual-editor-design.md` — the plan argues from the spec; executors read both.

## Global Constraints

- Manifest V3, Chrome-only. Permissions: `storage` + host_permissions `http://*/*`, `https://*/*` only. **No `scripting` permission** unless a real need appears (spec §4).
- Applier content script bundle target: **< 15 KB raw** (spec §4.1). It must never import React or @medv/finder (generation is editor-only; resolution is dependency-free).
- Storage key format: `page:` + `origin` + `pathname` — query string and hash ignored (spec §4.4, §10).
- Style edits: **one** `<style data-pg-editor>` tag, one rule per record, every declaration `!important`, never inline styles (spec §6).
- Text/attr DOM writes must be idempotent (skip when value already equals target) — this is the MutationObserver loop protection (spec §6).
- All panel UI copy in **English** (spec §8).
- `PageEdits.version` is `1`; `oldValue` always keeps the value from before the first edit (spec §5).
- No backend, no iframe editing (hovering an iframe shows a "not supported" hint), no import UI (Phase 2).
- TDD: write the failing test first for all `lib/` and controller code. UI entrypoints get component tests where practical and a manual verification step. Commit at the end of every task.
- Unit/component tests are colocated (`*.test.ts(x)` next to source); only Playwright E2E lives in `tests/e2e/`. (Deliberate deviation from spec §13's `tests/` — better DX, noted here.)
- All imports between project files use **relative paths** (no `~` alias) to keep vitest/WXT config-independent.

---

### Task 1: Project scaffold (WXT + React + TS + vitest)

**Files:**
- Create: `package.json`, `wxt.config.ts`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `entrypoints/background.ts`, `lib/smoke.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a building WXT project; `pnpm test` and `pnpm build` both green. Later tasks assume `wxt.config.ts` exists with the manifest below and vitest configured with `WxtVitest`.

- [ ] **Step 1: Write project config files**

`package.json` (versions were current at planning time; `pnpm install` resolves within these ranges):

```json
{
  "name": "pg-visual-editor",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wxt",
    "build": "wxt build",
    "postinstall": "wxt prepare",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "wxt build && playwright test"
  },
  "dependencies": {
    "@medv/finder": "^4.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.50.0",
    "@testing-library/react": "^16.2.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@wxt-dev/module-react": "^1.1.0",
    "happy-dom": "^17.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "wxt": "^0.20.0"
  },
  "pnpm": {
    "onlyBuiltDependencies": ["esbuild"]
  }
}
```

(`pnpm.onlyBuiltDependencies` pre-approves esbuild's postinstall — pnpm 10 blocks dependency build scripts by default. If install still reports ignored build scripts, run `pnpm approve-builds`.)

`wxt.config.ts`:

```ts
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'PG Visual Editor',
    description: 'Visually edit any page and export the changes.',
    permissions: ['storage'],
    host_permissions: ['http://*/*', 'https://*/*'],
    action: { default_title: 'PG Visual Editor' },
  },
});
```

`tsconfig.json`:

```json
{
  "extends": "./.wxt/tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "jsx": "react-jsx"
  }
}
```

(`.wxt/tsconfig.json` is generated by `wxt prepare` during postinstall.)

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'happy-dom',
  },
});
```

`.gitignore`:

```
node_modules/
.output/
.wxt/
test-results/
playwright-report/
```

`entrypoints/background.ts` (stub so the build has an entrypoint; wired in Task 11 — `defineBackground` is a WXT auto-imported global, no import needed):

```ts
export default defineBackground(() => {});
```

`lib/smoke.test.ts` (deleted in Task 2 once real tests exist):

```ts
import { expect, test } from 'vitest';

test('vitest runs', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 2: Install dependencies**

Run: `pnpm install`
Expected: success; `.wxt/` directory generated by the postinstall `wxt prepare`. If it errors on missing `.wxt/tsconfig.json`, run `pnpm wxt prepare` manually.

- [ ] **Step 3: Run tests**

Run: `pnpm test`
Expected: 1 passed (smoke test).

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: `.output/chrome-mv3/manifest.json` exists and contains `"manifest_version": 3`, the `storage` permission, and both host permissions. Verify with: `cat .output/chrome-mv3/manifest.json`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold WXT + React + TS project with vitest"
```

---

### Task 2: Edit model — types and coalescing

**Files:**
- Create: `lib/edits/types.ts`, `lib/edits/coalesce.ts`
- Test: `lib/edits/coalesce.test.ts`
- Delete: `lib/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (used by nearly every later task):
  - `types.ts`: `EditType = 'style' | 'text' | 'attr'`; `interface EditRecord { id, selector, fallbackSelectors, textFingerprint?, elementLabel, type, property, oldValue, newValue, enabled, createdAt, updatedAt }` (all strings except `fallbackSelectors: string[]`, `enabled: boolean`, `type: EditType`); `interface PageEdits { version: 1; url: string; title: string; records: EditRecord[]; updatedAt: string }`; `makeId(): string`; `emptyPageEdits(url, title, now): PageEdits`.
  - `coalesce.ts`: `interface NewEdit` (EditRecord minus id/enabled/timestamps); `findRecord(records, selector, property): EditRecord | undefined`; `upsertRecord(records, edit: NewEdit, now: string): EditRecord[]` (pure — returns a new array).

- [ ] **Step 1: Write the failing tests**

`lib/edits/coalesce.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { findRecord, upsertRecord, type NewEdit } from './coalesce';

const base: NewEdit = {
  selector: '.hero-title',
  fallbackSelectors: ['html > body > h2:nth-child(1)'],
  textFingerprint: 'Unleash Your Sound',
  elementLabel: 'h2.hero-title "Unleash Your Sound"',
  type: 'style',
  property: 'color',
  oldValue: 'rgb(51, 51, 51)',
  newValue: '#ff0000',
};

describe('upsertRecord', () => {
  test('inserts a new record with id, enabled, timestamps', () => {
    const records = upsertRecord([], base, '2026-08-15T10:00:00.000Z');
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      ...base,
      enabled: true,
      createdAt: '2026-08-15T10:00:00.000Z',
      updatedAt: '2026-08-15T10:00:00.000Z',
    });
    expect(records[0].id).toBeTruthy();
  });

  test('coalesces same selector+property: keeps oldValue and createdAt, updates newValue', () => {
    const first = upsertRecord([], base, '2026-08-15T10:00:00.000Z');
    const second = upsertRecord(first, { ...base, oldValue: '#ff0000', newValue: '#00ff00' }, '2026-08-15T11:00:00.000Z');
    expect(second).toHaveLength(1);
    expect(second[0].oldValue).toBe('rgb(51, 51, 51)');
    expect(second[0].newValue).toBe('#00ff00');
    expect(second[0].createdAt).toBe('2026-08-15T10:00:00.000Z');
    expect(second[0].updatedAt).toBe('2026-08-15T11:00:00.000Z');
    expect(second[0].id).toBe(first[0].id);
  });

  test('different property on same selector creates a second record', () => {
    const first = upsertRecord([], base, '2026-08-15T10:00:00.000Z');
    const second = upsertRecord(first, { ...base, property: 'fontSize', oldValue: '32px', newValue: '40px' }, '2026-08-15T10:01:00.000Z');
    expect(second).toHaveLength(2);
  });

  test('different selector creates a second record', () => {
    const first = upsertRecord([], base, '2026-08-15T10:00:00.000Z');
    const second = upsertRecord(first, { ...base, selector: '.lead' }, '2026-08-15T10:01:00.000Z');
    expect(second).toHaveLength(2);
  });

  test('does not mutate the input array', () => {
    const input: ReturnType<typeof upsertRecord> = [];
    upsertRecord(input, base, '2026-08-15T10:00:00.000Z');
    expect(input).toHaveLength(0);
  });
});

test('findRecord matches on selector + property', () => {
  const records = upsertRecord([], base, '2026-08-15T10:00:00.000Z');
  expect(findRecord(records, '.hero-title', 'color')).toBe(records[0]);
  expect(findRecord(records, '.hero-title', 'fontSize')).toBeUndefined();
  expect(findRecord(records, '.other', 'color')).toBeUndefined();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run lib/edits/coalesce.test.ts`
Expected: FAIL — cannot resolve `./coalesce`.

- [ ] **Step 3: Implement**

`lib/edits/types.ts`:

```ts
export type EditType = 'style' | 'text' | 'attr';

export interface EditRecord {
  id: string;
  selector: string;
  fallbackSelectors: string[];
  textFingerprint?: string;
  elementLabel: string;
  type: EditType;
  property: string;
  oldValue: string;
  newValue: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PageEdits {
  version: 1;
  url: string;
  title: string;
  records: EditRecord[];
  updatedAt: string;
}

export function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyPageEdits(url: string, title: string, now: string): PageEdits {
  return { version: 1, url, title, records: [], updatedAt: now };
}
```

(`makeId` falls back for non-secure contexts — `crypto.randomUUID` is unavailable on plain-http pages, which marketing may use for staging.)

`lib/edits/coalesce.ts`:

```ts
import { makeId, type EditRecord } from './types';

export interface NewEdit {
  selector: string;
  fallbackSelectors: string[];
  textFingerprint?: string;
  elementLabel: string;
  type: EditRecord['type'];
  property: string;
  oldValue: string;
  newValue: string;
}

export function findRecord(
  records: EditRecord[],
  selector: string,
  property: string,
): EditRecord | undefined {
  return records.find((r) => r.selector === selector && r.property === property);
}

export function upsertRecord(records: EditRecord[], edit: NewEdit, now: string): EditRecord[] {
  const existing = findRecord(records, edit.selector, edit.property);
  if (existing) {
    return records.map((r) =>
      r === existing
        ? { ...r, newValue: edit.newValue, elementLabel: edit.elementLabel, updatedAt: now }
        : r,
    );
  }
  return [...records, { id: makeId(), enabled: true, createdAt: now, updatedAt: now, ...edit }];
}
```

Also delete `lib/smoke.test.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run lib/edits/coalesce.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: edit record model with coalescing upsert"
```

---

### Task 3: CSS builders and value parsing

**Files:**
- Create: `lib/edits/css.ts`, `lib/css-values.ts`
- Test: `lib/edits/css.test.ts`, `lib/css-values.test.ts`

**Interfaces:**
- Consumes: `EditRecord` from Task 2.
- Produces:
  - `css.ts`: `cssPropertyName(property: string): string` (camelCase → kebab-case); `buildCssText(records: EditRecord[]): string` (enabled style records only, one rule per record, `!important`).
  - `css-values.ts`: `rgbToHex(value: string): string` (accepts `rgb()`/`rgba()`/`#rgb`/`#rrggbb`, falls back `#000000`); `pxToNumber(value: string): number` (rounds; non-numeric → 0).

- [ ] **Step 1: Write the failing tests**

`lib/edits/css.test.ts`:

```ts
import { expect, test } from 'vitest';
import { buildCssText, cssPropertyName } from './css';
import type { EditRecord } from './types';

function record(overrides: Partial<EditRecord>): EditRecord {
  return {
    id: 'r1',
    selector: '.hero',
    fallbackSelectors: [],
    elementLabel: 'h2.hero',
    type: 'style',
    property: 'color',
    oldValue: '#333333',
    newValue: '#ff0000',
    enabled: true,
    createdAt: '2026-08-15T10:00:00.000Z',
    updatedAt: '2026-08-15T10:00:00.000Z',
    ...overrides,
  };
}

test('cssPropertyName converts camelCase to kebab-case', () => {
  expect(cssPropertyName('fontSize')).toBe('font-size');
  expect(cssPropertyName('backgroundColor')).toBe('background-color');
  expect(cssPropertyName('paddingTop')).toBe('padding-top');
  expect(cssPropertyName('color')).toBe('color');
});

test('buildCssText emits one !important rule per enabled style record', () => {
  const css = buildCssText([
    record({}),
    record({ id: 'r2', property: 'fontSize', newValue: '40px' }),
  ]);
  expect(css).toBe(
    '.hero { color: #ff0000 !important; }\n.hero { font-size: 40px !important; }',
  );
});

test('buildCssText skips disabled and non-style records', () => {
  const css = buildCssText([
    record({ enabled: false }),
    record({ id: 'r2', type: 'text', property: 'textContent', newValue: 'Hi' }),
  ]);
  expect(css).toBe('');
});
```

`lib/css-values.test.ts`:

```ts
import { expect, test } from 'vitest';
import { pxToNumber, rgbToHex } from './css-values';

test('rgbToHex parses rgb() and rgba()', () => {
  expect(rgbToHex('rgb(255, 0, 0)')).toBe('#ff0000');
  expect(rgbToHex('rgba(17, 34, 51, 0.5)')).toBe('#112233');
});

test('rgbToHex normalizes hex forms', () => {
  expect(rgbToHex('#A1B2C3')).toBe('#a1b2c3');
  expect(rgbToHex('#abc')).toBe('#aabbcc');
});

test('rgbToHex falls back to black for unparseable values', () => {
  expect(rgbToHex('transparent')).toBe('#000000');
  expect(rgbToHex('var(--brand)')).toBe('#000000');
});

test('pxToNumber parses and rounds px values', () => {
  expect(pxToNumber('32px')).toBe(32);
  expect(pxToNumber('19.2px')).toBe(19);
  expect(pxToNumber('normal')).toBe(0);
  expect(pxToNumber('')).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run lib/edits/css.test.ts lib/css-values.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`lib/edits/css.ts`:

```ts
import type { EditRecord } from './types';

export function cssPropertyName(property: string): string {
  return property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

export function buildCssText(records: EditRecord[]): string {
  return records
    .filter((r) => r.type === 'style' && r.enabled)
    .map((r) => `${r.selector} { ${cssPropertyName(r.property)}: ${r.newValue} !important; }`)
    .join('\n');
}
```

`lib/css-values.ts`:

```ts
export function rgbToHex(value: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const [r, g, b] = trimmed.slice(1);
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const m = trimmed.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (!m) return '#000000';
  const hex = (n: string) => Number(n).toString(16).padStart(2, '0');
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
}

export function pxToNumber(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run lib/edits/css.test.ts lib/css-values.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: css rule builder and css value parsing helpers"
```

---

### Task 4: Stable-class heuristic

**Files:**
- Create: `lib/selector/stable-class.ts`
- Test: `lib/selector/stable-class.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `isStableClass(cls: string): boolean` — used by Task 5 as the `className` predicate for @medv/finder and for element labels.

- [ ] **Step 1: Write the failing tests**

`lib/selector/stable-class.test.ts`:

```ts
import { expect, test } from 'vitest';
import { isStableClass } from './stable-class';

test('accepts semantic class names', () => {
  expect(isStableClass('hero-title')).toBe(true);
  expect(isStableClass('nav')).toBe(true);
  expect(isStableClass('btn')).toBe(true);
  expect(isStableClass('col-md-6')).toBe(true);
  expect(isStableClass('product_card')).toBe(true);
});

test('rejects framework hash prefixes', () => {
  expect(isStableClass('css-1x2y3z')).toBe(false);
  expect(isStableClass('sc-bdfBwQ')).toBe(false);
  expect(isStableClass('emotion-0')).toBe(false);
  expect(isStableClass('jss42')).toBe(false);
});

test('rejects very short and digit-heavy names', () => {
  expect(isStableClass('x')).toBe(false);
  expect(isStableClass('ab')).toBe(false);
  expect(isStableClass('a12345')).toBe(false);
});

test('rejects hash-like mixed tokens without separators', () => {
  expect(isStableClass('a1b2c3')).toBe(false);
  expect(isStableClass('x9k2mQ')).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run lib/selector/stable-class.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`lib/selector/stable-class.ts`:

```ts
const FRAMEWORK_HASH = /^(css|sc|jss|emotion)[-_]?/i;

export function isStableClass(cls: string): boolean {
  if (cls.length <= 2) return false;
  if (FRAMEWORK_HASH.test(cls)) return false;
  if (/\d{3,}/.test(cls)) return false;
  const hashLike = /^[a-z0-9]+$/i.test(cls) && /\d/.test(cls) && !/[-_]/.test(cls);
  return !hashLike;
}
```

Note: `jss42` must fail — the `FRAMEWORK_HASH` regex with optional separator covers `jss` + digits. `a12345` fails on the hash-like rule. If a test disagrees with the regex, fix the implementation, not the test intent (semantic names pass, generated names fail).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run lib/selector/stable-class.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: stable-class heuristic for selector generation"
```

---

### Task 5: Selector generation

**Files:**
- Create: `lib/selector/generate.ts`
- Test: `lib/selector/generate.test.ts`

**Interfaces:**
- Consumes: `isStableClass` (Task 4); `@medv/finder`.
- Produces:
  - `interface GeneratedSelector { selector: string; fallbackSelectors: string[]; textFingerprint?: string; elementLabel: string }`
  - `generateSelector(el: Element): GeneratedSelector`
  - `nthChildPath(el: Element): string` (structural fallback, id-anchored when possible)
  - `buildElementLabel(el: Element): string` (also used by the Overlay in Task 14)

- [ ] **Step 1: Write the failing tests**

`lib/selector/generate.test.ts`:

```ts
import { beforeEach, expect, test } from 'vitest';
import { buildElementLabel, generateSelector, nthChildPath } from './generate';

beforeEach(() => {
  document.body.innerHTML = '';
});

test('prefers id selectors', () => {
  document.body.innerHTML = '<div><h1 id="headline">Hello</h1></div>';
  const el = document.getElementById('headline')!;
  const gen = generateSelector(el);
  expect(document.querySelectorAll(gen.selector)).toHaveLength(1);
  expect(gen.selector).toContain('headline');
});

test('never uses hash-like classes', () => {
  document.body.innerHTML =
    '<section><h2 class="css-1x2y3z hero-title">Save 20%</h2><h2 class="css-9zz88x other">Other</h2></section>';
  const el = document.querySelector('.hero-title')!;
  const gen = generateSelector(el);
  expect(gen.selector).not.toContain('css-');
  expect(document.querySelectorAll(gen.selector)).toHaveLength(1);
  expect(document.querySelector(gen.selector)).toBe(el);
});

test('nthChildPath round-trips to the same element', () => {
  document.body.innerHTML = '<div><ul><li>a</li><li>b</li><li>c</li></ul></div>';
  const el = document.querySelectorAll('li')[1];
  const path = nthChildPath(el);
  expect(document.querySelector(path)).toBe(el);
});

test('nthChildPath anchors at the nearest id ancestor', () => {
  document.body.innerHTML = '<div id="root"><p>one</p><p>two</p></div>';
  const el = document.querySelectorAll('p')[1];
  const path = nthChildPath(el);
  expect(path).toBe('#root > p:nth-child(2)');
  expect(document.querySelector(path)).toBe(el);
});

test('includes structural fallback and text fingerprint', () => {
  document.body.innerHTML = '<h2 class="hero-title">Unleash Your Sound</h2>';
  const gen = generateSelector(document.querySelector('h2')!);
  expect(gen.fallbackSelectors.length).toBeGreaterThanOrEqual(1);
  expect(gen.textFingerprint).toBe('Unleash Your Sound');
});

test('caps the text fingerprint at 60 chars', () => {
  document.body.innerHTML = `<p>${'x'.repeat(100)}</p>`;
  const gen = generateSelector(document.querySelector('p')!);
  expect(gen.textFingerprint).toHaveLength(60);
});

test('buildElementLabel uses tag, stable class, and trimmed text', () => {
  document.body.innerHTML =
    '<h2 class="css-1x2y3z hero-title">  Unleash   Your Sound and more and more and more  </h2>';
  expect(buildElementLabel(document.querySelector('h2')!)).toBe(
    'h2.hero-title "Unleash Your Sound and more an"',
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run lib/selector/generate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`lib/selector/generate.ts`:

```ts
import { finder } from '@medv/finder';
import { isStableClass } from './stable-class';

export interface GeneratedSelector {
  selector: string;
  fallbackSelectors: string[];
  textFingerprint?: string;
  elementLabel: string;
}

export function generateSelector(el: Element): GeneratedSelector {
  let primary: string;
  try {
    primary = finder(el, { className: isStableClass });
  } catch {
    primary = nthChildPath(el);
  }
  const fallbacks = [nthChildPath(el)].filter((s) => s !== primary);
  const text = el.textContent?.trim().slice(0, 60) || undefined;
  return {
    selector: primary,
    fallbackSelectors: fallbacks,
    textFingerprint: text,
    elementLabel: buildElementLabel(el),
  };
}

export function nthChildPath(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur) {
    if (cur.id) {
      parts.unshift(`#${escapeIdent(cur.id)}`);
      return parts.join(' > ');
    }
    const parent: Element | null = cur.parentElement;
    if (!parent) {
      parts.unshift(cur.tagName.toLowerCase());
      return parts.join(' > ');
    }
    const index = Array.prototype.indexOf.call(parent.children, cur) + 1;
    parts.unshift(`${cur.tagName.toLowerCase()}:nth-child(${index})`);
    cur = parent;
  }
  return parts.join(' > ');
}

export function buildElementLabel(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const cls = Array.from(el.classList).find(isStableClass);
  const base = cls ? `${tag}.${cls}` : el.id ? `${tag}#${el.id}` : tag;
  const text = el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 30);
  return text ? `${base} "${text}"` : base;
}

function escapeIdent(id: string): string {
  return id.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
}
```

Implementation notes:
- `@medv/finder` v4 exports `finder(element, options)`; `className: (name: string) => boolean` filters which classes it may use. If the installed version's option name differs, check `node_modules/@medv/finder/README.md` and adapt the call — the requirement is that `isStableClass` filters candidate classes.
- If `finder` misbehaves under happy-dom, add `// @vitest-environment jsdom` at the top of the test file and `jsdom` as a devDependency rather than weakening assertions.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run lib/selector/generate.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: selector generation with finder, structural fallback, labels"
```

---

### Task 6: Selector resolution

**Files:**
- Create: `lib/selector/resolve.ts`
- Test: `lib/selector/resolve.test.ts`

**Interfaces:**
- Consumes: `EditRecord` fields `selector`, `fallbackSelectors`, `textFingerprint` (Task 2).
- Produces: `resolveRecord(record: Pick<EditRecord, 'selector' | 'fallbackSelectors' | 'textFingerprint'>, root: Document | Element): Element | null`. Resolution order: primary (must match exactly 1) → fallbacks in order (same rule) → unique fingerprint scan → `null`. **No dependency on @medv/finder** (applier bundle imports this).

- [ ] **Step 1: Write the failing tests**

`lib/selector/resolve.test.ts`:

```ts
import { beforeEach, expect, test } from 'vitest';
import { resolveRecord } from './resolve';

beforeEach(() => {
  document.body.innerHTML = '';
});

const rec = (selector: string, fallbackSelectors: string[] = [], textFingerprint?: string) => ({
  selector,
  fallbackSelectors,
  textFingerprint,
});

test('resolves a unique primary selector', () => {
  document.body.innerHTML = '<h1 class="title">Hi</h1>';
  expect(resolveRecord(rec('.title'), document)).toBe(document.querySelector('.title'));
});

test('rejects a primary selector matching multiple elements', () => {
  document.body.innerHTML = '<p class="x">a</p><p class="x">b</p>';
  expect(resolveRecord(rec('.x'), document)).toBeNull();
});

test('falls back when the primary matches nothing', () => {
  document.body.innerHTML = '<div><span class="new-name">Hello</span></div>';
  const el = document.querySelector('span')!;
  expect(resolveRecord(rec('.old-name', ['html > body > div:nth-child(1) > span:nth-child(1)']), document)).toBe(el);
});

test('survives an invalid stored selector', () => {
  document.body.innerHTML = '<em>x</em>';
  expect(resolveRecord(rec('div[[', ['html > body > em:nth-child(1)']), document)).toBe(
    document.querySelector('em'),
  );
});

test('uses the text fingerprint as last resort when unique', () => {
  document.body.innerHTML = '<h2>Alpha</h2><h2>Beta</h2>';
  const el = document.querySelectorAll('h2')[1];
  expect(resolveRecord(rec('h2.gone', [], 'Beta'), document)).toBe(el);
});

test('rejects an ambiguous fingerprint', () => {
  document.body.innerHTML = '<h2>Same</h2><h2>Same</h2>';
  expect(resolveRecord(rec('h2.gone', [], 'Same'), document)).toBeNull();
});

test('returns null when everything misses', () => {
  document.body.innerHTML = '<p>text</p>';
  expect(resolveRecord(rec('.nope', ['.also-nope'], 'missing'), document)).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run lib/selector/resolve.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`lib/selector/resolve.ts`:

```ts
import type { EditRecord } from '../edits/types';

type Resolvable = Pick<EditRecord, 'selector' | 'fallbackSelectors' | 'textFingerprint'>;

export function resolveRecord(record: Resolvable, root: Document | Element): Element | null {
  for (const selector of [record.selector, ...record.fallbackSelectors]) {
    const el = queryUnique(root, selector);
    if (el) return el;
  }
  if (record.textFingerprint) {
    const tag = tagFromSelector(record.selector) ?? '*';
    const matches = Array.from(root.querySelectorAll(tag)).filter(
      (el) => (el.textContent?.trim().slice(0, 60) ?? '') === record.textFingerprint,
    );
    if (matches.length === 1) return matches[0];
  }
  return null;
}

function queryUnique(root: Document | Element, selector: string): Element | null {
  let matches: NodeListOf<Element>;
  try {
    matches = root.querySelectorAll(selector);
  } catch {
    return null;
  }
  return matches.length === 1 ? matches[0] : null;
}

function tagFromSelector(selector: string): string | null {
  const last = selector.split(/[\s>]+/).filter(Boolean).pop() ?? '';
  const m = last.match(/^[a-z][a-z0-9-]*/i);
  return m ? m[0].toLowerCase() : null;
}
```

Known trade-off (document in code review, not code comments): a **style** record whose selector now matches 2+ elements gets status "not-found" from resolution even though its CSS rule still paints all matches. Conservative and acceptable for v1; text/attr edits are protected from wrong-element writes by the uniqueness rule, which is what matters.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run lib/selector/resolve.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: selector resolution with fallbacks and fingerprint scan"
```

---

### Task 7: DOM edits and the apply engine core

**Files:**
- Create: `lib/edits/dom.ts`, `lib/edits/apply.ts`
- Test: `lib/edits/apply.test.ts`

**Interfaces:**
- Consumes: `EditRecord` (Task 2), `buildCssText` (Task 3), `resolveRecord` (Task 6).
- Produces:
  - `dom.ts`: `applyDomEdit(el: Element, record: EditRecord): void` (idempotent — skips when the value already matches); `revertDomEdit(el: Element, record: EditRecord): void`.
  - `apply.ts`: `type ApplyStatus = 'applied' | 'not-found' | 'disabled'`; `ensureStyleTag(doc: Document): HTMLStyleElement`; `applyAll(records: EditRecord[], doc: Document): Map<string, ApplyStatus>` (record id → status); `revertAll(records: EditRecord[], doc: Document): void`.

- [ ] **Step 1: Write the failing tests**

`lib/edits/apply.test.ts`:

```ts
import { beforeEach, expect, test } from 'vitest';
import { applyAll, ensureStyleTag, revertAll } from './apply';
import type { EditRecord } from './types';

function record(overrides: Partial<EditRecord>): EditRecord {
  return {
    id: 'r1',
    selector: '.title',
    fallbackSelectors: [],
    elementLabel: 'h1.title',
    type: 'style',
    property: 'color',
    oldValue: 'rgb(0, 0, 0)',
    newValue: '#ff0000',
    enabled: true,
    createdAt: '2026-08-15T10:00:00.000Z',
    updatedAt: '2026-08-15T10:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '<h1 class="title">Original</h1><img class="hero" src="/a.png">';
});

test('applyAll writes style rules into a single data-pg-editor tag', () => {
  applyAll([record({})], document);
  const tags = document.querySelectorAll('style[data-pg-editor]');
  expect(tags).toHaveLength(1);
  expect(tags[0].textContent).toBe('.title { color: #ff0000 !important; }');
});

test('applyAll is idempotent: second run keeps one tag and identical css', () => {
  applyAll([record({})], document);
  const tag = document.querySelector('style[data-pg-editor]')!;
  applyAll([record({})], document);
  expect(document.querySelectorAll('style[data-pg-editor]')).toHaveLength(1);
  expect(document.querySelector('style[data-pg-editor]')).toBe(tag);
});

test('applyAll applies text edits idempotently', () => {
  const r = record({ id: 'r2', type: 'text', property: 'textContent', oldValue: 'Original', newValue: 'Changed' });
  applyAll([r], document);
  const h1 = document.querySelector('.title')!;
  expect(h1.textContent).toBe('Changed');
  const statuses = applyAll([r], document);
  expect(h1.textContent).toBe('Changed');
  expect(statuses.get('r2')).toBe('applied');
});

test('applyAll applies attr edits', () => {
  const r = record({ id: 'r3', selector: '.hero', type: 'attr', property: 'src', oldValue: '/a.png', newValue: '/b.png' });
  applyAll([r], document);
  expect(document.querySelector('.hero')!.getAttribute('src')).toBe('/b.png');
});

test('applyAll reports not-found and disabled statuses', () => {
  const statuses = applyAll(
    [record({ id: 'r4', selector: '.missing' }), record({ id: 'r5', enabled: false })],
    document,
  );
  expect(statuses.get('r4')).toBe('not-found');
  expect(statuses.get('r5')).toBe('disabled');
});

test('revertAll removes the style tag and restores text and attrs', () => {
  const text = record({ id: 'r2', type: 'text', property: 'textContent', oldValue: 'Original', newValue: 'Changed' });
  const attr = record({ id: 'r3', selector: '.hero', type: 'attr', property: 'src', oldValue: '/a.png', newValue: '/b.png' });
  applyAll([record({}), text, attr], document);
  revertAll([record({}), text, attr], document);
  expect(document.querySelector('style[data-pg-editor]')).toBeNull();
  expect(document.querySelector('.title')!.textContent).toBe('Original');
  expect(document.querySelector('.hero')!.getAttribute('src')).toBe('/a.png');
});

test('ensureStyleTag reuses an existing tag', () => {
  const a = ensureStyleTag(document);
  const b = ensureStyleTag(document);
  expect(a).toBe(b);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run lib/edits/apply.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`lib/edits/dom.ts`:

```ts
import type { EditRecord } from './types';

export function applyDomEdit(el: Element, record: EditRecord): void {
  if (record.type === 'text') {
    if (el.textContent !== record.newValue) el.textContent = record.newValue;
  } else if (record.type === 'attr') {
    if (el.getAttribute(record.property) !== record.newValue) {
      el.setAttribute(record.property, record.newValue);
    }
  }
}

export function revertDomEdit(el: Element, record: EditRecord): void {
  if (record.type === 'text') {
    if (el.textContent !== record.oldValue) el.textContent = record.oldValue;
  } else if (record.type === 'attr') {
    if (el.getAttribute(record.property) !== record.oldValue) {
      el.setAttribute(record.property, record.oldValue);
    }
  }
}
```

`lib/edits/apply.ts`:

```ts
import { buildCssText } from './css';
import { applyDomEdit, revertDomEdit } from './dom';
import type { EditRecord } from './types';
import { resolveRecord } from '../selector/resolve';

const STYLE_TAG_SELECTOR = 'style[data-pg-editor]';

export type ApplyStatus = 'applied' | 'not-found' | 'disabled';

export function ensureStyleTag(doc: Document): HTMLStyleElement {
  let tag = doc.querySelector<HTMLStyleElement>(STYLE_TAG_SELECTOR);
  if (!tag) {
    tag = doc.createElement('style');
    tag.setAttribute('data-pg-editor', '');
    (doc.head ?? doc.documentElement).appendChild(tag);
  }
  return tag;
}

export function applyAll(records: EditRecord[], doc: Document): Map<string, ApplyStatus> {
  const statuses = new Map<string, ApplyStatus>();
  const css = buildCssText(records);
  const tag = ensureStyleTag(doc);
  if (tag.textContent !== css) tag.textContent = css;
  for (const record of records) {
    if (!record.enabled) {
      statuses.set(record.id, 'disabled');
      continue;
    }
    const el = resolveRecord(record, doc);
    if (!el) {
      statuses.set(record.id, 'not-found');
      continue;
    }
    if (record.type !== 'style') applyDomEdit(el, record);
    statuses.set(record.id, 'applied');
  }
  return statuses;
}

export function revertAll(records: EditRecord[], doc: Document): void {
  doc.querySelector(STYLE_TAG_SELECTOR)?.remove();
  for (const record of records) {
    if (record.type === 'style') continue;
    const el = resolveRecord(record, doc);
    if (el) revertDomEdit(el, record);
  }
}
```

The value-equality guards in `dom.ts` and the `tag.textContent !== css` guard are the MutationObserver loop protection (Global Constraints): re-applying settled edits produces **zero** DOM mutations.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run lib/edits/apply.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: apply engine with injected stylesheet and idempotent dom edits"
```

---

### Task 8: Storage layer

**Files:**
- Create: `lib/edits/storage.ts`
- Test: `lib/edits/storage.test.ts`

**Interfaces:**
- Consumes: `PageEdits` (Task 2); `browser` from `wxt/browser`; `fakeBrowser` from `wxt/testing` (tests only — the `WxtVitest` plugin wires the fake automatically).
- Produces: `normalizePageUrl(url: string): string` (origin + pathname); `pageKey(url: string): string` (`page:` prefix); `loadPageEdits(url: string): Promise<PageEdits | null>`; `savePageEdits(page: PageEdits): Promise<void>` (removes the key when `records` is empty).

- [ ] **Step 1: Write the failing tests**

`lib/edits/storage.test.ts`:

```ts
import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test } from 'vitest';
import { loadPageEdits, normalizePageUrl, pageKey, savePageEdits } from './storage';
import { emptyPageEdits, type PageEdits } from './types';

beforeEach(() => {
  fakeBrowser.reset();
});

test('normalizePageUrl keeps origin + pathname, drops query and hash', () => {
  expect(normalizePageUrl('https://positivegrid.com/products/spark?utm_source=x#hero')).toBe(
    'https://positivegrid.com/products/spark',
  );
});

test('pageKey prefixes with page:', () => {
  expect(pageKey('https://a.com/b?q=1')).toBe('page:https://a.com/b');
});

test('save and load round-trip', async () => {
  const page: PageEdits = {
    ...emptyPageEdits('https://a.com/b', 'Title', '2026-08-15T10:00:00.000Z'),
    records: [
      {
        id: 'r1', selector: '.x', fallbackSelectors: [], elementLabel: 'p.x',
        type: 'style', property: 'color', oldValue: '#000000', newValue: '#ff0000',
        enabled: true, createdAt: '2026-08-15T10:00:00.000Z', updatedAt: '2026-08-15T10:00:00.000Z',
      },
    ],
  };
  await savePageEdits(page);
  expect(await loadPageEdits('https://a.com/b?utm=1')).toEqual(page);
});

test('loading an unknown url returns null', async () => {
  expect(await loadPageEdits('https://a.com/unknown')).toBeNull();
});

test('saving with zero records removes the key', async () => {
  const page = emptyPageEdits('https://a.com/b', 'Title', '2026-08-15T10:00:00.000Z');
  await savePageEdits({ ...page, records: [] });
  expect(await loadPageEdits('https://a.com/b')).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run lib/edits/storage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`lib/edits/storage.ts`:

```ts
import { browser } from 'wxt/browser';
import type { PageEdits } from './types';

export function normalizePageUrl(url: string): string {
  const u = new URL(url);
  return u.origin + u.pathname;
}

export function pageKey(url: string): string {
  return `page:${normalizePageUrl(url)}`;
}

export async function loadPageEdits(url: string): Promise<PageEdits | null> {
  const key = pageKey(url);
  const result = await browser.storage.local.get(key);
  return (result[key] as PageEdits | undefined) ?? null;
}

export async function savePageEdits(page: PageEdits): Promise<void> {
  const key = pageKey(page.url);
  if (page.records.length === 0) {
    await browser.storage.local.remove(key);
  } else {
    await browser.storage.local.set({ [key]: page });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run lib/edits/storage.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: chrome.storage.local layer keyed by origin+pathname"
```

---

### Task 9: Export formatters (JSON + Markdown)

**Files:**
- Create: `lib/export/json.ts`, `lib/export/markdown.ts`
- Test: `lib/export/export.test.ts`

**Interfaces:**
- Consumes: `PageEdits`, `EditRecord` (Task 2), `cssPropertyName` (Task 3).
- Produces:
  - `json.ts`: `toJson(page: PageEdits): string` (pretty-printed, 2-space); `exportFilename(url: string, yyyymmdd: string): string` → `pg-edits-<hostname>-<yyyymmdd>.json`.
  - `markdown.ts`: `toMarkdown(page: PageEdits, exportedAt: string): string` — spec §9 format, records grouped by `elementLabel`.

- [ ] **Step 1: Write the failing tests**

`lib/export/export.test.ts`:

```ts
import { expect, test } from 'vitest';
import { exportFilename, toJson } from './json';
import { toMarkdown } from './markdown';
import type { EditRecord, PageEdits } from '../edits/types';

function record(overrides: Partial<EditRecord>): EditRecord {
  return {
    id: 'r1', selector: '.hero-title', fallbackSelectors: [],
    elementLabel: 'h2.hero-title "Unleash Your Sound"',
    type: 'style', property: 'color', oldValue: '#333333', newValue: '#ff0000',
    enabled: true, createdAt: '2026-08-15T10:00:00.000Z', updatedAt: '2026-08-15T10:00:00.000Z',
    ...overrides,
  };
}

const page: PageEdits = {
  version: 1,
  url: 'https://positivegrid.com/products/spark',
  title: 'Spark',
  updatedAt: '2026-08-15T10:00:00.000Z',
  records: [
    record({}),
    record({ id: 'r2', property: 'fontSize', oldValue: '32px', newValue: '40px' }),
    record({
      id: 'r3', type: 'text', property: 'textContent',
      oldValue: 'Unleash Your Sound', newValue: 'Unleash Your Tone',
    }),
    record({
      id: 'r4', selector: '.hero img', elementLabel: 'img.hero-img',
      type: 'attr', property: 'src', oldValue: '/a.png', newValue: '/b.png',
    }),
  ],
};

test('toJson round-trips and keeps the schema version', () => {
  const parsed = JSON.parse(toJson(page)) as PageEdits;
  expect(parsed).toEqual(page);
  expect(parsed.version).toBe(1);
});

test('exportFilename uses hostname and date', () => {
  expect(exportFilename('https://positivegrid.com/products/spark', '20260815')).toBe(
    'pg-edits-positivegrid.com-20260815.json',
  );
});

test('toMarkdown groups records by element and formats each kind', () => {
  const md = toMarkdown(page, '2026-08-15');
  expect(md).toBe(
    [
      '# Page edits — https://positivegrid.com/products/spark',
      'Exported 2026-08-15 by PG Visual Editor',
      '',
      '## h2.hero-title "Unleash Your Sound"',
      '- color: `#333333` → `#ff0000`',
      '- font-size: `32px` → `40px`',
      '- text: "Unleash Your Sound" → "Unleash Your Tone"',
      '',
      '## img.hero-img',
      '- src: `/a.png` → `/b.png`',
      '',
    ].join('\n'),
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run lib/export/export.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`lib/export/json.ts`:

```ts
import type { PageEdits } from '../edits/types';

export function toJson(page: PageEdits): string {
  return JSON.stringify(page, null, 2);
}

export function exportFilename(url: string, yyyymmdd: string): string {
  return `pg-edits-${new URL(url).hostname}-${yyyymmdd}.json`;
}
```

`lib/export/markdown.ts`:

```ts
import { cssPropertyName } from '../edits/css';
import type { EditRecord, PageEdits } from '../edits/types';

export function toMarkdown(page: PageEdits, exportedAt: string): string {
  const lines = [
    `# Page edits — ${page.url}`,
    `Exported ${exportedAt} by PG Visual Editor`,
    '',
  ];
  const groups = new Map<string, EditRecord[]>();
  for (const record of page.records) {
    const list = groups.get(record.elementLabel) ?? [];
    list.push(record);
    groups.set(record.elementLabel, list);
  }
  for (const [label, records] of groups) {
    lines.push(`## ${label}`);
    for (const record of records) lines.push(formatLine(record));
    lines.push('');
  }
  return lines.join('\n');
}

function formatLine(record: EditRecord): string {
  if (record.type === 'text') return `- text: "${record.oldValue}" → "${record.newValue}"`;
  if (record.type === 'attr') return `- ${record.property}: \`${record.oldValue}\` → \`${record.newValue}\``;
  return `- ${cssPropertyName(record.property)}: \`${record.oldValue}\` → \`${record.newValue}\``;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run lib/export/export.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: JSON and Markdown export formatters"
```

---

### Task 10: Applier engine and URL watching

**Files:**
- Create: `lib/applier/engine.ts`, `lib/applier/navigation.ts`
- Test: `lib/applier/engine.test.ts`

**Interfaces:**
- Consumes: `applyAll` (Task 7), `loadPageEdits`/`pageKey` (Task 8), `browser` from `wxt/browser`.
- Produces:
  - `engine.ts`: `class ApplierEngine { constructor(doc: Document); start(url: string): Promise<void>; navigate(url: string): Promise<void> }`. Behavior: loads edits for the URL; when present, applies them and attaches a debounced (50 ms) MutationObserver on `documentElement` (`childList`, `subtree`, `characterData`) that re-applies; when absent, disconnects and idles. Subscribes to `browser.storage.onChanged` — a change to this page's key updates edits live (editor→applier sync path).
  - `navigation.ts`: `watchUrlChanges(win: Window, onChange: (url: string) => void): void` — listens to `popstate` and (when present) the Chrome Navigation API's `currententrychange`; fires only when `location.href` actually changed. Note: patching `history.pushState` in the content script's isolated world would NOT see the page's own calls — that's why we use these events instead.

- [ ] **Step 1: Write the failing tests**

`lib/applier/engine.test.ts`:

```ts
import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test } from 'vitest';
import { ApplierEngine } from './engine';
import { watchUrlChanges } from './navigation';
import { savePageEdits } from '../edits/storage';
import { emptyPageEdits, type EditRecord } from '../edits/types';

function record(overrides: Partial<EditRecord>): EditRecord {
  return {
    id: 'r1', selector: '.title', fallbackSelectors: [], elementLabel: 'h1.title',
    type: 'text', property: 'textContent', oldValue: 'Original', newValue: 'Changed',
    enabled: true, createdAt: '2026-08-15T10:00:00.000Z', updatedAt: '2026-08-15T10:00:00.000Z',
    ...overrides,
  };
}

async function seed(url: string, records: EditRecord[]): Promise<void> {
  await savePageEdits({ ...emptyPageEdits(url, 'T', '2026-08-15T10:00:00.000Z'), records });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
  document.body.innerHTML = '<h1 class="title">Original</h1>';
});

test('start applies stored edits for the url', async () => {
  await seed('https://a.com/page', [record({})]);
  const engine = new ApplierEngine(document);
  await engine.start('https://a.com/page');
  expect(document.querySelector('.title')!.textContent).toBe('Changed');
});

test('start stays idle when the url has no edits', async () => {
  const engine = new ApplierEngine(document);
  await engine.start('https://a.com/other');
  expect(document.querySelector('style[data-pg-editor]')).toBeNull();
});

test('re-applies after a mutation replaces the node', async () => {
  await seed('https://a.com/page', [record({})]);
  const engine = new ApplierEngine(document);
  await engine.start('https://a.com/page');
  document.body.innerHTML = '<h1 class="title">Original</h1>';
  await wait(120);
  expect(document.querySelector('.title')!.textContent).toBe('Changed');
});

test('storage change updates the applied edits', async () => {
  await seed('https://a.com/page', [record({})]);
  const engine = new ApplierEngine(document);
  await engine.start('https://a.com/page');
  await seed('https://a.com/page', [record({ newValue: 'Newest' })]);
  await wait(20);
  expect(document.querySelector('.title')!.textContent).toBe('Newest');
});

test('navigate loads edits for the new url', async () => {
  await seed('https://a.com/second', [record({})]);
  const engine = new ApplierEngine(document);
  await engine.start('https://a.com/first');
  expect(document.querySelector('.title')!.textContent).toBe('Original');
  await engine.navigate('https://a.com/second');
  expect(document.querySelector('.title')!.textContent).toBe('Changed');
});

test('watchUrlChanges fires on popstate when the href changed', () => {
  const seen: string[] = [];
  watchUrlChanges(window, (url) => seen.push(url));
  window.dispatchEvent(new PopStateEvent('popstate'));
  expect(seen).toHaveLength(0); // href unchanged → no fire
  history.pushState({}, '', '/new-path');
  window.dispatchEvent(new PopStateEvent('popstate'));
  expect(seen).toHaveLength(1);
  expect(seen[0]).toContain('/new-path');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run lib/applier/engine.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`lib/applier/engine.ts`:

```ts
import { browser } from 'wxt/browser';
import { applyAll } from '../edits/apply';
import { loadPageEdits, pageKey } from '../edits/storage';
import type { PageEdits } from '../edits/types';

const REAPPLY_DELAY_MS = 50;

export class ApplierEngine {
  private edits: PageEdits | null = null;
  private observer: MutationObserver | null = null;
  private pending = false;
  private url = '';

  constructor(private doc: Document) {}

  async start(url: string): Promise<void> {
    this.url = url;
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const change = changes[pageKey(this.url)];
      if (change) this.setEdits((change.newValue as PageEdits | undefined) ?? null);
    });
    this.setEdits(await loadPageEdits(url));
  }

  async navigate(url: string): Promise<void> {
    this.url = url;
    this.setEdits(await loadPageEdits(url));
  }

  private setEdits(edits: PageEdits | null): void {
    this.edits = edits && edits.records.length > 0 ? edits : null;
    if (this.edits) {
      this.applyNow();
      this.observe();
    } else {
      this.observer?.disconnect();
      this.observer = null;
    }
  }

  private applyNow(): void {
    if (this.edits) applyAll(this.edits.records, this.doc);
  }

  private observe(): void {
    if (this.observer) return;
    this.observer = new MutationObserver(() => this.scheduleReapply());
    this.observer.observe(this.doc.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  private scheduleReapply(): void {
    if (this.pending) return;
    this.pending = true;
    setTimeout(() => {
      this.pending = false;
      this.applyNow();
    }, REAPPLY_DELAY_MS);
  }
}
```

`lib/applier/navigation.ts`:

```ts
export function watchUrlChanges(win: Window, onChange: (url: string) => void): void {
  let last = win.location.href;
  const check = () => {
    if (win.location.href !== last) {
      last = win.location.href;
      onChange(win.location.href);
    }
  };
  const nav = (win as Window & { navigation?: EventTarget }).navigation;
  nav?.addEventListener('currententrychange', check);
  win.addEventListener('popstate', check);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run lib/applier/engine.test.ts`
Expected: 6 passed. (If the mutation-reapply test is flaky under happy-dom's MutationObserver, raise the `wait` to 200 ms before touching the implementation.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: applier engine with mutation reapply, storage sync, url watching"
```

---

### Task 11: Extension wiring — background, applier content script, lazy editor stub

**Files:**
- Modify: `entrypoints/background.ts`, `wxt.config.ts`
- Create: `entrypoints/applier.content.ts`, `entrypoints/editor-main/index.ts`, `entrypoints/editor-main/boot.ts` (stub — replaced by `boot.tsx` in Task 13)

**Interfaces:**
- Consumes: `ApplierEngine`, `watchUrlChanges` (Task 10).
- Produces (protocol used by Tasks 13 and 18):
  - Message `{ type: 'pg:toggle' }` — background → applier on toolbar click.
  - Message `{ type: 'pg:state', active: boolean }` — editor → background; badge shows `ON` when active.
  - DOM event `pg-editor:toggle` on `document` — applier → already-loaded editor.
  - Lazy-load contract: first `pg:toggle` imports `/editor-main.js` (via `browser.runtime.getURL`), and the editor **auto-activates on first load**; subsequent toggles only dispatch the DOM event. `editor-main.js` must be listed in `web_accessible_resources`.

- [ ] **Step 1: Implement the background worker**

`entrypoints/background.ts` (replace the stub):

```ts
import { browser } from 'wxt/browser';

export default defineBackground(() => {
  browser.action.onClicked.addListener((tab) => {
    if (tab.id == null) return;
    browser.tabs.sendMessage(tab.id, { type: 'pg:toggle' }).catch(() => {
      // No content script on this page (chrome://, web store, etc.) — nothing to do.
    });
  });

  browser.runtime.onMessage.addListener((message: { type?: string; active?: boolean }, sender) => {
    if (message?.type === 'pg:state' && sender.tab?.id != null) {
      void browser.action.setBadgeText({ tabId: sender.tab.id, text: message.active ? 'ON' : '' });
    }
  });
});
```

- [ ] **Step 2: Implement the applier content script**

`entrypoints/applier.content.ts`:

```ts
import { browser } from 'wxt/browser';
import { ApplierEngine } from '../lib/applier/engine';
import { watchUrlChanges } from '../lib/applier/navigation';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  main() {
    const engine = new ApplierEngine(document);
    void engine.start(location.href);
    watchUrlChanges(window, (url) => void engine.navigate(url));

    let editorLoaded = false;
    browser.runtime.onMessage.addListener((message: { type?: string }) => {
      if (message?.type !== 'pg:toggle') return;
      void (async () => {
        if (!editorLoaded) {
          await import(/* @vite-ignore */ browser.runtime.getURL('/editor-main.js'));
          editorLoaded = true;
        } else {
          document.dispatchEvent(new CustomEvent('pg-editor:toggle'));
        }
      })();
    });
  },
});
```

- [ ] **Step 3: Create the editor entrypoint stub**

`entrypoints/editor-main/index.ts`:

```ts
import { boot } from './boot';

export default defineUnlistedScript(() => {
  boot();
});
```

`entrypoints/editor-main/boot.ts` (stub proving the lazy-load path; replaced in Task 13):

```ts
export function boot(): void {
  console.info('[pg-visual-editor] editor loaded');
}
```

- [ ] **Step 4: Add web_accessible_resources to the manifest**

In `wxt.config.ts`, extend `manifest`:

```ts
    web_accessible_resources: [
      { resources: ['editor-main.js'], matches: ['http://*/*', 'https://*/*'] },
    ],
```

- [ ] **Step 5: Build and check the applier bundle size**

Run: `pnpm build && ls -la .output/chrome-mv3/content-scripts/ && ls -la .output/chrome-mv3/editor-main.js`
Expected: build succeeds; the applier content-script JS exists and is **< 15 KB**; `editor-main.js` exists at the output root. If WXT emits the content script under a different path, locate it with `find .output/chrome-mv3 -name '*.js'` — the size constraint is what matters. If `editor-main.js` is emitted under a subdirectory (e.g. `/editor-main/…`), adjust both the `web_accessible_resources` entry and the `getURL` path to match the actual output.

- [ ] **Step 6: Manual verification in Chrome**

1. `chrome://extensions` → enable Developer mode → "Load unpacked" → select `.output/chrome-mv3/`.
2. Open `https://example.com`, click the PG Visual Editor toolbar icon.
3. DevTools console shows `[pg-visual-editor] editor loaded` exactly once, even after multiple clicks.
4. Seed a stored edit from the extension's service-worker console (chrome://extensions → "service worker"):
   ```js
   chrome.storage.local.set({ 'page:https://example.com/': { version: 1, url: 'https://example.com/', title: 'x', updatedAt: 'now', records: [{ id: 'r1', selector: 'h1', fallbackSelectors: [], elementLabel: 'h1', type: 'text', property: 'textContent', oldValue: 'Example Domain', newValue: 'Hello from PGVE', enabled: true, createdAt: 'now', updatedAt: 'now' }] } })
   ```
5. Reload `https://example.com` → the `<h1>` reads "Hello from PGVE" with no icon click. Remove the key afterwards: `chrome.storage.local.clear()`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: wire background, always-on applier, and lazy editor loading"
```

---

### Task 12: EditsController

**Files:**
- Create: `entrypoints/editor-main/controller.ts`
- Test: `entrypoints/editor-main/controller.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 5, 6, 7, 8 (`emptyPageEdits`, `findRecord`, `upsertRecord`, `generateSelector`, `resolveRecord`, `applyAll`, `revertAll`, `revertDomEdit`, `normalizePageUrl`, `savePageEdits`).
- Produces: `class EditsController` — the single mutation path for the editor UI:
  - `constructor(initial: PageEdits | null, doc: Document, now?: () => string)` — applies initial records once.
  - `getPage: () => PageEdits` (stable reference between commits — safe for `useSyncExternalStore`).
  - `getStatus: (id: string) => ApplyStatus | undefined`
  - `subscribe: (fn: () => void) => () => void`
  - `recordEdit(el: Element, type: EditType, property: string, oldValue: string, newValue: string): void` — generates selectors, coalesces, applies, saves. Editing a value back to the record's original `oldValue` **deletes** the record (and reverts the DOM). A brand-new edit where `newValue === oldValue` is a no-op.
  - `recordFor: (el: Element, property: string) => EditRecord | undefined` — looks up the existing record for an element+property (selector generation is cached per element in a WeakMap; `recordEdit` shares the cache). Used by sections for edited-markers and per-property reset (spec §8).
  - `deleteRecord(id: string): void` — reverts text/attr DOM state, removes the record, re-applies + saves.
  - `revertAllEdits(): void` — reverts everything, empties records (storage key removed via `savePageEdits`).

- [ ] **Step 1: Write the failing tests**

`entrypoints/editor-main/controller.test.ts`:

```ts
import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test } from 'vitest';
import { EditsController } from './controller';
import { loadPageEdits } from '../../lib/edits/storage';

const NOW = () => '2026-08-15T10:00:00.000Z';

beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
  document.body.innerHTML = '<h1 id="title">Original</h1>';
  history.replaceState({}, '', '/page');
});

function controller(): EditsController {
  return new EditsController(null, document, NOW);
}

test('recordEdit creates a record, applies it, and persists', async () => {
  const c = controller();
  const el = document.getElementById('title')!;
  c.recordEdit(el, 'style', 'color', 'rgb(0, 0, 0)', '#ff0000');
  expect(c.getPage().records).toHaveLength(1);
  expect(document.querySelector('style[data-pg-editor]')!.textContent).toContain('#ff0000');
  const stored = await loadPageEdits(location.href);
  expect(stored?.records).toHaveLength(1);
  expect(c.getStatus(c.getPage().records[0].id)).toBe('applied');
});

test('recordEdit coalesces repeat edits to the same property', () => {
  const c = controller();
  const el = document.getElementById('title')!;
  c.recordEdit(el, 'style', 'color', 'rgb(0, 0, 0)', '#ff0000');
  c.recordEdit(el, 'style', 'color', '#ff0000', '#00ff00');
  expect(c.getPage().records).toHaveLength(1);
  expect(c.getPage().records[0].oldValue).toBe('rgb(0, 0, 0)');
  expect(c.getPage().records[0].newValue).toBe('#00ff00');
});

test('editing back to the original value deletes the record and reverts', async () => {
  const c = controller();
  const el = document.getElementById('title')!;
  c.recordEdit(el, 'text', 'textContent', 'Original', 'Changed');
  expect(el.textContent).toBe('Changed');
  c.recordEdit(el, 'text', 'textContent', 'Original', 'Original');
  expect(c.getPage().records).toHaveLength(0);
  expect(el.textContent).toBe('Original');
  expect(await loadPageEdits(location.href)).toBeNull();
});

test('a new edit equal to its old value is a no-op', () => {
  const c = controller();
  c.recordEdit(document.getElementById('title')!, 'style', 'color', '#000000', '#000000');
  expect(c.getPage().records).toHaveLength(0);
});

test('deleteRecord reverts dom edits and removes the record', () => {
  const c = controller();
  const el = document.getElementById('title')!;
  c.recordEdit(el, 'text', 'textContent', 'Original', 'Changed');
  c.deleteRecord(c.getPage().records[0].id);
  expect(el.textContent).toBe('Original');
  expect(c.getPage().records).toHaveLength(0);
});

test('revertAllEdits clears everything', async () => {
  const c = controller();
  const el = document.getElementById('title')!;
  c.recordEdit(el, 'style', 'color', 'rgb(0, 0, 0)', '#ff0000');
  c.recordEdit(el, 'text', 'textContent', 'Original', 'Changed');
  c.revertAllEdits();
  expect(document.querySelector('style[data-pg-editor]')).toBeNull();
  expect(el.textContent).toBe('Original');
  expect(await loadPageEdits(location.href)).toBeNull();
});

test('subscribe notifies on every commit and getPage stays stable between commits', () => {
  const c = controller();
  let calls = 0;
  c.subscribe(() => calls++);
  const snapshotBefore = c.getPage();
  expect(c.getPage()).toBe(snapshotBefore);
  c.recordEdit(document.getElementById('title')!, 'style', 'color', 'rgb(0, 0, 0)', '#ff0000');
  expect(calls).toBe(1);
  expect(c.getPage()).not.toBe(snapshotBefore);
});

test('recordFor finds the record for an element and property', () => {
  const c = controller();
  const el = document.getElementById('title')!;
  expect(c.recordFor(el, 'color')).toBeUndefined();
  c.recordEdit(el, 'style', 'color', 'rgb(0, 0, 0)', '#ff0000');
  expect(c.recordFor(el, 'color')?.newValue).toBe('#ff0000');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run entrypoints/editor-main/controller.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`entrypoints/editor-main/controller.ts`:

```ts
import { applyAll, revertAll, type ApplyStatus } from '../../lib/edits/apply';
import { findRecord, upsertRecord } from '../../lib/edits/coalesce';
import { revertDomEdit } from '../../lib/edits/dom';
import { normalizePageUrl, savePageEdits } from '../../lib/edits/storage';
import { emptyPageEdits, type EditRecord, type EditType, type PageEdits } from '../../lib/edits/types';
import { generateSelector, type GeneratedSelector } from '../../lib/selector/generate';
import { resolveRecord } from '../../lib/selector/resolve';

export class EditsController {
  private page: PageEdits;
  private statuses = new Map<string, ApplyStatus>();
  private listeners = new Set<() => void>();
  private selectorCache = new WeakMap<Element, GeneratedSelector>();

  constructor(
    initial: PageEdits | null,
    private doc: Document,
    private now: () => string = () => new Date().toISOString(),
  ) {
    this.page =
      initial ?? emptyPageEdits(normalizePageUrl(doc.location.href), doc.title, this.now());
    if (this.page.records.length > 0) {
      this.statuses = applyAll(this.page.records, this.doc);
    }
  }

  getPage = (): PageEdits => this.page;

  getStatus = (id: string): ApplyStatus | undefined => this.statuses.get(id);

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  recordFor = (el: Element, property: string): EditRecord | undefined =>
    findRecord(this.page.records, this.genFor(el).selector, property);

  recordEdit(el: Element, type: EditType, property: string, oldValue: string, newValue: string): void {
    const gen = this.genFor(el);
    const existing = findRecord(this.page.records, gen.selector, property);
    if (existing && newValue === existing.oldValue) {
      this.deleteRecord(existing.id);
      return;
    }
    if (!existing && newValue === oldValue) return;
    this.setRecords(
      upsertRecord(this.page.records, { ...gen, type, property, oldValue, newValue }, this.now()),
    );
  }

  deleteRecord(id: string): void {
    const record = this.page.records.find((r) => r.id === id);
    if (!record) return;
    if (record.type !== 'style') {
      const el = resolveRecord(record, this.doc);
      if (el) revertDomEdit(el, record);
    }
    this.setRecords(this.page.records.filter((r) => r.id !== id));
  }

  revertAllEdits(): void {
    revertAll(this.page.records, this.doc);
    this.setRecords([]);
  }

  private genFor(el: Element): GeneratedSelector {
    let gen = this.selectorCache.get(el);
    if (!gen) {
      gen = generateSelector(el);
      this.selectorCache.set(el, gen);
    }
    return gen;
  }

  private setRecords(records: EditRecord[]): void {
    this.page = { ...this.page, records, title: this.doc.title, updatedAt: this.now() };
    this.statuses = applyAll(records, this.doc);
    void savePageEdits(this.page);
    this.listeners.forEach((fn) => fn());
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run entrypoints/editor-main/controller.test.ts`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: EditsController as the editor's single mutation path"
```

---

### Task 13: Editor boot — Shadow DOM mount, EditorHost, panel shell, stylesheet

**Files:**
- Create: `entrypoints/editor-main/boot.tsx` (replaces `boot.ts` — delete it), `entrypoints/editor-main/EditorHost.tsx`, `entrypoints/editor-main/EditorApp.tsx`, `entrypoints/editor-main/editor.css`
- Delete: `entrypoints/editor-main/boot.ts`

**Interfaces:**
- Consumes: `EditsController` (Task 12), `loadPageEdits` (Task 8), toggle protocol (Task 11).
- Produces:
  - `boot.tsx`: `boot(): void` — idempotent; creates host div `#pg-visual-editor-host`, open shadow root, injects `editor.css` (`?inline` import), loads stored edits, renders `<EditorHost>`.
  - `EditorHost.tsx`: `EditorHost({ controller, host })` — owns `active` state (starts `true`), toggles on `pg-editor:toggle`, reports `{ type: 'pg:state', active }` to background, renders `<EditorApp>` when active.
  - `EditorApp.tsx`: `EditorApp({ controller, host, onRequestClose })` — panel shell in this task; Tasks 14–15 extend it.

- [ ] **Step 1: Implement**

`entrypoints/editor-main/boot.tsx`:

```tsx
import { createRoot } from 'react-dom/client';
import { loadPageEdits } from '../../lib/edits/storage';
import { EditsController } from './controller';
import { EditorHost } from './EditorHost';
import css from './editor.css?inline';

const HOST_ID = 'pg-visual-editor-host';

export function boot(): void {
  if (document.getElementById(HOST_ID)) return;
  const host = document.createElement('div');
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = css;
  const container = document.createElement('div');
  shadow.append(style, container);
  document.documentElement.appendChild(host);
  void loadPageEdits(location.href).then((initial) => {
    createRoot(container).render(
      <EditorHost controller={new EditsController(initial, document)} host={host} />,
    );
  });
}
```

Delete `entrypoints/editor-main/boot.ts`. If TypeScript rejects the `?inline` import, create `env.d.ts` at the project root containing `/// <reference types="vite/client" />`.

`entrypoints/editor-main/EditorHost.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import type { EditsController } from './controller';
import { EditorApp } from './EditorApp';

interface EditorHostProps {
  controller: EditsController;
  host: HTMLElement;
}

export function EditorHost({ controller, host }: EditorHostProps) {
  const [active, setActive] = useState(true);

  useEffect(() => {
    const onToggle = () => setActive((a) => !a);
    document.addEventListener('pg-editor:toggle', onToggle);
    return () => document.removeEventListener('pg-editor:toggle', onToggle);
  }, []);

  useEffect(() => {
    browser.runtime.sendMessage({ type: 'pg:state', active }).catch(() => {});
  }, [active]);

  if (!active) return null;
  return <EditorApp controller={controller} host={host} onRequestClose={() => setActive(false)} />;
}
```

`entrypoints/editor-main/EditorApp.tsx` (shell version — replaced in Task 14):

```tsx
import { useSyncExternalStore } from 'react';
import type { EditsController } from './controller';

export interface EditorAppProps {
  controller: EditsController;
  host: HTMLElement;
  onRequestClose: () => void;
}

export function EditorApp({ controller, onRequestClose }: EditorAppProps) {
  useSyncExternalStore(controller.subscribe, controller.getPage);
  return (
    <aside className="pgve-panel">
      <header className="pgve-header">
        <strong>PG Visual Editor</strong>
        <button type="button" onClick={onRequestClose} aria-label="Close">✕</button>
      </header>
      <p className="pgve-empty">Select an element on the page to edit it.</p>
    </aside>
  );
}
```

`entrypoints/editor-main/editor.css` (complete stylesheet for all editor UI, including classes used by Tasks 14–17):

```css
:host { all: initial; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
button, input, select, textarea { font: inherit; color: inherit; }

.pgve-outline { position: fixed; pointer-events: none; z-index: 2147483646; }
.pgve-outline--hover { outline: 2px dashed #3b82f6; outline-offset: 1px; }
.pgve-outline--selected { outline: 2px solid #2563eb; outline-offset: 1px; }
.pgve-outline-label { position: absolute; top: -26px; left: 0; background: #2563eb; color: #fff; font: 11px/1.5 ui-sans-serif, system-ui, sans-serif; padding: 2px 6px; border-radius: 3px; white-space: nowrap; }

.pgve-panel { position: fixed; top: 0; right: 0; width: 320px; height: 100vh; z-index: 2147483647; display: flex; flex-direction: column; overflow-y: auto; background: #ffffff; color: #111827; font: 13px/1.5 ui-sans-serif, system-ui, sans-serif; box-shadow: -4px 0 16px rgba(0, 0, 0, 0.15); }
.pgve-header { display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid #e5e7eb; }
.pgve-header button { border: none; background: none; cursor: pointer; font-size: 14px; }
.pgve-tabs { display: flex; border-bottom: 1px solid #e5e7eb; }
.pgve-tabs button { flex: 1; padding: 8px; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; }
.pgve-tabs .pgve-tab-active { border-bottom-color: #2563eb; font-weight: 600; }
.pgve-empty { padding: 16px; color: #6b7280; }
.pgve-sections { padding: 12px; display: flex; flex-direction: column; gap: 16px; }
.pgve-section h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 8px; }
.pgve-section label { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.pgve-section input[type='number'], .pgve-section input[type='text'], .pgve-section select { width: 130px; padding: 4px 6px; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; }
.pgve-section textarea { width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; resize: vertical; }
.pgve-section button { padding: 4px 10px; border: 1px solid #d1d5db; border-radius: 4px; background: #f9fafb; cursor: pointer; }
.pgve-section button.pgve-reset { padding: 0 4px; border: none; background: none; color: #2563eb; font-size: 14px; }

.pgve-breadcrumb { display: flex; flex-wrap: wrap; gap: 4px; }
.pgve-breadcrumb button { padding: 2px 6px; border: 1px solid #d1d5db; border-radius: 4px; background: #f9fafb; cursor: pointer; font-size: 12px; }
.pgve-breadcrumb .pgve-crumb-active { background: #2563eb; color: #fff; border-color: #2563eb; }

.pgve-color-field { display: flex; gap: 6px; }
.pgve-color-field input[type='color'] { width: 32px; height: 26px; padding: 0; border: 1px solid #d1d5db; border-radius: 4px; }
.pgve-color-field input[type='text'] { width: 92px; }

.pgve-box { display: grid; grid-template-columns: 56px 1fr 56px; grid-template-rows: 28px auto 28px; gap: 2px; align-items: center; justify-items: center; padding: 4px; border: 1px dashed #d1d5db; border-radius: 4px; position: relative; }
.pgve-box--margin { background: #fef3c7; }
.pgve-box--padding { background: #dcfce7; width: 100%; grid-column: 2; grid-row: 2; }
.pgve-box-label { position: absolute; top: 2px; left: 6px; font-size: 10px; color: #6b7280; }
.pgve-box input { width: 48px; padding: 2px 4px; border: 1px solid #d1d5db; border-radius: 3px; text-align: center; background: #fff; }
.pgve-box-input--top { grid-column: 2; grid-row: 1; }
.pgve-box-input--right { grid-column: 3; grid-row: 2; }
.pgve-box-input--bottom { grid-column: 2; grid-row: 3; }
.pgve-box-input--left { grid-column: 1; grid-row: 2; }
.pgve-box-center { grid-column: 2; grid-row: 2; font-size: 11px; color: #6b7280; padding: 8px 0; }

.pgve-changes { display: flex; flex-direction: column; gap: 8px; padding: 12px; }
.pgve-changes-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.pgve-changes-actions button { padding: 4px 10px; border: 1px solid #d1d5db; border-radius: 4px; background: #f9fafb; cursor: pointer; }
.pgve-changes ul { list-style: none; display: flex; flex-direction: column; gap: 8px; }
.pgve-change { border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
.pgve-change-target { font-weight: 600; word-break: break-all; }
.pgve-change-diff { word-break: break-all; }
.pgve-change-warning { color: #b45309; font-size: 12px; }
.pgve-change button { align-self: flex-start; padding: 2px 8px; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; cursor: pointer; }
```

- [ ] **Step 2: Build and typecheck**

Run: `pnpm build`
Expected: success, no TS errors.

- [ ] **Step 3: Manual verification in Chrome**

1. Reload the unpacked extension (`chrome://extensions` → refresh icon), reload `https://example.com`.
2. Click the toolbar icon → white panel appears top-right with "PG Visual Editor" and the empty-state text; badge shows `ON`.
3. Click the icon again → panel disappears, badge clears. Click again → panel returns (no duplicate mount, no console errors).
4. The panel's close (✕) button also hides it and clears the badge.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: shadow-dom editor mount with toggle lifecycle and badge state"
```

---

### Task 14: Element picker and overlay

**Files:**
- Create: `entrypoints/editor-main/hooks/useElementPicker.ts`, `entrypoints/editor-main/components/Overlay.tsx`
- Modify: `entrypoints/editor-main/EditorApp.tsx` (full replacement below)
- Test: `entrypoints/editor-main/hooks/useElementPicker.test.ts`

**Interfaces:**
- Consumes: `buildElementLabel` (Task 5), `EditorAppProps` (Task 13).
- Produces:
  - `useElementPicker.ts`: `eventTargetElement(e: Event, host: HTMLElement): Element | null` (null when the event path includes our host); `useElementPicker(host, { onHover, onSelect, onEscape })` — capture-phase `mousemove`/`click`/`keydown` listeners on `document`; click on a page element is `preventDefault`ed + `stopPropagation`ed (links must not navigate); Escape calls `onEscape`.
  - `Overlay.tsx`: `Overlay({ hovered, selected })` — fixed-position outline boxes tracking `getBoundingClientRect`, label showing `buildElementLabel` + `W×H` (label warns for iframes); re-renders on scroll (capture) and resize.
  - `EditorApp` selection behavior consumed by Task 15: Escape deselects first, then closes; disconnected elements are treated as unselected.

- [ ] **Step 1: Write the failing tests**

`entrypoints/editor-main/hooks/useElementPicker.test.ts`:

```ts
import { beforeEach, expect, test } from 'vitest';
import { eventTargetElement } from './useElementPicker';

beforeEach(() => {
  document.body.innerHTML = '<p id="p">x</p><div id="host"><button id="inside">b</button></div>';
});

function capture(dispatchOn: Element): Event {
  let captured: Event | null = null;
  document.addEventListener('mousemove', (e) => { captured = e; }, { once: true, capture: true });
  dispatchOn.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, composed: true }));
  return captured!;
}

test('returns the element for events outside the host', () => {
  const host = document.getElementById('host')!;
  const e = capture(document.getElementById('p')!);
  expect(eventTargetElement(e, host)).toBe(document.getElementById('p'));
});

test('returns null for events inside the host', () => {
  const host = document.getElementById('host')!;
  const e = capture(document.getElementById('inside')!);
  expect(eventTargetElement(e, host)).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run entrypoints/editor-main/hooks/useElementPicker.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`entrypoints/editor-main/hooks/useElementPicker.ts`:

```ts
import { useEffect } from 'react';

export interface PickerCallbacks {
  onHover: (el: Element | null) => void;
  onSelect: (el: Element) => void;
  onEscape: () => void;
}

export function eventTargetElement(e: Event, host: HTMLElement): Element | null {
  const path = e.composedPath();
  if (path.includes(host)) return null;
  const target = path[0] ?? e.target;
  return target instanceof Element ? target : null;
}

export function useElementPicker(
  host: HTMLElement,
  { onHover, onSelect, onEscape }: PickerCallbacks,
): void {
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => onHover(eventTargetElement(e, host));
    const onClick = (e: MouseEvent) => {
      const el = eventTargetElement(e, host);
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      onSelect(el);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape();
      }
    };
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [host, onHover, onSelect, onEscape]);
}
```

`entrypoints/editor-main/components/Overlay.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { buildElementLabel } from '../../../lib/selector/generate';

interface OverlayProps {
  hovered: Element | null;
  selected: Element | null;
}

export function Overlay({ hovered, selected }: OverlayProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const update = () => setTick((t) => t + 1);
    window.addEventListener('scroll', update, { capture: true, passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, { capture: true } as EventListenerOptions);
      window.removeEventListener('resize', update);
    };
  }, []);
  return (
    <>
      {hovered && hovered !== selected && <OutlineBox el={hovered} kind="hover" />}
      {selected && <OutlineBox el={selected} kind="selected" />}
    </>
  );
}

function OutlineBox({ el, kind }: { el: Element; kind: 'hover' | 'selected' }) {
  const r = el.getBoundingClientRect();
  const label =
    el.tagName === 'IFRAME'
      ? 'iframe — not supported'
      : `${buildElementLabel(el)} · ${Math.round(r.width)}×${Math.round(r.height)}`;
  return (
    <div
      className={`pgve-outline pgve-outline--${kind}`}
      style={{ top: r.top, left: r.left, width: r.width, height: r.height }}
    >
      <span className="pgve-outline-label">{label}</span>
    </div>
  );
}
```

`entrypoints/editor-main/EditorApp.tsx` (full replacement):

```tsx
import { useCallback, useState, useSyncExternalStore } from 'react';
import type { EditsController } from './controller';
import { Overlay } from './components/Overlay';
import { useElementPicker } from './hooks/useElementPicker';

export interface EditorAppProps {
  controller: EditsController;
  host: HTMLElement;
  onRequestClose: () => void;
}

export function EditorApp({ controller, host, onRequestClose }: EditorAppProps) {
  useSyncExternalStore(controller.subscribe, controller.getPage);
  const [hovered, setHovered] = useState<Element | null>(null);
  const [selected, setSelected] = useState<Element | null>(null);

  const onHover = useCallback((el: Element | null) => setHovered(el), []);
  const onSelect = useCallback((el: Element) => {
    setSelected(el);
    setHovered(null);
  }, []);
  const onEscape = useCallback(() => {
    setSelected((current) => {
      if (!current) onRequestClose();
      return null;
    });
  }, [onRequestClose]);

  useElementPicker(host, { onHover, onSelect, onEscape });

  const activeSelected = selected?.isConnected ? selected : null;

  return (
    <>
      <Overlay hovered={hovered?.isConnected ? hovered : null} selected={activeSelected} />
      <aside className="pgve-panel">
        <header className="pgve-header">
          <strong>PG Visual Editor</strong>
          <button type="button" onClick={onRequestClose} aria-label="Close">✕</button>
        </header>
        <p className="pgve-empty">
          {activeSelected
            ? `Selected: ${activeSelected.tagName.toLowerCase()}`
            : 'Select an element on the page to edit it.'}
        </p>
      </aside>
    </>
  );
}
```

- [ ] **Step 4: Run tests, build, verify manually**

Run: `pnpm vitest run entrypoints/editor-main/hooks/useElementPicker.test.ts && pnpm build`
Expected: 2 passed; build succeeds.

Manual check on `https://example.com` (reload extension + page, activate):
1. Moving the mouse shows a dashed blue outline + label (`h1 "Example Domain" · 600×38`-style) following the hovered element; hovering the panel shows no outline.
2. Clicking an element locks a solid outline; clicking the "More information..." link does NOT navigate; panel shows `Selected: a`.
3. Escape once → deselects; Escape again → editor closes and badge clears.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: hover/select element picker with outline overlay"
```

---

### Task 15: Panel, breadcrumb, Text and Typography sections

**Files:**
- Create: `entrypoints/editor-main/components/Panel.tsx`, `entrypoints/editor-main/components/Breadcrumb.tsx`, `entrypoints/editor-main/components/ColorField.tsx`, `entrypoints/editor-main/components/ResetButton.tsx`, `entrypoints/editor-main/components/sections/TextSection.tsx`, `entrypoints/editor-main/components/sections/TypographySection.tsx`
- Modify: `entrypoints/editor-main/EditorApp.tsx` (swap the inline `<aside>` for `<Panel>`)
- Test: `entrypoints/editor-main/components/Panel.test.tsx`

**Interfaces:**
- Consumes: `EditsController` (Task 12), `rgbToHex`/`pxToNumber` (Task 3).
- Produces:
  - `Panel({ controller, selected, onSelect, onClose })` — header, Edit/Changes tabs (`Changes (N)` label), iframe guard, empty state. Changes tab shows a placeholder until Task 17.
  - `Breadcrumb({ element, onSelect })` + exported `getBreadcrumb(el: Element): Element[]` (≤4 ancestors below `<html>`, plus first element child).
  - `ColorField({ label, value, onChange })` — color input + hex text input (aria-labels: `<label>` and `<label> hex`); `onChange` fires only with a valid `#rrggbb`.
  - `ResetButton({ controller, element, property })` — renders only when `controller.recordFor(element, property)` exists (its presence IS the "edited" marker, spec §8); aria-label `Reset <property>`; clicking deletes the record.
  - `TextSection({ element, controller })` — renders only when the element has direct non-empty text nodes; textarea (aria-label `Text`) live-syncs via `recordEdit(el, 'text', 'textContent', original, value)`. Value and original are derived from `recordFor`/DOM (no local state), so resets reflect immediately.
  - `TypographySection({ element, controller })` — Font size (number, px), Font weight (select 100–900), Line height (text), Color (ColorField); records `style` edits with computed-style originals snapshotted per element. Each field carries a `ResetButton`.

- [ ] **Step 1: Write the failing tests**

`entrypoints/editor-main/components/Panel.test.tsx`:

```tsx
import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Panel } from './Panel';
import { getBreadcrumb } from './Breadcrumb';
import { EditsController } from '../controller';

const NOW = () => '2026-08-15T10:00:00.000Z';

beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
  document.body.innerHTML =
    '<h1 id="title" style="font-size: 32px; font-weight: 700; line-height: 40px; color: rgb(51, 51, 51)">Original</h1>';
});

function setup(selected: Element | null = document.getElementById('title')) {
  const controller = new EditsController(null, document, NOW);
  const onSelect = vi.fn();
  render(
    <Panel controller={controller} selected={selected} onSelect={onSelect} onClose={vi.fn()} />,
  );
  return { controller, onSelect };
}

test('shows the empty state without a selection', () => {
  setup(null);
  expect(screen.getByText('Select an element on the page to edit it.')).toBeTruthy();
});

test('text edits live-sync through the controller', () => {
  const { controller } = setup();
  fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Changed' } });
  expect(document.getElementById('title')!.textContent).toBe('Changed');
  const record = controller.getPage().records.find((r) => r.property === 'textContent')!;
  expect(record.oldValue).toBe('Original');
  expect(record.newValue).toBe('Changed');
});

test('font size records a style edit in px', () => {
  const { controller } = setup();
  fireEvent.change(screen.getByLabelText('Font size'), { target: { value: '40' } });
  const record = controller.getPage().records.find((r) => r.property === 'fontSize')!;
  expect(record.oldValue).toBe('32px');
  expect(record.newValue).toBe('40px');
});

test('color hex input records a color edit', () => {
  const { controller } = setup();
  fireEvent.change(screen.getByLabelText('Color hex'), { target: { value: '#ff0000' } });
  const record = controller.getPage().records.find((r) => r.property === 'color')!;
  expect(record.newValue).toBe('#ff0000');
});

test('iframes show the unsupported notice', () => {
  document.body.innerHTML = '<iframe id="frame"></iframe>';
  setup(document.getElementById('frame'));
  expect(screen.getByText("Editing inside iframes isn't supported.")).toBeTruthy();
});

test('getBreadcrumb walks ancestors and first child', () => {
  document.body.innerHTML = '<section><div><h2>Hi <span>there</span></h2></div></section>';
  const h2 = document.querySelector('h2')!;
  const crumb = getBreadcrumb(h2);
  expect(crumb).toContain(document.querySelector('section'));
  expect(crumb).toContain(document.querySelector('div'));
  expect(crumb).toContain(h2);
  expect(crumb[crumb.length - 1]).toBe(document.querySelector('span'));
});

test('breadcrumb buttons change the selection', () => {
  document.body.innerHTML = '<div><h1 id="title">Original</h1></div>';
  const { onSelect } = setup(document.getElementById('title'));
  fireEvent.click(screen.getByRole('button', { name: 'div' }));
  expect(onSelect).toHaveBeenCalledWith(document.querySelector('div'));
});

test('an edited property shows a reset control that reverts it', () => {
  const { controller } = setup();
  fireEvent.change(screen.getByLabelText('Font size'), { target: { value: '40' } });
  fireEvent.click(screen.getByRole('button', { name: 'Reset fontSize' }));
  expect(controller.getPage().records).toHaveLength(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run entrypoints/editor-main/components/Panel.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`entrypoints/editor-main/components/Panel.tsx`:

```tsx
import { useState, useSyncExternalStore } from 'react';
import type { EditsController } from '../controller';
import { Breadcrumb } from './Breadcrumb';
import { TextSection } from './sections/TextSection';
import { TypographySection } from './sections/TypographySection';

type Tab = 'edit' | 'changes';

export interface PanelProps {
  controller: EditsController;
  selected: Element | null;
  onSelect: (el: Element) => void;
  onClose: () => void;
}

export function Panel({ controller, selected, onSelect, onClose }: PanelProps) {
  const [tab, setTab] = useState<Tab>('edit');
  const count = useSyncExternalStore(controller.subscribe, controller.getPage).records.length;
  return (
    <aside className="pgve-panel">
      <header className="pgve-header">
        <strong>PG Visual Editor</strong>
        <button type="button" onClick={onClose} aria-label="Close">✕</button>
      </header>
      <nav className="pgve-tabs">
        <button
          type="button"
          className={tab === 'edit' ? 'pgve-tab-active' : ''}
          onClick={() => setTab('edit')}
        >
          Edit
        </button>
        <button
          type="button"
          className={tab === 'changes' ? 'pgve-tab-active' : ''}
          onClick={() => setTab('changes')}
        >
          {`Changes (${count})`}
        </button>
      </nav>
      {tab === 'edit' ? (
        <EditTab controller={controller} selected={selected} onSelect={onSelect} />
      ) : (
        <p className="pgve-empty">No changes yet.</p>
      )}
    </aside>
  );
}

function EditTab({ controller, selected, onSelect }: Omit<PanelProps, 'onClose'>) {
  if (!selected) {
    return <p className="pgve-empty">Select an element on the page to edit it.</p>;
  }
  if (selected.tagName === 'IFRAME') {
    return <p className="pgve-empty">Editing inside iframes isn't supported.</p>;
  }
  return (
    <div className="pgve-sections">
      <Breadcrumb element={selected} onSelect={onSelect} />
      <TextSection element={selected} controller={controller} />
      <TypographySection element={selected} controller={controller} />
    </div>
  );
}
```

`entrypoints/editor-main/components/Breadcrumb.tsx`:

```tsx
interface BreadcrumbProps {
  element: Element;
  onSelect: (el: Element) => void;
}

export function getBreadcrumb(el: Element): Element[] {
  const chain: Element[] = [];
  let cur: Element | null = el;
  while (cur && cur.tagName !== 'HTML' && chain.length < 4) {
    chain.unshift(cur);
    cur = cur.parentElement;
  }
  const child = el.firstElementChild;
  return child ? [...chain, child] : chain;
}

export function Breadcrumb({ element, onSelect }: BreadcrumbProps) {
  return (
    <div className="pgve-breadcrumb">
      {getBreadcrumb(element).map((el, i) => (
        <button
          key={i}
          type="button"
          className={el === element ? 'pgve-crumb-active' : ''}
          onClick={() => onSelect(el)}
        >
          {el.tagName.toLowerCase()}
        </button>
      ))}
    </div>
  );
}
```

`entrypoints/editor-main/components/ColorField.tsx`:

```tsx
import { useEffect, useState } from 'react';

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

export function ColorField({ label, value, onChange }: ColorFieldProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label>
      {label}
      <span className="pgve-color-field">
        <input type="color" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
        <input
          type="text"
          aria-label={`${label} hex`}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value.toLowerCase());
          }}
        />
      </span>
    </label>
  );
}
```

`entrypoints/editor-main/components/ResetButton.tsx`:

```tsx
import type { EditsController } from '../controller';

interface ResetButtonProps {
  controller: EditsController;
  element: Element;
  property: string;
}

export function ResetButton({ controller, element, property }: ResetButtonProps) {
  const record = controller.recordFor(element, property);
  if (!record) return null;
  return (
    <button
      type="button"
      className="pgve-reset"
      aria-label={`Reset ${property}`}
      title="Reset to original"
      onClick={() => controller.deleteRecord(record.id)}
    >
      ↺
    </button>
  );
}
```

`entrypoints/editor-main/components/sections/TextSection.tsx` (value/original derive from the controller — no local state, so a reset from anywhere updates the textarea):

```tsx
import type { EditsController } from '../../controller';
import { ResetButton } from '../ResetButton';

interface SectionProps {
  element: Element;
  controller: EditsController;
}

export function hasDirectText(el: Element): boolean {
  return Array.from(el.childNodes).some(
    (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0,
  );
}

export function TextSection({ element, controller }: SectionProps) {
  if (!hasDirectText(element)) return null;
  const record = controller.recordFor(element, 'textContent');
  const original = record?.oldValue ?? element.textContent ?? '';
  const value = record?.newValue ?? element.textContent ?? '';
  return (
    <section className="pgve-section">
      <h3>
        Text <ResetButton controller={controller} element={element} property="textContent" />
      </h3>
      <textarea
        aria-label="Text"
        rows={3}
        value={value}
        onChange={(e) => controller.recordEdit(element, 'text', 'textContent', original, e.target.value)}
      />
    </section>
  );
}
```

`entrypoints/editor-main/components/sections/TypographySection.tsx`:

```tsx
import { useMemo } from 'react';
import { pxToNumber, rgbToHex } from '../../../../lib/css-values';
import type { EditsController } from '../../controller';
import { ColorField } from '../ColorField';
import { ResetButton } from '../ResetButton';

interface SectionProps {
  element: Element;
  controller: EditsController;
}

const WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];

export function TypographySection({ element, controller }: SectionProps) {
  const cs = getComputedStyle(element);
  const original = useMemo(() => {
    const s = getComputedStyle(element);
    return { fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight, color: s.color };
  }, [element]);
  return (
    <section className="pgve-section">
      <h3>Typography</h3>
      <label>
        Font size
        <input
          type="number"
          aria-label="Font size"
          value={pxToNumber(cs.fontSize)}
          onChange={(e) => {
            if (e.target.value === '') return;
            controller.recordEdit(element, 'style', 'fontSize', original.fontSize, `${e.target.value}px`);
          }}
        />
        <ResetButton controller={controller} element={element} property="fontSize" />
      </label>
      <label>
        Font weight
        <select
          aria-label="Font weight"
          value={normalizeWeight(cs.fontWeight)}
          onChange={(e) => controller.recordEdit(element, 'style', 'fontWeight', original.fontWeight, e.target.value)}
        >
          {WEIGHTS.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
        <ResetButton controller={controller} element={element} property="fontWeight" />
      </label>
      <label>
        Line height
        <input
          type="text"
          aria-label="Line height"
          value={cs.lineHeight === 'normal' ? '' : cs.lineHeight}
          placeholder="normal"
          onChange={(e) => {
            if (e.target.value === '') return;
            controller.recordEdit(element, 'style', 'lineHeight', original.lineHeight, e.target.value);
          }}
        />
        <ResetButton controller={controller} element={element} property="lineHeight" />
      </label>
      <ColorField
        label="Color"
        value={rgbToHex(cs.color)}
        onChange={(hex) => controller.recordEdit(element, 'style', 'color', original.color, hex)}
      />
      <ResetButton controller={controller} element={element} property="color" />
    </section>
  );
}

function normalizeWeight(weight: string): string {
  if (weight === 'normal') return '400';
  if (weight === 'bold') return '700';
  return WEIGHTS.includes(weight) ? weight : '400';
}
```

In `EditorApp.tsx`, replace the inline `<aside>…</aside>` block with:

```tsx
      <Panel
        controller={controller}
        selected={activeSelected}
        onSelect={setSelected}
        onClose={onRequestClose}
      />
```

and add `import { Panel } from './components/Panel';` (remove the now-unused empty-state markup).

- [ ] **Step 4: Run tests, build, verify manually**

Run: `pnpm vitest run entrypoints/editor-main/components/Panel.test.tsx && pnpm build`
Expected: 8 passed; build succeeds.

Manual check on `https://example.com`: select the `h1` → Text, Typography sections appear with current values; typing in Text updates the page live; changing Font size / Color updates live; breadcrumb `body > div > h1` navigates; `Changes (N)` counter climbs.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: editing panel with breadcrumb, text and typography sections"
```

---

### Task 16: Background, Image, and Spacing sections

**Files:**
- Create: `entrypoints/editor-main/components/sections/BackgroundSection.tsx`, `entrypoints/editor-main/components/sections/ImageSection.tsx`, `entrypoints/editor-main/components/sections/SpacingSection.tsx`
- Modify: `entrypoints/editor-main/components/Panel.tsx` (add the three sections to `EditTab`)
- Test: `entrypoints/editor-main/components/sections/sections.test.tsx`

**Interfaces:**
- Consumes: `SectionProps` shape (element + controller), `ColorField` (Task 15), `rgbToHex`/`pxToNumber` (Task 3).
- Produces:
  - `BackgroundSection` — ColorField labeled `Background color` + ResetButton, records `style`/`backgroundColor`.
  - `ImageSection` — renders only for `IMG` tags; text input `Image URL` + `Apply` button, records `attr`/`src` (from `getAttribute('src')`).
  - `SpacingSection` — DevTools-style nested box (margin outer, padding inner, center `W×H`); eight number inputs aria-labeled `margin top` … `padding left`; records `style` edits like `paddingTop: '24px'`.
  - Deliberate deviation from spec §8's "per-property reset": Image and Spacing skip inline ResetButtons (eight reset icons would clutter the box grid) — those resets happen via per-record Delete in the Changes tab (Task 17).

- [ ] **Step 1: Write the failing tests**

`entrypoints/editor-main/components/sections/sections.test.tsx`:

```tsx
import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BackgroundSection } from './BackgroundSection';
import { ImageSection } from './ImageSection';
import { SpacingSection } from './SpacingSection';
import { EditsController } from '../../controller';

const NOW = () => '2026-08-15T10:00:00.000Z';

beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
});

test('background color records a backgroundColor edit', () => {
  document.body.innerHTML = '<div id="box" style="background-color: rgb(255, 255, 255)">x</div>';
  const controller = new EditsController(null, document, NOW);
  render(<BackgroundSection element={document.getElementById('box')!} controller={controller} />);
  fireEvent.change(screen.getByLabelText('Background color hex'), { target: { value: '#112233' } });
  const record = controller.getPage().records.find((r) => r.property === 'backgroundColor')!;
  expect(record.newValue).toBe('#112233');
});

test('image url + apply records an attr src edit', () => {
  document.body.innerHTML = '<img id="pic" src="/a.png">';
  const controller = new EditsController(null, document, NOW);
  render(<ImageSection element={document.getElementById('pic')!} controller={controller} />);
  fireEvent.change(screen.getByLabelText('Image URL'), { target: { value: '/b.png' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  const record = controller.getPage().records.find((r) => r.property === 'src')!;
  expect(record.type).toBe('attr');
  expect(record.oldValue).toBe('/a.png');
  expect(record.newValue).toBe('/b.png');
  expect(document.getElementById('pic')!.getAttribute('src')).toBe('/b.png');
});

test('image section renders nothing for non-images', () => {
  document.body.innerHTML = '<p id="p">x</p>';
  const controller = new EditsController(null, document, NOW);
  const { container } = render(
    <ImageSection element={document.getElementById('p')!} controller={controller} />,
  );
  expect(container.innerHTML).toBe('');
});

test('spacing inputs record padding and margin edits in px', () => {
  document.body.innerHTML =
    '<div id="box" style="padding: 10px 10px 10px 10px; margin: 5px 5px 5px 5px">x</div>';
  const controller = new EditsController(null, document, NOW);
  render(<SpacingSection element={document.getElementById('box')!} controller={controller} />);
  fireEvent.change(screen.getByLabelText('padding top'), { target: { value: '24' } });
  fireEvent.change(screen.getByLabelText('margin left'), { target: { value: '0' } });
  const padding = controller.getPage().records.find((r) => r.property === 'paddingTop')!;
  expect(padding.oldValue).toBe('10px');
  expect(padding.newValue).toBe('24px');
  const margin = controller.getPage().records.find((r) => r.property === 'marginLeft')!;
  expect(margin.newValue).toBe('0px');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run entrypoints/editor-main/components/sections/sections.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`entrypoints/editor-main/components/sections/BackgroundSection.tsx`:

```tsx
import { useMemo } from 'react';
import { rgbToHex } from '../../../../lib/css-values';
import type { EditsController } from '../../controller';
import { ColorField } from '../ColorField';

interface SectionProps {
  element: Element;
  controller: EditsController;
}

export function BackgroundSection({ element, controller }: SectionProps) {
  const cs = getComputedStyle(element);
  const original = useMemo(() => getComputedStyle(element).backgroundColor, [element]);
  return (
    <section className="pgve-section">
      <h3>Background</h3>
      <ColorField
        label="Background color"
        value={rgbToHex(cs.backgroundColor)}
        onChange={(hex) => controller.recordEdit(element, 'style', 'backgroundColor', original, hex)}
      />
      <ResetButton controller={controller} element={element} property="backgroundColor" />
    </section>
  );
}
```

(with `import { ResetButton } from '../ResetButton';` added to the imports)

`entrypoints/editor-main/components/sections/ImageSection.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import type { EditsController } from '../../controller';

interface SectionProps {
  element: Element;
  controller: EditsController;
}

export function ImageSection({ element, controller }: SectionProps) {
  const original = useMemo(() => element.getAttribute('src') ?? '', [element]);
  const [url, setUrl] = useState(original);
  useEffect(() => setUrl(element.getAttribute('src') ?? ''), [element]);
  if (element.tagName !== 'IMG') return null;
  return (
    <section className="pgve-section">
      <h3>Image</h3>
      <label>
        Image URL
        <input type="text" aria-label="Image URL" value={url} onChange={(e) => setUrl(e.target.value)} />
      </label>
      <button
        type="button"
        onClick={() => controller.recordEdit(element, 'attr', 'src', original, url)}
      >
        Apply
      </button>
    </section>
  );
}
```

`entrypoints/editor-main/components/sections/SpacingSection.tsx`:

```tsx
import { useMemo, type ReactNode } from 'react';
import { pxToNumber } from '../../../../lib/css-values';
import type { EditsController } from '../../controller';

interface SectionProps {
  element: Element;
  controller: EditsController;
}

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
type Side = (typeof SIDES)[number];
type Kind = 'padding' | 'margin';

function propName(kind: Kind, side: Side): string {
  return `${kind}${side[0].toUpperCase()}${side.slice(1)}`;
}

export function SpacingSection({ element, controller }: SectionProps) {
  const cs = getComputedStyle(element);
  const original = useMemo(() => {
    const s = getComputedStyle(element);
    const snapshot: Record<string, string> = {};
    for (const kind of ['padding', 'margin'] as Kind[]) {
      for (const side of SIDES) {
        snapshot[propName(kind, side)] = s.getPropertyValue(`${kind}-${side}`);
      }
    }
    return snapshot;
  }, [element]);

  const field = (kind: Kind, side: Side): ReactNode => {
    const prop = propName(kind, side);
    return (
      <input
        key={prop}
        type="number"
        aria-label={`${kind} ${side}`}
        className={`pgve-box-input--${side}`}
        value={pxToNumber(cs.getPropertyValue(`${kind}-${side}`))}
        onChange={(e) => {
          if (e.target.value === '') return;
          controller.recordEdit(element, 'style', prop, original[prop], `${e.target.value}px`);
        }}
      />
    );
  };

  const rect = element.getBoundingClientRect();
  return (
    <section className="pgve-section">
      <h3>Spacing</h3>
      <div className="pgve-box pgve-box--margin">
        <span className="pgve-box-label">margin</span>
        {SIDES.map((side) => field('margin', side))}
        <div className="pgve-box pgve-box--padding">
          <span className="pgve-box-label">padding</span>
          {SIDES.map((side) => field('padding', side))}
          <div className="pgve-box-center">
            {Math.round(rect.width)}×{Math.round(rect.height)}
          </div>
        </div>
      </div>
    </section>
  );
}
```

In `Panel.tsx`'s `EditTab`, extend the sections list:

```tsx
      <TextSection element={selected} controller={controller} />
      <TypographySection element={selected} controller={controller} />
      <BackgroundSection element={selected} controller={controller} />
      <ImageSection element={selected} controller={controller} />
      <SpacingSection element={selected} controller={controller} />
```

with the matching imports.

- [ ] **Step 4: Run tests, build, verify manually**

Run: `pnpm vitest run entrypoints/editor-main/components/sections/sections.test.tsx && pnpm build`
Expected: 4 passed; build succeeds.

Manual check: on any site, select a block element → Background + Spacing render with live values; editing padding-top visibly moves content; select an `<img>` → Image URL + Apply swaps the image.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: background, image, and spacing sections with box-model editor"
```

---

### Task 17: Changes tab and export UI

**Files:**
- Create: `entrypoints/editor-main/components/ChangesTab.tsx`, `entrypoints/editor-main/components/ExportButtons.tsx`
- Modify: `entrypoints/editor-main/components/Panel.tsx` (replace the changes placeholder with `<ChangesTab>`)
- Test: `entrypoints/editor-main/components/ChangesTab.test.tsx`

**Interfaces:**
- Consumes: `EditsController` (Task 12), `toJson`/`exportFilename`/`toMarkdown` (Task 9), `cssPropertyName` (Task 3).
- Produces:
  - `ChangesTab({ controller })` — per-record card: `elementLabel`, `property: old → new`, "Couldn't apply on this page" warning when status is `not-found`, Delete button; top actions: `Export JSON`, `Copy Markdown`, `Revert all`. Empty state: "No changes yet."
  - `ExportButtons({ controller })` — `Export JSON` downloads via a temporary object-URL anchor named by `exportFilename`; `Copy Markdown` writes `toMarkdown` to the clipboard, falling back to `window.prompt` if the clipboard API rejects.
  - Deliberate deviation from spec §4.3 (background "triggers export file downloads"): the anchor download runs in the page context instead — same result, no `downloads` permission needed, keeps the background worker trivial.

- [ ] **Step 1: Write the failing tests**

`entrypoints/editor-main/components/ChangesTab.test.tsx`:

```tsx
import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChangesTab } from './ChangesTab';
import { EditsController } from '../controller';
import { emptyPageEdits, type PageEdits } from '../../../lib/edits/types';

const NOW = () => '2026-08-15T10:00:00.000Z';

beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
  document.body.innerHTML = '<h1 id="title">Original</h1>';
  history.replaceState({}, '', '/page');
});

test('shows the empty state with no records', () => {
  render(<ChangesTab controller={new EditsController(null, document, NOW)} />);
  expect(screen.getByText('No changes yet.')).toBeTruthy();
});

test('lists records with label and diff, delete removes them', () => {
  const controller = new EditsController(null, document, NOW);
  controller.recordEdit(document.getElementById('title')!, 'text', 'textContent', 'Original', 'Changed');
  render(<ChangesTab controller={controller} />);
  expect(screen.getByText(/h1#title/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
  expect(controller.getPage().records).toHaveLength(0);
  expect(document.getElementById('title')!.textContent).toBe('Original');
});

test('flags records that could not be applied', () => {
  const initial: PageEdits = {
    ...emptyPageEdits('http://localhost/page', 'T', NOW()),
    records: [
      {
        id: 'r1', selector: '.does-not-exist', fallbackSelectors: [], elementLabel: 'p.gone',
        type: 'style', property: 'color', oldValue: '#000000', newValue: '#ff0000',
        enabled: true, createdAt: NOW(), updatedAt: NOW(),
      },
    ],
  };
  render(<ChangesTab controller={new EditsController(initial, document, NOW)} />);
  expect(screen.getByText("Couldn't apply on this page")).toBeTruthy();
});

test('revert all clears records', () => {
  const controller = new EditsController(null, document, NOW);
  controller.recordEdit(document.getElementById('title')!, 'text', 'textContent', 'Original', 'Changed');
  render(<ChangesTab controller={controller} />);
  fireEvent.click(screen.getByRole('button', { name: 'Revert all' }));
  expect(controller.getPage().records).toHaveLength(0);
  expect(screen.getByText('No changes yet.')).toBeTruthy();
});

test('copy markdown writes the change list to the clipboard', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  const controller = new EditsController(null, document, NOW);
  controller.recordEdit(document.getElementById('title')!, 'text', 'textContent', 'Original', 'Changed');
  render(<ChangesTab controller={controller} />);
  fireEvent.click(screen.getByRole('button', { name: 'Copy Markdown' }));
  await Promise.resolve();
  expect(writeText).toHaveBeenCalledTimes(1);
  expect(writeText.mock.calls[0][0]).toContain('# Page edits —');
  expect(writeText.mock.calls[0][0]).toContain('"Original" → "Changed"');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run entrypoints/editor-main/components/ChangesTab.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`entrypoints/editor-main/components/ChangesTab.tsx`:

```tsx
import { useSyncExternalStore } from 'react';
import { cssPropertyName } from '../../../lib/edits/css';
import type { EditRecord } from '../../../lib/edits/types';
import type { EditsController } from '../controller';
import { ExportButtons } from './ExportButtons';

export function ChangesTab({ controller }: { controller: EditsController }) {
  const page = useSyncExternalStore(controller.subscribe, controller.getPage);
  if (page.records.length === 0) return <p className="pgve-empty">No changes yet.</p>;
  return (
    <div className="pgve-changes">
      <div className="pgve-changes-actions">
        <ExportButtons controller={controller} />
        <button type="button" onClick={() => controller.revertAllEdits()}>Revert all</button>
      </div>
      <ul>
        {page.records.map((record) => (
          <li key={record.id} className="pgve-change">
            <div className="pgve-change-target">{record.elementLabel}</div>
            <div className="pgve-change-diff">
              {labelFor(record)}: <s>{shorten(record.oldValue)}</s> → <b>{shorten(record.newValue)}</b>
            </div>
            {controller.getStatus(record.id) === 'not-found' && (
              <div className="pgve-change-warning">Couldn't apply on this page</div>
            )}
            <button
              type="button"
              aria-label={`Delete ${labelFor(record)} change`}
              onClick={() => controller.deleteRecord(record.id)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function labelFor(record: EditRecord): string {
  if (record.type === 'text') return 'text';
  if (record.type === 'attr') return record.property;
  return cssPropertyName(record.property);
}

function shorten(value: string): string {
  return value.length > 40 ? `${value.slice(0, 40)}…` : value;
}
```

`entrypoints/editor-main/components/ExportButtons.tsx`:

```tsx
import { exportFilename, toJson } from '../../../lib/export/json';
import { toMarkdown } from '../../../lib/export/markdown';
import type { EditsController } from '../controller';

export function ExportButtons({ controller }: { controller: EditsController }) {
  const onJson = () => {
    const page = controller.getPage();
    const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    downloadFile(exportFilename(page.url, stamp), toJson(page));
  };
  const onMarkdown = async () => {
    const markdown = toMarkdown(controller.getPage(), new Date().toISOString().slice(0, 10));
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      window.prompt('Copy the change list below:', markdown);
    }
  };
  return (
    <>
      <button type="button" onClick={onJson}>Export JSON</button>
      <button type="button" onClick={() => void onMarkdown()}>Copy Markdown</button>
    </>
  );
}

function downloadFile(name: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
```

In `Panel.tsx`, replace `<p className="pgve-empty">No changes yet.</p>` with `<ChangesTab controller={controller} />` and add the import.

- [ ] **Step 4: Run tests, build, verify manually**

Run: `pnpm vitest run entrypoints/editor-main/components/ChangesTab.test.tsx && pnpm build`
Expected: 5 passed; build succeeds.

Manual check: make a few edits → Changes tab lists them; Delete reverts one; Revert all cleans the page; Export JSON downloads `pg-edits-<host>-<date>.json`; Copy Markdown → paste into a text editor shows the spec §9 format; reload the page → edits replay; open the editor again → Changes tab still lists them.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: changes tab with delete, revert all, and JSON/Markdown export"
```

---

### Task 18: Playwright smoke E2E, README, final verification

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/fixtures.ts`, `tests/e2e/fixtures-page/index.html`, `tests/e2e/editor.spec.ts`, `README.md`

**Interfaces:**
- Consumes: the built extension (`.output/chrome-mv3`), the toggle protocol (Task 11), panel aria-labels (Tasks 15–17).
- Produces: `pnpm e2e` runs the spec §11 smoke flow; README documents pilot install + usage + manual QA checklist.

- [ ] **Step 1: Install the Playwright browser**

Run: `pnpm exec playwright install chromium`
Expected: chromium downloaded (skipped if present).

- [ ] **Step 2: Write the E2E config, fixture, and test**

`playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  webServer: {
    command: 'python3 -m http.server 4173 -d tests/e2e/fixtures-page',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
  },
});
```

`tests/e2e/fixtures-page/index.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>PGVE Test Page</title>
  <style>
    h1 { color: rgb(17, 17, 17); font-size: 32px; }
    .lead { color: rgb(85, 85, 85); }
  </style>
</head>
<body>
  <h1 id="headline">Original Headline</h1>
  <p class="lead">Some paragraph text for testing.</p>
  <img id="hero" alt="hero" width="40" height="40"
       src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==">
</body>
</html>
```

`tests/e2e/fixtures.ts`:

```ts
import path from 'node:path';
import { chromium, test as base, type BrowserContext } from '@playwright/test';

export const test = base.extend<{ context: BrowserContext }>({
  context: async ({}, use) => {
    const extensionPath = path.resolve('.output/chrome-mv3');
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
    await use(context);
    await context.close();
  },
});

export async function activateEditor(context: BrowserContext): Promise<void> {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  await worker.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (globalThis as any).chrome;
    const [tab] = await c.tabs.query({ active: true, currentWindow: true });
    await c.tabs.sendMessage(tab.id, { type: 'pg:toggle' });
  });
}
```

`tests/e2e/editor.spec.ts`:

```ts
import fs from 'node:fs';
import { expect } from '@playwright/test';
import { activateEditor, test } from './fixtures';

test('edit → persist → replay → export', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');

  await activateEditor(context);
  await expect(page.locator('#pg-visual-editor-host aside')).toBeVisible();

  await page.locator('h1').click();
  await page.getByLabel('Text', { exact: true }).fill('New headline');
  await expect(page.locator('h1')).toHaveText('New headline');

  await page.getByLabel('Color hex', { exact: true }).fill('#ff0000');
  await expect(page.locator('h1')).toHaveCSS('color', 'rgb(255, 0, 0)');

  await page.reload();
  await expect(page.locator('h1')).toHaveText('New headline');
  await expect(page.locator('h1')).toHaveCSS('color', 'rgb(255, 0, 0)');

  await activateEditor(context);
  await page.getByRole('button', { name: /^Changes/ }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(fs.readFileSync((await download.path())!, 'utf8'));
  expect(exported.version).toBe(1);
  expect(exported.records).toHaveLength(2);
});
```

If the persistent context fails to load the extension headlessly on this machine, add `headless: false` to `launchPersistentContext` — a headed smoke test is acceptable.

- [ ] **Step 3: Run the E2E**

Run: `pnpm e2e`
Expected: 1 passed. (This runs `wxt build` first via the script.)

- [ ] **Step 4: Write the README**

`README.md`:

```markdown
# PG Visual Editor

Chrome extension for visually editing any web page — for marketing folks who want
to try out copy, colors, sizes, spacing, and images without touching code.

Every edit is recorded as a structured diff (selector + property + old → new), so you can:

- **Hand engineers a change list** — Copy Markdown from the Changes tab, paste into Slack/Jira.
- **Keep your edits** — they're saved locally per URL and re-applied automatically on reload.
- **Share with a colleague** — Export JSON (import arrives in Phase 2).

## Install (pilot)

1. Download and unzip the latest build (or run `pnpm install && pnpm build` — output in `.output/chrome-mv3/`).
2. Open `chrome://extensions`, enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `chrome-mv3` folder.

## Usage

1. Click the **PG Visual Editor** toolbar icon on any page (badge shows `ON`).
2. Hover — dashed outline shows what you're pointing at. Click to select.
3. Edit in the right-hand panel: Text, Typography, Background, Image, Spacing.
   Use the breadcrumb to move to a parent/child element.
4. **Changes** tab: review every edit, delete one, revert all, **Export JSON**, **Copy Markdown**.
5. `Esc` deselects; `Esc` again (or the icon) closes the editor. Edits stay applied and survive reloads.

Not supported yet: elements inside iframes, importing JSON, uploading local images.

## Development

- `pnpm dev` — WXT dev mode with HMR
- `pnpm test` — unit/component tests (vitest)
- `pnpm e2e` — builds, then runs the Playwright smoke test
- Spec: `docs/superpowers/specs/2026-08-15-pg-visual-editor-design.md`
- Plan: `docs/superpowers/plans/2026-08-15-pg-visual-editor-mvp.md`

## Manual QA checklist (per release)

- [ ] positivegrid.com — edit hero copy + color, reload, verify replay, export Markdown
- [ ] A React SPA — edit text, trigger a client-side navigation and back, verify replay
- [ ] A static site — full flow including Export JSON
```

- [ ] **Step 5: Full verification**

Run: `pnpm test && pnpm e2e && ls -la .output/chrome-mv3/content-scripts/`
Expected: all unit/component tests pass; E2E passes; applier content script still **< 15 KB** (Global Constraints). MVP exit criteria (spec §12): a marketing colleague can restyle a page, reload without losing work, and hand an engineer a Markdown change list — verified by the E2E plus the Task 17 manual check.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: playwright smoke e2e; docs: pilot README"
```

