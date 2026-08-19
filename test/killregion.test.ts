/**
 * The kill-region computation, as a pure function of value and selection.
 *
 * Offsets throughout are UTF-16 code units, because that is what the platform's
 * selection API (`selectionStart`/`selectionEnd`, `setSelectionRange`) speaks.
 * Grapheme integrity is deliberately unclaimed: a region may split a surrogate
 * pair or an emoji cluster if the caret sits inside one, and the tests below
 * pin that as the semantics rather than treat it as a defect. A kill-ring
 * release that wants cluster-aware motion changes the claim first.
 *
 * The class walk is derived from the specified behaviour — kill from the caret
 * to the line boundary — not from reading the implementation, so a test that
 * agrees with the code by construction is not counted as evidence.
 */
import { describe, expect, test } from "vitest";
import fc from "fast-check";
import { endOfLineRegion, KillRegion, topOfLineRegion } from "../src/killregion";

/** The text a region removes. */
function killed(value: string, region: KillRegion): string {
  return value.slice(region.start, region.end);
}

/** The value that remains once a region is removed. */
function remaining(value: string, region: KillRegion): string {
  return value.slice(0, region.start) + value.slice(region.end);
}

describe("endOfLineRegion covers the caret classes", () => {
  const text = "first line\nsecond line\nthird";

  test("caret at a line start takes the whole line", () => {
    expect(endOfLineRegion(text, 11, 11)).toEqual({ start: 11, end: 22 });
  });
  test("caret mid line takes the tail of that line only", () => {
    expect(endOfLineRegion(text, 15, 15)).toEqual({ start: 15, end: 22 });
  });
  test("caret one before end of line takes a single character", () => {
    expect(endOfLineRegion(text, 21, 21)).toEqual({ start: 21, end: 22 });
  });
  test("caret exactly at end of line yields an empty region", () => {
    expect(endOfLineRegion(text, 22, 22)).toEqual({ start: 22, end: 22 });
  });
  test("caret at end of value yields an empty region", () => {
    expect(endOfLineRegion(text, text.length, text.length)).toEqual({
      start: text.length,
      end: text.length,
    });
  });
  test("empty value yields an empty region", () => {
    expect(endOfLineRegion("", 0, 0)).toEqual({ start: 0, end: 0 });
  });
  test("caret before a leading newline yields an empty region", () => {
    expect(endOfLineRegion("\nbody\n", 0, 0)).toEqual({ start: 0, end: 0 });
  });
  test("caret before a trailing newline takes up to it", () => {
    expect(endOfLineRegion("\nbody\n", 1, 1)).toEqual({ start: 1, end: 5 });
  });
  test("caret after a trailing newline yields an empty last line", () => {
    const value = "\nbody\n";
    expect(endOfLineRegion(value, 6, 6)).toEqual({ start: 6, end: 6 });
  });
  test("caret between the halves of a surrogate pair splits it", () => {
    const value = "a\u{1F600}b";
    expect(endOfLineRegion(value, 2, 2)).toEqual({ start: 2, end: 4 });
    expect(killed(value, endOfLineRegion(value, 2, 2))).toBe("\uDE00b");
  });
});

describe("topOfLineRegion covers the caret classes", () => {
  const text = "first line\nsecond line\nthird";

  test("caret at a line start yields an empty region", () => {
    expect(topOfLineRegion(text, 11, 11)).toEqual({ start: 11, end: 11 });
  });
  test("caret mid line takes the head of that line only", () => {
    expect(topOfLineRegion(text, 15, 15)).toEqual({ start: 11, end: 15 });
  });
  test("caret one past a line start takes a single character", () => {
    expect(topOfLineRegion(text, 12, 12)).toEqual({ start: 11, end: 12 });
  });
  test("caret at end of line takes the whole line", () => {
    expect(topOfLineRegion(text, 22, 22)).toEqual({ start: 11, end: 22 });
  });
  test("caret at end of value takes the whole last line", () => {
    expect(topOfLineRegion(text, text.length, text.length)).toEqual({
      start: 23,
      end: text.length,
    });
  });
  test("empty value yields an empty region", () => {
    expect(topOfLineRegion("", 0, 0)).toEqual({ start: 0, end: 0 });
  });
  test("caret at 0 of a leading-newline value yields an empty region", () => {
    expect(topOfLineRegion("\nbody\n", 0, 0)).toEqual({ start: 0, end: 0 });
  });
  test("caret after a trailing newline yields an empty region", () => {
    expect(topOfLineRegion("\nbody\n", 6, 6)).toEqual({ start: 6, end: 6 });
  });
  test("caret between the halves of a surrogate pair splits it", () => {
    const value = "a\u{1F600}b";
    expect(topOfLineRegion(value, 2, 2)).toEqual({ start: 0, end: 2 });
    expect(killed(value, topOfLineRegion(value, 2, 2))).toBe("a\uD83D");
  });
});

