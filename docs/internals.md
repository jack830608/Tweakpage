<!-- Reference, not introduction. What a hand-off file contains, and how replay works. -->

# Internals

## The hand-off format

`Copy JSON` / `Download JSON` produce one object per page, `version: 1`, with a `records`
array. Each record says what changed — `type`, `property`, `oldValue`, `newValue` — and
carries what is needed to find the element again (`selector`, `fallbackSelectors`,
`textFingerprint`) and what is needed to find it in a repository (`context`).

`context` is the chain from the edited element outwards, six deep at most, with each
ancestor's `tag`, `id`, `role`, `aria-label`, test id and authored class names. It exists
because the element you edit is often bare — a `<span>` with no class and no id, whose
selector can only be positional — while its ancestors carry the two things a reader
needs: the region named in the author's own words, and a class naming the component.

Build hashes are stripped from those class names: `product-selector_optIn__qe980` is
recorded as `product-selector_optIn`, because the hash changes on every build that
touches the file and `optIn` does not. Classes that are nothing but a hash —
styled-components, emotion — are dropped, since they say nothing about the source.

`context` also carries the nearest heading above the element, which on stacks where
every class is a utility is the only thing naming where you are. Across eight real sites
it takes the share of records that name their region from as low as 8% to 93–100%.

`context` is recorded and never resolved against. Replay is the selectors' job; giving
these a vote would mean more chances to land on the wrong element, not fewer — and the
audit puts a number on what that would buy: 38 of 661 refusals. See
[docs/selection.md](docs/selection.md) for how an element is found again, what survives
a rebuild, and what 1920 resolutions across eight real sites measured.

## How it works

- A tiny always-on content script replays saved edits and draws the corner chip; the
  editor itself loads lazily into a Shadow DOM, so pages you never edit pay almost
  nothing.
- Style edits go through one injected stylesheet targeting a `data-tweakpage` marker
  stamped on the resolved element — a selector can never fan out to elements you didn't
  pick.
- Selectors prove uniqueness, not identity. A hit is held against the remembered text
  before it is believed, so a site inserting a sibling can't get the wrong element
  edited — and a selector minted after Tweakpage's own reorder or duplicate waits until
  those are replayed, because it describes the page as it looked then, not as the site
  serves it.
- Everything lives in `chrome.storage.local`, keyed by normalized URL. Nothing leaves
  the machine unless you export or share.
- Credentials never enter the page. The editor's Shadow DOM is UI encapsulation, not a
  security boundary — a site can reach into it — so the AWS and TinyPNG keys are read
  and written only on the extension's own page, and the panel receives status, never
  values. The one message that changes stored data carries a per-page token the site
  cannot guess.
