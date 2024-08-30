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
    // set the cursor to the beginning of the text
    textinput.setSelectionRange(0, 0);
  },
  moveCursorToEnd(textinput: HTMLInputElement) {
    // get the end position of the text
    const end = textinput.value.length;
    // set the cursor to the end of the text
    textinput.setSelectionRange(end, end);
  },
  deleteToEOL(textinput: HTMLInputElement) {
    // get the end position of the selected text
    const cursor = textinput.selectionEnd;
    // do nothing if the cursor is at the beginning
    if (cursor == null || cursor === 0) return;
    // get the text before the cursor
    const text = textinput.value.slice(0, cursor);
    // set the text before the cursor
    textinput.value = text;
  },
  moveCursorToNextChar(textinput: HTMLInputElement) {
    // get the cursor position
    const cursor = textinput.selectionEnd;
    // do nothing if the cursor is at the end
    if (cursor == null || cursor === textinput.value.length) return;
    // set the cursor to the next character
    textinput.setSelectionRange(cursor + 1, cursor + 1);
  },
  moveCursorToPreviousChar(textinput: HTMLInputElement) {
    // get the cursor position
    const cursor = textinput.selectionEnd;
    // do nothing if the cursor is at the beginning
    if (cursor == null || cursor === 0) return;
    // set the cursor to the previous character
    textinput.setSelectionRange(cursor - 1, cursor - 1);
  },
  moveCursorToNextWord(textinput: HTMLInputElement) {
    // get the cursor position
    const cursor = textinput.selectionEnd;
    // get the text after the cursor
    const text = textinput.value.slice(cursor ?? 0);
    // get the next word position
    const next = text.search(/\w\s/);
    // set the cursor to the next word
    textinput.setSelectionRange(cursor ?? 0 + next + 1, cursor ?? 0 + next + 1);
  },
  moveCursorToTopOfWord(textinput: HTMLInputElement) {
    // get the cursor position
    const cursor = textinput.selectionEnd;
    if (cursor == null || cursor == 0) return;
    // get the text before the cursor
    const text = textinput.value.slice(0, cursor ?? 0);
    // get the previous word position
    const previous = text.search(/\s\w/);
    // set the cursor to the previous word
    textinput.setSelectionRange(cursor ?? 0 - previous, cursor ?? 0 - previous);
  },
};
