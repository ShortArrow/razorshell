import { cursor } from "./cursor";

export const operation = {
  moveToTOL(textinput: HTMLInputElement) {
    textinput.setSelectionRange(0, 0); // set cursor to beginning
  },
  moveToEOL(textinput: HTMLInputElement) {
    const end = textinput.value.length; // get text length
    textinput.setSelectionRange(end, end); // set cursor to end
  },
  deleteToEOL(textinput: HTMLInputElement) {
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
  moveToNextChar(textinput: HTMLInputElement) {
    const cursor = textinput.selectionEnd; // get position
    if (cursor == null || cursor === textinput.value.length) return; // do nothing if cursor is end
    textinput.setSelectionRange(cursor + 1, cursor + 1); // move cursor forward
  },
  moveToPreviousChar(textinput: HTMLInputElement) {
    const cursor = textinput.selectionEnd; // get position
    if (cursor == null || cursor === 0) return; // do nothing if the cursor is beginning
    textinput.setSelectionRange(cursor - 1, cursor - 1); // move cursor backward
  },
  moveToEndOfWord(textinput: HTMLInputElement) {
    const position = textinput.selectionEnd; // get position
    if (position == null) return;
    const next = cursor.getEndOfWord(textinput.value, position); // get word end
    textinput.setSelectionRange(next, next); // move cursor word end
  },
  moveToTopOfWord(textinput: HTMLInputElement) {
    const position = textinput.selectionEnd; // get the cursor position
    if (position == null || position == 0) return;
    const previous = cursor.getTopOfWord(textinput.value, position); // get word top
    textinput.setSelectionRange(previous, previous); // move cursor word top
  },
};
