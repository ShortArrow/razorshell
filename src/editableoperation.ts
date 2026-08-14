/**
 * @file editableoperation.ts
 * @brief Selection API counterparts of the text field operations, for
 *        contenteditable roots where there is no value to slice.
 *
 * Movement goes through Selection.modify, which the engine resolves against the
 * rendered lines rather than the source text. Deletion extends the selection and
 * hands the removal to execCommand("delete") so the host editor still sees its
 * input event and keeps its undo history.
 */

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

function deleteToBoundary(direction: string): void {
  const current = selection();
  if (!current) return;
  current.modify("extend", direction, "lineboundary");
  if (current.isCollapsed) return;
  document.execCommand("delete");
}

export const editableOperation: Record<string, (root: HTMLElement) => void> = {
  move_cursor_to_the_beginning: () => move("backward", "lineboundary"),
  move_cursor_to_the_end: () => move("forward", "lineboundary"),
  move_cursor_to_the_next_character: () => move("forward", "character"),
  move_cursor_to_the_previous_character: () => move("backward", "character"),
  move_cursor_to_the_next_word: () => move("forward", "word"),
  move_cursor_to_the_previous_word: () => move("backward", "word"),
  delete_to_the_end_of_the_line: () => deleteToBoundary("forward"),
  delete_to_the_beginning_of_the_line: () => deleteToBoundary("backward"),
};
