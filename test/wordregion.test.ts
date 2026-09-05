/**
 * The word-kill regions and the grapheme-delete extents.
 *
 * Two different claims live here, and they are kept apart deliberately.
 *
 * The word regions are a *characterization* of the word-boundary flavor the
 * caret motions already ship: `cursor.getEndOfWord` skips any separator run it
 * starts on and then consumes to the end of the following word, and
 * `cursor.getTopOfWord` walks back over separators and then to the start of the
 * preceding word. Alt+d and Alt+Backspace kill exactly what Alt+f and Alt+b
 * move over, so the expectations below are derived from that documented motion
 * rather than from readline's own (subtly different) word rules — a kill that
 * disagreed with its own motion binding would be the worse defect. Where this
 * flavor differs from readline it is marked.
 *
 * The grapheme extents are a *specification*: a character delete must never
 * leave half of a surrogate pair or a piece of a ZWJ sequence in the field.
 * That is a decided property, not an observation, and the assertions state it
 * in terms of what the user sees leave the field.
 */
import { describe, expect, test } from "vitest";
import fc from "fast-check";
import {
  backwardWordRegion,
  forwardWordRegion,
  nextGraphemeRegion,
  previousGraphemeRegion,
} from "../src/killregion";
import { upcaseWordEdit } from "../src/caseregion";

/** The text a region removes. */
function killed(value: string, region: { start: number; end: number }): string {
  return value.slice(region.start, region.end);
}

/** The value that remains once a region is removed. */
function remaining(value: string, region: { start: number; end: number }): string {
  return value.slice(0, region.start) + value.slice(region.end);
}

describe("forwardWordRegion covers the caret classes", () => {
  test("caret mid-word takes the rest of that word", () => {
    expect(forwardWordRegion("hello world", 2, 2)).toEqual({ start: 2, end: 5 });
    expect(killed("hello world", forwardWordRegion("hello world", 2, 2))).toBe("llo");
  });

  test("caret at a word start takes the whole word", () => {
    expect(forwardWordRegion("hello world", 0, 0)).toEqual({ start: 0, end: 5 });
    expect(killed("hello world", forwardWordRegion("hello world", 0, 0))).toBe("hello");
  });

  /**
   * characterization — readline's M-d at a word end takes the separator and the
   * next word together, and so does the motion this kill mirrors. The space is
   * part of the kill, not a boundary it stops at.
   */
  test("caret at a word end takes the separator and the next word", () => {
    expect(forwardWordRegion("hello world", 5, 5)).toEqual({ start: 5, end: 11 });
    expect(killed("hello world", forwardWordRegion("hello world", 5, 5))).toBe(" world");
  });

  test("caret before a whitespace run takes the run and the word after it", () => {
    const value = "hello   world";
    expect(forwardWordRegion(value, 5, 5)).toEqual({ start: 5, end: 13 });
    expect(killed(value, forwardWordRegion(value, 5, 5))).toBe("   world");
  });

  test("caret at the end of the value yields an empty region", () => {
    expect(forwardWordRegion("hello world", 11, 11)).toEqual({ start: 11, end: 11 });
  });

  test("an empty value yields an empty region", () => {
    expect(forwardWordRegion("", 0, 0)).toEqual({ start: 0, end: 0 });
  });

  test("caret at the start of a leading whitespace run takes it and the word", () => {
    expect(forwardWordRegion("  hello", 0, 0)).toEqual({ start: 0, end: 7 });
  });

  test("trailing whitespace with no word after it is still taken", () => {
    expect(forwardWordRegion("hello  ", 5, 5)).toEqual({ start: 5, end: 7 });
  });

  test("a non-collapsed selection survives and the kill runs from its far edge", () => {
    // The shape the line kills already ship: the selected text is kept and the
    // kill measures from selectionEnd.
    expect(forwardWordRegion("hello world", 2, 5)).toEqual({ start: 5, end: 11 });
  });
});

