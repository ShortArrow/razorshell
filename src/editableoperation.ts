/**
 * @file editableoperation.ts
 * @brief Selection API counterparts of the text field operations, for
 *        contenteditable roots where there is no value to slice.
 *
 * Movement goes through Selection.modify, which the engine resolves against the
 * rendered lines rather than the source text. Deletion extends the selection and
 * hands the removal to execCommand("delete") so the host editor still sees its
 * input event and keeps its undo history.
 *
 * The kill ring reaches into these operations with a weaker chain check than the
 * text-field side has. There is no caret offset to compare here — a
 * contenteditable's selection is a node and an offset inside arbitrary markup,
 * not an index into a value — so a chained kill is recognised by the root
 * element and the last-command flag alone. An arrow key that moves the caret
 * within the same root is therefore invisible: the kill after it still
 * concatenates. That is a known looseness, not an oversight.
 *
 * Yank-pop is refused outright in contenteditable, and that is where the
 * boundary falls: killing and yanking are in scope for a rich-text root, popping
 * a yank back is not. A pop is a replacement, and replacing needs proof that the
 * recorded range still holds exactly the text that was inserted. In a rich-text root
 * there is no offset pair that survives the host editor's own normalisation, so
 * the only honest options were an optimistic replace that can destroy text the
 * user wrote, or nothing. Nothing is what ships.
 */

import { beginYank, recordKill } from "./killring";
import { isRuboutWhitespace, transposeWithinTextNode } from "./reclaimedregion";

interface ModifiableSelection extends Selection {
  modify(alter: string, direction: string, granularity: string): void;
}

/** The two members of a Selection the character walks use. */
export type CharacterStepper = Pick<ModifiableSelection, "modify" | "toString">;

function selection(): ModifiableSelection | null {
  const current = window.getSelection();
  if (!current) return null;
  if (typeof (current as ModifiableSelection).modify !== "function") return null;
  return current as ModifiableSelection;
}

function move(direction: string, granularity: string): void {
  const current = selection();
  if (!current) return;
  current.modify("move", direction, granularity);
}

/**
 * Extends by one unit of `granularity` and removes it, reporting what was taken
 * to the ring. The text has to be read off the selection before the delete,
 * because afterwards there is nothing left to read.
 *
 * The line kills pass `lineboundary` and the word kills `word`; both are kills,
 * so both record, and the chain rules they meet are the ring's own.
 *
 * A `lineboundary` extend that collapses means the caret already sits at the end
 * of its line, and one character forward is then the block boundary. Extending
 * by that character and deleting it joins the two blocks — the contenteditable
 * analog of `endOfLineRegion` taking the newline, and what makes consecutive
 * Ctrl+K in a rich-text root walk through the document instead of stalling.
 *
 * What lands on the ring is whatever the selection reports for that extend, not
 * a `"\n"` this code writes: a block boundary in markup is an element edge, and
 * the engine is the only thing that can say what text it stands for. Where the
 * character extend also collapses there is nothing after the caret at all, and
 * the kill is a no-op exactly as it is at the end of a value.
 */
function deleteToBoundary(
  root: HTMLElement,
  direction: string,
  granularity = "lineboundary",
): void {
  const current = selection();
  if (!current) return;
  current.modify("extend", direction, granularity);
  if (current.isCollapsed) {
    if (granularity !== "lineboundary") return;
    current.modify("extend", direction, "character");
    if (current.isCollapsed) return;
  }
  const text = current.toString();
  document.execCommand("delete");
  recordEditableKill(root, direction === "forward" ? "forward" : "backward", text);
}

/**
 * Extends by one unit of `granularity` and removes it without telling the ring.
 *
 * The character deletes are not kills, so unlike `deleteToBoundary` nothing is
 * recorded — which is also what lets the dispatcher's foreign-command report
 * break a kill chain around them. Granularity is the engine's own, so what one
 * press removes is what the engine calls one character: it deletes emoji and
 * combining sequences whole, the same property `nextGraphemeRegion` buys on the
 * text-field side by a different route.
 */
function deleteByGranularity(direction: string, granularity: string): void {
  const current = selection();
  if (!current) return;
  current.modify("extend", direction, granularity);
  if (current.isCollapsed) return;
  document.execCommand("delete");
}

