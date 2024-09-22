import { getMessage } from "./languages";
import { Keymap, operation } from "./operation";

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
  result &&= key.key == event.key;
  return result;
}

export const defaultKeymap: Keymap[] = [
  {
    label: "move cursor to the beginning",
    description: getMessage("move_cursor_to_the_beginning"),
    operation: operation.moveToTOL,
    ctrl: true,
    key: "a",
  },
  {
    label: "move cursor to the end",
    description: getMessage("move_cursor_to_the_end"),
    operation: operation.moveToEOL,
    ctrl: true,
    key: "e",
  },
  {
    label: "delete to the end of the line",
    description: getMessage("delete_to_the_end_of_the_line"),
    operation: operation.deleteToEOL,
    ctrl: true,
    key: "k",
  },
  {
    label: "move cursor to the next character",
    description: getMessage("move_cursor_to_the_next_character"),
    operation: operation.moveToNextChar,
    ctrl: true,
    key: "f",
  },
  {
    label: "move cursor to the previous character",
    description: getMessage("move_cursor_to_the_previous_character"),
    operation: operation.moveToPreviousChar,
    ctrl: true,
    key: "b",
  },
  {
    label: "move cursor to the next word",
    description: getMessage("move_cursor_to_the_next_word"),
    operation: operation.moveToEndOfWord,
    alt: true,
    key: "f",
  },
  {
    label: "move cursor to the previous word",
    description: getMessage("move_cursor_to_the_previous_word"),
    operation: operation.moveToTopOfWord,
    alt: true,
    key: "b",
  },
  {
    label: "delete to the beginning of the line",
    description: getMessage("delete_to_the_beginning_of_the_line"),
    operation: operation.deleteToTOL,
    ctrl: true,
    key: "u",
  },
];