describe("backwardWordRegion covers the caret classes", () => {
  test("caret mid-word takes the head of that word", () => {
    expect(backwardWordRegion("hello world", 8, 8)).toEqual({ start: 6, end: 8 });
    expect(killed("hello world", backwardWordRegion("hello world", 8, 8))).toBe("wo");
  });

  /**
   * characterization — at a word start the motion steps back over the separator
   * and takes the previous word with it, so the kill removes both.
   */
  test("caret at a word start takes the previous word and its separator", () => {
    expect(backwardWordRegion("hello world", 6, 6)).toEqual({ start: 0, end: 6 });
    expect(killed("hello world", backwardWordRegion("hello world", 6, 6))).toBe("hello ");
  });

  test("caret at a word end takes that whole word", () => {
    expect(backwardWordRegion("hello world", 5, 5)).toEqual({ start: 0, end: 5 });
    expect(killed("hello world", backwardWordRegion("hello world", 5, 5))).toBe("hello");
  });

  test("caret after a whitespace run takes the run and the word before it", () => {
    const value = "hello   world";
    expect(backwardWordRegion(value, 8, 8)).toEqual({ start: 0, end: 8 });
    expect(killed(value, backwardWordRegion(value, 8, 8))).toBe("hello   ");
  });

  test("caret at the start of the value yields an empty region", () => {
    expect(backwardWordRegion("hello world", 0, 0)).toEqual({ start: 0, end: 0 });
  });

  test("an empty value yields an empty region", () => {
    expect(backwardWordRegion("", 0, 0)).toEqual({ start: 0, end: 0 });
  });

  test("caret at the end of the value takes the last word", () => {
    expect(backwardWordRegion("hello world", 11, 11)).toEqual({ start: 6, end: 11 });
  });

  /**
   * The boundary that a backward word kill must not walk past.
   *
   * `cursor.getTopOfWord` is called with a caret sitting after separators that
   * have no word before them. Its separator-skipping loop is unguarded below
   * index 0, and `isStartOfWord` reads `text[-1]` as `undefined`, which is not
   * a separator — so the search for a "previous word" that does not exist runs
   * away below zero. A motion binding survives that (the browser clamps a
   * negative `setSelectionRange`), but a kill would compute a region starting
   * before the value and delete text nobody selected. The region function must
   * clamp at 0 regardless of what the cursor helper hands it.
   */
  test("a caret after leading whitespace only cannot produce a region below zero", () => {
    const region = backwardWordRegion("  hello", 2, 2);
    expect(region.start).toBeGreaterThanOrEqual(0);
    expect(region).toEqual({ start: 0, end: 2 });
    expect(killed("  hello", region)).toBe("  ");
  });

  test("a value of whitespace alone is taken to the start", () => {
    const region = backwardWordRegion("   ", 3, 3);
    expect(region.start).toBeGreaterThanOrEqual(0);
    expect(region).toEqual({ start: 0, end: 3 });
  });

  test("a single separator is taken to the start", () => {
    expect(backwardWordRegion(" ", 1, 1)).toEqual({ start: 0, end: 1 });
  });

  test("a non-collapsed selection survives and the kill runs from its near edge", () => {
    expect(backwardWordRegion("hello world", 6, 9)).toEqual({ start: 0, end: 6 });
  });
});

/**
 * The word boundary the case operations share with the motions.
 *
 * `upcaseWordEdit` and its siblings measure their span with the same
 * `cursor.getEndOfWord` that `forwardWordRegion` uses, so Alt+U recases exactly
 * what Alt+D would kill and Alt+F would move over. These cases pin that the two
 * really do agree, class for class — a case operation that drifted onto its own
 * boundary would recase text the user could not predict from the motion they
 * already know.
 */
describe("the case span matches the forward word region @C1.17", () => {
  const cases: [string, string, number][] = [
    ["caret mid-word", "hello world", 2],
    ["caret at a word start", "hello world", 0],
    ["caret at a word end", "hello world", 5],
    ["caret before a whitespace run", "hello   world", 5],
    ["caret at the end of the value", "hello world", 11],
    ["an empty value", "", 0],
    ["leading whitespace", "  hello", 0],
  ];

  test.each(cases)("%s covers the same span", (_name, value, caret) => {
    const region = forwardWordRegion(value, caret, caret);
    const edit = upcaseWordEdit(value, caret);
    expect({ start: edit.start, end: edit.end }).toEqual(region);
  });
});

describe("nextGraphemeRegion removes exactly one grapheme forward", () => {
  test("an ASCII character is one grapheme", () => {
    expect(nextGraphemeRegion("abc", 0, 0)).toEqual({ start: 0, end: 1 });
  });

  test("a surrogate-pair emoji goes whole", () => {
    const value = "a\u{1F600}b";
    const region = nextGraphemeRegion(value, 1, 1);
    expect(region).toEqual({ start: 1, end: 3 });
    expect(killed(value, region)).toBe("\u{1F600}");
    expect(remaining(value, region)).toBe("ab");
  });

  test("a ZWJ family emoji is one grapheme", () => {
    // Man + ZWJ + Woman + ZWJ + Girl: four code points joined into one cluster.
    const family = "\u{1F468}‍\u{1F469}‍\u{1F467}";
    const value = `x${family}y`;
    const region = nextGraphemeRegion(value, 1, 1);
    expect(killed(value, region)).toBe(family);
    expect(remaining(value, region)).toBe("xy");
  });

  test("a combining-mark sequence goes with its base character", () => {
    // e + combining acute accent.
    const value = "éz";
    const region = nextGraphemeRegion(value, 0, 0);
    expect(killed(value, region)).toBe("é");
    expect(remaining(value, region)).toBe("z");
  });

  test("at the end of the value the region is empty", () => {
    expect(nextGraphemeRegion("abc", 3, 3)).toEqual({ start: 3, end: 3 });
  });

  test("an empty value yields an empty region", () => {
    expect(nextGraphemeRegion("", 0, 0)).toEqual({ start: 0, end: 0 });
  });

  test("a caret inside a surrogate pair still removes the whole pair", () => {
    // The caret cannot legitimately land here, but a page script can put it
    // there; the region must not answer with half a character.
    const value = "a\u{1F600}b";
    const region = nextGraphemeRegion(value, 2, 2);
    expect(remaining(value, region)).toBe("ab");
  });
});

