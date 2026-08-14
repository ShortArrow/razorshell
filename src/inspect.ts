/**
 * @file inspect.ts
 * @brief Probes a text field for keymap chords the hosting page already
 *        consumes, so a conflict is observed rather than guessed at.
 */

import { Keymap, TextField } from "./operation";

interface FieldState {
  value: string;
  selectionStart: number | null;
  selectionEnd: number | null;
}

function captureState(field: TextField): FieldState {
  return {
    value: field.value,
    selectionStart: field.selectionStart,
    selectionEnd: field.selectionEnd,
  };
}

function restoreState(field: TextField, state: FieldState): void {
  if (field.value !== state.value) field.value = state.value;
  if (state.selectionStart === null || state.selectionEnd === null) return;
  field.setSelectionRange(state.selectionStart, state.selectionEnd);
}

function chordEvent(entry: Keymap): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: entry.key,
    ctrlKey: entry.ctrl === true,
    altKey: entry.alt === true,
    shiftKey: entry.shift === true,
    bubbles: true,
    cancelable: true,
  });
}

function isConsumed(field: TextField, entry: Keymap): boolean {
  const state = captureState(field);
  const event = chordEvent(entry);
  field.dispatchEvent(event);
  restoreState(field, state);
  return event.defaultPrevented;
}

/**
 * @fn probeConflicts
 * @brief Dispatch each keymap chord at the field and collect the entries the
 *        page cancels, leaving the field's value and selection as they were.
 * @param TextField field - The field to probe
 * @param Keymap[] keymap - The entries to probe with
 * @return Keymap[] - The cancelled entries, in keymap order
 */
export function probeConflicts(field: TextField, keymap: Keymap[]): Keymap[] {
  return keymap.filter((entry) => isConsumed(field, entry));
}
