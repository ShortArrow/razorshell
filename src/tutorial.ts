/**
 * @file tutorial.ts
 * @brief The tutorial's steps and the rule that moves from one to the next.
 *
 * The decision is ADR-0018, "A tutorial opens from the toolbar icon's menu and
 * advances on the field state each chord produces".
 */

import type { Keymap } from "./operation";

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
  /** The earlier step whose effect this one needs to reach its Then state. */
  restsOn?: string;
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
  {
    operationId: "yank",
    given: caret("hello ", 6),
    then: caret("hello world", 11),
    restsOn: "delete_to_the_end_of_the_line",
  },
];

/** Why a step is left out: its operation has no binding, or it rests on a step left out. */
export type SkipReason = "unassigned" | "rests-on-skipped";

/** A step left out of the tutorial, and why. */
export interface SkippedStep {
  step: TutorialStep;
  reason: SkipReason;
}

/**
 * Each step paired with why the given keymap leaves it out, or `undefined`
 * for a step it can teach: an operation with no entry in the keymap, or whose
 * entry is unassigned (ADR-0012), cannot be taught, nor can a step that rests
 * on one left out.
 */
function sortSteps(keymap: readonly Keymap[]): { step: TutorialStep; reason: SkipReason | undefined }[] {
  const kept = new Set<string>();
  return tutorialSteps.map((step) => {
    const bound = keymap.some((entry) => entry.id === step.operationId && entry.unassigned !== true);
    const footing = step.restsOn === undefined || kept.has(step.restsOn);
    const reason = !bound ? "unassigned" : !footing ? "rests-on-skipped" : undefined;
    if (reason === undefined) kept.add(step.operationId);
    return { step, reason };
  });
}

/** The steps the given keymap can teach, in order. */
export function stepsFor(keymap: readonly Keymap[]): TutorialStep[] {
  return sortSteps(keymap).filter(({ reason }) => reason === undefined).map(({ step }) => step);
}

/** The steps the given keymap leaves out, in order, each with why. */
export function skippedFor(keymap: readonly Keymap[]): SkippedStep[] {
  return sortSteps(keymap).flatMap(({ step, reason }) => (reason === undefined ? [] : [{ step, reason }]));
}
