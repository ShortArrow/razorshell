import {
  CaseEdit,
  capitalizeWordEdit,
  downcaseWordEdit,
  transposeWordsEdit,
  upcaseWordEdit,
} from "./caseregion";
import { cursor } from "./cursor";
import {
  applyKillRegion,
  backwardWordRegion,
  endOfLineRegion,
  forwardWordRegion,
  nextGraphemeRegion,
  previousGraphemeRegion,
  topOfLineRegion,
  KillRegion,
} from "./killregion";
import { beginYank, newestEntry, recordKill, rotateYank } from "./killring";
import { transposeCharsEdit, unixWordRuboutRegion } from "./reclaimedregion";
import {
  applyYank,
  applyYankPop,
  canYankPop,
  noteYankPopFailure,
  replaceRangeNatively,
} from "./yank";

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
  killWord(textinput: TextField) {
    const start = textinput.selectionStart;
    const end = textinput.selectionEnd;
    if (start == null || end == null) return;
    kill(textinput, forwardWordRegion(textinput.value, start, end), "forward");
  },
  backwardKillWord(textinput: TextField) {
    const start = textinput.selectionStart;
    const end = textinput.selectionEnd;
    if (start == null || end == null) return;
    kill(textinput, backwardWordRegion(textinput.value, start, end), "backward");
  },
  /**
   * Removes one grapheme ahead of the caret without telling the ring anything.
   *
   * This is a delete, not a kill: readline's C-d does not put the character on
   * the ring, and the binding carries no `ringRole`, so the dispatcher reports
   * it as a foreign command and a kill chain around it breaks. That break is
   * the point — a character deleted between two kills is text missing from
   * between the pieces, and concatenating across the hole would fabricate a
   * line the user never had.
   */
  deleteChar(textinput: TextField) {
    const start = textinput.selectionStart;
    const end = textinput.selectionEnd;
    if (start == null || end == null) return;
    applyKillRegion(textinput, nextGraphemeRegion(textinput.value, start, end));
  },
  backwardDeleteChar(textinput: TextField) {
    const start = textinput.selectionStart;
    const end = textinput.selectionEnd;
    if (start == null || end == null) return;
    applyKillRegion(textinput, previousGraphemeRegion(textinput.value, start, end));
  },
  /**
   * Steps the field's own undo history back one entry.
   *
   * The whole operation is `execCommand("undo")`, for the same reason the kill
   * and the yank go through `execCommand`: the history belongs to the engine,
   * and there is no way to reach it from script otherwise. Where `execCommand`
   * is absent or refuses — jsdom, and any engine that drops it — this does
   * nothing at all. That is a declared degradation rather than a fallback: a
   * kill can be spliced back into a value, but an undo stack cannot be
   * reconstructed from outside, so nothing is attempted.
   */
  undo(textinput: TextField) {
    runUndo(textinput);
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
  upcaseWord(textinput: TextField) {
    applyCaseEdit(textinput, upcaseWordEdit);
  },
  downcaseWord(textinput: TextField) {
    applyCaseEdit(textinput, downcaseWordEdit);
  },
  capitalizeWord(textinput: TextField) {
    applyCaseEdit(textinput, capitalizeWordEdit);
  },
  /**
   * Swaps the word before the caret with the word after it, leaving the caret
   * past both.
   *
   * Fewer than two words is a complete no-op — and the key is still consumed.
   * Readline rings the bell there, which is a refusal the user hears while the
   * key stays with the editor; a browser has no bell, so the honest translation
   * of "refused, not unhandled" is to swallow the key and change nothing. Letting
   * it fall through to the page instead would make Alt+T mean one thing on a line
   * with two words and whatever the page decided on a line with one, which is a
   * worse surprise than silence. The `preventDefault` lives in the dispatcher, so
   * doing nothing here is what produces it.
   */
  transposeWords(textinput: TextField) {
    applyCaseEdit(textinput, transposeWordsEdit);
  },
  /**
   * Kills backward to the start of the previous whitespace-delimited word —
   * readline's C-w, reachable only through a chord the user assigned in
   * chrome://extensions/shortcuts, because Chrome reserves Ctrl+W.
   *
   * A kill like any other: backward direction, so it chains with the line kill
   * and prepends to the entry, and a password field's text leaves the field
   * without entering the ring.
   */
  unixWordRubout(textinput: TextField) {
    const start = textinput.selectionStart;
    const end = textinput.selectionEnd;
    if (start == null || end == null) return;
    kill(textinput, unixWordRuboutRegion(textinput.value, start, end), "backward");
  },
  /**
   * Swaps the two graphemes around the caret — readline's C-t, reached the same
   * way, because Chrome reserves Ctrl+T.
   *
   * The edit goes through the same `insertText` path as the case operations, so
   * it joins the field's own undo history and the page sees an `input` event. It
   * carries no ring role: nothing leaves the field, so a transpose between two
   * kills breaks the chain instead of splicing them across text it rearranged.
   *
   * A null edit is the refusal `transposeCharsEdit` reports at position 0 and on
   * a value too short to have two graphemes; the key is still consumed, which is
   * how readline's bell translates here.
   */
  transposeChars(textinput: TextField) {
    applyCaseEdit(textinput, transposeCharsEdit);
  },
};

