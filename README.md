<p align="center">
  <img src="public/icon/128.png" width="96" alt="Tweakpage icon">
</p>

<h1 align="center">Tweakpage</h1>

<p align="center">
  Visually edit any web page — then keep it, prove it, and hand it off.
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/tweakpage/kicbechkfggmokgdceddemojfchjaadg"><img src="https://img.shields.io/chrome-web-store/v/kicbechkfggmokgdceddemojfchjaadg?color=10b981&label=chrome%20web%20store" alt="Chrome Web Store version"></a>
  <a href="https://chromewebstore.google.com/detail/tweakpage/kicbechkfggmokgdceddemojfchjaadg"><img src="https://img.shields.io/chrome-web-store/users/kicbechkfggmokgdceddemojfchjaadg?color=10b981" alt="Users"></a>
  <a href="https://chromewebstore.google.com/detail/tweakpage/kicbechkfggmokgdceddemojfchjaadg"><img src="https://img.shields.io/chrome-web-store/rating/kicbechkfggmokgdceddemojfchjaadg?color=10b981" alt="Rating"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-10b981" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/Chrome-Manifest%20V3-10b981" alt="Chrome Manifest V3">
  <img src="https://img.shields.io/badge/UI-English%20%C2%B7%20%E7%B9%81%E9%AB%94%E4%B8%AD%E6%96%87-10b981" alt="English and Traditional Chinese">
</p>

![Tweakpage editing a demo page](docs/assets/screenshot.png)

