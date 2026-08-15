# Tweakpage Panel UX Redesign — Design Spec

**Date:** 2026-08-15
**Status:** Approved (design review with Jack, 2026-08-15; direction C of three explored)
**Scope:** View layer only. Controller, applier engine, storage, selector engine, and export formatters are untouched.

## 1. Problem

The MVP panel mixes high-frequency *mode actions* (compare, hide, export) into a flat stack of low-frequency *property editors*. Consequences observed in pilot use:

- "Show original" is an unlabeled-state text button in the header — users don't find it.
- Alt-to-click-through is a modifier-key convention non-technical users never discover.
- Export lives inside the Changes tab, one level away from where users finish their work.
- While previewing the original, nothing on the page says so — users forget which state they're looking at.
- Six always-expanded sections make the panel long and undifferentiated.

## 2. Goals and non-goals

### Goals

- Every mode and high-frequency action is visible at all times, labeled, and stateful.
- Page-level feedback whenever the page is in a non-default state (Browse mode, Original preview).
- Explicit Browse mode replaces Alt as the primary click-through path (Alt stays as a shortcut).
- Flatter hierarchy: no tab bar; property sections collapsed by default except the two most used.
- One-time onboarding card for first launch.

### Non-goals

- No changes to the edit data model, persistence, replay, selector engine, or export formats.
- No floating per-element property card (direction B was considered and rejected for scope).
- No coach-mark bubbles; onboarding is a single dismissible card.
- No new features beyond re-housing existing ones.

## 3. Panel information architecture

Five zones, top to bottom:

1. **Header** — `⠿ Tweakpage ✕`. The `⠿` glyph marks the drag handle; header remains the drag surface (buttons excluded, as today).
2. **Mode zone** — two full-width segmented controls, always visible:
   - **Interaction:** `✏ Edit | 🖐 Browse`. Edit = current picker behavior. Browse = picker fully disabled; clicks and hovers pass through to the page. Holding Alt in Edit mode still acts as temporary Browse. Escape in Browse switches back to Edit (it does not close the editor).
   - **Compare:** `Edited | Original`. Wraps the existing `controller.setPreviewOriginal`. While Original is active the property sections are covered by an explanatory overlay ("Viewing the original page — switch back to Edited to continue editing") instead of relying on the implicit edit-exits-preview behavior; the Hide action is disabled.
3. **Action row** — three labeled buttons, always visible: `Hide element` (disabled when nothing is selected or while previewing), `Copy summary` (Markdown to clipboard), `Export JSON`. Copy/Export move up from the Changes tab; their handlers are the existing ExportButtons logic.
4. **Content zone** —
   - *Edit view:* selection card (elementLabel + breadcrumb) when something is selected, otherwise the empty-state hints (rewritten for the new model: "move the mouse to select an element; switch to Browse to use the page normally"); then property sections, each wrapped in a collapsible disclosure. Default open: Text, Typography. Open/closed state lives in Panel (keyed by section title) so it survives switching to the Changes view and back; it is not persisted across sessions.
   - *Changes view:* the existing ChangesTab list, entered via the footer, with a `‹ Back to editing` row at top. Revert-all and per-record delete stay here; Export buttons are removed from this view (they live in the action row now).
5. **Footer** — `N changes · Review ›`, highlighted when N > 0. Tapping switches the content zone to the Changes view. The Edit/Changes tab bar is removed.

## 4. Interaction state machine

Two orthogonal booleans, both surfaced as segmented controls:

- `mode: 'edit' | 'browse'` — owned by EditorApp. Passed to `useElementPicker` as `enabled: mode === 'edit'`. When disabled, the picker's mousemove/click handlers return immediately (no hover outline, no interception); Escape switches mode back to `edit`.
- `previewing: boolean` — already owned by EditsController (`setPreviewOriginal` / `isPreviewingOriginal`). Unchanged semantics, new presentation.

