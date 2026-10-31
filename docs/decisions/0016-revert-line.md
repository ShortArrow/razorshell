# ADR-0016: revert-line restores the value a field held when it gained focus

Status: Accepted

## Context

readline's revert-line (M-r) undoes every change made to the line
since editing began. In bash a line begins at the prompt, so the point
to return to is well defined. A web text field has no prompt and no
line buffer of its own: it has a current `value`, a `defaultValue`
from the markup, and an undo history that belongs to the engine and
cannot be read from script. Alt+R is not a Chrome shortcut, so the
chord itself was free; the README listed it as not implemented.

## Decision

- A field's snapshot is its `value` when it gains focus. The content
  script records it on `focusin` (capture, composed path, so fields in
  open shadow roots count). A field that took focus before the script
  ran is recorded on its first keydown instead; a keydown precedes
  the edit it causes, so the value is still the pre-edit one. A new
  focus replaces the snapshot.
- Returning to a tab or window is not a new focus. Chrome fires a
  window `blur` as the tab or window loses focus and `focusin` on the
  still-active element when it comes back. The content script
  remembers the element active at the window `blur`, and a `focusin`
  on that element keeps its snapshot. The next `focusin` anywhere
  clears what was remembered, so a later refocus of the same field
  records again.
- The snapshots live in src/revertline.ts, a `WeakMap` per element
  shaped as plain state; the content script only wires the events.
  They go when the URL policy turns the frame off, as the kill ring
  does.
- Alt+R writes the snapshot over the whole value, every line of a
  textarea, through `execCommand("insertText")`, so the page sees an
  `input` event and Ctrl+Z takes the revert back. The caret lands at
  the end of the restored value. The snapshot stays, so a later edit
  in the same focus reverts to the same value.
- The key is left to the page when there is nothing to restore: no
  snapshot, a value equal to it, a readonly or disabled field.
- A password field is never recorded, and Alt+R there is left to the
  page. The check is repeated at the key, since a show-password toggle
  can switch a field to `type="password"` after its focus.
- Text fields only. A rich text root has no counterpart, so the chord
  stays the host editor's there.
- Not a kill: the entry carries no ring role, so a kill chain around
  it breaks.

## Criteria

The point readline returns to is where the user started editing, and
focus is the nearest event a page offers to that moment. A user
pressing Alt+R wants back what was in the box when they went into it,
not what the markup said at page load and not one line of it.

Razorshell promises that it keeps no text from a password field
(ADR-0010). A snapshot is text kept, so password fields get none.

## Alternatives rejected

- `defaultValue`. It is the value at page load, or whatever the page
  last assigned to the attribute. A form the page prefilled by script,
  or a field the user filled, left and came back to, would lose
  everything since load, and a page that never sets the attribute
  would empty the field.
- The caret's line in a textarea. readline's line is the whole
  buffer; a per-line snapshot would need a line identity that survives
  edits above it, which a plain string offers no way to keep.
- Repeated Ctrl+Z. It already exists, walks one step per press, and
  the engine gives no way to tell from script where the steps began.
- A rich text counterpart. Writing a snapshot of markup back into a
  host editor bypasses that editor's model, the reason the case
  operations have none.

## Cost

A `focusin` and a window `blur` listener per frame, a snapshot per
text field focused and the element active at the last window `blur`,
all held weakly. Known limits:

- A change the page makes by script does not move the snapshot. A chat
  box that clears itself after sending while focus stays in it gets the
  sent text back on Alt+R.
- The revert is one undo step on the engine's history, and a page that
  rebuilds its field on `input` sees one large replacement.
