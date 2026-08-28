# Release log

Releasing: bump `package.json`, tag `vX.Y.Z`, push the tag. `.github/workflows/release.yml`
runs the gate and attaches the ZIP to that tag's GitHub release — that asset is what goes
to the dashboard. It does not publish; uploading to real users stays a person's decision.

One section per submission. The point is to be able to answer, months later, what is
actually on the store and what was already known to be wrong when it went there — without
reconstructing it from memory or from a merge commit's date.

## 1.2.0 — submitted 2026-08-28

An interface release. No permission change, no record-format change, no change to what a
hand-off contains — so an update review rather than the deeper one.

### Where the work came from

A design review that measured the rendered panel instead of reading the stylesheet, and
then seven defects found by the person who uses this daily, in an afternoon of using it.
That ratio is the finding worth recording: the review was good — it found white text at
1.92:1 on every primary button, a slider drawn in the accent while sitting at its default,
and seven section dividers drawn in a colour 8/255 from their background — and it still
missed everything that only appears when a hand is on the keyboard.

Reported, in order, each after the previous was fixed: colour and opacity chips not
focusing what you would type into; the reset button overflowing its gutter onto the label
the moment a field was edited; the panel jumping 88px down on the first change; the panel
collapsing 511px when compare was pressed, taking the pressed button with it; the compare
toggle not looking like a control; and that same toggle moving 13px sideways when the
status text beside it changed width.

The last four are one class, and the rule now written into known-issues.md came out of
them: a control must not sit inside or below the region its own action resizes, and chrome
whose presence depends on state must not sit in the flow above the content it modifies.

### Checked before submitting

- `pnpm test` — 63 files, 701 tests
- `pnpm e2e` — 79 tests
- `pnpm package` — ZIP built, unpacked, driven in a real browser
- `pnpm audit --prod` — no known vulnerabilities
- Every guard added this release was confirmed to fail against the version that shipped.
  Three did not on the first attempt: an 88px probe that a flex column shrank to zero
  height, a horizontal guard that survived removing a redundant margin (which is how the
  margin was found to be redundant), and a `data-property` selector pointing at the old
  class name. A guard nobody has watched fail is a guard nobody has read.
- The rendered panel was looked at, in both themes, after each substantive change. The
  last such look found two more defects — a truncated error message and, after fixing it,
  a floating message drawn over the row beneath it in a 22% tint.

### Not done before submitting

- `docs/qa-checklist.md` — the eight manual paths. **Fifth release running.** Nothing in
  this release touches the sharing code, but "did not touch" and "still works" are
  different statements, and only one of them has been checked.
- `pnpm audit:selectors` — not re-run. Resolution is untouched by this release.

## 1.1.0 — submitted 2026-08-28

A reliability release, from an outside review that found four real defects the project's
own review pass and a code review had both missed. Every claim in it was verified before
being acted on; every one that was checkable held.

Minor rather than patch because page identity changed. Edits are filed under a key that
now includes the query, so anything saved under the old key is unreachable — acceptable
only because there is nobody to lose work: the store shows no ratings and the listing is
two days old. Had there been users this would have needed a hand-over, and the decision
was made explicitly rather than by omission.

### What changed

- **Page identity keeps the query**, minus arrival-only parameters. `youtube.com/watch`
  without its `v=` was one page for every video.
- **Hand-offs carry only enabled changes.** A switched-off change was still going to
  engineers.
- **TinyPNG calls have the timeout** the rest of the codebase adopted.
- **Every filled control clears WCAG AA.** White on the dark accent was 1.92:1.
- **`happy-dom` past its critical advisory**, Firefox-only transitive deps pinned.
- Version shown in Settings and stamped into every hand-off.
- zh-TW: 59 strings of halfwidth punctuation, one mixed-language string, and the
  before/after image labels now follow the interface language.

### Checked before submitting

- `pnpm test` — 63 files, 688 tests
- `pnpm e2e` — 71 tests
- `pnpm package` — ZIP built, unpacked, driven in a real browser
- Both new guards were confirmed to fail without their fix. The first attempt at the
  share-link test did not: the page-identity change had already fixed it, and the extra
  change being tested turned out to be redundant *and* worse — it forwarded the sender's
  campaign tags to the recipient. It was reverted.

### Not done before submitting

- `docs/qa-checklist.md` — the eight manual paths. Third release running. Still needs a
  real bucket, a real TinyPNG key and two browser profiles.
- `pnpm audit:selectors` — not re-run; nothing in this release touches resolution.

### Deliberately not in this release

Four more findings from the same review, each verified and each held back for a stated
reason — permission model, panel density, share-link positioning, hand-off language. They
are written up in `known-issues.md` rather than dropped.

## 1.0.1 — submitted 2026-08-27, published 2026-08-28

Approved the next day. An update that changes no permissions does not draw the review
`<all_urls>` drew for 1.0.0.

The first release built by CI from a tag rather than from a laptop, and the first
uploaded as a draft by the workflow instead of by hand.

Six defects from `known-issues.md`, all of which needed no change to the record format.
The one that reaches users without ever being reported is the out-of-range move index:
the applier rewrote the DOM twenty times a second for as long as a tab stayed open, and
the only symptom was the battery. The others: several copies of one card collapsed into
one on import, an import that failed to store said nothing at all, a carousel's current
frame became the record's idea of the original, Escape during a hand-off still filled the
clipboard, and an edit made straight after a text edit was stamped with the words that
edit had just written.

### Checked before submitting

- `pnpm test` — 59 files, 661 tests
- `pnpm e2e` — 71 tests
- `pnpm package` — ZIP built, unpacked, driven in a real browser
- **A code review, which is how this release nearly shipped the bug it was fixing.** The
  merge-identity fix exempted every structural edit from supersession, which was right for
  clones and wrong for moves: two moves on one element disagree about where it goes, so
  each pass wrote the DOM — the same perpetual loop, arriving by import instead of by a
  bad index. Green suites did not catch it. Six more findings came with it, three of them
  introduced by this release's own fixes.
- `pnpm audit:selectors` — ran for the first time ever; it had never been executable,
  because the script calls esbuild and esbuild was never a declared dependency. 59 wrong
  answers in 3840 against 63 on the previous recorded run, and 56 of the 59 on elements
  with no text, which is the documented positional limit rather than a regression.

### Not done before submitting

- `docs/qa-checklist.md` — the eight manual paths, again. Still needs a real bucket, a
  real TinyPNG key and two browser profiles.

### What CI does and does not check

The release workflow checks that the tag and the manifest agree, that the unit suite
passes, and that the package builds. It does not open a browser. Every
`--load-extension` test times out on a GitHub runner — the page serves, the browser
starts, the extension never becomes active — so each test burns its full 30 seconds and
the suite cannot finish. Two attempts at 25 and 40 minutes proved it is not slowness.

Until that is understood, `pnpm e2e` and `pnpm package` are a laptop's job, run before
the tag is pushed, and this section is where each release says whether that happened.
For 1.0.1 it did: 71 e2e and the unpacked-ZIP smoke test, both green, immediately before
tagging.

### Also in this release

- 59 zh-TW interface strings had halfwidth punctuation sitting against Chinese text.
- `release.yml`: a tag now builds the package and uploads it as a draft. It stops there.

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
