# ADR-0017: the reclaimed chords act in rich text editors, and Ctrl+T refuses to cross a formatting boundary

Date: 2026-10-26
Status: accepted

## Context

An assigned Ctrl+W or Ctrl+T reaches the frame that owns focus
through the routing ADR-0011 decides, and with the rich text option
on, that frame may hold a contenteditable root rather than a field.

A rich text root has no value. Its text is spread over Text nodes, and
the formatting lives on the elements around them: in `ab<b>cd</b>` the
`b` and the `c` are in different nodes. readline's transpose-chars
swaps the character before the point with the one at it, wherever they
are, so at that boundary it would carry `c` out of the bold and `b`
into it.

## Decision

- Both operations act in a contenteditable root while the rich text
  option is on. They live in src/editableoperation.ts, and the
  content script's run arm dispatches on what `focusedField()`
  returned: a text field takes the field operation, a root the rich
  text one. Gating by `ownsFocus`, the URL policy and the option is
  unchanged, and with the option off nothing changes.
- unix-word-rubout walks the Selection back one engine `character` at
  a time, first over whitespace and then over non-whitespace, stepping
  back once when a step takes in the wrong class, the way
  delete-horizontal-space measures its run. Whitespace is the field
  version's: space, tab, newline and carriage return. A block boundary
  reads back as a newline and is therefore whitespace, so at the start
  of a block the rubout joins it to the previous block and takes that
  block's last word, as it takes a textarea's newline. The span goes
  through `execCommand("delete")` and onto the kill ring as a backward
  kill on the root, the record the line and word kills make. A
  non-collapsed selection is collapsed to its start first, so the
  selected text survives as it does in a field.
- transpose-chars needs a collapsed caret in a Text node, or between
  an element's children next to one. It swaps two graphemes only when
  both lie in that node, using `transposeCharsEdit` on the node's
  data; the decision is `transposeWithinTextNode` in
  src/reclaimedregion.ts. Anywhere else it does nothing, but the chord
  is still consumed, so no tab opens. The swap selects the two
  graphemes in the node and replaces them with
  `execCommand("insertText")`, so the node keeps its formatting, the
  editor sees the input and Ctrl+Z takes it back. It stays off the
  ring, and the kill chain breaks around it as in a field.
- End of line is measured only when the caret is at the end of its
  node, the one place it changes the answer. The probe extends the
  selection one character forward and reads it back, then restores
  the caret. Nothing read is the end of the root; a newline is a
  `<br>`, a block boundary or a preformatted newline. Either is the
  end of the line, and the two graphemes before the caret swap if both
  are in the node. Anything else is more of the line in another node,
  and the transpose refuses.

## Criteria

A rich text editor's formatting is the user's work, and a chord that
silently unbolds a letter damages it in a way they may not notice
until later. Refusing at a node boundary costs a no-op in a minority
of positions; letters inside one run of formatting, which is most of
them, transpose as readline does.

The probe asks the engine rather than the markup because only the
engine knows what renders next: an empty element, collapsed
whitespace or a hidden node after the caret say nothing about whether
the line goes on. It is asked only at a node's end, so most
transposes cost no selection change at all.

The rubout keeps the field's whitespace so that one chord means one
thing in both kinds of field, and the walk reads rendered characters
for the reason ADR-0005 gives for `Selection.modify`.

## Alternatives rejected

- Swapping across the boundary as plain text: select both characters
  across the nodes and insert the swapped pair. The engine applies
  one format to the inserted text, so one character always lands in
  the other's formatting.
- Leaving the no-op in place: the tab is safe but the chord does
  nothing in the editors where a user who assigned it types most.
- Rearranging the nodes so each character keeps its formatting: that
  rebuilds the editor's markup from outside its model, the reason
  ADR-0005 routes every edit through `execCommand`.

## Cost

The probe moves the selection and puts it back, so an editor that
listens to `selectionchange` sees two changes for one transpose at a
node end. The rubout runs one `modify` per character it takes, plus
one per back-off. Neither `Selection.modify` nor `execCommand` exists
in jsdom, so the walk and the in-node rule are unit-tested against a
fake selection and as a pure function, and the engine half rests on
the e2e suite.
