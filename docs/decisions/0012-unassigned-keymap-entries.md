# ADR-0012: bindings that shadow an everyday browser key ship unassigned in the keymap

Date: 2026-09-15
Status: accepted

## Context

readline's line discard, accept-line and Emacs' open-line sit on
Ctrl+C, Ctrl+J and Ctrl+O. In Chrome those chords are copy, the
downloads page and the open-file dialog. None is a reserved chord:
unlike Ctrl+W and Ctrl+T (ADR-0011) the keydown reaches the page,
and a content script can cancel it the way Ctrl+D and Ctrl+H are
already cancelled inside a text field. The commands API route is
therefore not needed, and the two-arm "pay back the browser action"
routing does not apply — outside a text field the extension never
sees these keys as its own.

What does carry over from ADR-0011 is the opt-in. On 2026-09-09 a
probe (scratch, not committed) rebound `yank` to Ctrl+V and observed
what a user would: paste works while the ring is empty and silently
turns into a yank once anything has been killed. A chord the user
presses hundreds of times a day, taken by default, reads as a bug in
the extension however faithfully it follows readline. Copy is such a
chord. Ctrl+J and Ctrl+O are rarer, but inside a text field a user
who has not asked for them expects the browser's own meaning.

The keymap model has no way to say "this entry exists but is bound
to nothing". Every entry carries a chord and matches it.

## Decision

- A keymap entry may be marked `unassigned`. Its `key` and modifier
  fields then hold the SUGGESTED chord — what the default column
  shows and what the README documents — and the entry matches no
  keystroke at all.
- Assigning is a rebind: the user captures a chord on the row, the
  gui override layer stores it, and the merged entry is bound. Reset
  on the row, or reset-all, returns it to unassigned. The override
  layer is unchanged in shape, so settings export and import carry
  an assignment as they carry any other override.
- An unassigned entry takes no part in conflict detection or in the
  inspector's conflict report: a chord nothing matches conflicts
  with nothing.
- The options page grays an unassigned row's reading cells and prints
  `—` in the current column, as the browser-managed rows do; the
  rebind button is the assign affordance.
- Three entries ship this way:
  - `kill_whole_field`, suggested Ctrl+C: kills the whole value of
    the field — every line of a textarea — onto the ring. bash's
    Ctrl+C discards the whole buffer; putting it on the ring is the
    one departure, so a slip is one Ctrl+Y from undone.
  - `accept_line`, suggested Ctrl+J: readline's accept-line, which is
    Enter. Inside an input the form is submitted; inside a textarea
    a newline is inserted.
  - `open_line`, suggested Ctrl+O: Emacs' open-line. A newline is
    inserted at the caret and the caret stays before it. In an input,
    which cannot hold a newline, nothing happens and the key is left
    to the browser.
- Ctrl+Shift+O is not among them.

## Criteria

Unassigned-by-default is what makes shipping these safe. A user who
wants readline's Ctrl+C assigns it once and has knowingly traded
copy inside text fields for it; a user who never opens the keymap
table loses nothing. The same table row and the same override layer
serve both the reclaimed rows of ADR-0011 and these, so the user
learns one gesture.

The suggested chord is data on the entry rather than a separate
list so that the README, the default column and the assignment
capture all read the same value, and `test/readmekeymap.test.ts`
keeps the README in step with it exactly as it does for the bound
defaults.
