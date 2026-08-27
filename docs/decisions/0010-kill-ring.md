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
frame off — the entries and the yank record together, since a record
outliving the entries is a pop that cancels the key and does nothing
— so text killed while allowed cannot be yanked after a deny.

It holds plain text only, at most ten entries, and refuses any entry
over 100,000 UTF-16 code units. A kill in a password field happens
normally and is reported as unstorable: the text is never kept, and
the kill chain breaks around it so the secret cannot be concatenated
into a neighbouring entry.

Yank-pop verifies before it replaces, and the verification is text
AND place: the recorded region must still read back as exactly the
text that was inserted, and the caret must still rest collapsed at
that region's end. Otherwise it does nothing and does not even
cancel the key. In contenteditable it never runs at all — see the
cost below.

Whether the last command was a kill is tracked by the dispatcher,
which tells the ring whenever it runs a binding that carries no
`ringRole`. The honest reading of that: only *bound* keys report.
A keystroke matching no binding — an ordinary letter, an arrow key —
never reaches that path and never announces itself. The place half
of the yank-pop check is what covers the gap, because everything
unreported still moves the caret, and a caret that moved is a pop
refused. The role lives on the keymap entry rather than in a list
held beside it, so a binding added later declares its own relation to
the ring instead of the ring's correctness depending on a second file
being edited in step.

Both element references — the kill chain's and the yank record's —
are `WeakRef`. A page that removes a field after a kill would other-
wise leave the module pinning the detached element and its subtree
for the life of the frame, and nothing is given up by holding them
weakly: a chain or a record whose element is gone could never match
again anyway. A dead reference reads as a mismatch.

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

A contenteditable kill is always storable. The password exemption
keys off `input[type=password]`, and a rich-text root carries no
equivalent: a site may well collect a secret in a contenteditable
div, and nothing in the DOM says so. So the property the password
rule buys for `input` does not extend here, and a secret killed in
such an editor does enter the ring. Detecting it is not achievable
in this frame, so the boundary is stated rather than papered over.

There is a window before the first policy load resolves. The
listener is installed synchronously while `loadUrlPolicy` is still in
flight, and `enabled` starts true, so on a page the policy denies a
binding can act during those first milliseconds. What survives is
bounded: the ring clears the moment the policy resolves, so nothing
killed in the window can be yanked afterwards. What does not come
back is the killed text itself — the deletion already happened, and
clearing the ring does not undo it. Starting disabled instead would
trade this for bindings dead on every allowed page for as long as
storage takes, which is the worse failure.
