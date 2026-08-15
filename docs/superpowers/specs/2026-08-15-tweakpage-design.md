# PG Visual Editor — Design Spec

**Date:** 2026-08-15
**Status:** Approved (design review with Jack, 2026-08-15)
**Working name:** PG Visual Editor (subject to change)

## 1. Overview

A Chrome extension (Manifest V3) that lets non-technical marketing teammates visually edit elements on any web page: hover shows a dashed outline, click selects the element, and a side panel edits text content, colors, font size/weight, line-height, images, background, and padding/margin.

Edits are recorded as **structured diffs** (selector + property + old value → new value), not throwaway DOM mutations. This is the core mental model — the same one used by A/B-testing visual editors (VWO, Optimizely). It enables the two primary use cases:

1. **Export a change list for engineers** — a human-readable summary of what changed (old → new) to hand off for real implementation.
2. **Persist and replay** — edits survive page reloads (stored locally, auto-reapplied), and can be shared between colleagues via JSON export/import.

## 2. Goals and non-goals

### Goals

- Work on **any** http/https website (`<all_urls>`).
- Simple enough for non-technical marketing users.
- Edits persist per-URL in `chrome.storage.local` and auto-reapply on reload.
- Export: JSON (machine-readable, re-importable) and Markdown (engineer handoff).
- Import: merge a JSON file into local storage and apply immediately.
- Zero backend. Distribution starts as load-unpacked for a small pilot group.

### Non-goals (v1)

- No cloud sync / share links / accounts.
- No iframe support (hovering an iframe shows a "not supported" hint).
- No Chrome Web Store publishing yet.
- No editing of pseudo-elements, animations, or arbitrary CSS properties beyond the supported set.

## 3. Tech stack

- **WXT** (extension framework: manifest generation, HMR, MV3 bundling)
- **React + TypeScript** for the editor panel UI
- **@medv/finder** for unique CSS selector generation
- **vitest + happy-dom** for unit tests; **Playwright** (chromium, extension loaded) for smoke E2E

## 4. Architecture

Four components:

### 4.1 Applier content script (always-on, tiny)

- Registered for all http/https pages, runs at `document_idle`. Target < 15 KB.
- On load: look up `chrome.storage.local` for edits keyed by this page's `origin + pathname`.
  - **No edits:** stay idle. No observers, no UI, near-zero cost.
  - **Edits exist:** apply them (see §6) and attach a MutationObserver to re-apply text/attr edits when an SPA re-render replaces nodes.
- Listens for SPA navigations (`pushState`/`replaceState`/`popstate`) and re-resolves edits for the new URL.
- Receives an "activate editor" message from the background worker and lazy-loads the editor bundle.

### 4.2 Editor UI (lazy-loaded)

- Dynamically imported only when the user clicks the toolbar icon.
- React app mounted inside a **Shadow DOM** host element — full style isolation from the page in both directions.
- Contains: hover/selection overlay, editing panel, changes list, export/import UI.
- On SPA navigations the editor deactivates (the toolbar icon reopens it); edits are never recorded against a URL the panel wasn't opened on.

### 4.3 Background service worker

Minimal responsibilities:
- Toolbar icon click → send activate/deactivate message to the tab's applier.
- Track per-tab editing state, reflect it in the icon (badge/color).
- Trigger export file downloads.

### 4.4 Storage

- `chrome.storage.local`, keyed by `origin + pathname` (query string ignored, so `?utm_source=...` variants share edits).
- Schema is versioned for future migration.

### Permissions

`storage`, host_permissions: `<all_urls>`. The always-on applier is what makes reload-replay work, so broad host permission is required by design. (The editor bundle is dynamically imported by the declared content script, so `scripting` should not be needed; add it during implementation only if a real need appears.)

## 5. Data model

```ts
interface EditRecord {
  id: string;                    // nanoid
  selector: string;              // primary CSS selector
  fallbackSelectors: string[];   // 2–3 alternates generated at edit time
  textFingerprint?: string;      // first 60 chars of textContent at edit time
  elementLabel: string;          // human-readable, e.g. `h2.hero-title "Unleash Your…"`
  type: 'style' | 'text' | 'attr';
  property: string;              // 'color' | 'fontSize' | 'fontWeight' | 'lineHeight'
                                 // | 'backgroundColor' | 'backgroundImage'
                                 // | 'paddingTop' … 'marginLeft'
                                 // | 'textContent' | 'src'
  oldValue: string;              // value BEFORE the first edit (never overwritten)
  newValue: string;              // latest value
  enabled: boolean;              // toggle without deleting
  createdAt: string;             // ISO 8601
  updatedAt: string;
}

interface PageEdits {
  version: 1;                    // schema version
  url: string;                   // origin + pathname
  title: string;                 // document.title at last edit
  records: EditRecord[];
  updatedAt: string;
}
```

**Coalescing rule:** editing the same element + same property again updates the existing record's `newValue` (and `updatedAt`); `oldValue` always keeps the original page value. The exported change list is always "original → final".

## 6. Apply strategy

Two mechanisms, chosen per edit type:

### Style edits (`type: 'style'`)

Injected via a single `<style data-pg-editor>` element, one rule per record:

```css
.hero-title { color: #ff0000 !important; }
```

- **Not** inline styles. If a framework re-renders and replaces the DOM node, the rule still applies as long as the selector matches.
- Removing/disabling an edit removes its rule. Zero residue on the page.

### Text and attribute edits (`type: 'text' | 'attr'`)

- Must mutate the DOM directly (`textContent`, `img.src`).
- A MutationObserver watches for replaced nodes and re-applies. A WeakSet marks already-processed nodes to prevent observer loops.

