/**
 * @file commandroute.ts
 * @brief What a reclaimed chord does, decided from the command name and what the
 *        active tab reports about its focus — as a pure function, so the half of
 *        the behaviour the harness cannot press is still testable.
 *
 * The chords these route are Chrome's own. A page can never cancel Ctrl+W or
 * Ctrl+T: the browser handles them before the renderer sees them. The one
 * documented way in is the commands API — a command the user assigns in
 * chrome://extensions/shortcuts is dispatched INSTEAD of the browser action —
 * and that assignment is the user's, not the manifest's, because a reserved
 * chord cannot be suggested. See ADR-0011.
 *
 * Taking a chord away from the browser means owing back what it did. A user who
 * presses Ctrl+W with nothing focused means "close this tab", and the extension
 * having claimed the chord is no reason for nothing to happen. So the decision
 * has two arms, and the arm that reproduces the browser action is as much the
 * feature as the arm that runs the operation.
 */

/** The two commands the manifest declares, by their manifest names. */
export const unixWordRuboutCommand = "unix_word_rubout";
export const transposeCharsCommand = "transpose_chars";

/** What the active tab reports about where the keystroke would have landed. */
export interface FocusState {
  /** Whether a field razorshell's own `isTextField`/contenteditable opt-in covers has focus. */
  textFieldFocused: boolean;
  /**
   * Whether the URL policy leaves razorshell on in that frame. Absent means yes:
   * a content script that answered at all is a frame the policy allowed to load
   * one, and the caller reports the denial explicitly when it knows of it.
   */
  enabled?: boolean;
}

/**
 * What the service worker should do about a dispatched command.
 *
 * `run` names the operation for the content script; the other three are the
 * worker's own business. `ignore` covers a command name the build does not know,
 * which is not routed at all rather than guessed at.
 */
export type CommandAction =
  | { kind: "run"; operation: string }
  | { kind: "close-tab" }
  | { kind: "new-tab" }
  | { kind: "ignore" };

/**
 * The routing decision.
 *
 * Focused AND enabled runs the operation; anything else reproduces the displaced
 * browser action. A denied frame is deliberately not a special case with its own
 * arm — the extension is off there, so the honest behaviour is the browser's
 * own, exactly as if nothing had focus.
 */
export function commandAction(command: string, focus: FocusState): CommandAction {
  const active = focus.textFieldFocused && focus.enabled !== false;

  if (command === unixWordRuboutCommand) {
    return active ? { kind: "run", operation: unixWordRuboutCommand } : { kind: "close-tab" };
  }
  if (command === transposeCharsCommand) {
    return active ? { kind: "run", operation: transposeCharsCommand } : { kind: "new-tab" };
  }
  return { kind: "ignore" };
}
