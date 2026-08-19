# Release QA checklist

Run before each release, in a real browser with the unpacked build. These are the paths
the automated suites cannot reach: real sites, real files, real S3.

- [ ] A real marketing/landing page — edit hero copy + color, reorder two sections,
      duplicate one, reload, verify replay, export Markdown
- [ ] A React SPA — edit text, trigger a client-side navigation and back, verify replay
- [ ] A static site — full flow including Export JSON
- [ ] Double-click text on a page with inline markup (a heading holding a link) — type,
      click away, reload: the markup survives and the change replays
- [ ] A local image against a real bucket — pick a photo, share, and confirm the object
      lands in `tweakpage/images/`, the panel switches to the URL, and a second share
      uploads nothing
- [ ] With a TinyPNG key — the same photo, and confirm the uploaded object is smaller
      than the file and the month's count went up by one, not two
- [ ] A share link across two browser profiles — sender configured, recipient with
      nothing set up: preview shows, nothing saved until Keep
- [ ] A page whose own CSS is hostile (`* { visibility: hidden }` in DevTools) — the
      panel and the corner chip stay usable

## Selection, before a release

`pnpm audit:selectors` — eight real sites, six ways a page can move, 40 elements each.
The number that must stay zero is **landed elsewhere**; refusals are the safe failure.
Numbers and the reasoning behind them: [selection.md](selection.md).
