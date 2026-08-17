<p align="center">
  <img src="public/icon/128.png" width="96" alt="Tweakpage icon">
</p>

<h1 align="center">Tweakpage</h1>

<p align="center">
  Visually edit any web page — tweak copy, colors, spacing and images,
  replay your edits on reload, and export a clean change list for engineers.
</p>

![Tweakpage editing a demo page](docs/assets/screenshot.png)

For anyone who wants to try a page change before asking someone to build it —
designers, marketers, PMs, and engineers who'd rather not open DevTools for a copy tweak.

Every edit is recorded as a structured diff (selector + property + old → new), so you can:

- **Hand engineers a change list** — Copy Markdown from the Changes tab, paste into Slack/Jira.
- **Keep your edits** — they're saved locally per URL and re-applied automatically on reload.
- **Share with a colleague** — Export JSON, and import theirs; edits for other pages
  wait until you open those pages.

## Install (pilot)

1. Download and unzip the latest build (or run `pnpm install && pnpm build` — output in `.output/chrome-mv3/`).
2. Open `chrome://extensions`, enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `chrome-mv3` folder.

## Usage

1. Click the **Tweakpage** toolbar icon and hit **Edit this page** (the popup also lists every
   page holding saved edits — open or clear them from there; the badge shows each page's edit
   count). First launch shows a three-step intro card.
2. **Edit / Browse** (top switch): Edit selects elements on hover/click; Browse lets you use
   the page normally (menus, tabs, links) — a badge reminds you while browsing. Holding
   `⌥ Alt` in Edit mode is a temporary Browse.
3. **Edited / Original** (second switch): flips the whole page between your edited version
   and the untouched original — the page badge takes you back.
4. Select an element and edit it in the collapsible sections: Text, Typography (family, size,
   weight, line height, align, letter spacing, transform, color), Background (color + image),
   Image, Appearance (corner radius, opacity, border), Size, Layout (display, flex, gap,
   position, shadow), Spacing. Text with inline markup gets one box per run, so a heading
   keeps the link or coloured span inside it. Images can come from a local file or a URL (which applies
   when you leave the field or press Enter), and colours keep their transparency. Fields are named after
   the CSS property they write, and an edited one shows a ↺ beside it. Color fields have
   an eyedropper (pick from the page) and recent swatches. Use the breadcrumb to reach
   parents/children.
5. Selection card: **Hide / Unhide** the selected element (editing locks while hidden), and
   **apply style edits to every similar element** when the element is one of a family.
   Hand off with **Copy** (Markdown summary), **CSS** (a pasteable stylesheet) or **Snap**
   (one image with the original and the edited page side by side); send with **Copy JSON**
   or **Export JSON**.
6. **Proposals**: save the current edits under a name, then switch between them to compare
   two directions without rebuilding either. They travel with the export.
7. Footer **Review** opens the change list (delete individual edits, revert all, **Import JSON**
   from a teammate — edits for other pages are stored and apply when you open them).
8. `⌘Z` / `⇧⌘Z` (or `Ctrl+Z`) undo and redo, or the arrows in the header. Each change in
   Review can be toggled, hovered (highlights the element) or selected (scrolls the page to
   it). `⌥` + arrow keys move the selection through the page without a mouse.
9. A page showing edits says so: a small marker sits in the bottom-left corner whether or
   not the editor is open, so an edited page is never mistaken for the real one. Click it
   to open the editor.
10. `Esc` deselects, then closes; in Browse it returns to Edit. Drag the panel anywhere,
   drag its left edge to resize, or minimize it to a corner pill — all remembered. The theme
   follows your system unless you pick Light or Dark in the header. The UI ships in English
   and Traditional Chinese. Edits survive reloads and follow client-side navigation.


## Share links (optional)

Upload a page's edits to **your own** S3 bucket and share a link. Whoever opens it needs
Tweakpage and the same bucket configured; the edits apply on arrival.

Right-click the toolbar icon → **Options** and fill in bucket, region, key id and secret.
Nothing is shared until all four are set, and this repo ships no defaults.

The link carries only a random id — never a URL — so it can only ever resolve against the
bucket the reader configured themselves. What arrives is validated exactly like an
imported file.

**About the key.** Extension storage is not a vault: anyone with access to that browser
profile can read it, and this extension is open source. Use a key that can do nothing
except read and write one prefix, and rotate it like any other credential:

```json
{ "Effect": "Allow",
  "Action": ["s3:PutObject", "s3:GetObject"],
  "Resource": "arn:aws:s3:::YOUR_BUCKET/tweakpage/*" }
```

The secret itself never leaves the machine — requests carry a signature derived from it.
Set a lifecycle rule on that prefix to expire old shares.

## Development

- `pnpm dev` — WXT dev mode with HMR
- `pnpm test` — unit/component tests (vitest)
- `pnpm e2e` — builds, then runs the Playwright smoke test
- Spec: `docs/superpowers/specs/2026-08-15-tweakpage-design.md`
- Plan: `docs/superpowers/plans/2026-08-15-tweakpage-mvp.md`

## Manual QA checklist (per release)

- [ ] A real marketing/landing page — edit hero copy + color, reload, verify replay, export Markdown
- [ ] A React SPA — edit text, trigger a client-side navigation and back, verify replay
- [ ] A static site — full flow including Export JSON

## License

MIT
