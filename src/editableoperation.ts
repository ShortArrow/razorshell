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
 * Yank-pop is refused outright in contenteditable, and that is the v0.0.5
 * boundary. A pop is a replacement, and replacing needs proof that the recorded
 * range still holds exactly the text that was inserted. In a rich-text root
 * there is no offset pair that survives the host editor's own normalisation, so
 * the only honest options were an optimistic replace that can destroy text the
 * user wrote, or nothing. Nothing is what ships.
 */

import { beginYank, recordKill } from "./killring";

interface ModifiableSelection extends Selection {
  modify(alter: string, direction: string, granularity: string): void;
}

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
  recordKill({
    direction: direction === "forward" ? "forward" : "backward",
    text,
    elementToken: root,
    caretBefore: editableCaret,
    caretAfter: editableCaret,
    storable: true,
  });
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
  undo: (root) => undoInto(root),
  yank: (root) => yankInto(root),
};
