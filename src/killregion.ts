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
 * A caret sitting exactly ON the newline takes the newline itself, which is what
 * joins the two lines — readline's C-k at a line end, and the reason three
 * presses from a line start accumulate line, newline and next line into one ring
 * entry rather than stalling on the boundary. Without this the second press
 * would find an empty region, record nothing, and leave the newline in place
 * forever.
 *
 * At the END OF THE VALUE there is no newline to take and the region stays
 * empty, so `applyKillRegion`'s guard still holds and Ctrl+K there does nothing
 * at all. That is the one empty case, and it is the one C1.14 names.
 *
 * With a non-collapsed selection the selected text survives and the kill takes
 * only what follows it.
 */
export function endOfLineRegion(
  value: string,
  _selectionStart: number,
  selectionEnd: number,
): KillRegion {
  const end = cursor.getEndOfLine(value, selectionEnd);
  if (end === selectionEnd && value[selectionEnd] === "\n") {
    return { start: selectionEnd, end: selectionEnd + 1 };
  }
  return { start: selectionEnd, end };
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
 * The region a kill-word removes: from the selection's end to the end of the
 * word ahead of it, separators included.
 *
 * The boundary is the one the Alt+f motion already uses, so Alt+d removes
 * exactly what Alt+f moves over. A caret sitting on a separator run takes that
 * run together with the word after it, which is readline's M-d and this
 * extension's own motion agreeing.
 */
export function forwardWordRegion(
  value: string,
  _selectionStart: number,
  selectionEnd: number,
): KillRegion {
  return { start: selectionEnd, end: cursor.getEndOfWord(value, selectionEnd) };
}

/**
 * The region a backward kill-word removes: from the start of the word behind
 * the caret to the selection's start.
 *
 * The ordering guard is not decoration. `cursor.getTopOfWord` is a search, and
 * a search that returns something outside the value would make this a region
 * that deletes text the user never selected — the failure a kill cannot afford
 * and a motion can (a caret motion clamps a bad offset; a deletion acts on it).
 * The helper's own boundary is pinned in test/topofword.test.ts; this keeps the
 * region well-formed regardless, because the cost of the two disagreeing is
 * measured in the user's text.
 */
export function backwardWordRegion(
  value: string,
  selectionStart: number,
  _selectionEnd: number,
): KillRegion {
  const top = cursor.getTopOfWord(value, selectionStart);
  return { start: Math.max(0, Math.min(top, selectionStart)), end: selectionStart };
}

/**
 * The extent of the grapheme cluster starting at the caret, or an empty region
 * at the end of the value.
 *
 * A character delete is measured in what the user sees as one character, not in
 * UTF-16 code units: an emoji built from a surrogate pair, a family joined by
 * zero-width joiners and a letter carrying a combining mark are each one press
 * of the key. Splitting any of them leaves a fragment that renders as a
 * replacement glyph and cannot be typed back, so the cluster is the unit.
 *
 * A caret that a page script parked inside a cluster is snapped outward to the
 * cluster's own bounds rather than honoured, for the same reason.
 */
export function nextGraphemeRegion(
  value: string,
  _selectionStart: number,
  selectionEnd: number,
): KillRegion {
  const caret = clamp(selectionEnd, value.length);
  if (caret >= value.length) return { start: value.length, end: value.length };
  const cluster = clusterAt(value, caret);
  return { start: cluster.start, end: cluster.end };
}

/**
 * The extent of the grapheme cluster ending at the caret, or an empty region at
 * the start of the value. The mirror of `nextGraphemeRegion`, cluster for
 * cluster.
 */
export function previousGraphemeRegion(
  value: string,
  selectionStart: number,
  _selectionEnd: number,
): KillRegion {
  const caret = clamp(selectionStart, value.length);
  if (caret <= 0) return { start: 0, end: 0 };
  const cluster = clusterAt(value, caret - 1);
  return { start: cluster.start, end: cluster.end };
}

function clamp(position: number, length: number): number {
  return Math.max(0, Math.min(position, length));
}

/**
 * The grapheme cluster containing a code-unit offset.
 *
 * `Intl.Segmenter` is the platform's own cluster definition, which is what
 * keeps this in step with how the engine renders and how Backspace behaves in a
 * field the extension is not touching. Where it is missing the fallback is a
 * single code point, taken whole — half of a surrogate pair is never returned,
 * because a smaller unit is a degradation and a split character is a defect.
 */
function clusterAt(value: string, offset: number): KillRegion {
  const segmenter = graphemeSegmenter();
  if (segmenter) {
    for (const segment of segmenter.segment(value)) {
      const end = segment.index + segment.segment.length;
      if (offset < end) return { start: segment.index, end };
    }
    return { start: value.length, end: value.length };
  }
  return codePointAt(value, offset);
}

let segmenterCache: Intl.Segmenter | null | undefined;

function graphemeSegmenter(): Intl.Segmenter | null {
  if (segmenterCache !== undefined) return segmenterCache;
  segmenterCache =
    typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
      ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
      : null;
  return segmenterCache;
}

/** The whole code point covering an offset, so a surrogate pair stays intact. */
function codePointAt(value: string, offset: number): KillRegion {
  let start = offset;
  const unit = value.charCodeAt(start);
  const isLowSurrogate = unit >= 0xdc00 && unit <= 0xdfff;
  if (isLowSurrogate && start > 0) {
    const previous = value.charCodeAt(start - 1);
    if (previous >= 0xd800 && previous <= 0xdbff) start -= 1;
  }
  const point = value.codePointAt(start);
  const width = point !== undefined && point > 0xffff ? 2 : 1;
  return { start, end: Math.min(start + width, value.length) };
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
