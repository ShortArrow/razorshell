import { cursor } from "./cursor";
import type { TextField } from "./operation";

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

/**
 * Removes a region from a field the way the browser removes text itself, so the
 * kill joins the field's native undo stack and the page sees an `input` event.
 *
 * Selecting the region and running `execCommand("delete")` is what buys both:
 * the engine treats it as a user deletion. The empty-region guard is load-
 * bearing rather than an optimisation — with an empty selection `delete` acts
 * as Backspace and eats the preceding character (measured 2026-08-20), so a
 * Ctrl+K at the end of a line would silently delete backwards.
 *
 * Where `execCommand` is absent or refuses (jsdom, and any engine that drops
 * it), the value is spliced instead. That path restores the text correctly but
 * claims no undo and emits no event; it is a degradation, not an equivalent.
 */
export function applyKillRegion(field: TextField, region: KillRegion) {
  if (region.start === region.end) return;
  if (field.readOnly || field.disabled) return;

  field.setSelectionRange(region.start, region.end);
  if (!deleteSelection(field)) {
    field.value = field.value.slice(0, region.start) + field.value.slice(region.end);
  }
  field.setSelectionRange(region.start, region.start);
}

/** The native deletion, reported as whether the engine actually performed it. */
function deleteSelection(field: TextField): boolean {
  if (typeof document.execCommand !== "function") return false;
  field.focus();
  try {
    return document.execCommand("delete");
  } catch {
    return false;
  }
}
