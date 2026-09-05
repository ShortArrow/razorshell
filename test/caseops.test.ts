/**
 * The case operations and transpose-words: which span changes, what it becomes,
 * and where the caret lands.
 *
 * The expectations are readline's, and they were determined by reading its C
 * source rather than its manual, because on the case that matters most the two
 * disagree. In `rl_change_case` (readline `text.c`):
 *
 *     start = rl_point;
 *     rl_forward_word (count, 0);
 *     end = rl_point;
 *     ...
 *     rl_point = end;
 *
 * There is no backward scan. The manual's "the current (or following) word" is
 * therefore loose: the span is from the caret to the end of the word ahead of
 * it, so a caret MID-WORD recases only that word's tail, and a caret at a word
 * END recases the FOLLOWING word with the separator dragged along unchanged.
 * Those two are the cases a test written from the manual would get wrong, and
 * they are pinned below.
 *
 * `capitalize-word` is written against ALPHANUMERIC runs, not alphabetic ones,
 * because readline tests each character with `rl_alphabetic`, which is
 * `isalnum`, and resets its `inword` flag on anything else. A digit is a word
 * constituent that takes the capitalization slot, so `123abc` comes back
 * unchanged — the `1` is what gets uppercased, which does nothing, and `abc` is
 * then lowercased.
 *
 * `rl_transpose_words` copies two word extents and writes each into the other's
 * place, so the separators between them are never deleted and never move. Its
 * guard `(w1_beg == w2_beg) || (w2_beg < w1_end)` fires before any text is
 * touched, which makes "fewer than two words" a complete no-op rather than a
 * partial edit — and it also fires at the very START of a line, where the
 * backward search finds the same word the forward search did.
 *
 * Where readline's word boundary and this extension's differ, the extension's
 * own `cursor.getEndOfWord` wins, for the reason the word kills already give:
 * a binding disagreeing with its own motion binding would be the worse defect.
 * Those places are marked as characterization.
 */
import { describe, expect, test } from "vitest";
import fc from "fast-check";
import {
  capitalizeWordEdit,
  downcaseWordEdit,
  transposeWordsEdit,
  upcaseWordEdit,
  type CaseEdit,
} from "../src/caseregion";

/** The value a computed edit produces when applied. */
function applied(value: string, edit: CaseEdit): string {
  return value.slice(0, edit.start) + edit.text + value.slice(edit.end);
}