/**
 * Removes the spaces and tabs around the caret without telling the ring, the
 * counterpart of `operation.deleteHorizontalSpace`.
 *
 * There is no value to scan, so the run is measured by growing the selection
 * one engine `character` at a time and reading it back: forward from the caret
 * until the selected text stops being all blank, one step back, collapse to
 * that end, then the same walk backward across the whole run. The selection
 * then covers the run, and `execCommand("delete")` removes it through the
 * host editor's own history, leaving the caret at its start. With nothing
 * selected at the end there was no blank at the caret, and nothing is deleted.
 *
 * A non-collapsed selection is measured from its end, as the text-field side
 * reads `selectionEnd`.
 *
 * Limits, all the engine's: a step is a rendered character, so under
 * `white-space: normal` a run the engine collapses into one visible space is
 * walked as that one space, and what the delete removes is what the engine
 * says the selection covers. A no-break space is text here as on the field
 * side, which includes the U+00A0 an editor writes when a user types two
 * spaces in a row: such a run is removed only up to it. A block boundary reads
 * back as a newline and ends the run like one.
 */
function deleteHorizontalSpaceInto(): void {
  const current = selection();
  if (!current) return;
  current.collapseToEnd();
  extendWhile(current, "forward", "backward", isBlankRun);
  current.collapseToEnd();
  extendWhile(current, "backward", "forward", isBlankRun);
  if (current.isCollapsed) return;
  document.execCommand("delete");
}

function isBlankRun(text: string): boolean {
  return /^[ \t]+$/.test(text);
}

/**
 * Extends the selection a character at a time while what it holds satisfies
 * `holds`, stepping back once when a step makes it fail. A step that adds
 * nothing is the edge of the editable content, and ends the walk.
 */
function extendWhile(
  current: CharacterStepper,
  direction: "forward" | "backward",
  opposite: "forward" | "backward",
  holds: (text: string) => boolean,
): void {
  let held = current.toString().length;
  for (;;) {
    current.modify("extend", direction, "character");
    const text = current.toString();
    if (text.length <= held) return;
    if (!holds(text)) {
      current.modify("extend", opposite, "character");
      return;
    }
    held = text.length;
  }
}

/**
 * Kills back over the whitespace behind the caret and the word before it,
 * the counterpart of `operation.unixWordRubout`, and records the kill on the
 * ring as the line and word kills do.
 *
 * A non-collapsed selection is collapsed to its start first, so the rubout
 * takes what precedes the selection and the selected text survives, as the
 * field version reads `selectionStart`. The selection itself does not: what
 * is left is the caret where the deleted text began.
 */
function unixWordRuboutInto(root: HTMLElement): void {
  const current = selection();
  if (!current) return;
  current.collapseToStart();
  extendOverUnixWord(current);
  if (current.isCollapsed) return;
  const text = current.toString();
  document.execCommand("delete");
  recordEditableKill(root, "backward", text);
}

/**
 * Extends a collapsed selection backward over what `unixWordRuboutRegion`
 * would remove in a field: whitespace, then the non-whitespace before it,
 * with whitespace as `isRuboutWhitespace` defines it.
 *
 * The text is read off the selection a rendered character at a time, so a
 * block boundary is whatever the engine reports for it, which is a newline.
 * A boundary is therefore whitespace here as a newline is in a textarea: at
 * the start of a block the rubout takes the boundary and the previous block's
 * last word, joining the two blocks, and mid-block it stops at the boundary.
 * A no-break space is text, so a run an editor wrote as U+00A0 belongs to the
 * word.
 */
export function extendOverUnixWord(current: CharacterStepper): void {
  extendWhile(current, "backward", "forward", isWhitespaceRun);
  extendWhile(current, "backward", "forward", isWordThenWhitespace);
}

function isWhitespaceRun(text: string): boolean {
  return text !== "" && Array.from(text).every(isRuboutWhitespace);
}

function isWordThenWhitespace(text: string): boolean {
  let end = text.length;
  while (end > 0 && isRuboutWhitespace(text[end - 1])) end -= 1;
  return end > 0 && !Array.from(text.slice(0, end)).some(isRuboutWhitespace);
}

/**
 * Swaps the two graphemes at the caret, the counterpart of
 * `operation.transposeChars`, inside one text node or not at all.
 *
 * The caret must be collapsed and resolve to a Text node in the root; the
 * swap is `transposeWithinTextNode` on that node's data, which refuses a swap
 * that would move a character across a node boundary and so out of its
 * formatting. A refusal changes nothing. The edit selects the two graphemes
 * inside the node and replaces them through `execCommand("insertText")`, so
 * the text keeps the node's formatting, the host editor sees the input and
 * Ctrl+Z takes it back; the caret lands after both.
 *
 * Whether the caret ends the line is asked only at the node's end, where it
 * decides between the end-of-line swap and a refusal; `endsLine` measures it.
 */
function transposeCharsInto(root: HTMLElement): void {
  const current = selection();
  if (!current || !current.isCollapsed) return;
  const caret = textCaret(current);
  if (!caret || !root.contains(caret.node)) return;
  const { node, offset } = caret;
  const atLineEnd = offset >= node.data.length && endsLine(current, node, offset);
  const edit = transposeWithinTextNode(node.data, offset, atLineEnd);
  if (!edit) return;
  current.setBaseAndExtent(node, edit.start, node, edit.end);
  document.execCommand("insertText", false, edit.text);
}

