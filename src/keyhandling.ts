import { keymaching } from "./keymap";
import { getActiveKeymap } from "./keymapstore";
import { debug } from "./debug";
import { Keymap, TextField } from "./operation";

const targetInputTypes = ["text", "search", "url", "tel", "email"];

/**
 * Narrows an event target to a text field the keymap can operate on.
 */
export function isTextField(target: EventTarget | null): target is TextField {
  if (target instanceof HTMLTextAreaElement) return true;
  return (
    target instanceof HTMLInputElement &&
    targetInputTypes.includes(target.type)
  );
}

/**
 * Runs the first keymap entry matching the event against the given text field,
 * cancelling the default action. A chord bound twice fires only its first entry,
 * and an unmatched event is left untouched.
 */
export function dispatchKey(event: KeyboardEvent, textinput: TextField, keymap: Keymap[]): void {
  const matched = keymap.find((entry) => keymaching(event, entry));
  if (!matched) return;
  console.debug("key matched");
  event.preventDefault(); // cancel default action
  matched.operation(textinput);
}

/**
 * Dispatches the event against the keymap currently in force.
 */
export function keyEventHandling(event: KeyboardEvent, textinput: TextField) {
  debug.logKey(event);
  dispatchKey(event, textinput, getActiveKeymap());
}