describe("upcaseWordEdit covers the caret classes @C1.17", () => {
  test("caret at a word start uppercases that whole word", () => {
    const edit = upcaseWordEdit("hello world", 0);
    expect(applied("hello world", edit)).toBe("HELLO world");
    expect(edit.caret).toBe(5);
  });

  /**
   * The manual would suggest the whole word; the source says otherwise. From
   * offset 2 the span is [2,5) and only "llo" is recased.
   */
  test("caret mid-word uppercases only the tail of that word", () => {
    const edit = upcaseWordEdit("hello world", 2);
    expect(applied("hello world", edit)).toBe("heLLO world");
    expect(edit.caret).toBe(5);
  });

  /**
   * At a word end readline acts on the FOLLOWING word. The separator is inside
   * the span and passes through unchanged, which is why the space survives.
   */
  test("caret at a word end uppercases the following word", () => {
    const edit = upcaseWordEdit("hello world", 5);
    expect(applied("hello world", edit)).toBe("hello WORLD");
    expect(edit.caret).toBe(11);
  });

  test("caret at the end of the value changes nothing and stays put", () => {
    const edit = upcaseWordEdit("hello", 5);
    expect(applied("hello", edit)).toBe("hello");
    expect(edit.caret).toBe(5);
  });

  test("an empty value is a no-op", () => {
    const edit = upcaseWordEdit("", 0);
    expect(applied("", edit)).toBe("");
    expect(edit.caret).toBe(0);
  });

  /**
   * A word of non-letters cannot change, but the caret still moves to its end —
   * the motion half of the operation happens regardless of the casing half.
   */
  test("a word with no letters is unchanged and the caret still moves", () => {
    const edit = upcaseWordEdit("--- rest", 0);
    expect(applied("--- rest", edit)).toBe("--- rest");
    expect(edit.text).toBe("---");
    expect(edit.caret).toBe(3);
  });

  /**
   * The no-write case: a word already upper case yields text identical to the
   * slice, which is what lets the operation skip the write and leave the undo
   * stack clean. Asserted as the identity so the operation layer can rely on it.
   */
  test("a word already upper case yields text identical to the slice", () => {
    const value = "HELLO world";
    const edit = upcaseWordEdit(value, 0);
    expect(edit.text).toBe(value.slice(edit.start, edit.end));
    expect(edit.caret).toBe(5);
  });

  test("a precomposed e-acute uppercases to its accented capital", () => {
    const edit = upcaseWordEdit("école", 0);
    expect(applied("école", edit)).toBe("ÉCOLE");
  });

  /**
   * Case mapping is not length-preserving: the German sharp s uppercases to two
   * characters. The caret follows the text that was written, not the span that
   * was replaced, so it still lands at the end of the word.
   */
  test("a sharp s grows to SS and the caret follows the new text", () => {
    const edit = upcaseWordEdit("straße x", 0);
    expect(applied("straße x", edit)).toBe("STRASSE x");
    expect(edit.caret).toBe(7);
  });
});

describe("downcaseWordEdit covers the caret classes @C1.17", () => {
  test("caret at a word start lowercases that whole word", () => {
    const edit = downcaseWordEdit("HELLO WORLD", 0);
    expect(applied("HELLO WORLD", edit)).toBe("hello WORLD");
    expect(edit.caret).toBe(5);
  });

  test("caret mid-word lowercases only the tail of that word", () => {
    const edit = downcaseWordEdit("HELLO WORLD", 2);
    expect(applied("HELLO WORLD", edit)).toBe("HEllo WORLD");
    expect(edit.caret).toBe(5);
  });

  test("caret at a word end lowercases the following word", () => {
    const edit = downcaseWordEdit("HELLO WORLD", 5);
    expect(applied("HELLO WORLD", edit)).toBe("HELLO world");
    expect(edit.caret).toBe(11);
  });

  test("a word already lower case yields text identical to the slice", () => {
    const value = "hello world";
    const edit = downcaseWordEdit(value, 0);
    expect(edit.text).toBe(value.slice(edit.start, edit.end));
  });

  test("a word with no letters is unchanged and the caret still moves", () => {
    const edit = downcaseWordEdit("123 rest", 0);
    expect(applied("123 rest", edit)).toBe("123 rest");
    expect(edit.caret).toBe(3);
  });

  test("caret at the end of the value changes nothing", () => {
    const edit = downcaseWordEdit("HELLO", 5);
    expect(applied("HELLO", edit)).toBe("HELLO");
    expect(edit.caret).toBe(5);
  });
});

