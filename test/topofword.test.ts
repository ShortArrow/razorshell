import { describe, expect, test } from "vitest";
import { cursor } from "../src/cursor";

describe("move cursor to beginning", () => {
  const target = "hello world new order       ";

  function actual(current: number) {
    return cursor.getTopOfWord(target, current);
  }

  test("hello world new order", () => {
    expect(actual(9)).toBe(6);
  });
  test("hello world new order__", () => {
    expect(actual(22)).toBe(16);
  });
  test("hello world new order_", () => {
    expect(actual(21)).toBe(16);
  });
  test("hello world n", () => {
    expect(actual(12)).toBe(6);
  });
  test("hello world ne", () => {
    expect(actual(13)).toBe(12);
  });
  test("hello world new", () => {
    expect(actual(14)).toBe(12);
  });
  test("hello world new_", () => {
    expect(actual(15)).toBe(12);
  });
  test("hello world new w", () => {
    expect(actual(16)).toBe(12);
  });
  test("he", () => {
    expect(actual(1)).toBe(0);
  });
  test("h", () => {
    expect(actual(0)).toBe(0);
  });
  test("hello", () => {
    expect(actual(4)).toBe(0);
  });
  test("hello_", () => {
    expect(actual(5)).toBe(0);
  });
  test("hello w", () => {
    expect(actual(6)).toBe(0);
  });
  test("hello wo", () => {
    expect(actual(7)).toBe(6);
  });
  test("split", () => {
    const actual = target.slice(0, 9);
    expect(actual).toEqual("hello wor");
  });
});

/**
 * The search for a previous word when there is none.
 *
 * `getTopOfWord` steps back over separators and then looks for the start of the
 * word before them. When the value begins with those separators there is no
 * such word, and the search has to stop at the start of the value instead of
 * walking past it: `isStartOfWord` reads `text[-1]` as `undefined`, which is
 * not a separator, so an unguarded loop never finds a boundary and never
 * terminates.
 *
 * Alt+b tolerated that — a caret motion clamps a negative offset — but the
 * backward word kill computes a region from this number and would delete from
 * before the start of the value. Each case is run under a deadline, because a
 * regression here hangs the runner rather than failing an assertion, and a
 * suite that hangs reports nothing at all.
 */
describe("a caret with no word behind it stops at the start of the value", () => {
  function withinDeadline(value: string, caret: number): number {
    const started = Date.now();
    const result = cursor.getTopOfWord(value, caret);
    expect(
      Date.now() - started,
      `getTopOfWord(${JSON.stringify(value)}, ${caret}) did not return promptly`,
    ).toBeLessThan(1000);
    return result;
  }

  test("a caret after a leading whitespace run", () => {
    expect(withinDeadline("  hello", 2)).toBe(0);
  });

  test("a caret inside a leading whitespace run", () => {
    expect(withinDeadline("  hello", 1)).toBe(0);
  });

  test("a value of whitespace alone", () => {
    expect(withinDeadline("   ", 3)).toBe(0);
  });

  test("a single separator", () => {
    expect(withinDeadline(" ", 1)).toBe(0);
  });

  test("a single newline", () => {
    expect(withinDeadline("\n", 1)).toBe(0);
  });

  test("the result is never negative", () => {
    for (const [value, caret] of [["  hello", 2], ["   ", 3], [" ", 1]] as const) {
      expect(withinDeadline(value, caret)).toBeGreaterThanOrEqual(0);
    }
  });
});