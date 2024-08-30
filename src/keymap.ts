import { Keymap, operation } from "./operation";

export function keymaching(event: KeyboardEvent, key: Keymap): boolean {
  key.ctrl = key.ctrl ?? false;
  event.ctrlKey = event.ctrlKey ?? false;
  return true;
}

export const defaultKeymap: Keymap[] = [
  {
    label: "move cursor to the beginning",
    operation: operation.moveCursorToBeginning,
    ctrl: true,
    key: "a",
  },
  {
    label: "move cursor to the end",
    operation: operation.moveCursorToEnd,
    ctrl: true,
    key: "e",
  },
  {
    label: "delete to the end of the line",
    operation: operation.deleteToEOL,
    ctrl: true,
    key: "k",
  },
  {
    label: "move cursor to the next character",
    operation: operation.moveCursorToNextChar,
    ctrl: true,
    key: "f",
  },
  {
    label: "move cursor to the previous character",
    operation: operation.moveCursorToPreviousChar,
    ctrl: true,
    key: "b",
  },
  {
    label: "move cursor to the next word",
    operation: operation.moveCursorToNextWord,
    alt: true,
    key: "f",
  },
  {
    label: "move cursor to the previous word",
    operation: operation.moveCursorToTopOfWord,
    alt: true,
    key: "b",
  },
];