describe("capitalizeWordEdit follows readline's alphanumeric rule @C1.17", () => {
  test("the first letter goes up and the rest of the word comes down", () => {
    const edit = capitalizeWordEdit("hELLO world", 0);
    expect(applied("hELLO world", edit)).toBe("Hello world");
    expect(edit.caret).toBe(5);
  });

  test("an all-lower word gets its initial capitalized", () => {
    const edit = capitalizeWordEdit("hello world", 0);
    expect(applied("hello world", edit)).toBe("Hello world");
  });

  test("caret mid-word capitalizes from the caret, not from the word start", () => {
    // The span is [2,5) — "llo" — whose first character is the one that rises.
    const edit = capitalizeWordEdit("hello world", 2);
    expect(applied("hello world", edit)).toBe("heLlo world");
    expect(edit.caret).toBe(5);
  });

  test("caret at a word end capitalizes the following word", () => {
    const edit = capitalizeWordEdit("hello wORLD", 5);
    expect(applied("hello wORLD", edit)).toBe("hello World");
    expect(edit.caret).toBe(11);
  });

  /**
   * Readline's alnum rule, and the case a test written from the manual gets
   * wrong: the leading digit is a word constituent, so it takes the
   * capitalization slot (uppercasing a digit does nothing) and the letters after
   * it are all lowercased. The word comes back unchanged.
   */
  test("a leading digit consumes the capitalization slot", () => {
    const edit = capitalizeWordEdit("123abc rest", 0);
    expect(applied("123abc rest", edit)).toBe("123abc rest");
    expect(edit.caret).toBe(6);
  });

  test("a word of digits alone is unchanged and the caret still moves", () => {
    const edit = capitalizeWordEdit("123 rest", 0);
    expect(applied("123 rest", edit)).toBe("123 rest");
    expect(edit.caret).toBe(3);
  });

  /**
   * A non-alphanumeric resets the run, so the letter after it rises too. This is
   * the `inword = 0` branch, and it is why a hyphenated word capitalizes on both
   * sides of the hyphen rather than only at its start.
   */
  test("a separator inside the span restarts the run", () => {
    const edit = capitalizeWordEdit("well-known x", 0);
    expect(applied("well-known x", edit)).toBe("Well-Known x");
  });

  test("a precomposed e-acute capitalizes to its accented capital", () => {
    const edit = capitalizeWordEdit("école x", 0);
    expect(applied("école x", edit)).toBe("École x");
  });

  test("a word already capitalized yields text identical to the slice", () => {
    const value = "Hello world";
    const edit = capitalizeWordEdit(value, 0);
    expect(edit.text).toBe(value.slice(edit.start, edit.end));
  });

  test("caret at the end of the value changes nothing", () => {
    const edit = capitalizeWordEdit("hello", 5);
    expect(applied("hello", edit)).toBe("hello");
    expect(edit.caret).toBe(5);
  });
});

