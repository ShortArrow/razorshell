# ADR-0010: The kill ring is frame-local and never persisted

Date: 2026-08-27
Status: accepted

## Context

Ctrl+K and Ctrl+U destroyed their text. The field's undo stack could
bring it back in place (ADR of 0.0.4, C1.14), but readline's actual
bargain is different: what you kill you can put back somewhere else,
in the order you killed it. That needs somewhere to keep the text
between the kill and the yank, and choosing that place decides how
far the text travels and how long it lives.

The obvious candidates carry the text further than the user asked.
`chrome.storage.sync` would put every killed line on Google's sync
transport and into the 100 KB quota that A4 already constrains, and
would hold it across restarts. `storage.local` drops the transport
and keeps the persistence. A background service worker would make
one ring for the whole browser, which sounds like a feature until a
password manager's iframe and a bank's login form share it.

Kills happen in password fields too — Ctrl+U in a password box is a
common way to clear it — so whatever holds killed text will be
offered secrets on the first day.

## Decision

The ring is module state in the content script (src/killring.ts), so
it is per frame: the top document and each same-process iframe get
their own, and nothing crosses between them. It is never written to
any storage area, so it dies with the frame and no restart or sync
carries it. `applyUrlPolicy` clears it whenever the policy turns the
frame off, so text killed while allowed cannot be yanked after a
deny.

It holds plain text only, at most ten entries, and refuses any entry
over 100,000 UTF-16 code units. A kill in a password field happens
normally and is reported as unstorable: the text is never kept, and
the kill chain breaks around it so the secret cannot be concatenated
into a neighbouring entry.

Yank-pop verifies before it replaces. It runs only when the last
command was a yank or a pop and the recorded region still reads back
as exactly the text that was inserted; otherwise it does nothing and
does not even cancel the key. In contenteditable it never runs at
all — see the cost below.

## Criteria

Killed text is the user's, and it is often a password, a token or a
URL with a session in it. The safe default for such a thing is the
shortest life and the smallest blast radius that still makes the
feature work: a yank follows its kill by seconds, in the same frame,
so a frame-local, non-persistent ring covers the real use and
nothing more. Every property that would extend its reach — sync,
persistence, a shared background ring — buys convenience nobody
asked for with exposure everybody would have to trust.

## Alternatives rejected

- A ring in `storage.sync` or `storage.local`: persisting killed
  text means a password typed and cleared today is readable
  tomorrow, and in the `sync` case leaves the device entirely. The
  8 KB per-item and 100 KB total quotas (A4) would also make a long
  kill a storage failure rather than a kill.
- One ring in the service worker, shared by every frame and tab: the
  iframe case decides it. A page can embed a login form it does not
  own, and a shared ring lets one origin's kill be yanked into
  another's field.
- Storing password-field kills but marking them: a mark is only as
  good as every future reader of the ring. Not storing the text is
  the property; a flag beside the text is a promise about code that
  has not been written yet.
- Optimistic yank-pop that replaces the recorded range without
  checking it: when the record is stale the replacement lands on
  text the user wrote, and deletes it. A pop is a convenience; no
  convenience justifies a destructive write aimed at a range nobody
  verified.

## Cost

Each frame keeps its own ring, so a kill in one iframe cannot be
yanked in another — inside a single page this may read as the
feature not working. Nothing survives a reload, which is a real
difference from an editor's kill ring, and users who expect Emacs's
persistence across sessions will not find it.

In contenteditable the ring is looser and smaller. There is no caret
offset to compare in a rich-text root, so a chained kill is
recognised by the root element and the last-command flag alone: an
arrow key that moves within the same root is invisible, and the next
kill still concatenates. Yank-pop is refused there outright, which
is the v0.0.5 boundary — verifying a recorded range in markup the
host editor normalises is not achievable with the Selection API
alone, and the alternative was the optimistic replace rejected
above. Yank itself works, inserting plain text.
