# Review fixes — 2026-08-16

Working list from the code review. Ordered by what stops people trusting the tool,
then cheap wins, then the product-level holes. Checked items are shipped on `main`.

## 1. Trust — data safety and honesty

- [x] **Style edits fan out to every matching element while the UI says "couldn't apply"**
      `buildCssText` emits the raw selector; `resolveRecord` demands a unique match. After a
      site change one `.btn` rule restyles every button *and* Review reports it as not applied.
      Fix: mark the resolved element with a `data-tweakpage` token and emit
      `[data-tweakpage~="id"]`, so the CSS can only ever land on the element we resolved.
- [x] **Revert all / popup Clear wipe the only copy with no confirmation**
- [x] **⌘Z and Esc are dead while focus is inside the panel** — the guard skips every key whose
      `composedPath` includes the host, which is exactly where focus sits after clicking a button
- [x] **Save failures are invisible** (`console.warn` only) — quota or an invalidated context both
      look like a successful save
- [x] **Rejected input fails silently** — font family with `;{}`, malformed line-height, a
      background URL that isn't http/data: all `return` with no feedback
- [x] **No summary when edits stop matching** — you have to open Review and read every row

## 2. Cheap and valuable

- [x] Copy as CSS, and put the selector in the Markdown export
- [x] Copy JSON to clipboard (sharing shouldn't require a file round-trip)
- [x] Pick a local image file → data URL, for both image and background image
- [x] Colours keep their alpha (`rgba(0,0,0,.5)` currently reads as opaque black)
- [x] Undo/redo buttons — `canUndo()` / `canRedo()` exist and nothing uses them
- [x] Localise `aria-label` and `title`; move E2E anchors to `data-testid`
- [x] Stop the UI misreporting state: `justify`/`start` shown as `left`, weight `350` as `400`
- [ ] Unit hints on number fields, and a consistent Apply (image/background are the odd ones out)

## 3. Product-level holes

- [x] Editing text flattens inline markup — the highest-frequency edit is the most damaging one
- [x] Apply an edit to every similar element ("all the buttons")
- [x] Responsive: viewport width in the record, and a width the export can name
- [x] Layout properties (display, flex, gap, box-shadow, position) and an escape-hatch CSS field
- [ ] Panel: resizable width, manual dark-mode switch, keyboard element selection, focus trap
- [ ] Review list: search, grouping, edit values in place
- [ ] Mark edited elements on the page when a saved page is reopened
- [ ] Snap: full-page capture and a before/after preview
- [ ] SPA: keep the editor alive across route changes; hash-routed pages share one bucket
