# Knowing which element you picked

This is the part everything else rests on. The panel, the change list, the shared link
and the hand-off are all downstream of one question — which element did you mean — and
every bug in this project worth the name has been a way of answering it wrongly.

## The two failures, and which one to prefer

A resolver can fail in two directions.

**Refusing** shows up as *not found on this page* in the change list. The edit is not
applied, you can see that it is not applied, and nothing on the page is touched.

**Landing on the wrong element** shows up as your words appearing on content you never
picked. It is silent, it survives a reload, and it goes out in the shared link looking
like a real proposal.

Everything here is built to prefer the first. Where a rule had to choose, it chose the
failure that announces itself.

## How an element is found again

1. A selector anchored to a copy's stamp (`[data-tweakpage-clone="…"]`) resolves inside
   that copy or not at all.
2. Our mark — `[data-tweakpage~="<id>"]` — if it names exactly one element **and** that
   element still passes the identity test below.
3. The primary selector, then each fallback, taking the first that matches exactly one
   element and passes the identity test.
4. Failing that, the remembered text: one element of the same tag holding those words
   anywhere in the document. This is how an edit follows an element that moved.
5. Otherwise nothing, and the change list says so.

### The identity test

A whole-element text edit is recognised by its words. If the element a selector or a
mark points at holds neither the fingerprint nor the value we applied, it is not that
element. Two exceptions, both narrow:

- **The user is typing into it.** Mid-keystroke an element holds neither its old words
  nor its new ones. The inline session declares which element that is.
- **We wrote it, for this record.** The memo of what we wrote is keyed by record as well
  as element — keyed by element alone, one record's write vouched for every other
  record's claim on the same element.

Style, attribute, move and clone records are not held to their words: they sit on
elements whose text may legitimately change — a price, a counter, a translation.

## What survives a rebuild

Class names never carry a record on their own. `isStableClass` keeps hashed names out of
selectors: `product-selector_optIn__qe980`, `css-1x2y3z`, `sc-bdVaJa`, `emotion-…`,
`jss1` are all refused, while `text-white`, `px-4` and hand-written names are kept. A
deploy that only changes hashes changes nothing here — measured below at 100%.

What does break a record is the structure moving and, above all, the copy changing. The
words are the lifeline; an element with no text at all (an image, a bare div) has no
fingerprint and cannot be relocated when its position stops being true.

## What the numbers say

`pnpm audit:selectors` mints a record for 40 elements spread across a real page, moves
the page the way pages move, and asks the resolver to find them again. Ground truth is a
stamp put on each element before anything is disturbed.

Eight sites, six scenarios, two kinds of record, 40 elements each — 3840 resolutions.
The sample is every element with a box, not only the ones with words: images, icons and
empty containers are in it, and they turn out to be where the remaining trouble is.

| the page moved by | exact | drift | refused | **landed elsewhere** |
| --- | --- | --- | --- | --- |
| a reload | 99% | 1% | 1% | **0** |
| every class renamed by a rebuild | 100% | 0% | 0% | **0** |
| a block inserted above it | 82% | 1% | 12% | **40** |
| an extra wrapper div | 74% | 2% | 20% | **22** |
| a keyed list re-labelled in place | 14% | 17% | 70% | **0** |
| that copy replaced everywhere | 48% | 0% | 52% | **1** |

**63 wrong answers in 3840, and 60 of them are elements that had no words when they
were picked.** On elements with text — which is what a change list is usually about —
it is 3.

Both kinds of record are measured because the first version of this audit modelled every
sample as a whole-element text edit, which is the one kind held to its words. It reported
zero wrong answers while a colour edit could still take a positional hit and land on a
stranger; a review found that by hand, and the gate now covers every kind.

*exact* is the element the record was made from. *drift* is a different element now
holding the remembered words, which is the intended answer when an element moves.
*refused* found nothing. **Landed elsewhere is the bug, and it did not happen once.**

Sites: positivegrid.com (Next + CSS Modules + Tailwind), nuxt.com (Vue), svelte.dev,
angular.dev, tailwindcss.com, developer.mozilla.org, news.ycombinator.com (table
layout, no framework), wordpress.org.

Of 661 refusals, 557 were because those words had left the page entirely — there was
nothing to find, and refusing is the only correct answer.

### The limit that is left: an element with nothing to say

A record identifies its element by the words it held. An image, an icon, a spacer or an
empty container has none, so there is nothing to hold a candidate against, and when the
structure moves the positional selector's answer is taken on trust. That is all 60 of
the wrong answers above.

The obvious fix — hold those elements to their recorded class names instead — trades one
failure for another: a rebuild that renames every class currently costs nothing at all
(100% above), and making classes part of identity would turn that column into zeroes.
Which of the two matters more is a product decision, not a technical one, so it is
written down here rather than guessed at.

Until then: **an edit on an element with no text is positional, and structural drift can
move it.** Edits on text are not.

### A change that was measured and then not made

The remaining refusals are mostly ambiguity: several elements share the remembered text,
so relocation cannot choose. The recorded `context` chain could break some of those ties.
The audit counts how many: **38 of 661**. Recovering 6% of refusals — the visible,
harmless failure — is not worth giving context a vote in resolution and risking the
silent one. `context` stays recorded and never resolved against.

## What is refused outright

- **iframes** — a different document; the outline says so.
- **Inside a web component** — a shadow root is out of reach of `document.querySelector`,
  so a record made there can never replay. The outline says so at the moment you hover,
  rather than accepting the edit and doing nothing.
- **Anything matching an exclusion rule** — see *Areas to leave alone* in Settings.

## What the person receiving the hand-off gets

A selector says which element on this page. It does not say which component in a
repository, and that is the question somebody holding a change list is actually asking.
Each record carries a `context` chain: the element and its ancestors with their ids,
roles, aria-labels, test ids, authored class names (build hashes stripped) and the
nearest heading above the element.

Share of sampled elements whose record names the region it sits in:

| site | named region | something to grep for |
| --- | --- | --- |
| positivegrid.com | 100% | 100% |
| tailwindcss.com | 98% | 98% |
| developer.mozilla.org | 98% | 98% |
| nuxt.com | 95% | 95% |
| svelte.dev | 95% | 95% |
| wordpress.org | 95% | 98% |
| angular.dev | 93% | 93% |
| news.ycombinator.com | 73% | 73% |

The heading is what lifted this. Before it, an ancestor with an id, a role or an
aria-label was there for 8% of elements on Nuxt and 13% on Tailwind's own site, where
every class is a utility and nothing is named. Copy outlives markup, and a heading is
what a person would say if you asked them where on the page they meant.

Hacker News stays at 73% because it is a table with no headings and nothing to name.
That is honest rather than fixable.
