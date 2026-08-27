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
Refusals are the safe failure; **landed elsewhere** is the one to read.

The report gives that count per scenario, and on the `ALL` row a second figure for how
many of them had no text. Subtract to get the two numbers that matter, and compare both
against the run recorded in [selection.md](selection.md):

- **On elements with text** — last measured **3**. These records are held to their words,
  so a rise here is a regression and worth stopping for.
- **On elements with none** — last measured **56**. Positional by design, and the sites
  move underneath the audit, so this drifts on its own. A jump is worth reading; a few
  either way is not.

Also worth a glance: `reload` and `strip-classes` are zero in both columns. If either
stops being zero, something in resolution has broken rather than drifted.

This used to say the number must be zero outright, which was true of an audit that
modelled only whole-element text edits. Extending it to style records made it 63, and the
instruction was never updated — leaving a gate that could not be passed, in a script that
could not be run.
