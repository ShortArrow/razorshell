import { keymaching } from "./keymap";
import { getActiveKeymap } from "./keymapstore";
import { debug } from "./debug";
import { Keymap, TextField } from "./operation";

const targetInputTypes = ["text", "search", "url", "tel", "password"];

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
 * Resolves the element the event actually started from, so an editor inside an
 * open shadow root is seen as itself rather than as its host.
 */
export function resolveEventTarget(event: Event): EventTarget | null {
  const path = event.composedPath();
  return path.length > 0 ? path[0] : event.target;
}

/**
 * Narrows an event target to a contenteditable host the Selection API can drive.
 */
export function isEditableTarget(target: EventTarget | null): target is HTMLElement {
  return target instanceof HTMLElement && target.isContentEditable;
}

/**
 * Announces which binding is about to run, so the kill ring can tell a command
 * of its own from any other and break the kill chain accordingly.
 *
 * Entries that speak to the ring themselves — kills and yanks — record what they
 * did as part of running, so this default reports every other binding as
 * foreign. It is a module-level seam rather than an argument because the whole
 * dispatch path is reached through `getActiveKeymap`, and threading a reporter
 * through it would put ring state in every caller's signature.
 */
let reportCommand: (id: string) => void = () => {};

/** Replaces the command reporter. Returns the previous one, so tests restore it. */
export function setCommandReporter(reporter: (id: string) => void): (id: string) => void {
  const previous = reportCommand;
  reportCommand = reporter;
  return previous;
}

/**
 * Runs the first keymap entry matching the event against the given text field,
 * cancelling the default action. A chord bound twice fires only its first entry,
 * and an unmatched event is left untouched. A keydown raised while an IME
 * composition is in flight belongs to the IME, so it is left to the page.
 *
 * An entry whose `canHandle` refuses the field is treated as no match at all:
 * the default action stands, because a binding that will do nothing must not
 * swallow the native key it shadows.
 */
export function dispatchKey(event: KeyboardEvent, textinput: TextField, keymap: Keymap[]): void {
  if (event.isComposing) return;
  const matched = keymap.find((entry) => keymaching(event, entry));
  if (!matched) return;
  if (matched.canHandle && !matched.canHandle(textinput)) return;
  console.debug("key matched");
  event.preventDefault(); // cancel default action
  reportCommand(matched.id);
  matched.operation(textinput);
}

/**
 * Dispatches the event against the keymap currently in force.
 */
export function keyEventHandling(event: KeyboardEvent, textinput: TextField) {
  debug.logKey(event);
  dispatchKey(event, textinput, getActiveKeymap());
}

/**
 * Runs the first matching keymap entry against a contenteditable root. An entry
 * carrying no editable counterpart, or one whose `canHandle` refuses this root,
 * leaves the event to the page, so a chord the host editor owns keeps working. A
 * keydown raised while an IME composition is in flight belongs to the IME, so it
 * is left to the page.
 */
export function dispatchEditableKey(event: KeyboardEvent, root: HTMLElement, keymap: Keymap[]): void {
  if (event.isComposing) return;
  const matched = keymap.find((entry) => keymaching(event, entry));
  if (!matched || !matched.editableOperation) return;
  if (matched.canHandle && !matched.canHandle(root)) return;
  event.preventDefault(); // cancel default action
  reportCommand(matched.id);
  matched.editableOperation(root);
}
