import { defaultKeymap, keymaching } from "./keymap";
import { debug } from "./debug";

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

export function keyEventHandling(event: KeyboardEvent, textinput: HTMLInputElement) {
  debug.logKey(event);
  defaultKeymap.forEach((keymap) => {
    if (!keymaching(event, keymap)) {
      return;
    }
    console.debug("key matched");
    event.preventDefault(); // cancel default action
    keymap.operation(textinput);
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
