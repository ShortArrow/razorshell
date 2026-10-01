import { describe, expect, test } from "vitest";
import { cursor } from "../src/cursor";


describe("cursor.getEndOfWord", () => {
  const target = "hello world new order";

  function actual(current: number) {
    return cursor.getEndOfWord(target, current);
  }

  test(target.slice(undefined,9), () => {
    expect(actual(9)).toBe(11);
  });
  test("hello world_", () => {
    expect(actual(11)).toBe(15);
  });
  test("hello world n", () => {
    expect(actual(12)).toBe(15);
  });
  test("hello world ne", () => {
    expect(actual(13)).toBe(15);
  });
  test("hello world new", () => {
    expect(actual(14)).toBe(15);
  });
  test("hello world new_", () => {
    expect(actual(15)).toBe(21);
  });
  test("he", () => {
    expect(actual(1)).toBe(5);
  });
  test("h", () => {
    expect(actual(0)).toBe(5);
  });
  test("hello_", () => {
    expect(actual(5)).toBe(11);
  });
  test("hello w", () => {
    expect(actual(6)).toBe(11);
  });
  test("hello wo", () => {
    expect(actual(7)).toBe(11);
  });
  test("split", () => {
    const actual = target.slice(0, 9);
    expect(actual).toEqual("hello wor");
  });
});

/**
 * Readline's word unit: a run of letters and digits (`rl_alphabetic`), with
 * combining marks kept inside the word. Every other character separates words,
 * so the motion stops at punctuation that a whitespace boundary would cross.
 */
describe("cursor.getEndOfWord stops at readline's alphanumeric word end @C1.16", () => {
  const cases: [string, number, number][] = [
    ["foo-bar baz", 0, 3],
    ["foo-bar baz", 3, 7],
    ["a.b/c d", 0, 1],
    ["--foo", 0, 5],
    ["日本語 テキスト", 0, 3],
    ["café au", 0, 4],
  ];

  test.each(cases)("%j from %i ends at %i", (text, caret, expected) => {
    expect(cursor.getEndOfWord(text, caret)).toBe(expected);
  });

  test("a combining mark stays inside its word", () => {
    expect(cursor.getEndOfWord("café au", 0)).toBe(5);
  });

  test("a letter outside the BMP is one word character, not two separators", () => {
    expect(cursor.getEndOfWord("\u{2000B}\u{2000B} x", 0)).toBe(4);
  });
});
