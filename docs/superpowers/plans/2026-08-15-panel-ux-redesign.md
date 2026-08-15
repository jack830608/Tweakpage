# Panel UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Tweakpage panel around a mode rail (Edit/Browse + Edited/Original), a persistent action row, collapsible sections, a footer Changes entry, a page-level status badge, and first-run onboarding — view layer only.

**Architecture:** Panel is reassembled from new focused components (ModeSwitch, ActionRow, SelectionCard, CollapsibleSection, StatusBadge, OnboardingCard). EditorApp owns `mode` and onboarding state; the picker gains an `enabled` flag. Controller/engine/storage/selector/export are untouched.

**Tech Stack:** Existing WXT + React + TS stack; vitest + RTL; Playwright E2E.

**Spec:** docs/superpowers/specs/2026-08-15-panel-ux-redesign-design.md

## Global Constraints

- View layer only: no changes under `lib/` or to `controller.ts`/`boot.tsx`/entrypoint scripts (except EditorApp.tsx).
- Panel copy English. Accent `#FF3B30` for active states; badge charcoal `#1F2933`.
- Onboarding storage key: `tweakpage:onboarded` in `chrome.storage.local`; storage failure ⇒ show the card, never block.
- Escape in Browse switches to Edit (never closes); Alt-hold in Edit remains a temporary Browse.
- Default-open sections: Text, Typography. Open state lives in Panel keyed by title.
- Deviation from spec §7 noted: the `‹ Back to editing` row is rendered by Panel's changes view wrapper, not inside ChangesTab (equivalent, cleaner).
- TDD; commit per task; existing behavior covered by the 105-test suite must stay green (with updated selectors where UI moved).

---

### Task 1: ModeSwitch + CollapsibleSection (pure UI primitives)

**Files:**
- Create: `entrypoints/editor-main/components/ModeSwitch.tsx`, `entrypoints/editor-main/components/CollapsibleSection.tsx`
- Test: `entrypoints/editor-main/components/primitives.test.tsx`

**Interfaces:**
- Produces: `ModeSwitch({ ariaLabel, options: [{value,label},{value,label}], value, onChange })` — generic two-option segmented control; buttons carry `aria-pressed`. `CollapsibleSection({ title, open, onToggle, children })` — controlled disclosure; header button has `aria-expanded`; children rendered only when open.

- [ ] Failing tests: segmented renders both options, clicking inactive calls onChange(value), clicking active does not; disclosure hides children when closed, toggle fires onToggle.
- [ ] Implement both components.

```tsx
// ModeSwitch.tsx
interface ModeSwitchOption<T extends string> { value: T; label: string }
interface ModeSwitchProps<T extends string> {
  ariaLabel: string;
  options: readonly [ModeSwitchOption<T>, ModeSwitchOption<T>];
  value: T;
  onChange: (value: T) => void;
}
export function ModeSwitch<T extends string>({ ariaLabel, options, value, onChange }: ModeSwitchProps<T>) {
  return (
    <div className="pgve-segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={value === option.value ? 'pgve-segment pgve-segment-active' : 'pgve-segment'}
          onClick={() => { if (value !== option.value) onChange(option.value); }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// CollapsibleSection.tsx
import type { ReactNode } from 'react';
interface CollapsibleSectionProps { title: string; open: boolean; onToggle: () => void; children: ReactNode }
export function CollapsibleSection({ title, open, onToggle, children }: CollapsibleSectionProps) {
  return (
    <section className="pgve-disclosure">
      <button type="button" className="pgve-disclosure-header" aria-expanded={open} onClick={onToggle}>
        <span aria-hidden="true">{open ? '▾' : '▸'}</span> {title}
      </button>
      {open && <div className="pgve-disclosure-body">{children}</div>}
    </section>
  );
}
```

- [ ] Tests green; commit `feat: segmented control and disclosure primitives`.

### Task 2: Picker `enabled` flag

**Files:**
- Modify: `entrypoints/editor-main/hooks/useElementPicker.ts`, `entrypoints/editor-main/EditorApp.tsx` (call site only, mode wiring comes in Task 5)
- Test: `entrypoints/editor-main/hooks/useElementPicker.test.ts`

