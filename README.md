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
3. Edit in the panel: Text, Typography, Background, Image, Size, Spacing.
   Drag the panel by its title bar if it covers what you are editing (it snaps back to the top-right when reopened).
   Use the breadcrumb to move to a parent/child element.
4. **Changes** tab: review every edit, delete one, revert all, **Export JSON**, **Copy Markdown**.
5. `Esc` deselects; `Esc` again (or the icon) closes the editor. Edits stay applied and survive reloads.

Not supported yet: elements inside iframes, importing JSON, uploading local images.
- Text editing on elements with nested formatting flattens it to plain text (a warning is shown in the panel).

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
