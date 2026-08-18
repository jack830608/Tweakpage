# Chrome Web Store submission

Everything the dashboard asks for, written against what the code actually does. Check
each claim before pasting: a listing that overstates the product is a rejection, and a
listing that contradicts the privacy policy is a worse one.

## Single purpose

> Tweakpage lets people visually propose changes to a web page, preview them locally,
> and export or deliberately share those proposals so someone can implement them.

Everything in the product serves that: the editor makes the proposal, storage replays it,
the hand-offs deliver it. S3 and TinyPNG are optional plumbing for the delivery step —
not a storage product, not a credential manager.

## Permission justifications

**`storage`**

> Keeps the user's page edits, proposals, notes and editor preferences on their own
> machine so a proposal survives a reload, and stores the optional sharing configuration
> they enter.

**`downloads`**

> Saves the JSON exports and the before/after screenshots the user asks for, to their
> Downloads folder.

**`<all_urls>`**

> Tweakpage is a general-purpose visual page editor: the user chooses which page to edit,
> so the extension cannot know in advance which sites it needs. Host access is also what
> lets previously saved edits replay when the user returns to a page they proposed
> changes on. On a page with no saved edits the extension performs a single local storage
> lookup and does nothing else — it does not read, transmit or store page content.
> Browsing data is never sold and never used for advertising.

Reviewer notes worth adding:

- The always-on content script is small; the editor itself is lazily loaded and only when
  the user opens it.
- Nothing is transmitted except through a hand-off the user presses, and the first time
  one would upload, the extension shows what is about to leave and waits for consent.
- Uploads go to a bucket the user configures; this project operates no server.

## Privacy practices — what to declare

| Category | Declare | Because |
| --- | --- | --- |
| Website content | Yes | The user's selections, text, attributes and styles on pages they edit |
| Web browsing activity | Yes | The page address is read to look up saved edits |
| User-generated content | Yes | Edits, notes, proposals, imported and exported JSON |
| Authentication information | Yes | AWS and TinyPNG keys, if the user enters them |
| Personal communications, financial, health, location | No | Not touched |

Also declare, and make sure each is true at submission time:

- Not sold to third parties.
- Not used or transferred for purposes unrelated to the single purpose above.
- Not used to determine creditworthiness or for lending.
- Transfers happen only to the user's own S3 bucket, and to tinify.com if the user
  switches compression on.

Privacy policy URL: the raw `PRIVACY.md` in this repository, or the same text on a page
you control.

## Short description (132 characters max)

> Visually edit any web page, compare before and after, and hand engineers a clear list
> of what to change.

## Long description

> Tweakpage turns "can we try making this bigger?" into something you can look at.
>
> Select anything on a page and edit it: copy, typography, colours, images, spacing,
> layout. Reorder sections, duplicate a card, hide what doesn't belong. Double-click text
> and type straight on the page. Flip between your version and the original with one
> switch.
>
> Your edits stay. They are saved on your own machine, per page, and replay when you come
> back — so you can live with a change for a day before deciding.
>
> When you're ready, hand it off. Copy a change list an engineer can act on: element,
> property, old value, new value, and your note explaining why. Or take one image with
> before and after side by side. Or send a link, if you have an S3 bucket of your own —
> whoever opens it needs Tweakpage and nothing else.
>
> Nothing leaves your computer unless you press something that sends it, and the first
> time that would happen, Tweakpage stops and tells you exactly what is about to go
> where. No account, no server, no analytics.

## zh-TW listing

**簡短說明**

> 直接在網頁上做視覺修改、對照前後差異,並交給工程師一份清楚的改動清單。

**完整說明**

> Tweakpage 讓「這裡可以放大一點嗎?」變成一個看得到的東西。
>
> 選取頁面上任何元素直接改:文案、字型、顏色、圖片、間距、版面。調整區塊順序、複製
> 一張卡片、隱藏不該出現的東西。雙擊文字就能直接在頁面上編輯。一個開關就能在你的版本
> 和原始版之間來回對照。
>
> 改動會留著。它們存在你自己的電腦上、依頁面分開,下次回來會自動重現 —— 所以你可以先
> 跟一個改動相處一天,再決定要不要。
>
> 準備好就交出去:複製一份工程師能直接動手的改動清單(元素、屬性、舊值、新值,還有你
> 寫的理由),或存成一張前後對照圖,或者你有自己的 S3 bucket 的話,送一條連結 ——
> 對方只需要裝 Tweakpage,不需要其他設定。
>
> 除非你按下會送出的按鈕,否則沒有任何東西離開你的電腦;而且第一次真的要送出時,
> Tweakpage 會停下來告訴你什麼東西要去哪裡。不用帳號、沒有伺服器、沒有分析追蹤。

## Assets

Sizes the dashboard requires. Every screenshot must be the shipping UI.

- [ ] Store icon 128×128 — have it (`public/icon/128.png`), but it is still the red-ish
      original while the UI is emerald. Redraw before submitting.
- [ ] Screenshots 1280×800 (or 640×400), 1–5 of them. Suggested: select and edit; before
      and after; the change list with a note; duplicate and reorder; the share link
      preview as the recipient sees it.
- [ ] Small promo tile 440×280.
- [ ] Marquee 1400×560 — only if the dashboard asks for it.

`pnpm shots` regenerates the screenshots from the live extension so they cannot drift
from the product.

## Before pressing submit

- [ ] `pnpm test` and `pnpm e2e` green
- [ ] `pnpm audit --prod` clean
- [ ] `pnpm package` — builds the ZIP, unpacks it, and drives that copy in a real
      browser (edit, reload, replay, and a credential-leak check)
- [ ] Load the unpacked ZIP by hand and run `docs/qa-checklist.md`
- [ ] The package contains no tests, no source maps, no `.env`, no real credentials
- [ ] The privacy policy URL resolves and matches the declared practices
- [ ] Version bumped
