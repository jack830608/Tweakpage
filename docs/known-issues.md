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

## Not supported, by design

Shadow DOM, iframes, canvas and WebGL. The editor says so when you hover them. See
[selection.md](selection.md).

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