describe("previousGraphemeRegion removes exactly one grapheme backward", () => {
  test("an ASCII character is one grapheme", () => {
    expect(previousGraphemeRegion("abc", 3, 3)).toEqual({ start: 2, end: 3 });
  });

  test("a surrogate-pair emoji goes whole", () => {
    const value = "a\u{1F600}b";
    const region = previousGraphemeRegion(value, 3, 3);
    expect(region).toEqual({ start: 1, end: 3 });
    expect(killed(value, region)).toBe("\u{1F600}");
    expect(remaining(value, region)).toBe("ab");
  });

  test("a ZWJ family emoji is one grapheme", () => {
    const family = "\u{1F468}‍\u{1F469}‍\u{1F467}";
    const value = `x${family}y`;
    const region = previousGraphemeRegion(value, 1 + family.length, 1 + family.length);
    expect(killed(value, region)).toBe(family);
    expect(remaining(value, region)).toBe("xy");
  });

  test("a combining-mark sequence goes with its base character", () => {
    const value = "zé";
    const region = previousGraphemeRegion(value, value.length, value.length);
    expect(killed(value, region)).toBe("é");
    expect(remaining(value, region)).toBe("z");
  });

  test("at the start of the value the region is empty", () => {
    expect(previousGraphemeRegion("abc", 0, 0)).toEqual({ start: 0, end: 0 });
  });

  test("an empty value yields an empty region", () => {
    expect(previousGraphemeRegion("", 0, 0)).toEqual({ start: 0, end: 0 });
  });

  test("a caret inside a surrogate pair still removes the whole pair", () => {
    const value = "a\u{1F600}b";
    const region = previousGraphemeRegion(value, 2, 2);
    expect(remaining(value, region)).toBe("ab");
  });
});

/**
 * A string is well-formed when it carries no unpaired surrogate.
 *
 * `isWellFormed` is the platform's own answer to the question, which is exactly
 * the property a grapheme delete must preserve: half an emoji left in a field
 * renders as a replacement glyph and can never be typed back.
 */
function isWellFormed(text: string): boolean {
  return text.isWellFormed();
}

/** Values built from pieces that make surrogate pairs and clusters likely. */
const graphemePieces = fc.constantFrom(
  "a",
  " ",
  "\u{1F600}",
  "\u{1F468}‍\u{1F469}‍\u{1F467}",
  "é",
  "\u{1F1EF}\u{1F1F5}",
  "\n",
);

const graphemeValue = fc
  .array(graphemePieces, { maxLength: 8 })
  .map((parts) => parts.join(""));

/** Every grapheme boundary of a value, as code-unit offsets. */
function boundaries(value: string): number[] {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const offsets = [0];
  for (const segment of segmenter.segment(value)) {
    offsets.push(segment.index + segment.segment.length);
  }
  return offsets;
}

describe("a character delete never leaves half a character behind", () => {
  test("P1 forward and backward deletes at any boundary keep the value well-formed", () => {
    let sawEmoji = false;
    fc.assert(
      fc.property(graphemeValue, (value) => {
        if (!isWellFormed(value)) return; // the generator never produces these
        if (/[\u{1F300}-\u{1FAFF}]/u.test(value)) sawEmoji = true;
        for (const at of boundaries(value)) {
          const forward = remaining(value, nextGraphemeRegion(value, at, at));
          const backward = remaining(value, previousGraphemeRegion(value, at, at));
          expect(isWellFormed(forward), `forward at ${at} of ${JSON.stringify(value)}`).toBe(true);
          expect(isWellFormed(backward), `backward at ${at} of ${JSON.stringify(value)}`).toBe(true);
        }
      }),
    );
    expect(
      sawEmoji,
      "no generated value contained an astral character, so the property asserted nothing about surrogate pairs",
    ).toBe(true);
  });

  test("P2 a delete removes at most one grapheme and never grows the value", () => {
    fc.assert(
      fc.property(graphemeValue, (value) => {
        const before = boundaries(value).length;
        for (const at of boundaries(value)) {
          const forward = remaining(value, nextGraphemeRegion(value, at, at));
          expect(forward.length).toBeLessThanOrEqual(value.length);
          expect(boundaries(forward).length).toBeGreaterThanOrEqual(before - 1);
        }
      }),
    );
  });
});