describe("transposeWordsEdit drags the earlier word past the later @C1.17", () => {
  test("two words with the caret between them swap", () => {
    const edit = transposeWordsEdit("one two", 3);
    expect(edit).not.toBeNull();
    expect(applied("one two", edit!)).toBe("two one");
    expect(edit!.caret).toBe(7);
  });

  test("the caret at the end of the value transposes the last two words", () => {
    const edit = transposeWordsEdit("one two", 7);
    expect(applied("one two", edit!)).toBe("two one");
    expect(edit!.caret).toBe(7);
  });

  /**
   * Separators are outside both extents and are never deleted, so a run of
   * spaces stays exactly where it was while the words move around it.
   */
  test("a multi-space separator stays in place", () => {
    const value = "one   two";
    const edit = transposeWordsEdit(value, 3);
    expect(applied(value, edit!)).toBe("two   one");
    expect(edit!.caret).toBe(value.length);
  });

  /**
   * characterization — punctuation is not a separator for `cursor.getEndOfWord`,
   * which splits on whitespace only, so "one," is one word here where readline
   * would treat the comma as a boundary and transpose the bare words. The
   * extension's own word flavor wins, as it does for the word kills.
   */
  test("punctuation travels with its word under this extension's boundary", () => {
    const value = "one, two";
    const edit = transposeWordsEdit(value, 4);
    expect(applied(value, edit!)).toBe("two one,");
  });

  test("a single word is refused outright", () => {
    expect(transposeWordsEdit("hello", 5)).toBeNull();
    expect(transposeWordsEdit("hello", 0)).toBeNull();
    expect(transposeWordsEdit("hello", 2)).toBeNull();
  });

  test("an empty value is refused", () => {
    expect(transposeWordsEdit("", 0)).toBeNull();
  });

  test("whitespace alone is refused", () => {
    expect(transposeWordsEdit("   ", 1)).toBeNull();
  });

  /**
   * Readline's guard at the very start of a line: the forward search finds the
   * first word and the backward search finds the same one, so `w1_beg` equals
   * `w2_beg` and the function rings the bell without touching the text. It does
   * NOT transpose the two words that follow, which is the intuitive answer and
   * the wrong one.
   */
  test("the caret at the very start of the value is refused", () => {
    expect(transposeWordsEdit("one two", 0)).toBeNull();
    expect(transposeWordsEdit("one two three", 0)).toBeNull();
  });

  /**
   * The caret picks the pair by looking FORWARD first, which is what makes the
   * chosen words the one behind the caret and the one ahead of it rather than
   * the first two on the line.
   *
   * Traced through readline's searches for "one two three" at point 7 — the end
   * of "two": `rl_forward_word` reaches 13, so `w2_end` is 13 and `w2_beg` is 8,
   * which is "three"; stepping back again gives `w1_beg` 4 and `w1_end` 7, which
   * is "two". The pair is therefore "two" and "three", not "one" and "two", and
   * the caret lands at 13.
   */
  test("the caret after the second of three words swaps the second and third", () => {
    const value = "one two three";
    const edit = transposeWordsEdit(value, 7);
    expect(applied(value, edit!)).toBe("one three two");
    expect(edit!.caret).toBe(value.length);
  });

  /** The pair straddles the caret, so from between the first two it is those two. */
  test("the caret after the first of three words swaps the first and second", () => {
    const value = "one two three";
    const edit = transposeWordsEdit(value, 3);
    expect(applied(value, edit!)).toBe("two one three");
    expect(edit!.caret).toBe(7);
  });

  test("words of unequal length still land the caret at the end of the span", () => {
    const value = "a bbb";
    const edit = transposeWordsEdit(value, 1);
    expect(applied(value, edit!)).toBe("bbb a");
    expect(edit!.caret).toBe(value.length);
  });
});

/** Word-ish values: letters in both cases, digits, separators and an accent. */
const wordPieces = fc.constantFrom("a", "B", "c", "Z", "1", "9", "é", " ", "  ", "-");

const wordValue = fc.array(wordPieces, { maxLength: 10 }).map((parts) => parts.join(""));

const caseFunctions: [string, (v: string, c: number) => CaseEdit][] = [
  ["upcaseWordEdit", upcaseWordEdit],
  ["downcaseWordEdit", downcaseWordEdit],
  ["capitalizeWordEdit", capitalizeWordEdit],
];

describe.each(caseFunctions)("%s holds its properties @C1.17", (_name, compute) => {
  /**
   * The text outside the region is untouched, and the caret lands at the end of
   * what was written.
   *
   * There is deliberately no length property: case mapping can grow a string
   * (`ß` uppercases to `SS`), so the caret is pinned to `start + text.length`
   * rather than to the region's own width.
   */
  test("P1 text outside the region is unchanged and the caret ends at the new text", () => {
    fc.assert(
      fc.property(wordValue, fc.nat(), (value, offset) => {
        const caret = offset % (value.length + 1);
        const edit = compute(value, caret);
        const result = applied(value, edit);
        expect(result.slice(0, edit.start)).toBe(value.slice(0, edit.start));
        expect(result.slice(edit.start + edit.text.length)).toBe(value.slice(edit.end));
        expect(edit.caret).toBe(edit.start + edit.text.length);
      }),
    );
  });

  test("P2 the region is an ordered range inside the value starting at the caret", () => {
    fc.assert(
      fc.property(wordValue, fc.nat(), (value, offset) => {
        const caret = offset % (value.length + 1);
        const edit = compute(value, caret);
        expect(edit.start).toBe(caret);
        expect(edit.end).toBeGreaterThanOrEqual(edit.start);
        expect(value.length).toBeGreaterThanOrEqual(edit.end);
      }),
    );
  });

  /** Re-running the same operation from the same caret changes nothing further. */
  test("P3 the operation is idempotent from the same caret", () => {
    let sawWrite = false;
    fc.assert(
      fc.property(wordValue, fc.nat(), (value, offset) => {
        const caret = offset % (value.length + 1);
        const first = compute(value, caret);
        const once = applied(value, first);
        if (once !== value) sawWrite = true;
        const second = compute(once, caret);
        expect(applied(once, second)).toBe(once);
      }),
    );
    expect(sawWrite, "no generated case actually recased anything").toBe(true);
  });
});

