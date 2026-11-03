/**
 * @file tutorial.ts
 * @brief The tutorial's steps and the rule that moves from one to the next.
 *
 * The decision is ADR-0018, "A tutorial opens from the toolbar icon's menu and
 * advances on the field state each chord produces".
 */

/** What a step reads from its field: the value and where the selection lies. */
export interface FieldState {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Whether a keydown moves the tutorial past its step: the keymap handled the
 * key, and the field it left equals the step's Then state. The Then state
 * reached by arrow keys, the mouse or typing does not count, nor does a
 * handled chord that left the field elsewhere.
 */
export function advances(then: FieldState, after: FieldState, handled: boolean): boolean {
  return (
    handled &&
    after.value === then.value &&
    after.selectionStart === then.selectionStart &&
    after.selectionEnd === then.selectionEnd
  );
}

/**
 * One lesson: the field is put in the Given state, the user presses the chord
 * the keymap in force binds to `operationId`, and the step passes on the Then
 * state (`advances`).
 */
export interface TutorialStep {
  operationId: string;
  given: FieldState;
  then: FieldState;
}

function caret(value: string, at: number): FieldState {
  return { value, selectionStart: at, selectionEnd: at };
}

/**
 * The steps in order, one edit of a single line carried through: each opens
 * where the one before it ends, so the yank puts back the word the kill took.
 */
export const tutorialSteps: readonly TutorialStep[] = [
  { operationId: "move_cursor_to_the_beginning", given: caret("hello world", 11), then: caret("hello world", 0) },
  { operationId: "move_cursor_to_the_end", given: caret("hello world", 0), then: caret("hello world", 11) },
  { operationId: "move_cursor_to_the_previous_word", given: caret("hello world", 11), then: caret("hello world", 6) },
  { operationId: "delete_to_the_end_of_the_line", given: caret("hello world", 6), then: caret("hello ", 6) },
  { operationId: "yank", given: caret("hello ", 6), then: caret("hello world", 11) },
];
