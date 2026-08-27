# Release log

Releasing: bump `package.json`, tag `vX.Y.Z`, push the tag. `.github/workflows/release.yml`
runs the gate and attaches the ZIP to that tag's GitHub release — that asset is what goes
to the dashboard. It does not publish; uploading to real users stays a person's decision.

One section per submission. The point is to be able to answer, months later, what is
actually on the store and what was already known to be wrong when it went there — without
reconstructing it from memory or from a merge commit's date.

## 1.0.0 — submitted 2026-08-25

- Chrome Web Store item ID: `kicbechkfggmokgdceddemojfchjaadg`
- Tagged `v1.0.0` at `fb79839` (`Merge branch 'release/1.0.0'`)
- **Approved and published 2026-08-27**, two days after submitting — the deeper review
  `<all_urls>` triggers did not cost the weeks it can.
  <https://chromewebstore.google.com/detail/tweakpage/kicbechkfggmokgdceddemojfchjaadg>
- Search indexing lags publication. The listing answered on its URL the day it went live;
  turning up in a store search for its own name takes longer, and there is no console to
  submit it to. Expect days.

### Checked before submitting

- `pnpm test` — 59 files, 653 tests
- `pnpm e2e` — 71 tests
- `pnpm audit --prod` — no known vulnerabilities
- `pnpm package` — ZIP built, unpacked, and driven in a real browser
- Package contents — 24 files, 215 KB. No source maps, no `.env`, no tests, no
  credentials. `AWS_SECRET_ACCESS_KEY` occurs once, as the env-var *name* the settings
  page shows so somebody knows where to find their own value (`lib/share/settings.ts`).
- No remote code — every `<script>` resolves inside the package, and there is no `eval`,
  no `new Function`, no dynamic `import()`, no `importScripts`, no WebAssembly. The
  external hosts in the bundle are `api.tinify.com` (sends an image, gets an image back),
  the two AWS console links on the settings page, `react.dev` in a React error string,
  and the SVG namespace URI.
- Privacy policy resolves: <https://github.com/jack830608/Tweakpage/blob/main/PRIVACY.md>

### Not done before submitting

- **`docs/qa-checklist.md`** — the eight manual paths. These are the ones no automated
  suite reaches: real sites, a real bucket, a real TinyPNG key, two browser profiles.
- **`pnpm audit:selectors`** — the eight-real-sites selection audit.

### Answers given on the listing

Worth keeping, because the next submission inherits them and a contradiction between
versions is worse than either answer alone.

- **Trader status**: non-trader. Free, MIT, personal copyright, no monetisation anywhere
  in the code. Declaring trader would put a verified name, address and phone number on
  the public listing under the DSA. Revisit the moment anything is charged for, or if
  this is ever published under a company.
- **Remote code**: no.
- **Data categories**: authentication information, web history, website content. The
  reasoning, including why user activity stays unticked, is in `store-listing.md`.
- **Host permission**: kept `<all_urls>`. The dashboard suggested `activeTab` or named
  hosts; neither works. `applier.content.ts` calls `engine.start()` unconditionally at
  `document_idle` and watches for client-side navigation — that is edits replaying on
  reload, and `activeTab` is granted only after a gesture and revoked on navigation. If a
  reviewer pushes back, the answer is the justification already on the listing, not a
  retreat to `activeTab`.
- **Visibility**: public. **Official URL**: none — no verified domain to point at.
  **Homepage / support**: the GitHub repository and its issues.

### Known-bad at submission time

Everything in `docs/known-issues.md` shipped as-is. The one most likely to cost a rating
without ever being reported is the out-of-range move index that makes the applier reapply
about twenty times a second forever: silent, invisible, and it just drains battery.

### Still open after publishing

- The eight manual paths in `docs/qa-checklist.md` and `pnpm audit:selectors` were never
  run for this release. Two of them are worth doing now rather than before 1.0.1: a real
  image share against a real bucket, and a share link across two browser profiles. Both
  are core paths, both are invisible to every automated suite, and both are now running
  against people who installed from the store.
- `README.md` was updated on publication: the store is the main install path, loading
  unpacked is the developer note.
