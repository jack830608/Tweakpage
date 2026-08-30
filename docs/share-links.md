<!-- Moved out of the README: it is one optional feature that needs an AWS account, and
     at 108 lines it was a third of a document people read to decide whether to install. -->

# Share links

Upload a page's edits to **your own** S3 bucket and share the link. Whoever opens it
needs Tweakpage and nothing else — no AWS account, no setup.

Opening a link **shows** the edits; it does not save them. The panel says they came from
someone else and offers **Keep on this page**, which is what puts them in the reader's
own storage. Look at a colleague's proposal, close the tab, and your copy of the page is
as it was.

## Setup

Credentials are entered on the extension's own settings page — panel gear → **Share
links** → **Open secure settings**, or right-click the toolbar icon → Options. They are
deliberately not editable from the panel: that panel is rendered inside whatever site
you are editing, and anything it displays is one `querySelector` away from that site's
own JavaScript. The panel shows whether sharing is configured, never with what.

Fill in bucket, region, access key id and secret (and optionally a TinyPNG key). Until
all four AWS fields are set, the Share link button stays disabled. This repo ships no
defaults.

Everything Tweakpage writes lives under one prefix, sorted by what it is, so a single
policy line covers the lot:

```
tweakpage/
  shares/<id>.json          the page a link points at
  images/<sha256>.<ext>     pictures those pages reference
```

## Images

An image picked from your machine (up to 1.5MB) is stored as data until it exists
somewhere else — right for this machine and useless in a share, where the bytes make the
page too big to survive the import limits and the recipient would quietly see the
original picture. A hand-off that uploads lifts each image into
`tweakpage/images/<sha256>.<ext>` and points at it instead.

The first time a hand-off would actually upload something, Tweakpage stops and says
what is about to leave: how many images, which bucket, that uploaded images are readable
by anyone with the link, that the local edit will point at the uploaded file afterwards,
and — if compression is on — that each image goes to tinify.com first. Saying "not now"
still completes the hand-off, with the images inside it. The answer is remembered per
bucket, and **Ask me again before uploading** in Settings takes it back.

Under gear icon → **Images**, one switch per hand-off — Copy summary, Copy JSON,
Download JSON, Share link — with **All hand-offs** above them to set the lot. All on by
default; with no bucket configured nothing uploads, so "on" means "upload when there is
somewhere to upload to".

Once an image is hosted, the local edit points at it too: the bytes were only ever the
right answer while the picture existed nowhere else. Storage stops carrying them, the
change list reads as a URL instead of a wall of base64, and this page describes the
image the same way the shared one does.

An image is named after its own content and remembered once uploaded, so sharing the
same picture again costs neither a second upload nor a slice of the TinyPNG quota. The
remembered URL is checked before it is reused — an emptied bucket means a fresh upload,
not a broken link.

- Switch one off to keep that hand-off self-contained: the images travel inside it and
  the local edit keeps its bytes. They still arrive — hosting is what keeps a share
  small, not what makes it work — but a page carrying several pictures can grow past the
  8MB a share is allowed to be, and then the share is refused with a reason rather than
  handed over broken.
- A summary that could not upload names each image and its size rather than pasting
  hundreds of kilobytes of base64 into your ticket.
- **TinyPNG** — paste a [tinify.com](https://tinypng.com/developers) key and switch on
  **Compress with TinyPNG first** to shrink images before they are uploaded. It sends
  the image to a third party, which is why the switch is separate from the key. If the
  month's free quota runs out or the service is down, the original is uploaded instead —
  a share is never blocked by it.

The key needs to write, and to be allowed to mark what it writes as readable:

```json
{ "Effect": "Allow", "Action": ["s3:PutObject", "s3:PutObjectAcl"],
  "Resource": "arn:aws:s3:::YOUR_BUCKET/tweakpage/*" }
```

Then the bucket has to let a stranger read a share — either a bucket policy:

```json
{ "Effect": "Allow", "Principal": "*", "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::YOUR_BUCKET/tweakpage/*" }
```

or leave ACLs enabled with Block Public Access off, and Tweakpage marks each file public
as it uploads. Either way it verifies: after writing, it reads the object back with no
credentials, exactly as a recipient would, and refuses to hand you a link that would 403.

## What to know before pasting a key

- Extension storage is not a vault: anyone with access to the browser profile can read
  what you paste, and this extension is open source. Use a key that can do nothing
  except write that one prefix, and rotate it like any other credential. The secret
  never leaves the machine — requests carry a signature derived from it.
- The object name is 113 bits of randomness, so the link is the permission — but the
  file is readable by anyone holding it. Don't share pages whose content is
  confidential. A lifecycle rule on `tweakpage/shares/` expires old links; one on
  `tweakpage/images/` expires pictures, which are content-addressed and therefore shared
  between every link that used the same image — expire them and older links lose their
  pictures, not just the one you had in mind.
- A link carries an id, bucket and region as separate validated parts — never a URL —
  so it can only resolve to an address Tweakpage builds itself, and what arrives is
  validated exactly like an imported file.