**Interfaces:**
- Produces: `useElementPicker(host, enabled: boolean, callbacks)` — when `enabled` is false, mousemove/click handlers return immediately (no interception); Escape still fires `onEscape` (host-exclusion unchanged).

- [ ] Failing tests: with `enabled: false`, click on page element neither selects nor preventDefaults, hover not called with element; Escape still fires.
- [ ] Implement: add `enabled` param; guard mousemove/click with `if (!enabled) return;` (before the alt checks); include `enabled` in the effect deps. EditorApp passes `true` for now.
- [ ] Tests green; commit `feat: picker enabled flag for browse mode`.

### Task 3: StatusBadge + OnboardingCard

**Files:**
- Create: `entrypoints/editor-main/components/StatusBadge.tsx`, `entrypoints/editor-main/components/OnboardingCard.tsx`
- Test: `entrypoints/editor-main/components/primitives.test.tsx` (extend)

**Interfaces:**
- Produces: `StatusBadge({ previewing, browsing, onExitPreview, onExitBrowse })` — null when both false; preview wins when both true; renders one fixed button. `OnboardingCard({ onDismiss })` — three-step list + `Got it` button.

```tsx
// StatusBadge.tsx
interface StatusBadgeProps { previewing: boolean; browsing: boolean; onExitPreview: () => void; onExitBrowse: () => void }
export function StatusBadge({ previewing, browsing, onExitPreview, onExitBrowse }: StatusBadgeProps) {
  if (previewing) {
    return (
      <button type="button" className="pgve-badge" onClick={onExitPreview}>
        👁 Viewing original — Back to edited
      </button>
    );
  }
  if (browsing) {
    return (
      <button type="button" className="pgve-badge" onClick={onExitBrowse}>
        🖐 Browsing — switch to Edit to select
      </button>
    );
  }
  return null;
}

// OnboardingCard.tsx
export function OnboardingCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="pgve-onboarding">
      <h3>Welcome to Tweakpage</h3>
      <ol>
        <li>Move your mouse over the page and click to select an element.</li>
        <li>Switch to Browse to use the page normally (menus, tabs).</li>
        <li>Drag this panel by its title bar if it's in the way.</li>
      </ol>
      <button type="button" onClick={onDismiss}>Got it</button>
    </div>
  );
}
```

- [ ] Failing tests → implement → green; commit `feat: status badge and onboarding card`.

### Task 4: ActionRow + SelectionCard (absorb ExportButtons)

**Files:**
- Create: `entrypoints/editor-main/components/ActionRow.tsx`, `entrypoints/editor-main/components/SelectionCard.tsx`
- Delete: `entrypoints/editor-main/components/ExportButtons.tsx` (logic moves into ActionRow verbatim: toBase64, pg:download message, clipboard with prompt fallback)
- Modify: `entrypoints/editor-main/components/ChangesTab.tsx` (drop ExportButtons import/render; keep Revert all + list)
- Test: `entrypoints/editor-main/components/ActionRow.test.tsx` (move the clipboard test from ChangesTab.test.tsx here; add: Hide disabled without selection and while previewing; Hide records display:none and calls onDeselect; Export JSON sends pg:download), update `ChangesTab.test.tsx`.

**Interfaces:**
- Produces: `ActionRow({ controller, selected, onDeselect })` — buttons: `🙈 Hide element`, `📋 Copy summary`, `⤓ Export JSON`. `SelectionCard({ element, onSelect })` — `buildElementLabel(element)` + existing Breadcrumb.
- Consumes: `controller.recordEdit/getPage/subscribe/isPreviewingOriginal`, `toJson/exportFilename/toMarkdown`, `browser.runtime.sendMessage`.

Hide handler: `controller.recordEdit(selected, 'style', 'display', getComputedStyle(selected).display, 'none'); onDeselect();` — the Panel's old inline Hide button is superseded in Task 5.

- [ ] Failing tests → implement → green; commit `feat: persistent action row and selection card`.

### Task 5: Panel reassembly + EditorApp mode wiring + CSS

**Files:**
- Modify: `entrypoints/editor-main/components/Panel.tsx` (full reassembly), `entrypoints/editor-main/EditorApp.tsx`, `entrypoints/editor-main/components/sections/*.tsx` (remove `<h3>` headers; TextSection keeps its ResetButton next to the textarea and its mixed-content hint), `entrypoints/editor-main/editor.css`
- Test: rewrite `entrypoints/editor-main/components/Panel.test.tsx`