**[Install](#install)** · **[Quick start](#quick-start)** · **[Guide](#guide)** ·
**[Share links](docs/share-links.md)** · **[What it cannot reach](#what-it-cannot-reach)** ·
**[Internals](docs/internals.md)** · **[Privacy](PRIVACY.md)**

Tweakpage is a Chrome extension for anyone who wants to try a page change before asking
someone to build it — designers, marketers, PMs, and engineers who'd rather not open
DevTools for a copy tweak. Every edit is recorded as a structured diff
(selector + property + old → new), not a screenshot of an idea.

## Features

- **Edit text in place** — double-click and type; inline markup and links inside survive.
- **Edit almost anything** — typography, colour with an eyedropper, backgrounds, images,
  links, size, spacing, layout, borders, shadows — plus an Advanced box for raw CSS.
- **Reorder, duplicate, hide** without touching the site.
- **Style one card, restyle the family** — apply an edit to every similar element.
- **Compare** — flip the page between your version and the original.
- **Edits stay** — saved on your machine, per page, replayed on reload.
- **Proposals** — keep two directions side by side and switch between them.
- **Hand off** — a Markdown change list, a JSON export, or one before-and-after image.
- **[Share links](docs/share-links.md)** — send a URL from your own S3 bucket; the
  recipient needs Tweakpage and nothing else.
- **Undo everything** — `⌘Z`, per-edit toggles, per-element resets, revert all.
- **Nothing leaves quietly** — the first hand-off that would upload says what is about to
  go where, and waits.
- **Keyboard-first**, in English and 繁體中文.

## Install

**[Add to Chrome from the Chrome Web Store][store]** — nothing else to set up.

[store]: https://chromewebstore.google.com/detail/tweakpage/kicbechkfggmokgdceddemojfchjaadg

Or load it from source, to work on it or to run a change before it ships:

```bash
pnpm install && pnpm build   # output in .output/chrome-mv3/
```

1. Open `chrome://extensions` and enable **Developer mode** (top right).
2. Click **Load unpacked** and select the `.output/chrome-mv3` folder.

## Quick start

1. Click the **Tweakpage** toolbar icon → **Edit this page**.
2. Hover to outline, click to select. Edit in the panel's sections — or double-click
   text and type straight on the page.
3. Reload the page — your edits replay. Footer **Review ›** lists every change.
4. Done? **Copy summary** and paste the change list into Slack or Jira.

## Guide

### Selecting

**Edit / Browse** is the top switch: Edit selects elements on hover/click; Browse lets
you use the page normally (menus, tabs, links). Holding `⌥ Alt` in Edit mode is a
temporary Browse. Use the breadcrumb in the selection card to reach parents and
children, or `⌥` + arrow keys to walk the DOM without a mouse.

**Start over** (Settings) puts things back the way they came. What goes is ticked rather
than assumed, because the three things it can clear cost wildly different amounts to
redo: preferences are a click, an AWS key is a trip to the console, and a month of edits
is a month. Only preferences start ticked; the other two carry the count of what they
would take — "4 changes across 2 pages" — and the button asks twice.

**Areas to leave alone** (Settings) is a list of CSS selectors the picker skips, along
with everything inside them — a chat launcher, a consent banner, an embedded widget.
Hovering one outlines it in grey and names the rule, so a refusal never looks like a
broken picker. Rules apply to picking only: edits you already made keep working, and
switching a rule on never deletes them. `[data-tweakpage-ignore]` ships as an ordinary
entry, so a page can mark its own volatile regions — and you can delete it.

### Editing

**Double-click text to edit it in place** — the element itself becomes a plain-text
input; blur, `Esc`, or clicking away commits, and the change lands in the same records
as the panel's text boxes. Long rewrites are still comfortable in the panel. An element
broken into more than twelve runs of text is not offered either way: past that there is
no field to record a change under, and typing that records nothing is worse than a
field that isn't there.

Fields say what they do, with the CSS property underneath — an edited one shows a ↺ reset
beside it, and reset restores what the page holds *now*, not a stale snapshot, even if
the site updated the value underneath you. Text with inline markup gets one box per run,
so a heading keeps the link or coloured span inside it. Image URLs apply on Enter or
blur; local files apply immediately. Color fields have an eyedropper and recent
swatches, and keep their transparency.

The selection card offers **Hide / Unhide** and **apply to every similar element**;
the ▲▼ on the selection outline reorder the element among its siblings — stepping it
back to where it started removes the edit.

### Reviewing and handing off

**Review ›** in the footer opens the change list: toggle an edit off and on, delete it,
hover to highlight its element, click to scroll to it. **Import JSON** merges a
teammate's edits — edits for other pages wait until you open those pages.

Hand off with **Copy summary** (Markdown), **Screenshot** (original and edited side by
side in one image), or **Copy / Download JSON**. **Proposals** saves the current set under a name so two directions can be
compared live.

### The panel

Drag it anywhere; resize by dragging its left edge or focusing the edge and using the
arrow keys — both remembered. Idle, it turns slightly translucent so the page shows
through, and solidifies when you reach for it. The gear opens Settings: appearance
(system/light/dark theme), share-link credentials, and what happens to images on the way
out. The popup on the toolbar icon lists every page holding saved edits — open or clear
them from there.

### Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `⌘Z` / `Ctrl+Z` | Undo |
| `⇧⌘Z` / `Ctrl+Shift+Z` | Redo |
| `Esc` | Deselect, then close; in Browse, return to Edit |
| hold `⌥ Alt` | Temporary Browse while in Edit |
| `⌥` + `↑ ↓ ← →` | Move selection: parent / first child / previous / next sibling |
| `← →` on the resize edge | Narrow / widen the panel (`⇧` for bigger steps) |
| `Enter` in an image URL field | Apply the URL |

## What it cannot reach

Tweakpage edits the DOM of the page you are looking at. Three kinds of content are
outside that, and it says so at the moment you hover rather than accepting an edit that
can never replay:

- **Inside a web component.** A shadow root is out of reach of `document.querySelector`,
  so a record made there could never be found again.
- **Inside an iframe.** A different document; the editor runs in the top one.
- **Canvas, WebGL, video** — pixels, not elements. There is nothing to select.

Everything else is fair game, but "fair game" is not "guaranteed". An element with no
text has no fingerprint, so if the page's structure moves under it the record is
reported as not found rather than guessed at. See [docs/selection.md](docs/selection.md)
for what survives what, measured.

## Development

```bash
pnpm dev         # WXT dev mode with HMR
pnpm test        # typecheck, then unit/component tests (vitest)
pnpm typecheck   # tsc --noEmit alone
pnpm e2e         # builds, then drives the real extension in Chromium (Playwright)
pnpm shots       # regenerates the store screenshots from the built extension
```

[Privacy policy](PRIVACY.md) · [internals](docs/internals.md) · [share links](docs/share-links.md) · [store submission notes](docs/store-listing.md) ·
[release QA checklist](docs/qa-checklist.md), which runs before each release. Issues and
PRs welcome — please keep both
locales in step (tests enforce it) and anchor E2E assertions on `data-testid`, never on
translated text.

## License

[MIT](LICENSE)
