import { defaultKeymap, keymaching } from "./keymap";
import { debug } from "./debug";
import { TextField } from "./operation";

console.log("extension razorshell loaded");

const targetInputTypes = ["text", "search", "url", "tel", "email"];

export function isTextField(target: EventTarget | null): target is TextField {
  if (target instanceof HTMLTextAreaElement) return true;
  return (
    target instanceof HTMLInputElement &&
    targetInputTypes.includes(target.type)
  );
}

export function keyEventHandling(event: KeyboardEvent, textinput: TextField) {
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

// Delegate at document level so text fields added after page load are
// also covered, unlike per-element listeners bound once at injection.
document.addEventListener(
  "keydown",
  (event) => {
    const target = event.target;
    if (!isTextField(target)) return;
    keyEventHandling(event, target);
  },
  { capture: true },
);
