import { editableOperation } from "./editableoperation";
import { getMessage } from "./languages";
import { canYank, canYankPopField, Keymap, operation } from "./operation";

export function keymaching(event: KeyboardEvent, key: Keymap): boolean {
  let result = true;
  if (key.ctrl === true) {
    result &&= event.ctrlKey == true;
  }
  else {
    result &&= event.ctrlKey == false;
  }
  if (key.alt === true) {
    result &&= event.altKey == true
  }
  else {
    result &&= event.altKey == false;
  }
  if (key.shift === true) {
    result &&= event.shiftKey == true;
  }
  else {
    result &&= event.shiftKey == false;
  }
  result &&= event.metaKey == false;
  result &&= key.key == event.key;
  return result;
}

export const defaultKeymap: Keymap[] = [
  {
    id: "move_cursor_to_the_beginning",
    label: "move cursor to the beginning",
    description: getMessage("move_cursor_to_the_beginning"),
    operation: operation.moveToTOL,
    editableOperation: editableOperation.move_cursor_to_the_beginning,
    ctrl: true,
    key: "a",
  },
  {
    id: "move_cursor_to_the_end",
    label: "move cursor to the end",
    description: getMessage("move_cursor_to_the_end"),
    operation: operation.moveToEOL,
    editableOperation: editableOperation.move_cursor_to_the_end,
    ctrl: true,
    key: "e",
  },
  {
    id: "delete_to_the_end_of_the_line",
    ringRole: "kill",
    label: "delete to the end of the line",
    description: getMessage("delete_to_the_end_of_the_line"),
    operation: operation.deleteToEOL,
    editableOperation: editableOperation.delete_to_the_end_of_the_line,
    ctrl: true,
    key: "k",
  },
  {
    id: "move_cursor_to_the_next_character",
    label: "move cursor to the next character",
    description: getMessage("move_cursor_to_the_next_character"),
    operation: operation.moveToNextChar,
    editableOperation: editableOperation.move_cursor_to_the_next_character,
    ctrl: true,
    key: "f",
  },
  {
    id: "move_cursor_to_the_previous_character",
    label: "move cursor to the previous character",
    description: getMessage("move_cursor_to_the_previous_character"),
    operation: operation.moveToPreviousChar,
    editableOperation: editableOperation.move_cursor_to_the_previous_character,
    ctrl: true,
    key: "b",
  },
  {
    id: "move_cursor_to_the_next_word",
    label: "move cursor to the next word",
    description: getMessage("move_cursor_to_the_next_word"),
    operation: operation.moveToEndOfWord,
    editableOperation: editableOperation.move_cursor_to_the_next_word,
    alt: true,
    key: "f",
  },
  {
    id: "move_cursor_to_the_previous_word",
    label: "move cursor to the previous word",
    description: getMessage("move_cursor_to_the_previous_word"),
    operation: operation.moveToTopOfWord,
    editableOperation: editableOperation.move_cursor_to_the_previous_word,
    alt: true,
    key: "b",
  },
  {
    id: "delete_to_the_beginning_of_the_line",
    ringRole: "kill",
    label: "delete to the beginning of the line",
    description: getMessage("delete_to_the_beginning_of_the_line"),
    operation: operation.deleteToTOL,
    editableOperation: editableOperation.delete_to_the_beginning_of_the_line,
    ctrl: true,
    key: "u",
  },
  {
    id: "yank",
    ringRole: "yank",
    label: "yank",
    description: getMessage("yank"),
    operation: operation.yank,
    editableOperation: editableOperation.yank,
    canHandle: canYank,
    ctrl: true,
    key: "y",
  },
  {
    id: "yank_pop",
    ringRole: "yank",
    label: "yank pop",
    description: getMessage("yank_pop"),
    operation: operation.yankPop,
    canHandle: canYankPopField,
    alt: true,
    key: "y",
  },
  {
    id: "kill_word",
    ringRole: "kill",
    label: "kill word",
    description: getMessage("kill_word"),
    operation: operation.killWord,
    editableOperation: editableOperation.kill_word,
    alt: true,
    key: "d",
  },
  {
    id: "backward_kill_word",
    ringRole: "kill",
    label: "backward kill word",
    description: getMessage("backward_kill_word"),
    operation: operation.backwardKillWord,
    editableOperation: editableOperation.backward_kill_word,
    alt: true,
    key: "Backspace",
  },
  {
    id: "delete_char",
    label: "delete char",
    description: getMessage("delete_char"),
    operation: operation.deleteChar,
    editableOperation: editableOperation.delete_char,
    ctrl: true,
    key: "d",
  },
  {
    id: "backward_delete_char",
    label: "backward delete char",
    description: getMessage("backward_delete_char"),
    operation: operation.backwardDeleteChar,
    editableOperation: editableOperation.backward_delete_char,
    ctrl: true,
    key: "h",
  },
  /**
   * Undo reaches the same operation from two chords, so it is two entries with
   * two ids rather than one entry claiming both. Ids are the handle the rebind
   * GUI keys its rows by and the settings importer validates against, and
   * neither can address half of a shared entry — a single id holding two chords
   * would make one of them unrebindable and unexportable.
   *
   * `key: "_"` with shift is the chord a US-layout keyboard actually produces
   * for Ctrl+underscore: Shift+Minus, measured 2026-09-05 as `key: "_"`,
   * `code: "Minus"`, `shiftKey` true. See test/undochords.test.ts for the
   * measurement and for why Playwright's own `press("Control+_")` shorthand
   * disagrees.
   */
  {
    id: "undo",
    label: "undo",
    description: getMessage("undo"),
    operation: operation.undo,
    editableOperation: editableOperation.undo,
    ctrl: true,
    shift: true,
    key: "_",
  },
  {
    id: "undo_slash",
    label: "undo",
    description: getMessage("undo_slash"),
    operation: operation.undo,
    editableOperation: editableOperation.undo,
    ctrl: true,
    key: "/",
  },
  /**
   * The case operations and transpose carry no `ringRole` on purpose. None of
   * them is a kill — nothing they touch leaves the field — so the dispatcher
   * reports each as a foreign command and a kill chain around one breaks, which
   * is what stops a recased word between two kills from splicing them into a
   * line the user never had. The property is bought by this absence, exactly as
   * it is for the character deletes.
   *
   * They ship without an `editableOperation`: a contenteditable root has no
   * value to slice, and the word extents these need cannot be read off a rich-
   * text selection without an offset pair that survives the host editor's own
   * normalisation. A chord with no counterpart is left to the page, so the
   * editor's own Alt+U keeps working rather than being swallowed by a binding
   * that could not act.
   */
  {
    id: "upcase_word",
    label: "upcase word",
    description: getMessage("upcase_word"),
    operation: operation.upcaseWord,
    alt: true,
    key: "u",
  },
  {
    id: "downcase_word",
    label: "downcase word",
    description: getMessage("downcase_word"),
    operation: operation.downcaseWord,
    alt: true,
    key: "l",
  },
  {
    id: "capitalize_word",
    label: "capitalize word",
    description: getMessage("capitalize_word"),
    operation: operation.capitalizeWord,
    alt: true,
    key: "c",
  },
  {
    id: "transpose_words",
    label: "transpose words",
    description: getMessage("transpose_words"),
    operation: operation.transposeWords,
    alt: true,
    key: "t",
  },
];
