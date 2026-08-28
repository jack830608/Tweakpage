# Known issues

Found in the pre-launch review, reproduced, and not fixed. Each says what goes wrong,
who it reaches, and why it is still here.

What has been fixed since 1.0.0 is at the bottom, with the reproduction that now guards
it — a defect nothing tests for is one that comes back.

## Two tabs on one page overwrite each other

**What happens.** Open the same URL in two tabs and edit in both. Each save writes the
whole record set from a copy read once when the panel opened, so whichever tab saved last
is the one that survives. The losing tab still shows its edit on screen and still shows a
green "saved" badge; the loss appears at the next reload.

**Why it is still here.** The obvious fix — adopt whatever another writer left — was
built and reverted. The applier writes this same key on its own schedule from a separate
bundle, so a watcher cannot tell that write from another tab's; treating it as one threw
away the undo history on every baseline refresh, and four end-to-end tests caught it.
Doing this properly means giving the two writers a way to name themselves, which is a
change to how the applier and the panel talk to each other and not something to land in a
review pass.

**What is fixed.** Clearing a page from the popup is followed correctly — the panel
notices the removal, puts the page back and stops writing the old records over it.

## Structural edits interact by position, and positions move

Three cases, all reproduced:

- **A clone undoes an earlier move of a sibling.** Move B down, then duplicate A: B
  jumps back above C. The move's index was recorded in a page without the copy in it, and
  clones are applied before moves are interpreted.
- **Two moves with overlapping indices land wrong.** `[A,B,C,D]`, move A to 2 and D to 1
  gives `D,B,A,C` instead of `B,D,A,C`. Placing an element that moves *down* past one
  already placed shifts it.
- **Deleting a clone orphans records made inside it.** They stay in the change list as
  permanently not-found, and are exported and shared as changes that can never apply.

**Why they are still here.** A move stores where an element goes as a sibling index, which
is only meaningful against one arrangement of the page. Fixing it means recording the
element it should sit before or after, which changes the record format. Reverting a
duplicate-then-reorder *is* fixed, because that one was a wrong order of operations rather
than a wrong representation.

## Import order decides what a copy contains

`mergeRecords` puts survivors first and incoming last, and a clone takes its content from
the page as it stands when the clone is applied. So importing a share that touches an
element which is also duplicated can change what the duplicate says.

**Why it is still here.** The order records apply in is currently the order they happen to
sit in, and making it deterministic means ordering the merged set by when each edit was
made. That is defensible, but it changes the apply order of every existing page and is
not a change to make alongside an identity fix.

## A page whose query changes looks like it lost your work

Keying on the query is the right default — the alternative put one page's words on
another page's content, silently — but it has a cost, and this is it. Edit a product
page, pick a size, and if the shop appends `?variant=42` the edits go off the screen.
They are not gone: going back to the variant they were made on brings them back, and the
popup lists every page anything is saved for. Nothing says so at the moment it happens,
which is the part worth fixing.

**What would fix it.** The corner chip already knows when a page has no edits. It could
also know when a *sibling* of that page does — same origin and path, different query —
and say so, which turns a disappearance into a signpost. That is a small feature rather
than a rule change, and it does not require picking a different default.

## Raised in the 2026-08-28 review, and deliberately not in 1.1.0

Each was verified as real. None is a defect being ignored; each is a different kind of
change from the reliability fixes 1.1.0 is made of.

**`<all_urls>` at install could be `optional_host_permissions`.** Asking per origin the
first time somebody edits there, and registering the content script dynamically for the
origins they granted, would keep edits replaying on reload without demanding every site
up front. It is a real option and a better answer than the two the dashboard suggests —
`activeTab` is granted only after a gesture and revoked on navigation, which is not a
thing that can replay anything. Held back because it changes the permission model, so
the store re-reviews permissions, and because the moment where a site is granted needs
designing rather than bolting on.

