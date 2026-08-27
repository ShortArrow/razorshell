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
    label: "delete to the beginning of the line",
    description: getMessage("delete_to_the_beginning_of_the_line"),
    operation: operation.deleteToTOL,
    editableOperation: editableOperation.delete_to_the_beginning_of_the_line,
    ctrl: true,
    key: "u",
  },
  {
    id: "yank",
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
    label: "yank pop",
    description: getMessage("yank_pop"),
    operation: operation.yankPop,
    canHandle: canYankPopField,
    alt: true,
    key: "y",
  },
];
