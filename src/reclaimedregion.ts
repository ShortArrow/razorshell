/**
 * @file reclaimedregion.ts
 * @brief The two operations behind the reclaimed chords, as pure functions of
 *        value and caret: which span changes, what it becomes, where the caret
 *        lands.
 *
 * Nothing here touches the DOM, the shape `killregion.ts` and `caseregion.ts`
 * already use. Both semantics are read off readline's C source rather than its
 * manual, because for both the manual is too loose to implement from.
 */
import type { KillRegion } from "./killregion";
import type { CaseEdit } from "./caseregion";

/**
 * The region readline's `unix-word-rubout` (C-w) removes: backward over any
 * whitespace run, then backward over the non-whitespace before it.
 *
 * From `rl_unix_word_rubout` in readline's `kill.c`, which is two loops and a
 * kill:
 *
 *     while (rl_point && whitespace (rl_line_buffer[rl_point - 1]))
 *       rl_point--;
 *     while (rl_point && (whitespace (rl_line_buffer[rl_point - 1]) == 0))
 *       rl_point--;
 *     rl_kill_text (orig_point, rl_point);
 *
 * The delimiter is WHITESPACE and nothing else, which is what separates this
 * from `backward_kill_word`: that one is delimited by word constituents, so
 * `"foo bar-baz|"` gives the two different answers — the rubout takes
 * `bar-baz` whole, the word kill takes only `baz`. A shell user reaches for C-w
 * precisely to swallow a path or a hyphenated token in one press, so aliasing
 * the two would remove the reason this binding exists.
 *
 * Both loops are guarded on `rl_point`, so a caret with only whitespace behind
 * it walks to 0 and stops rather than running off the buffer; `rl_point == 0`
 * rings the bell and kills nothing, which here is the empty region the caller's
 * own guard already treats as no event.
 *
 * With a non-collapsed selection the selected text survives and the rubout takes
 * only what precedes it, matching every other backward kill in this extension.
 */
export function unixWordRuboutRegion(
  value: string,
  selectionStart: number,
  _selectionEnd: number,
): KillRegion {
  const end = clamp(selectionStart, value.length);
  let start = end;
  while (start > 0 && isWhitespace(value[start - 1])) start -= 1;
  while (start > 0 && !isWhitespace(value[start - 1])) start -= 1;
  return { start, end };
}

/**
 * What readline's `transpose-chars` (C-t) replaces, and where it leaves the
 * caret, measured in whole graphemes.
 *
 * From `rl_transpose_chars` in readline's `text.c`:
 *
 *     if (!rl_point || rl_end < 2) { rl_ding (); return 1; }
 *     if (rl_point == rl_end)
 *       { rl_point = MB_PREVCHAR (...); count = 1; }
 *     prev_point = rl_point;
 *     rl_point = MB_PREVCHAR (...);
 *     dummy = <the character at rl_point>
 *     rl_delete_text (rl_point, rl_point + char_length);
 *     rl_point = _rl_find_next_mbchar (rl_line_buffer, rl_point, count, ...);
 *     rl_insert_text (dummy);
 *
 * Three branches follow from that, and this function reproduces each:
 *
 * - `rl_point == 0`, or a buffer shorter than two characters, is a bell and no
 *   edit at all. Returns null, which the caller must treat as "consume the key
 *   and leave the field alone" — the translation of readline's bell this
 *   extension already settled on for `transpose-words`.
 * - AT THE END OF THE LINE the point steps back one first, so the two characters
 *   BEFORE the caret are transposed and the caret stays where it was. `"abc"` at
 *   3 therefore produces exactly what `"abc"` at 2 produces.
 * - MID-LINE the character before the caret is lifted out and reinserted after
 *   the character that was at the caret, leaving the caret past both.
 *
 * `MB_PREVCHAR` and `_rl_find_next_mbchar` are readline's multibyte steps, so
 * the unit in the C is a character rather than a byte. The browser equivalent is
 * a grapheme cluster, not a UTF-16 code unit: an emoji built from a surrogate
 * pair or joined by ZWJ must cross the caret whole, because half of one renders
 * as a replacement glyph and cannot be typed back. The clusters come from
 * `Intl.Segmenter`, the same platform definition the character deletes use, and
 * a caret a page script parked inside a cluster is snapped to that cluster's own
 * bounds rather than honoured.
 */
export function transposeCharsEdit(value: string, caret: number): CaseEdit | null {
  const clusters = graphemes(value);
  if (clusters.length < 2) return null;

  const point = clusterIndexAt(clusters, clamp(caret, value.length));
  if (point <= 0) return null;

  const index = point === clusters.length ? point - 1 : point;
  const left = clusters[index - 1];
  const right = clusters[index];
  const start = offsetOf(clusters, index - 1);
  const end = start + left.length + right.length;

  return { start, end, text: right + left, caret: end };
}

/** The value split into grapheme clusters, or into code points where
 * `Intl.Segmenter` is missing — a smaller unit is a degradation, but a split
 * surrogate pair would be a defect, so the fallback still never returns half a
 * character. */
function graphemes(value: string): string[] {
  const segmenter = graphemeSegmenter();
  if (segmenter) return Array.from(segmenter.segment(value), (segment) => segment.segment);
  return Array.from(value);
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

/**
 * How many whole clusters lie before a code-unit offset.
 *
 * An offset falling INSIDE a cluster counts that cluster as not yet crossed, so
 * the caret snaps to the cluster's start — the outward snap the grapheme deletes
 * perform, expressed in cluster indices.
 */
function clusterIndexAt(clusters: string[], offset: number): number {
  let consumed = 0;
  for (let index = 0; index < clusters.length; index += 1) {
    if (offset < consumed + clusters[index].length) return index;
    consumed += clusters[index].length;
  }
  return clusters.length;
}

/** The code-unit offset a cluster index starts at. */
function offsetOf(clusters: string[], index: number): number {
  let offset = 0;
  for (let i = 0; i < index; i += 1) offset += clusters[i].length;
  return offset;
}

/**
 * Whitespace in the sense the rubout's boundary needs.
 *
 * Readline's `whitespace()` macro tests space and tab only, because its buffer
 * is a single line and cannot contain a newline. A textarea can, so a line break
 * is a separator here for the same reason it is one in `cursor.ts` — a rubout
 * that treated `\n` as a word constituent would reach across a line boundary and
 * swallow the previous line's last word along with the break.
 */
function isWhitespace(character: string | undefined): boolean {
  return character === " " || character === "\t" || character === "\n" || character === "\r";
}

function clamp(position: number, length: number): number {
  return Math.max(0, Math.min(position, length));
}
