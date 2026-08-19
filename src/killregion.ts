import { cursor } from "./cursor";

/**
 * A half-open range `[start, end)` of the field's value that a kill removes,
 * with `start` doubling as where the caret lands once the text is gone.
 *
 * Offsets are UTF-16 code units, matching `selectionStart`/`selectionEnd`;
 * grapheme integrity is not claimed at this layer.
 */
export interface KillRegion {
  start: number;
  end: number;
}

/**
 * The region a kill-to-end-of-line removes: from the selection's end to the
 * next newline, or to the end of the value when the line is the last one.
 *
 * With a non-collapsed selection the selected text survives and the kill takes
 * only what follows it.
 */
export function endOfLineRegion(
  value: string,
  _selectionStart: number,
  selectionEnd: number,
): KillRegion {
  return { start: selectionEnd, end: cursor.getEndOfLine(value, selectionEnd) };
}

/**
 * The region a kill-to-top-of-line removes: from the start of the line to the
 * selection's start.
 *
 * With a non-collapsed selection the selected text survives and the kill takes
 * only what precedes it.
 */
export function topOfLineRegion(
  value: string,
  selectionStart: number,
  _selectionEnd: number,
): KillRegion {
  return { start: cursor.getTopOfLine(value, selectionStart), end: selectionStart };
}
