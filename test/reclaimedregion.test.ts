/**
 * The two regions the reclaimed chords compute, and the routing decision that
 * chooses between running one and reproducing the browser action it displaced.
 *
 * Both operations are *specifications* read off readline's C source rather than
 * its manual, because for both the manual is too loose to implement from. The
 * verbatim sources are quoted in the docstrings of `src/reclaimedregion.ts` and
 * `src/commandroute.ts`; the expectations here are traced from those sources by
 * hand, one case per branch of the C.
 *
 * ON THE DIVERGENCE THAT IS NOT ONE. In readline, C-w and M-DEL disagree:
 * `unix-word-rubout` is delimited by WHITESPACE while `backward-kill-word` walks
 * `rl_backward_word`, whose boundary is `rl_alphabetic` (isalnum), so
 * `"foo bar-baz|"` gives them different answers — the rubout takes `bar-baz`
 * whole, the word kill takes only `baz`.
 *
 * Razorshell's `backward_kill_word` does NOT have readline's boundary. It
 * deliberately mirrors this extension's own Alt+b motion (`cursor.getTopOfWord`),
 * whose separator set is space, tab, newline and carriage return — which is the
 * rubout's boundary. The two are therefore EXTENSIONALLY EQUAL here: an
 * exhaustive search over every string up to length six on the alphabet
 * `{a, space, newline}` finds no caret at which they differ, and the hyphen case
 * that separates them in readline does not separate them here.
 *
 * The case is kept below, asserting the equality rather than a difference,
 * because the fact is worth pinning: if `getTopOfWord` is ever moved to
 * readline's alphanumeric boundary — which would be the faithful thing for
 * M-DEL — that change must make this test red, so that the rubout is not
 * silently dragged along with it. The rubout's boundary is whitespace by
 * specification and is defined here in its own module rather than shared, so it
 * is immune to that edit.
 */
import { describe, expect, test } from "vitest";
import { unixWordRuboutRegion, transposeCharsEdit } from "../src/reclaimedregion";
import { backwardWordRegion } from "../src/killregion";
import { commandAction } from "../src/commandroute";

/** The text a region removes. */
function killed(value: string, region: { start: number; end: number }): string {
  return value.slice(region.start, region.end);
}

/** The value that remains once a region is removed. */
function remaining(value: string, region: { start: number; end: number }): string {
  return value.slice(0, region.start) + value.slice(region.end);
}

