import { defaultKeymap, keymaching } from "./keymap";
import { debug } from "./debug";
import { TextField } from "./operation";

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
 * Runs every keymap entry matching the event against the given text field,
 * cancelling the default action for each match.
 */
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