**The panel is dense, and names CSS properties rather than what they do.** `font-size`,
`flex-direction` and `box-shadow` sit bare in a 320px column aimed partly at people who
do not write CSS. A "common" view with the rest behind Advanced is the suggestion. Held
back because it is taste, on the primary surface, and guessing at it is worse than
leaving it.

**Share links need the reader to run their own S3 bucket.** Bucket, IAM user, public-read
policy and a long-lived key is a small AWS project, and it is asked of a headline
feature. Marking it Advanced is a positioning decision that contradicts what the store
listing sells, so it is not one to make quietly.

**The Markdown hand-off is English whatever the interface language is.** Its headings,
field names and structural verbs are fixed. Arguably right — a change list names CSS
properties, and those are English — but it is not stated anywhere, which is the part
that should change either way.

## Not supported, by design

Shadow DOM, iframes, canvas and WebGL. The editor says so when you hover them. See
[selection.md](selection.md).

---

# Fixed in 1.2.0

An interface pass, from a design review that measured the rendered panel rather than
reading the stylesheet, and then from the person who uses this every day finding seven
things the review and the renders both missed. Every one of those was something only
using it would show.

**Nothing the panel does moves the panel.** This was the whole of the second half. The
compare controls appeared on the first edit and pushed everything down 88px while
somebody was typing; pressing compare then replaced the body and collapsed the panel
511px, taking the button that had just been pressed with it; the status text beside that
button changed width and moved it 13px sideways. Hiding an element did the same as
compare, for the same reason. Inside the content, a refused value grew a row under its
field, a colour's alpha slider arrived mid-keystroke, and its recent-colours row arrived
on the first colour committed. All measured, all zero now, all guarded — and every guard
was confirmed to fail against the version that shipped.

The rule the fixes came from, worth keeping: *a control must not sit inside or below the
region its own action resizes, and chrome whose presence depends on state must not sit in
the flow above the content it modifies.* Stickiness protects against shifts from above,
not from a control's own action.

**The panel says what it is instead of naming CSS.** Every property row leads with what
the control does and carries the CSS name underneath. The change list an engineer
receives is unchanged — that is where the CSS name is load-bearing.

**Eight drawers became three groups**, and what an element *is* — its words, its picture,
where it points — sits above them with no disclosure at all. Colour used to be spread
across three drawers all offering something called colour.

**A style summary in the selection card**: four facts about the element, each a way back
to the control that sets it. It reads and never writes, which is what makes it safe.

**Dragging a property name changes its number.** The stylesheet had described this for as
long as the number-input rules existed and nothing was ever wired to it.

**Contrast, spacing and type became systems.** White on the dark accent was 1.92:1 —
every primary button in the product. Seventeen spacing values became six steps, nine type
sizes became four, with one rule over the scale: nothing localized below 12px.

---

# Fixed in 1.1.0

From the 2026-08-28 review. Each was verified before being believed, and each is guarded.

**A page's identity ignored the query, so one page's edits appeared on another's
content.** `youtube.com/watch?v=A` and `?v=B` were one page. The rule was written against
the parameters that say nothing — a shop's `?variant=`, a session id, a page number — and
never considered that on a great many sites the query is the only thing naming the
content. It now keeps the query minus the parameters that only describe how you arrived,
and sorts the rest so one page reached two ways stays one page. The share link inherits
the fix: built from that key, it carries what names the content and forwards none of the
sender's campaign tags.
*`lib/edits/page-identity.test.ts`, and `tests/e2e/editor.spec.ts` — "a share link lands
on the page it was made from, query and all".*

**A change switched off was still handed to an engineer.** Markdown summaries and share
links carried every record, with nothing marking which had been turned off. A JSON export
still keeps them — that is your own work moving between your machines, not a request to
somebody else.
*`lib/export/hand-off.test.ts`.*

