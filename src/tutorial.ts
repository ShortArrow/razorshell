/**
 * @file tutorial.ts
 * @brief The rule that moves the tutorial from one step to the next.
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
