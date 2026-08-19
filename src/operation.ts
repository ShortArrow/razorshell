import { cursor } from "./cursor";
import { applyKillRegion, endOfLineRegion, topOfLineRegion } from "./killregion";

export type TextField = HTMLInputElement | HTMLTextAreaElement;

export interface Keymap {
  id: string;
  label: string;
  operation: (textinput: TextField) => void;
  editableOperation?: (root: HTMLElement) => void;
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
    const start = textinput.selectionStart;
    const end = textinput.selectionEnd;
    if (start == null || end == null) return;
    applyKillRegion(textinput, endOfLineRegion(textinput.value, start, end));
  },
  deleteToTOL(textinput: TextField) {
    const start = textinput.selectionStart;
    const end = textinput.selectionEnd;
    if (start == null || end == null) return;
    applyKillRegion(textinput, topOfLineRegion(textinput.value, start, end));
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