**TinyPNG had no timeout.** `compress.ts` imported `fetchWithin` and then called bare
`fetch` twice, so a stall there hung the hand-off that was supposed to degrade to the
original image.

**White text on the accent was 1.92:1 in dark mode**, 3.77:1 in light — every primary
button in the product, including Keep, Agree and the popup's own Edit this page. Filled
controls now take an `--on-accent` token, dark ink on the bright accent and white on a
darker one, and tertiary text moved off a 2.69:1 grey. Contrast is arithmetic now rather
than something looked at.
*`lib/contrast.test.ts`, which reads the tokens out of the stylesheets.*

**Nine dev-dependency advisories, two critical**, down to three by upgrading `happy-dom`
past its VM-escape line and pinning the Firefox tooling pnpm pulls in for a browser this
project does not build for. None ever shipped: the store ZIP is 24 files of our own code.

---

# Fixed after 1.0.0

Each is guarded by the reproduction that found it, named here so the guard can be found
again.

**A move index the page cannot satisfy reapplied forever.** `moveToIndex` treated an
out-of-range index as "append", but the position it then reached could never equal the
index asked for, so the guard meant to make a second call a no-op never fired. Since the
applier reapplies on mutation, every pass wrote again — twenty times a second, silently,
for as long as the tab stayed open, and the only symptom was the battery. The index is
now clamped to what the page can offer, so the write lands and stops.
*`lib/edits/dom.test.ts` — "lands at the end, and stays there without writing again".*

**Importing collapsed several copies of one element into one.** `mergeRecords` treated
selector-and-property as identity, and every copy of a card writes `clone`/`clone` against
the same node. A page with three copies came back with one. Identity is the id now;
selector-and-property decides only which of two *replaceable* edits wins, which is what it
was always meant to decide. `revertRemoved` had already learned this; the merge had not.
*`lib/edits/import.test.ts` — "mergeRecords keeps every clone of one element".*

**An import that could not be stored said nothing.** A share for another page is written
straight to storage rather than through the controller, so the controller's failed-save
badge never spoke for it, and the rejection went into a floating promise. The import had
simply not happened, with nothing on screen saying so. It toasts now.
*`entrypoints/editor-main/components/ChangesTab.test.tsx` — "an import that cannot be
stored says so".*

**A carousel's frame became the record's original.** `refreshBaselines` follows a site
that settles on a new value — a price, a stock line. A carousel never settles, and
following each frame in turn left `oldValue` holding whichever picture the page was
passing through, so Reset restored that instead of the image the page shipped with. One
rewrite is still followed; a value that moves a second time is not a baseline, so what
arrived from storage goes back and that record stops being chased.
*`lib/applier/engine.test.ts` — "a value the site keeps changing is not mistaken for a new
baseline".*

**Escape during an upload still filled the clipboard.** Closing the editor does not stop
the worker, so the reply arrived at a component that no longer existed and the clipboard
took a link to an object the user believed they had cancelled. The hand-off now checks it
still has somewhere to deliver to.
*`entrypoints/editor-main/components/ShareRow.test.tsx` — "a hand-off abandoned by closing
the editor does not reach the clipboard".*

**An edit made just after a text edit bound to the wrong element.** A record's fingerprint
has to describe where its element started, and after a text edit the element holds our
words, not its own. `genFor` could not tell our write from the site's, so it re-minted and
stamped the next edit with the text the previous one had just written: rename a nav link
to match a sidebar link, colour it, and on reload the colour landed on the sidebar. The
controller now remembers what it wrote and keeps the fingerprint the element began with.
*`entrypoints/editor-main/controller.test.ts` — "an edit made after a text edit still
describes the element it was made on".*

**`pnpm audit:selectors` could not run at all.** The script calls `esbuild` directly, but
esbuild was never a declared dependency — only a transitive one, whose binary pnpm does
not link. The release gate in `qa-checklist.md` had therefore never run once. It is a
devDependency now.
