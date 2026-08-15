# Tweakpage

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

1. Click the **Tweakpage** toolbar icon on any page (badge shows `ON`). First launch shows a
   three-step intro card.
2. **Edit / Browse** (top switch): Edit selects elements on hover/click; Browse lets you use
   the page normally (menus, tabs, links) — a badge reminds you while browsing. Holding
   `⌥ Alt` in Edit mode is a temporary Browse.
3. **Edited / Original** (second switch): flips the whole page between your edited version
   and the untouched original — the page badge takes you back.
4. Select an element and edit it in the collapsible sections: Text, Typography, Background,
   Image, Size, Spacing. Use the breadcrumb to reach parents/children.
5. Action row: **Hide element**, **Copy summary** (Markdown for engineers), **Export JSON**.
6. Footer **Review** opens the change list (delete individual edits, revert all).
7. `Esc` deselects, then closes; in Browse it returns to Edit. Drag the panel by its title
   bar. Edits stay applied and survive reloads.


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

## License

MIT