describe("unixWordRuboutRegion follows rl_unix_word_rubout", () => {
  /**
   * The C runs two loops from the caret: first backward over whitespace, then
   * backward over non-whitespace, and kills from where it stopped to where it
   * started. A caret sitting immediately after a word therefore skips nothing in
   * the first loop and takes the whole word in the second.
   */
  test("caret after a word takes that word", () => {
    const value = "foo bar";
    expect(unixWordRuboutRegion(value, 7, 7)).toEqual({ start: 4, end: 7 });
    expect(killed(value, unixWordRuboutRegion(value, 7, 7))).toBe("bar");
    expect(remaining(value, unixWordRuboutRegion(value, 7, 7))).toBe("foo ");
  });

  /**
   * A hyphenated token goes whole: `-` is not whitespace, so neither loop stops
   * at it. In readline this is where C-w parts company with M-DEL; here
   * `backward_kill_word` reaches the same answer, because it follows Alt+b's
   * whitespace boundary rather than readline's alphanumeric one. The second
   * half of this test states that equality as the current fact — see the file
   * docstring for why it is asserted rather than assumed away.
   */
  test("a hyphenated word goes whole, and backward_kill_word currently agrees", () => {
    const value = "foo bar-baz";
    const caret = value.length;

    const rubout = unixWordRuboutRegion(value, caret, caret);
    expect(killed(value, rubout)).toBe("bar-baz");
    expect(remaining(value, rubout)).toBe("foo ");

    expect(backwardWordRegion(value, caret, caret)).toEqual(rubout);
  });

  /** Punctuation of every kind rides along, for the same reason the hyphen does. */
  test("punctuation inside a run is not a boundary", () => {
    const value = "cd /usr/local/bin";
    const caret = value.length;
    expect(killed(value, unixWordRuboutRegion(value, caret, caret))).toBe("/usr/local/bin");
  });

  /**
   * The first loop is what makes trailing whitespace part of the kill: it walks
   * back over the run before the second loop ever looks at a word.
   */
  test("trailing whitespace is skipped and the word behind it taken with it", () => {
    const value = "foo bar   ";
    const caret = value.length;
    expect(killed(value, unixWordRuboutRegion(value, caret, caret))).toBe("bar   ");
    expect(remaining(value, unixWordRuboutRegion(value, caret, caret))).toBe("foo ");
  });

  test("multiple spaces between words are crossed in one press", () => {
    const value = "foo     bar";
    const caret = value.length;
    expect(killed(value, unixWordRuboutRegion(value, caret, caret))).toBe("bar");

    const next = remaining(value, unixWordRuboutRegion(value, caret, caret));
    expect(next).toBe("foo     ");
    expect(killed(next, unixWordRuboutRegion(next, next.length, next.length))).toBe("foo     ");
  });

  /**
   * Both loops are guarded on `rl_point`, so a caret with only whitespace behind
   * it walks to 0 and stops there rather than running off the buffer.
   */
  test("only whitespace behind the caret takes all of it and stops at 0", () => {
    const value = "   hello";
    expect(unixWordRuboutRegion(value, 3, 3)).toEqual({ start: 0, end: 3 });
    expect(killed(value, unixWordRuboutRegion(value, 3, 3))).toBe("   ");
  });

  test("caret at the value start yields an empty region", () => {
    expect(unixWordRuboutRegion("hello", 0, 0)).toEqual({ start: 0, end: 0 });
  });

  test("an empty value yields an empty region", () => {
    expect(unixWordRuboutRegion("", 0, 0)).toEqual({ start: 0, end: 0 });
  });

  test("caret mid-word takes only back to the word start", () => {
    const value = "foo barbaz";
    expect(killed(value, unixWordRuboutRegion(value, 7, 7))).toBe("bar");
    expect(remaining(value, unixWordRuboutRegion(value, 7, 7))).toBe("foo baz");
  });

  /** A newline is whitespace to the C `whitespace()` macro's tab-and-space test
   * only, but this field model treats a line break as a separator like the rest
   * of the extension does; the region must not cross into the previous line's
   * word without taking the break itself. */
  test("a newline behind the caret is crossed as whitespace", () => {
    const value = "foo\nbar";
    expect(killed(value, unixWordRuboutRegion(value, 7, 7))).toBe("bar");
  });

  /**
   * With a non-collapsed selection the selected text survives and the rubout
   * takes only what precedes it, matching every other backward kill here.
   */
  test("a selection is preserved and only the text before it is taken", () => {
    const value = "foo bar baz";
    expect(unixWordRuboutRegion(value, 8, 11)).toEqual({ start: 4, end: 8 });
  });
});

