# Known issues

Found in the pre-launch review, reproduced, and not fixed. Each says what goes wrong,
who it reaches, and why it is still here.

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

## Import reorders records, and order changes what a copy contains

`mergeRecords` puts survivors first and incoming last, and a clone takes its content from
the page as it stands when the clone is applied. So importing a share that touches an
element which is also duplicated can change what the duplicate says. Relatedly, several
clones of one element share a selector and a property, so importing collapses them into
one and a duplicated card silently disappears.

## An edit made just after a text edit can bind to the wrong element

Rename a nav link to match a sidebar link's wording, then change its colour: on reload the
colour lands on the sidebar link. The selector for the second edit is minted after the
first has already changed the words, so it is stamped with the new text, and resolution
follows the text.

## Failure paths that are silent

- **No network call has a timeout.** A hung upload spins until Chrome kills the worker,
  then reports a credentials problem to someone whose credentials are fine.
- **An import that fails is invisible.** No toast, no message. The import limit is 24MB
  while `chrome.storage.local` without `unlimitedStorage` is 10MB, so a large valid file
  validates and then vanishes.
- **Escape during an upload** tears down the editor but not the request: the clipboard
  still ends up holding a link to an object the user thought they had cancelled.
- **An out-of-range move index** makes the applier reapply about twenty times a second
  forever. Nothing is visibly wrong; it costs battery.
- **The site rewriting an edited attribute** overwrites the record's remembered original,
  so Reset restores whatever frame a carousel happened to be showing.

## Not supported, by design

Shadow DOM, iframes, canvas and WebGL. The editor says so when you hover them. See
[selection.md](selection.md).