/**
 * Applies a computed edit to a field, writing only when the text really changes.
 *
 * The write goes through the same `execCommand("insertText")` path as the yank,
 * for the same reason: it joins the field's own undo stack and raises an `input`
 * event the page can see. A transform that returns the text already there is not
 * written at all — the caret still moves, but the value is untouched and no undo
 * entry is created, so Alt+U on a word that is already upper case cannot leave
 * the user with a Ctrl+Z that appears to do nothing.
 *
 * A null edit is the refusal `transposeWordsEdit` reports, and it moves nothing.
 */
function applyCaseEdit(
  textinput: TextField,
  compute: (value: string, caret: number) => CaseEdit | null,
): void {
  if (textinput.readOnly || textinput.disabled) return;
  const caret = textinput.selectionEnd;
  if (caret == null) return;

  const edit = compute(textinput.value, caret);
  if (edit === null) return;

  if (edit.text === textinput.value.slice(edit.start, edit.end)) {
    textinput.setSelectionRange(edit.caret, edit.caret);
    return;
  }
  replaceRangeNatively(textinput, edit.start, edit.end, edit.text);
  textinput.setSelectionRange(edit.caret, edit.caret);
}

/**
 * Removes a region and tells the ring what left the field.
 *
 * The slice is read before the removal, because afterwards it is gone. A
 * password field's text is killed like any other but reported as unstorable, so
 * the secret never enters the ring and the kill chain breaks around it.
 *
 * The two caret positions the ring needs are the two ends of the region, and
 * which is which follows the direction: a forward kill starts at `region.start`
 * and leaves the caret there, while a backward kill starts at `region.end` and
 * pulls the caret back to `region.start`.
 */
function kill(textinput: TextField, region: KillRegion, direction: "forward" | "backward"): void {
  if (textinput.readOnly || textinput.disabled) return;
  const text = textinput.value.slice(region.start, region.end);
  applyKillRegion(textinput, region);
  recordKill({
    direction,
    text,
    elementToken: textinput,
    caretBefore: direction === "forward" ? region.start : region.end,
    caretAfter: region.start,
    storable: !isPasswordField(textinput),
  });
}

/**
 * The native undo, reported as whether the engine actually performed it.
 *
 * Shaped like `deleteSelection` in `killregion.ts` and `insertText` in
 * `yank.ts`: focus the target, ask the engine, and treat a missing or throwing
 * `execCommand` as a refusal rather than an error. The boolean is returned for
 * callers that may want it; the binding itself has nothing to do when the
 * engine says no, since an undo that did not happen leaves the field as it was.
 */
function runUndo(target: TextField | HTMLElement): boolean {
  if (typeof document.execCommand !== "function") return false;
  target.focus();
  try {
    return document.execCommand("undo");
  } catch {
    return false;
  }
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
