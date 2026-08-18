# Tweakpage privacy policy

Last updated: 2026-08-19

Tweakpage is a browser extension for visually proposing changes to a web page. This
policy describes exactly what it reads, what it keeps, and the two cases where anything
leaves your computer. It is written against the code in this repository; if you find a
difference between this document and what the extension does, that is a bug — please
open an issue.

## The short version

- Your edits are stored **on your computer**, in extension storage, keyed by the page's
  address.
- Nothing is sent anywhere unless you press a button that sends it, and the first time
  that would happen the extension stops and tells you what is about to leave.
- The only destinations are **your own S3 bucket** and, if you choose to switch it on,
  **tinify.com** for image compression.
- The developer receives nothing. There is no analytics, no telemetry, no crash
  reporting, no server operated by this project.

## What Tweakpage reads

It runs on the pages you visit so that edits you saved earlier can be replayed. On every
page it reads the address to look up whether you have saved anything for it. If you have
not, nothing else happens and nothing is stored.

When you open the editor on a page, it reads the parts of that page you interact with:
the elements you hover and select, their text, attributes and computed styles, and the
page title.

## What is stored, and where

All of it in `chrome.storage.local` on your computer:

| Stored | Why |
| --- | --- |
| Your edits, per page address (without its query string) | So they can be replayed after a reload |
| The page's title and the width you edited at | So a hand-off can say what was changed and where |
| Notes you write on a change | They travel with the hand-off |
| Proposals you save | So two directions can be compared |
| Images you pick from your machine | Held as data until they exist somewhere else |
| Editor preferences (theme, panel size and position) | So the editor looks the same next time |
| AWS and TinyPNG credentials, if you enter them | To sign uploads to your bucket |
| Which buckets you have agreed to upload to | So you are asked once rather than every time |

Credentials can only be entered and read on the extension's own settings page. They are
never rendered into the page you are editing, because anything shown there is readable
by that site's own JavaScript.

Extension storage is not encrypted. Anyone with access to your browser profile can read
it, including the credentials. Use an AWS key scoped to a single prefix, and rotate it
as you would any other.

## What leaves your computer, and when

Nothing leaves except through an action you take.

**Share links and hand-offs that upload.** When you press Share link — or Copy summary,
Copy JSON or Download JSON with uploading switched on for that hand-off — the page's
edits and any images you picked are uploaded to the S3 bucket **you configured**. The
first time this would happen for a given bucket, the extension shows what is about to
leave and waits for you to agree. You can decline, in which case the hand-off completes
with the images inside it and nothing is uploaded. You can withdraw the agreement in
Settings.

Objects uploaded this way are made publicly readable, because the point of a link is
that the person you send it to can open it without an AWS account. The object name is
113 bits of randomness, so the link is the permission — but anyone holding the link can
read the file. Do not share pages whose content is confidential.

**TinyPNG.** Off by default. If you enter a tinify.com key and switch compression on,
each image is sent to tinify.com before it is uploaded to your bucket. Their handling of
it is governed by their own privacy policy.

**Screenshots and JSON exports** are saved to your Downloads folder. They do not leave
your computer.

## What the developer receives

Nothing. This project operates no server and collects no data. Your edits, your pages,
your images and your credentials are on your computer and in infrastructure you control.

## Data is not sold or used for advertising

Tweakpage does not sell or transfer your data to third parties except as described
above (your own bucket; tinify.com if you switch it on). It is not used for advertising,
for building profiles, for creditworthiness or lending, and it is not read by any human
associated with this project.

## Deleting your data

- **One page's edits**: click the toolbar icon and press Clear beside that page, or
  Revert all in the editor.
- **Everything stored locally**: remove the extension. Chrome deletes its storage,
  including the credentials.
- **Objects already uploaded**: they are in your bucket and only you can delete them.
  Removing the extension does not remove them. A lifecycle rule on `tweakpage/shares/`
  expires links; one on `tweakpage/images/` expires the pictures, which are shared
  between every link that used the same image.

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `storage` | To keep your edits, preferences and settings on your computer |
| `downloads` | To save the JSON exports and screenshots you ask for |
| `<all_urls>` | Tweakpage is a general-purpose page editor: it has to be able to run on whatever page you choose to edit, and to replay edits you saved there earlier |

`<all_urls>` is the broadest of these and worth being precise about. On a page with no
saved edits, the extension performs one storage lookup and does nothing else — it does
not read, transmit or store the page's content. The editor itself is loaded only when
you open it.

## Contact

Issues and security reports: <https://github.com/jack830608/Tweakpage/issues>
