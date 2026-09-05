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
  /**
   * The behavior change of v0.0.5: a caret at a line end takes the newline and
   * joins the lines, where it used to find an empty region and do nothing. The
   * boundary pair that separates this from the end of the value is asserted in
   * its own describe below.
   */
  test("caret exactly at end of line takes the newline", () => {
    expect(endOfLineRegion(text, 22, 22)).toEqual({ start: 22, end: 23 });
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
  test("caret before a leading newline takes that newline", () => {
    expect(endOfLineRegion("\nbody\n", 0, 0)).toEqual({ start: 0, end: 1 });
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

  /**
   * A kill takes at most one line's worth of text, and the single newline it may
   * take is the line boundary itself.
   *
   * Ctrl+K at the end of a line takes the newline and joins the lines, so the
   * stronger "no newline at all" form is false by design: a caret resting exactly
   * on a newline kills that newline and nothing else. The property is therefore
   * the disjunction — newline-free, or exactly one `\n` and that `\n` is the
   * whole slice. Anything else would mean a kill had run past a line boundary and
   * swallowed a line the user never asked for, which is the fault this property
   * exists to catch.
   */
  test("P4 the killed slice is newline-free unless it is the line boundary itself", () => {
    fc.assert(
      fc.property(selectionArbitrary, ({ value, start, end }) => {
        const slice = killed(value, region(value, start, end));
        if (!slice.includes("\n")) return;
        expect(slice).toBe("\n");
      }),
    );
  });
});

/**
 * The line-joining boundary pair, stated as two cases that must not be confused.
 *
 * They look alike — both are a caret with no more text on its line — and the
 * whole behaviour turns on telling them apart. On a newline there IS something
 * to take and taking it joins the lines; at the end of the value there is not,
 * and the region must stay empty so `applyKillRegion`'s guard keeps
 * `execCommand("delete")` away from an empty selection, where it acts as
 * Backspace and eats the character behind the caret (measured 2026-08-20).
 */
describe("Ctrl+K at a line end takes the newline, at the value end nothing", () => {
  test("a caret on a newline kills exactly that newline", () => {
    const value = "first\nsecond";
    const region = endOfLineRegion(value, 5, 5);
    expect(region).toEqual({ start: 5, end: 6 });
    expect(killed(value, region)).toBe("\n");
    expect(remaining(value, region)).toBe("firstsecond");
  });

  test("a caret at the end of the value kills nothing", () => {
    const value = "first\nsecond";
    const region = endOfLineRegion(value, value.length, value.length);
    expect(region).toEqual({ start: value.length, end: value.length });
    expect(killed(value, region)).toBe("");
  });

  /** A trailing newline is still a newline: the caret before it takes it. */
  test("a caret on a trailing newline takes it and leaves the value empty of lines", () => {
    expect(endOfLineRegion("body\n", 4, 4)).toEqual({ start: 4, end: 5 });
  });

  /** After that trailing newline there is no more value, so nothing is taken. */
  test("a caret after a trailing newline kills nothing", () => {
    expect(endOfLineRegion("body\n", 5, 5)).toEqual({ start: 5, end: 5 });
  });

  /** A value that is one newline: the caret before it joins two empty lines. */
  test("a caret before a lone newline takes it", () => {
    expect(endOfLineRegion("\n", 0, 0)).toEqual({ start: 0, end: 1 });
  });

  test("an empty value still yields an empty region", () => {
    expect(endOfLineRegion("", 0, 0)).toEqual({ start: 0, end: 0 });
  });
});

describe("the properties run against non-empty regions", () => {
  /** A case is only interesting when something is actually killed. */
  const nonEmptyEndOfLine = selectionArbitrary.filter(({ value, start, end }) => {
    const r = endOfLineRegion(value, start, end);
    return r.end > r.start;
  });

  /**
   * A second Ctrl+K from the caret the first one left takes the newline that the
   * first one stopped at, or nothing when the value has run out.
   *
   * The claim is a bound, not a no-op: a kill never leaves a whole line behind
   * it, so the follow-up takes at most the newline that ends the line and never
   * reaches into the line after. The stronger "the second kill takes nothing"
   * form is false, because a caret resting on a newline has something left to
   * take — that newline — and taking it joins the lines.
   *
   * The caret the first kill leaves can sit INSIDE a surrogate pair, because
   * this module claims code-unit offsets and not grapheme integrity — the file
   * header says so and two unit cases pin it. The second kill then takes the
   * orphaned half up to the next newline, which is neither a join nor a no-op.
   * The property therefore asserts the bound that holds in every case, that the
   * slice carries no newline but a single trailing one, and the join and
   * exhaustion branches are counted separately so neither goes unexercised.
   */
  test("P5 a second kill from the same caret takes the line boundary or nothing", () => {
    let sawNonEmpty = false;
    let sawJoin = false;
    let sawExhausted = false;
    fc.assert(
      fc.property(nonEmptyEndOfLine, ({ value, start, end }) => {
        const first = endOfLineRegion(value, start, end);
        expect(first.end).toBeGreaterThan(first.start);
        sawNonEmpty = true;
        const after = remaining(value, first);
        const second = endOfLineRegion(after, first.start, first.start);
        expect(second.start).toBe(first.start);
        const taken = killed(after, second);
        if (taken === "") sawExhausted = true;
        else if (taken === "\n") sawJoin = true;
        // Whatever else it took, it stopped at the first line boundary: no
        // newline inside the slice, and at most one closing it.
        expect(taken.slice(0, -1)).not.toContain("\n");
      }),
    );
    expect(
      sawNonEmpty,
      "no non-empty region was generated, so the property above asserted nothing",
    ).toBe(true);
    expect(
      sawJoin,
      "no generated case left a newline at the caret, so the join branch asserted nothing",
    ).toBe(true);
    expect(
      sawExhausted,
      "no generated case ran the value out, so the empty branch asserted nothing",
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