describe("transposeCharsEdit follows rl_transpose_chars", () => {
  /**
   * Mid-line, the C saves the char before the caret, deletes it, steps forward
   * one char and reinserts — so the char before the caret ends up after the char
   * that was at it, and the caret lands past both.
   */
  test("mid-line swaps the char before the caret with the char at it", () => {
    expect(transposeCharsEdit("abc", 1)).toEqual({ start: 0, end: 2, text: "ba", caret: 2 });
  });

  test("mid-line, one further along", () => {
    expect(transposeCharsEdit("abc", 2)).toEqual({ start: 1, end: 3, text: "cb", caret: 3 });
  });

  /**
   * At the end of the line the C steps the point back one first, then runs the
   * same path — so the two characters BEFORE the caret are transposed and the
   * caret stays where it was. `"abc"` at 3 therefore gives the same result as
   * `"abc"` at 2.
   */
  test("at the end of the line the two chars before the caret are transposed", () => {
    expect(transposeCharsEdit("abc", 3)).toEqual({ start: 1, end: 3, text: "cb", caret: 3 });
  });

  test("a two-character value at its end transposes the pair", () => {
    expect(transposeCharsEdit("ab", 2)).toEqual({ start: 0, end: 2, text: "ba", caret: 2 });
  });

  /** `if (!rl_point || rl_end < 2) { rl_ding (); return 1; }` — the two refusals. */
  test("position 0 is a no-op", () => {
    expect(transposeCharsEdit("abc", 0)).toBeNull();
  });

  test("a value shorter than two characters is a no-op", () => {
    expect(transposeCharsEdit("a", 1)).toBeNull();
    expect(transposeCharsEdit("", 0)).toBeNull();
  });

  /**
   * The unit is the grapheme, not the code unit. An emoji built from a surrogate
   * pair must cross the caret whole; splitting it leaves a lone surrogate that
   * renders as a replacement glyph and cannot be typed back.
   */
  test("an emoji pair transposes as whole graphemes", () => {
    const value = "a\u{1F600}";
    const edit = transposeCharsEdit(value, value.length);
    expect(edit).not.toBeNull();
    expect(value.slice(0, edit!.start) + edit!.text + value.slice(edit!.end)).toBe("\u{1F600}a");
  });

  test("a ZWJ family sequence is one grapheme on both sides of the swap", () => {
    const family = "\u{1F468}‍\u{1F469}‍\u{1F467}";
    const value = `x${family}`;
    const edit = transposeCharsEdit(value, value.length);
    expect(edit).not.toBeNull();
    expect(value.slice(0, edit!.start) + edit!.text + value.slice(edit!.end)).toBe(`${family}x`);
  });

  test("a combining mark stays attached to its base letter", () => {
    const value = "aé";
    const edit = transposeCharsEdit(value, value.length);
    expect(edit).not.toBeNull();
    expect(value.slice(0, edit!.start) + edit!.text + value.slice(edit!.end)).toBe("éa");
  });

  /**
   * A caret parked inside a cluster by a page script is snapped to the cluster's
   * own bounds rather than honoured, for the reason the grapheme deletes give.
   */
  test("a caret inside a surrogate pair does not split it", () => {
    const value = "a\u{1F600}b";
    const edit = transposeCharsEdit(value, 2);
    expect(edit).not.toBeNull();
    expect(value.slice(0, edit!.start) + edit!.text + value.slice(edit!.end)).toBe("\u{1F600}ab");
  });
});

/**
 * The routing decision: four classes, each command against a focused and an
 * unfocused text field. The function is pure so that the half of C1.18 the
 * harness cannot press — a real reserved chord reaching the service worker —
 * still has its consequence tested.
 */
describe("commandAction routes by focus", () => {
  test("a rubout with a text field focused runs the operation", () => {
    expect(commandAction("unix_word_rubout", { textFieldFocused: true })).toEqual({
      kind: "run",
      operation: "unix_word_rubout",
    });
  });

  test("a rubout outside a text field closes the tab the chord would have closed", () => {
    expect(commandAction("unix_word_rubout", { textFieldFocused: false })).toEqual({
      kind: "close-tab",
    });
  });

  test("a transpose with a text field focused runs the operation", () => {
    expect(commandAction("transpose_chars", { textFieldFocused: true })).toEqual({
      kind: "run",
      operation: "transpose_chars",
    });
  });

  test("a transpose outside a text field opens the tab the chord would have opened", () => {
    expect(commandAction("transpose_chars", { textFieldFocused: false })).toEqual({
      kind: "new-tab",
    });
  });

  /**
   * A frame the URL policy denies is not a focused text field for this purpose:
   * the extension is off there, so the chord must behave as the browser's own.
   */
  test("a denied frame reproduces the browser action even with a field focused", () => {
    expect(commandAction("unix_word_rubout", { textFieldFocused: false, enabled: false })).toEqual({
      kind: "close-tab",
    });
    expect(commandAction("transpose_chars", { textFieldFocused: true, enabled: false })).toEqual({
      kind: "new-tab",
    });
  });

  /** An unknown command name is not routed at all rather than guessed at. */
  test("an unrecognised command does nothing", () => {
    expect(commandAction("something_else", { textFieldFocused: true })).toEqual({ kind: "ignore" });
  });
});