/**
 * The Text node and offset a collapsed caret sits at. A caret the engine
 * placed between an element's children resolves to the end of a Text node
 * before it or the start of one after it; anywhere else there is none.
 */
function textCaret(current: Selection): { node: Text; offset: number } | null {
  const { focusNode, focusOffset } = current;
  if (focusNode instanceof Text) return { node: focusNode, offset: focusOffset };
  if (!focusNode) return null;
  const before = focusNode.childNodes[focusOffset - 1];
  if (before instanceof Text) return { node: before, offset: before.data.length };
  const after = focusNode.childNodes[focusOffset];
  if (after instanceof Text) return { node: after, offset: 0 };
  return null;
}

/**
 * Whether the caret at the end of `node` also ends its line, probed by
 * extending one rendered character forward and reading what that takes in,
 * then putting the caret back where it was.
 *
 * Nothing taken in is the end of the root, so the end of its last line. A
 * newline is a line break: a `<br>`, a block boundary or a newline in
 * preformatted text, which the engine all reads back as `"\n"`. Anything else
 * is more of the line in another node. A soft wrap is not a line end, since
 * readline's line is the logical one.
 */
function endsLine(current: ModifiableSelection, node: Text, offset: number): boolean {
  current.modify("extend", "forward", "character");
  const ahead = current.toString();
  current.collapse(node, offset);
  return ahead === "" || /^[\r\n]+$/.test(ahead);
}

/**
 * Steps the host editor's own undo history back one entry, the counterpart of
 * `operation.undo`. Nothing is spliced when the engine refuses — an undo stack
 * cannot be rebuilt from outside, least of all in markup the editor normalises.
 */
function undoInto(root: HTMLElement): void {
  root.focus();
  document.execCommand("undo");
}

/**
 * The stand-in for a caret offset in a contenteditable root.
 *
 * A rich-text selection has no single number to compare, so every CE kill
 * reports the same value for both the caret it started from and the one it
 * left, and the chain rests on the root and the last-command flag alone — the
 * looseness the file header describes. Reporting one constant for both is what
 * keeps consecutive CE kills chaining under a comparison that is otherwise
 * asymmetric; the text-field side is where the two positions really differ.
 */
const editableCaret = 0;

/**
 * Selects everything under the root and removes it as one kill, the
 * counterpart of `operation.killWholeField`. The text goes on the ring as the
 * selection reports it, and an empty root is not an event.
 */
function killAllInto(root: HTMLElement): void {
  const current = selection();
  if (!current) return;
  root.focus();
  current.selectAllChildren(root);
  const text = current.toString();
  if (text === "") return;
  document.execCommand("delete");
  recordEditableKill(root, "backward", text);
}

/** Reports a rich text kill to the ring, under the chain rules the file header describes. */
function recordEditableKill(root: HTMLElement, direction: "forward" | "backward", text: string): void {
  recordKill({
    direction,
    text,
    elementToken: root,
    caretBefore: editableCaret,
    caretAfter: editableCaret,
    storable: true,
  });
}

/** Inserts ring text as plain text, so nothing carries markup into the editor. */
function yankInto(root: HTMLElement): void {
  const text = beginYank();
  if (text === undefined) return;
  root.focus();
  document.execCommand("insertText", false, text);
}

export const editableOperation: Record<string, (root: HTMLElement) => void> = {
  move_cursor_to_the_beginning: () => move("backward", "lineboundary"),
  move_cursor_to_the_end: () => move("forward", "lineboundary"),
  move_cursor_to_the_next_character: () => move("forward", "character"),
  move_cursor_to_the_previous_character: () => move("backward", "character"),
  move_cursor_to_the_next_word: () => move("forward", "word"),
  move_cursor_to_the_previous_word: () => move("backward", "word"),
  delete_to_the_end_of_the_line: (root) => deleteToBoundary(root, "forward"),
  delete_to_the_beginning_of_the_line: (root) => deleteToBoundary(root, "backward"),
  kill_word: (root) => deleteToBoundary(root, "forward", "word"),
  backward_kill_word: (root) => deleteToBoundary(root, "backward", "word"),
  delete_char: () => deleteByGranularity("forward", "character"),
  backward_delete_char: () => deleteByGranularity("backward", "character"),
  delete_horizontal_space: () => deleteHorizontalSpaceInto(),
  undo: (root) => undoInto(root),
  yank: (root) => yankInto(root),
  kill_whole_field: (root) => killAllInto(root),
};

/** The rich text counterparts of the two reclaimed chords' operations (ADR-0017). */
export const editableReclaimedOperation = {
  unixWordRubout: unixWordRuboutInto,
  transposeChars: transposeCharsInto,
};
