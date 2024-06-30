import { Keymap, operation } from "./operation";

console.log("extension razorshell loaded");
const query = [
  'input[type="text"]',
  'input[type="search"]',
  'input[type="url"]',
  'input[type="tel"]',
  'input[type="email"]',
].join(", ");
// select all elements that can input single line text
const textInputs = document.querySelectorAll<HTMLInputElement>(query);

const keymap: Keymap[] = [
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

function keyEventHandling(event: KeyboardEvent, textinput: HTMLInputElement) {
  keymap.forEach((keymap) => {
    if (keymap.ctrl) {
      if (event.ctrlKey && event.key === keymap.key) {
        event.preventDefault(); // cancel default action
        console.log(`ctrl+${keymap.key}`);
        keymap.operation(textinput);
      }
    }
  });
}

function eventListenerInjection(textinput: HTMLInputElement) {
  textinput.addEventListener(
    "keydown",
    (event) => keyEventHandling(event, textinput),
  );
}

// Main logic of the extension from here.

if (textInputs.length === 0) {
  console.log("nothing targets");
} else {
  textInputs.forEach(eventListenerInjection);
}