### Apply-status tracking

Every record tracks whether its selector currently resolves. If not (after all fallbacks, §7), the panel shows it as **"couldn't apply"** — never a silent failure.

## 7. Selector engine

The most fragile part of the system. Isolated as a pure-function module (`lib/selector/`), heavily unit-tested.

- Generate the shortest unique selector with `@medv/finder`, preference order:
  1. `id`
  2. `data-*` attributes (e.g. `data-testid`)
  3. stable classes
  4. `nth-child` path (last resort)
- **Filter hash-like classes** (CSS modules `css-1x2y3z`, styled-components/emotion hashes) — heuristic: short high-entropy segments, digits mixed into short tokens. These change every deploy and must never anchor a selector.
- At edit time, store 2–3 fallback selectors plus a text fingerprint.
- At replay time: primary selector → fallbacks in order → fingerprint scan over same-tag elements → give up and mark "couldn't apply".
- A resolved match must be unique (querySelectorAll length 1) to be trusted.

## 8. UI / UX

Panel copy is **English** (short vocabulary, standard tooling convention).

### Mode lifecycle

- Toolbar icon click → editing mode on (icon badge lit). Click again or press ESC → off.
- Deactivating removes overlay + panel but keeps applied edits visible.

### Hover

- Dashed-outline overlay: a separately positioned div tracking the hovered element's bounding box — never touches the element's own styles, so no layout shifts.
- Small tag label: element tag, significant class, and pixel dimensions.

### Selection

- Click locks selection (solid outline). The click is intercepted in capture phase with `preventDefault`/`stopPropagation` — selecting a link must not navigate.
- Breadcrumb in the panel to walk up to parent / down to first child (hover often lands on an inner `span`; marketing users need "one level up").

### Editing panel

Right-side collapsible drawer inside the Shadow DOM. Sections render conditionally based on the selected element:

| Section | Shown when | Controls |
|---|---|---|
| Text | element has direct text nodes | textarea, live-synced |
| Typography | always (for visible elements) | font-size (px input), font-weight (dropdown), line-height, color (picker + recent swatches) |
| Background | always | background-color (picker), background-image URL replace *(Phase 2)* |
| Image | `<img>` selected | src URL replace; local file upload *(Phase 2)* |
| Spacing | always | DevTools-style graphical box model; click a side of padding/margin to edit |

- Each property shows the current computed value; edited properties get a visual marker and a per-property reset.

### Changes tab

- Human-readable list of all edits on this page: `elementLabel · property · old → new`.
- Per-record: enable/disable toggle *(Phase 2)*, delete.
- Top actions: Revert all, Export, Import *(Phase 2)*.

## 9. Export / import

### JSON export

The `PageEdits` object (with `version`) serialized to a file: `pg-edits-<hostname>-<yyyymmdd>.json`. This is the interchange format for colleague-to-colleague sharing.

### Markdown export (engineer handoff)

Grouped by element:

```markdown
# Page edits — https://example.com/products/spark
Exported 2026-08-15 by PG Visual Editor

## h2.hero-title "Unleash Your…"
- color: `#333333` → `#ff0000`
- font-size: `32px` → `40px`
- text: "Unleash Your Sound" → "Unleash Your Tone"
```

One-click copy to clipboard for pasting into Slack/Jira.

### Import (Phase 2)

Pick a JSON file → validate schema version → merge into that URL's stored edits (incoming records win on conflict) → apply immediately if the current page matches.

## 10. Edge cases

- **SPA navigation:** URL change handlers re-resolve storage for the new `origin + pathname`.
- **iframes:** unsupported in v1; hovering into an iframe shows a hint.
- **Local image uploads (Phase 2):** converted to data URLs; single image capped at ~2 MB (chrome.storage.local total is ~10 MB); over the cap, prompt to use a URL instead.
- **Dynamic hash classes:** filtered by the selector engine (§7).
- **Text edits on elements with mixed children:** text editing targets direct text nodes only; elements whose text is spread across many nested children show text editing at the nearest sensible node (the breadcrumb helps users pick).

## 11. Testing

- **Unit (vitest + happy-dom):** selector generation/filtering/fallback resolution; edit model (apply, revert, coalesce, merge); export formatters.
- **Smoke E2E (Playwright + chromium with extension loaded):** activate → hover → select → edit text + color → reload → assert replay → export JSON and verify contents.
- **Manual checklist:** a real marketing site, one React SPA, one static site.

## 12. Phasing

### MVP (Phase 1)

- Editing mode, hover/select, breadcrumb
- Text, Typography (size/weight/line-height/color), Spacing (padding/margin), background-color
- `<img>` src URL replace
- Persist to storage, auto-replay on reload (applier)
- Export: JSON + Markdown
- Changes tab with delete + revert all

**Exit criteria:** a marketing teammate can restyle a real page, reload without losing work, and hand an engineer a Markdown change list.

### Phase 2

- Import JSON (colleague sharing loop)
- Local image upload (data URL), background-image replace
- Per-record enable/disable toggle
- Polish: recent color swatches, keyboard nudging for spacing

## 13. Project structure

```
tweakpage/
├── wxt.config.ts
├── entrypoints/
│   ├── background.ts
│   ├── applier.content.ts    # always-on tiny script
│   └── editor/               # lazy-loaded editor (React, Shadow DOM)
│       ├── index.tsx
│       └── components/
├── lib/
│   ├── selector/             # generation + fallback resolution (pure)
│   ├── edits/                # EditRecord model, apply/revert, storage
│   └── export/               # JSON / Markdown formatters
├── tests/
└── docs/superpowers/specs/   # this document
```