Combinations are legal (Browse + Original is fine). Existing safety behavior (editing exits preview) remains as a backstop but the UI makes it unreachable by covering the editors during preview.

## 5. Page-level status badge

A single `StatusBadge` component rendered by EditorApp inside the shadow root, fixed to the bottom-left of the viewport, shown when either non-default state is active:

- Original preview: `👁 Viewing original — Back to edited` (clicking it exits preview).
- Browse mode: `🖐 Browsing — switch to Edit to select` (clicking it switches to Edit).
- If both are active, preview wins (it is the more surprising state).

The badge is pointer-interactive (it is inside our host, so the picker already ignores it).

## 6. First-run onboarding

On first activation (no `tweakpage:onboarded` key in `chrome.storage.local`), the content zone shows a three-point card instead of the empty state: move the mouse to select an element / use Browse to interact with the page normally / drag the panel by its title bar. A `Got it` button stores the flag and reveals the normal UI. Storage failures fall back to showing the card (never blocking the editor).

## 7. Component structure

New components under `entrypoints/editor-main/components/`:

- `ModeSwitch.tsx` — generic two-option segmented control (`options: [{value, label}]`, `value`, `onChange`, `aria-label`). Used for both Interaction and Compare.
- `ActionRow.tsx` — the three labeled action buttons; consumes controller + selection + preview state.
- `SelectionCard.tsx` — elementLabel + Breadcrumb (Breadcrumb component reused as-is).
- `CollapsibleSection.tsx` — disclosure wrapper (`title`, `defaultOpen`, children). Property section internals (TextSection, TypographySection, BackgroundSection, ImageSection, SizeSection, SpacingSection) are reused unchanged inside it; their own `<h3>` headers are replaced by the disclosure title (sections drop their `<h3>`).
- `StatusBadge.tsx` — as §5.
- `OnboardingCard.tsx` — as §6.

Changed:

- `Panel.tsx` — reassembled per §3; view state `'edit' | 'changes'` replaces the tab state; receives `mode`/`onModeChange` from EditorApp.
- `EditorApp.tsx` — owns `mode`; renders StatusBadge; passes `enabled` to the picker.
- `useElementPicker.ts` — accepts `enabled: boolean`; when false, handlers no-op except Escape → `onEscape` (EditorApp interprets Escape in Browse as "switch to Edit" instead of deselect/close).
- `ChangesTab.tsx` — gains the Back row; loses ExportButtons (moved to ActionRow).
- `editor.css` — segmented controls, action row, disclosure, badge, footer, onboarding card. Accent color `#FF3B30` (matches the icon) for active/selected states; white panel, pill-style segmented controls.

Unchanged: controller, engine, storage, selector, export modules; all `lib/` code.

## 8. Testing

- Component tests: ModeSwitch (switching calls onChange, active styling), CollapsibleSection (toggle), ActionRow (hide disabled without selection and during preview; copy/export wired), Panel (footer navigation to Changes and back; preview overlay covers editors), OnboardingCard (shown once, Got it persists flag via fakeBrowser), StatusBadge (renders per state, click actions).
- Picker: `enabled: false` ignores click/hover, Escape still fires.
- Existing section tests unchanged (internals untouched aside from `<h3>` removal — update those assertions). The copy-markdown clipboard test moves from ChangesTab.test to the ActionRow tests along with the buttons.
- E2E updates: existing specs retarget (`Show original` → Compare segmented `Original` option; `Changes (N)` tab → footer `Review`; export button now in action row). New E2E: Browse mode lets a page link click through (no selection, no preventDefault), badge visible during Original preview.
- Onboarding must be dismissed or pre-seeded (`tweakpage:onboarded`) in E2E setup.

## 9. Acceptance

A first-time marketing user can, without instruction: discover and use Compare, hide an element, export, and interact with page menus via Browse — each within one glance at the panel. All 100+ existing unit tests still pass (with updated selectors), E2E suite green.
