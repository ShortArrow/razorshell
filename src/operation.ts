import { cursor } from "./cursor";

export interface Keymap {
  label: string;
  operation: (textinput: HTMLInputElement) => void;
  key: string;
  alt?: boolean;
  ctrl?: boolean;
  shift?: boolean;
}

export const operation = {
  moveCursorToBeginning(textinput: HTMLInputElement) {
    textinput.setSelectionRange(0, 0); // set cursor to beginning
  },
  moveCursorToEnd(textinput: HTMLInputElement) {
    const end = textinput.value.length; // get text length
    textinput.setSelectionRange(end, end); // set cursor to end
  },
  deleteToEOL(textinput: HTMLInputElement) {
    console.debug("deleteToEOL");
    const cursor = textinput.selectionEnd; // get position
    if (cursor == null) return; // do nothing if cursor is null
    const text = textinput.value.slice(0, cursor); // get text before cursor
    textinput.value = text; // set the text
  },
  deleteToTOL(textinput: HTMLInputElement) {
    const cursor = textinput.selectionStart; // get position
    if (cursor == null) return; // do nothing if cursor is null
    const text = textinput.value.slice(cursor); // get text after the cursor
    textinput.value = text; // set the text
    textinput.setSelectionRange(0, 0); // set cursor to beginning
  },
  moveCursorToNextChar(textinput: HTMLInputElement) {
    const cursor = textinput.selectionEnd; // get position
    if (cursor == null || cursor === textinput.value.length) return; // do nothing if cursor is end
    textinput.setSelectionRange(cursor + 1, cursor + 1); // move cursor forward
  },
  moveCursorToPreviousChar(textinput: HTMLInputElement) {
    const cursor = textinput.selectionEnd; // get position
    if (cursor == null || cursor === 0) return; // do nothing if the cursor is beginning
    textinput.setSelectionRange(cursor - 1, cursor - 1); // move cursor backward
  },
  moveCursorToEndOfWord(textinput: HTMLInputElement) {
    const cursor = textinput.selectionEnd; // get position
    const text = textinput.value.slice(cursor ?? 0); // get the text after the cursor
    const next = text.search(/\w\s/); // get word end
    textinput.setSelectionRange(cursor ?? 0 + next + 1, cursor ?? 0 + next + 1); // move cursor word end
  },
  moveCursorToTopOfWord(textinput: HTMLInputElement) {
    const position = textinput.selectionEnd; // get the cursor position
    if (position == null || position == 0) return;
    const text = textinput.value.slice(0, position ?? 0); // get the text before the cursor
    const previous = cursor.getTopOfWord(text, position); // get word top
    textinput.setSelectionRange(previous, previous); // move cursor word top
  },
};