**Interfaces:**
- Panel props: `{ controller, selected, mode, onModeChange, showOnboarding, onDismissOnboarding, onSelect, onDeselect, onClose }`.
- EditorApp owns: `mode` ('edit' | 'browse', browse clears hover, Escape in browse → edit), onboarding state (`browser.storage.local.get/set('tweakpage:onboarded')`, failure ⇒ show card), renders `StatusBadge`, passes `enabled: mode === 'edit'` to the picker.
- Panel internals: view state `'edit' | 'changes'`; `openSections: Record<string, boolean>` initialized `{ Text: true, Typography: true }`; sections array `[{title:'Text',node:<TextSection…>}, …]` wrapped in CollapsibleSection; compare ModeSwitch maps `previewing` ↔ `'original'`; preview shows `.pgve-preview-note` instead of sections; footer button `{count} changes · Review ›` (class `pgve-footer-active` when count > 0) → changes view with `‹ Back to editing` row + ChangesTab.
- Empty-state copy: "Select an element on the page to edit it." + "Switch to Browse to use the page normally. Drag this panel by its title bar."
- Header becomes `⠿ Tweakpage` + `✕` only (Show original button removed).
- CSS additions: `.pgve-segmented/.pgve-segment/.pgve-segment-active`, `.pgve-action-row`, `.pgve-selection-card/.pgve-selection-label`, `.pgve-disclosure*`, `.pgve-footer/.pgve-footer-active`, `.pgve-badge`, `.pgve-onboarding`, `.pgve-preview-note`, `.pgve-back-row`; remove `.pgve-tabs`, header `.pgve-toggle-active`; accent `#FF3B30`, badge bg `#1F2933`.

- [ ] Rewrite Panel.test.tsx: keep behavioral tests (text edit, font size, color hex, reset, iframe guard, mixed-content warning, hide via ActionRow, breadcrumb) updated for the disclosure layout (open collapsed sections in tests as needed); add: compare segmented toggles preview + preview note shown; footer navigates to changes and back; browse mode passes through (via EditorApp-level test or picker test already covers); onboarding card shows when `showOnboarding` and Got it calls back.
- [ ] Implement; all unit tests green (`pnpm test`); `pnpm build` clean.
- [ ] Commit `feat: mode-rail panel redesign`.

### Task 6: E2E updates + README + finish

**Files:**
- Modify: `tests/e2e/fixtures.ts` (seed `tweakpage:onboarded` in `activateEditor` before sending pg:toggle), `tests/e2e/editor.spec.ts`, `tests/e2e/fixtures-page/index.html` (add `<a href="#test-anchor" id="anchor-link">Jump</a>`), `README.md` (usage section rewritten for the new UI).

- [ ] Retarget existing specs: `Show original` clicks → `getByRole('button', { name: 'Original' })` / back via `name: 'Edited'`; Changes entry → `getByRole('button', { name: /Review/ })`; `Export JSON` unchanged (now in action row). Expand collapsed sections where needed (`getByRole('button', { name: 'Spacing' }).click()` etc. — Text/Typography open by default).
- [ ] New spec: Browse pass-through — activate, click `Browse`, click `#anchor-link`, expect `page.url()` to contain `#test-anchor` and no selection card; switch back to `Edit`, click h1, expect selection card. Badge — enable Original, expect `Viewing original` badge visible, click it, expect edited text restored.
- [ ] `pnpm test && pnpm e2e` green; README updated; commit `feat: e2e + docs for redesigned panel`; merge branch to main; `pnpm build`.

## Self-review

Spec coverage: §3 zones → Task 5; §4 state machine → Tasks 2+5; §5 badge → Tasks 3+5+6; §6 onboarding → Tasks 3+5+6; §7 components → Tasks 1–5; §8 tests → Tasks 1–6; §9 acceptance → Task 6. Back-row placement deviation recorded in Global Constraints. Type consistency: ModeSwitch/CollapsibleSection/ActionRow/StatusBadge/OnboardingCard signatures used identically in Tasks 5–6.
