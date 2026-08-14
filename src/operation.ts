import { cursor } from "./cursor";

export type TextField = HTMLInputElement | HTMLTextAreaElement;

export interface Keymap {
  label: string;
  operation: (textinput: TextField) => void;
  description?: () => string;
  key: string;
  alt?: boolean;
  ctrl?: boolean;
  shift?: boolean;
}

export const operation = {
  moveToTOL(textinput: TextField) {
    const position = textinput.selectionStart;
    if (position == null) return;
    const top = cursor.getTopOfLine(textinput.value, position);
    textinput.setSelectionRange(top, top);
  },
  moveToEOL(textinput: TextField) {
    const position = textinput.selectionEnd;
    if (position == null) return;
    const end = cursor.getEndOfLine(textinput.value, position);
    textinput.setSelectionRange(end, end);
  },
  deleteToEOL(textinput: TextField) {
    const position = textinput.selectionEnd;
    if (position == null) return;
    const end = cursor.getEndOfLine(textinput.value, position);
    textinput.value = textinput.value.slice(0, position) + textinput.value.slice(end);
    textinput.setSelectionRange(position, position);
  },
  deleteToTOL(textinput: TextField) {
    const position = textinput.selectionStart;
    if (position == null) return;
    const top = cursor.getTopOfLine(textinput.value, position);
    textinput.value = textinput.value.slice(0, top) + textinput.value.slice(position);
    textinput.setSelectionRange(top, top);
  },
  moveToNextChar(textinput: TextField) {
    const position = textinput.selectionEnd;
    if (position == null || position === textinput.value.length) return;
    textinput.setSelectionRange(position + 1, position + 1);
  },
  moveToPreviousChar(textinput: TextField) {
    const position = textinput.selectionEnd;
    if (position == null || position === 0) return;
    textinput.setSelectionRange(position - 1, position - 1);
  },
  moveToEndOfWord(textinput: TextField) {
    const position = textinput.selectionEnd;
    if (position == null) return;
    const next = cursor.getEndOfWord(textinput.value, position);
    textinput.setSelectionRange(next, next);
  },
  moveToTopOfWord(textinput: TextField) {
    const position = textinput.selectionEnd;
    if (position == null || position == 0) return;
    const previous = cursor.getTopOfWord(textinput.value, position);
    textinput.setSelectionRange(previous, previous);
  },
};
