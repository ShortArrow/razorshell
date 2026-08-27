import { cursor } from "./cursor";
import { applyKillRegion, endOfLineRegion, topOfLineRegion, KillRegion } from "./killregion";
import { beginYank, newestEntry, recordKill, rotateYank } from "./killring";
import { applyYank, applyYankPop, canYankPop, noteYankPopFailure } from "./yank";

export type TextField = HTMLInputElement | HTMLTextAreaElement;

export interface Keymap {
  id: string;
  label: string;
  operation: (textinput: TextField) => void;
  editableOperation?: (root: HTMLElement) => void;
  /**
   * Whether this entry will act on the given field at this moment. An entry
   * that declares itself unable is left to the page in full — the default
   * action is not cancelled — which is how a binding shadowing a native key
   * gives that key back when it has nothing to do. Absent means always.
   */
  canHandle?: (field: TextField | HTMLElement) => boolean;
  /**
   * How this entry speaks to the kill ring, when it does.
   *
   * A `"kill"` entry records what it removed and a `"yank"` entry drives the
   * yank sequence; both report themselves as part of running. Absent means the
   * entry is foreign to the ring, and the dispatcher tells the ring so — which
   * is what stops a motion between two kills from letting them concatenate into
   * a line the user never had.
   *
   * The role lives on the entry rather than in a list held elsewhere so that a
   * new binding declares its own relationship to the ring, instead of the ring's
   * correctness depending on a second file being edited in step.
   */
  ringRole?: "kill" | "yank";
  description?: () => string;
  key: string;
  alt?: boolean;
  ctrl?: boolean;
  shift?: boolean;
}

export const operation = {
  moveToTOL(textinput: TextField) {
    const position = textinput.selectionStart;
    if (position == null) return;
    const top = cursor.getTopOfLine(textinput.value, position);
    textinput.setSelectionRange(top, top);
  },
  moveToEOL(textinput: TextField) {
    const position = textinput.selectionEnd;
    if (position == null) return;
    const end = cursor.getEndOfLine(textinput.value, position);
    textinput.setSelectionRange(end, end);
  },
  deleteToEOL(textinput: TextField) {
    const start = textinput.selectionStart;
    const end = textinput.selectionEnd;
    if (start == null || end == null) return;
    kill(textinput, endOfLineRegion(textinput.value, start, end), "forward");
  },
  deleteToTOL(textinput: TextField) {
    const start = textinput.selectionStart;
    const end = textinput.selectionEnd;
    if (start == null || end == null) return;
    kill(textinput, topOfLineRegion(textinput.value, start, end), "backward");
  },
  /**
   * Inserts the newest ring entry at the caret. Reached only when `canYank` has
   * already said there is something to insert, so an empty ring never gets this
   * far and the native key it shadows survives.
   */
  yank(textinput: TextField) {
    const text = beginYank();
    if (text === undefined) return;
    applyYank(textinput, text);
  },
  /**
   * Replaces what the last yank inserted with the next-older entry.
   *
   * Both halves must agree: the ring must still consider a rotation legal, and
   * the recorded region must still verify against the field. Either refusing
   * makes this a no-op, and `canYankPop` in the binding keeps the key itself
   * untouched in that case.
   */
  yankPop(textinput: TextField) {
    if (!canYankPop(textinput)) {
      noteYankPopFailure();
      return;
    }
    const text = rotateYank();
    if (text === undefined) {
      noteYankPopFailure();
      return;
    }
    applyYankPop(textinput, text);
  },
  moveToNextChar(textinput: TextField) {
    const position = textinput.selectionEnd;
    if (position == null || position === textinput.value.length) return;
    textinput.setSelectionRange(position + 1, position + 1);
  },
  moveToPreviousChar(textinput: TextField) {
    const position = textinput.selectionEnd;
    if (position == null || position === 0) return;
    textinput.setSelectionRange(position - 1, position - 1);
  },
  moveToEndOfWord(textinput: TextField) {
    const position = textinput.selectionEnd;
    if (position == null) return;
    const next = cursor.getEndOfWord(textinput.value, position);
    textinput.setSelectionRange(next, next);
  },
  moveToTopOfWord(textinput: TextField) {
    const position = textinput.selectionEnd;
    if (position == null || position == 0) return;
    const previous = cursor.getTopOfWord(textinput.value, position);
    textinput.setSelectionRange(previous, previous);
  },
};

/**
 * Removes a region and tells the ring what left the field.
 *
 * The slice is read before the removal, because afterwards it is gone. A
 * password field's text is killed like any other but reported as unstorable, so
 * the secret never enters the ring and the kill chain breaks around it.
 */
function kill(textinput: TextField, region: KillRegion, direction: "forward" | "backward"): void {
  if (textinput.readOnly || textinput.disabled) return;
  const text = textinput.value.slice(region.start, region.end);
  applyKillRegion(textinput, region);
  recordKill({
    direction,
    text,
    elementToken: textinput,
    caretAfter: region.start,
    storable: !isPasswordField(textinput),
  });
}

/** A password input, whose contents the ring must never hold. */
function isPasswordField(field: TextField | HTMLElement): boolean {
  return field instanceof HTMLInputElement && field.type === "password";
}

/**
 * Whether a yank has anything to insert. An empty ring answers no, and the
 * binding then leaves Ctrl+Y to the browser — on Windows and Linux that is redo,
 * which would otherwise be silently swallowed by a binding with nothing to do.
 */
export function canYank(field: TextField | HTMLElement): boolean {
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    if (field.readOnly || field.disabled) return false;
  }
  return newestEntry() !== undefined;
}

/**
 * Whether a yank-pop may run: only against a field still holding exactly what
 * the last yank inserted. Anything else leaves the key alone rather than
 * replacing a range that no longer means what it did.
 */
export function canYankPopField(field: TextField | HTMLElement): boolean {
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return false;
  if (field.readOnly || field.disabled) return false;
  return canYankPop(field);
}
