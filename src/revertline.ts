/**
 * @file revertline.ts
 * @brief readline's revert-line for text fields: the value each field held when
 *        it gained focus, and the write that puts it back.
 *
 * readline undoes every change made to the line since editing began. A field
 * has no line buffer, so editing begins at focus and the snapshot is the whole
 * value at that moment, every line of a textarea. The decision and its limits
 * are ADR-0016, "revert-line restores the value a field held when it gained
 * focus".
 *
 * The snapshots are keyed weakly by element, for the reason `yank.ts` holds its
 * field weakly: a page that removes a field must not leave this module pinning
 * it. Garbage collection cannot be forced from a test, so that half is checked
 * by reading.
 *
 * A password field is never recorded. The extension promises it keeps no text
 * from one, the same promise the kill ring keeps (ADR-0010).
 */
import type { TextField } from "./operation";
import { replaceRangeNatively } from "./yank";

let focusValues = new WeakMap<TextField, string>();

/**
 * The element that was active when the window last lost focus, until the next
 * focus lands anywhere. Chrome fires `focusin` again on that element when its
 * tab or window regains focus, and that return is not the start of a new edit.
 * Held weakly for the same reason as the snapshots.
 */
let returning: WeakRef<Element> | null = null;

/**
 * Remembers the element active as the window loses focus, so the `focusin`
 * that merely returns focus to it does not move its snapshot.
 */
export function noteWindowBlur(active: Element | null): void {
  returning = active === null ? null : new WeakRef(active);
}

/**
 * Records the value a field holds as it gains focus, replacing any snapshot an
 * earlier focus left. Focus returning to the element the window blurred on
 * keeps the snapshot instead; either way the remembered return is spent. A
 * password field is skipped.
 */
export function noteFocus(field: TextField): void {
  const isReturn = returning?.deref() === field;
  returning = null;
  if (isReturn) return;
  record(field);
}

/** Spends the remembered return when focus lands on something other than a text field. */
export function noteFocusElsewhere(): void {
  returning = null;
}

/**
 * Records the value on a keydown in a field that has no snapshot yet, which is
 * a field that took focus before the content script was listening. A keydown
 * precedes the edit it causes, so the value read here is still the pre-edit one.
 */
export function noteKeydown(field: TextField): void {
  if (focusValues.has(field)) return;
  record(field);
}

/** The value the field held when it gained focus, if one was recorded. */
export function focusValue(field: TextField): string | undefined {
  return focusValues.get(field);
}

/**
 * Drops every snapshot, as the URL policy turning the extension off for the
 * frame does with the kill ring: text recorded while allowed must not be put
 * back on a page it is denied on.
 */
export function forgetFocusValues(): void {
  focusValues = new WeakMap();
  returning = null;
}

/**
 * Whether Alt+R has anything to do: a writable, non-password text field whose
 * value differs from its snapshot. Otherwise the key is left to the page.
 *
 * The password test is repeated here, not only at recording, because a field
 * shown as text can be switched to `type="password"` after its focus.
 */
export function canRevertLine(field: TextField | HTMLElement): boolean {
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return false;
  if (field.readOnly || field.disabled || isPasswordField(field)) return false;
  const snapshot = focusValues.get(field);
  return snapshot !== undefined && snapshot !== field.value;
}

/**
 * Writes the snapshot over the whole value through the native insert path, so
 * the page sees an `input` event and Ctrl+Z takes the revert back, and leaves
 * the caret at the end of the restored value. The snapshot stays, so a later
 * edit in the same focus reverts to the same value.
 */
export function revertLine(field: TextField): void {
  if (!canRevertLine(field)) return;
  const snapshot = focusValues.get(field)!;
  replaceRangeNatively(field, 0, field.value.length, snapshot);
}

function record(field: TextField): void {
  if (isPasswordField(field)) return;
  focusValues.set(field, field.value);
}

function isPasswordField(field: TextField): boolean {
  return field instanceof HTMLInputElement && field.type === "password";
}