describe("a non-collapsed selection is kept and the kill happens outside it", () => {
  const text = "first line\nsecond line\nthird";

  /**
   * characterization — this pins what the shipped operations do today rather
   * than a decided behaviour. Emacs kills the selection itself; here the
   * selection survives and the kill runs from its far edge. Changing it is a
   * behavioural decision, and these two tests are what will go red for it.
   */
  test("endOfLineRegion starts after a selection within a line", () => {
    expect(endOfLineRegion(text, 13, 17)).toEqual({ start: 17, end: 22 });
    expect(remaining(text, endOfLineRegion(text, 13, 17))).toBe("first line\nsecond\nthird");
  });
  /** characterization — see the sibling test above. */
  test("topOfLineRegion ends before a selection within a line", () => {
    expect(topOfLineRegion(text, 13, 17)).toEqual({ start: 11, end: 13 });
    expect(remaining(text, topOfLineRegion(text, 13, 17))).toBe("first line\ncond line\nthird");
  });
  /** characterization — a selection spanning a newline anchors on its far edge. */
  test("a selection spanning a newline anchors each region on its own edge", () => {
    expect(endOfLineRegion(text, 5, 15)).toEqual({ start: 15, end: 22 });
    expect(topOfLineRegion(text, 5, 15)).toEqual({ start: 0, end: 5 });
  });
});

/**
 * Values likely to expose boundary faults: newlines and astral characters.
 *
 * `unit: "binary"` is fast-check v4's full-Unicode string — it reaches beyond
 * the BMP, so generated values contain surrogate pairs and the properties are
 * exercised at code-unit positions that split them.
 */
const fullUnicode = (constraints?: { maxLength?: number }) =>
  fc.string({ unit: "binary", ...constraints });

const valueArbitrary = fc.oneof(
  fullUnicode(),
  fc
    .array(fc.oneof(fc.constant("\n"), fullUnicode({ maxLength: 4 })), { maxLength: 12 })
    .map((parts) => parts.join("")),
);

/** A value paired with an ordered selection at arbitrary code-unit positions. */
const selectionArbitrary = valueArbitrary.chain((value) =>
  fc
    .tuple(fc.integer({ min: 0, max: value.length }), fc.integer({ min: 0, max: value.length }))
    .map(([a, b]) => ({ value, start: Math.min(a, b), end: Math.max(a, b) })),
);

const regionFunctions: [string, (v: string, s: number, e: number) => KillRegion][] = [
  ["endOfLineRegion", endOfLineRegion],
  ["topOfLineRegion", topOfLineRegion],
];

describe.each(regionFunctions)("%s holds its region properties", (_name, region) => {
  test("P1 killed text and remaining text reassemble the original value", () => {
    fc.assert(
      fc.property(selectionArbitrary, ({ value, start, end }) => {
        const r = region(value, start, end);
        expect(value.slice(0, r.start) + killed(value, r) + value.slice(r.end)).toBe(value);
      }),
    );
  });

  test("P2 the region is an ordered range inside the value", () => {
    fc.assert(
      fc.property(selectionArbitrary, ({ value, start, end }) => {
        const r = region(value, start, end);
        expect(r.start).toBeGreaterThanOrEqual(0);
        expect(r.end).toBeGreaterThanOrEqual(r.start);
        expect(value.length).toBeGreaterThanOrEqual(r.end);
      }),
    );
  });

  test("P3 the region start is where the caret must land", () => {
    fc.assert(
      fc.property(selectionArbitrary, ({ value, start, end }) => {
        const r = region(value, start, end);
        const after = remaining(value, r);
        expect(after.slice(0, r.start)).toBe(value.slice(0, r.start));
        expect(after.length).toBe(value.length - (r.end - r.start));
      }),
    );
  });

  test("P4 the killed slice never crosses a newline", () => {
    fc.assert(
      fc.property(selectionArbitrary, ({ value, start, end }) => {
        expect(killed(value, region(value, start, end))).not.toContain("\n");
      }),
    );
  });
});

describe("the properties run against non-empty regions", () => {
  /** A case is only interesting when something is actually killed. */
  const nonEmptyEndOfLine = selectionArbitrary.filter(({ value, start, end }) => {
    const r = endOfLineRegion(value, start, end);
    return r.end > r.start;
  });

  test("P5 killing to end of line again from the same caret is a no-op", () => {
    let sawNonEmpty = false;
    fc.assert(
      fc.property(nonEmptyEndOfLine, ({ value, start, end }) => {
        const first = endOfLineRegion(value, start, end);
        expect(first.end).toBeGreaterThan(first.start);
        sawNonEmpty = true;
        const after = remaining(value, first);
        const second = endOfLineRegion(after, first.start, first.start);
        expect(second).toEqual({ start: first.start, end: first.start });
      }),
    );
    expect(
      sawNonEmpty,
      "no non-empty region was generated, so the property above asserted nothing",
    ).toBe(true);
  });

  test("the non-empty arbitrary really produces killable text", () => {
    const widths: number[] = [];
    fc.assert(
      fc.property(nonEmptyEndOfLine, ({ value, start, end }) => {
        widths.push(endOfLineRegion(value, start, end).end - endOfLineRegion(value, start, end).start);
      }),
      { numRuns: 200 },
    );
    expect(widths.length).toBeGreaterThan(0);
    expect(Math.min(...widths)).toBeGreaterThan(0);
  });
});
