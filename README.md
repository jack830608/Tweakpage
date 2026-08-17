<p align="center">
  <img src="public/icon/128.png" width="96" alt="Tweakpage icon">
</p>

<h1 align="center">Tweakpage</h1>

<p align="center">
  Visually edit any web page — tweak copy, colors, spacing and images, reorder sections,
  replay your edits on reload, and export a clean change list for engineers.
</p>

![Tweakpage editing a demo page](docs/assets/screenshot.png)

For anyone who wants to try a page change before asking someone to build it —
designers, marketers, PMs, and engineers who'd rather not open DevTools for a copy tweak.

Every edit is recorded as a structured diff (selector + property + old → new), so you can:

- **Hand engineers a change list** — Copy Markdown from the Changes tab, paste into Slack/Jira.
- **Keep your edits** — they're saved locally per URL and re-applied automatically on reload.
  A query string that selects content (`?view=b`) counts as its own page; tracking
  parameters (`utm_*`, click ids) don't.
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
   The ▲▼ on the selection outline reorder the element among its siblings; stepping it
   back to where it started removes the edit.
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
9. A page showing edits says so with **one chip, bottom-left**. While the panel is open
   the chip stays out of the way (the footer carries the count); minimize or close the
   editor and the chip takes over, in the same spot — click it to bring the editor back.
   During a shared preview it says the edits are someone else's. An edited page is never
   mistaken for the real one, editor open or not.
10. `Esc` deselects, then closes; in Browse it returns to Edit. Drag the panel anywhere;
   resize by dragging its left edge or by focusing the edge and using the arrow keys —
   both remembered. The idle panel goes slightly translucent so the page shows through,
   and solidifies when you reach for it. The gear in the header opens Settings, where the
   theme follows your system unless you pick Light or Dark. The UI ships in English and
   Traditional Chinese — visible text and screen-reader labels both. Edits survive
   reloads and follow client-side navigation.


## Share links (optional)

Upload a page's edits to **your own** S3 bucket and share the link. Whoever opens it needs
Tweakpage and nothing else — no AWS account, no setup.

Opening a link **shows** the edits; it does not save them. The panel says they came from
someone else and offers **Keep on this page**, which is what puts them in your own storage.
Look at a colleague's proposal, close the tab, and your copy of the page is as it was.

Open the panel's gear icon → **Share links**, then fill in bucket, region, key id and secret.
They save as you type. Until all four are set the Share link button stays disabled, and this
repo ships no defaults.

The key you paste needs to write, and to be allowed to mark what it writes as readable:

```json
{ "Effect": "Allow", "Action": ["s3:PutObject", "s3:PutObjectAcl"],
  "Resource": "arn:aws:s3:::YOUR_BUCKET/tweakpage/*" }
```

Then the bucket has to let a stranger read a share. Either give it a policy:

```json
{ "Effect": "Allow", "Principal": "*", "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::YOUR_BUCKET/tweakpage/*" }
```

or leave ACLs enabled with Block Public Access off, and Tweakpage marks each file public as
it uploads. Either way it checks: after writing, it reads the object back with no
credentials, exactly as a recipient would, and refuses to hand you a link that would 403.

The object name is 113 bits of randomness, so the link is the permission — but the file is
readable by anyone holding it, so don't share pages whose content is confidential. Set a
lifecycle rule on the prefix to expire old shares.

A link carries an id, a bucket and a region as separate, validated parts — never a URL — so
it can only ever resolve to an address Tweakpage builds itself, and what arrives is checked
exactly like an imported file.

**About the key.** Extension storage is not a vault: anyone with access to that browser
profile can read it, and this extension is open source. Use a key that can do nothing
except write that one prefix, and rotate it like any other credential. The secret itself
never leaves the machine — requests carry a signature derived from it.

## Development

- `pnpm dev` — WXT dev mode with HMR
- `pnpm test` — typecheck, then unit/component tests (vitest)
- `pnpm typecheck` — `tsc --noEmit` alone
- `pnpm e2e` — builds, then drives the real extension in Chromium (Playwright)
- Spec: `docs/superpowers/specs/2026-08-15-tweakpage-design.md`
- Plan: `docs/superpowers/plans/2026-08-15-tweakpage-mvp.md`

## Manual QA checklist (per release)

- [ ] A real marketing/landing page — edit hero copy + color, reorder two sections, reload,
      verify replay, export Markdown
- [ ] A React SPA — edit text, trigger a client-side navigation and back, verify replay
- [ ] A static site — full flow including Export JSON

## License

MIT