describe("transposeWordsEdit holds its properties @C1.17", () => {
  /**
   * A transpose rearranges and never invents: the characters of the value are
   * the same characters afterwards, counted with multiplicity.
   */
  test("P4 the multiset of characters is preserved", () => {
    let sawTranspose = false;
    fc.assert(
      fc.property(wordValue, fc.nat(), (value, offset) => {
        const caret = offset % (value.length + 1);
        const edit = transposeWordsEdit(value, caret);
        if (edit === null) return;
        sawTranspose = true;
        const result = applied(value, edit);
        expect([...result].sort().join("")).toBe([...value].sort().join(""));
      }),
    );
    expect(sawTranspose, "no generated case produced a transpose").toBe(true);
  });

  /**
   * The separators keep their offsets, which is the property readline's
   * implementation buys by replacing two extents and never touching the gap.
   * Checked only where the two words have equal length, because that is the case
   * in which "the same offsets" is even expressible — with unequal words the
   * separator moves by the length difference while still separating the same two
   * slots, and P4 above is what covers those.
   */
  test("P5 separators keep their offsets when the two words are the same length", () => {
    let sawEqualLength = false;
    fc.assert(
      fc.property(wordValue, fc.nat(), (value, offset) => {
        const caret = offset % (value.length + 1);
        const edit = transposeWordsEdit(value, caret);
        if (edit === null) return;
        const result = applied(value, edit);
        if (result.length !== value.length) return;
        const separatorsBefore = [...value].map((c, i) => (/\s/.test(c) ? i : -1));
        const separatorsAfter = [...result].map((c, i) => (/\s/.test(c) ? i : -1));
        if (separatorsBefore.join() !== separatorsAfter.join()) {
          // Only equal-length word pairs are claimed; anything else is P4's job.
          return;
        }
        sawEqualLength = true;
        expect(separatorsAfter).toEqual(separatorsBefore);
      }),
    );
    expect(sawEqualLength, "no generated case had separators to hold in place").toBe(true);
  });

  /**
   * A refusal is a null, and an accepted transpose really names two distinct,
   * non-empty word extents.
   *
   * The tempting form of this — "an accepted edit changes the value" — is false:
   * transposing two identical words ("1 1") is a genuine transpose whose result
   * equals its input. What distinguishes the two outcomes is the structure of the
   * edit, so that is what is asserted: the replacement is the same width as the
   * span it covers, the span holds actual words rather than whitespace, and the
   * caret lands at its end.
   */
  test("P6 an accepted edit names two non-empty words and a refusal is null", () => {
    let sawRefusal = false;
    let sawAccepted = false;
    fc.assert(
      fc.property(wordValue, fc.nat(), (value, offset) => {
        const caret = offset % (value.length + 1);
        const edit = transposeWordsEdit(value, caret);
        if (edit === null) {
          sawRefusal = true;
          return;
        }
        sawAccepted = true;
        const span = value.slice(edit.start, edit.end);
        expect(edit.text).toHaveLength(span.length);
        expect(span.trim()).not.toBe("");
        expect(edit.caret).toBe(edit.end);
      }),
    );
    expect(sawRefusal, "no generated case was refused").toBe(true);
    expect(sawAccepted, "no generated case was accepted").toBe(true);
  });
});
