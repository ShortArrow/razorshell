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
  test("hello world ne", () => {
    expect(actual(14)).toBe(15);
  });
  test("hello world n", () => {
    expect(actual(13)).toBe(15);
  });
  test("hello world new", () => {
    expect(actual(15)).toBe(21);
  });
  test("h", () => {
    expect(actual(1)).toBe(5);
  });
  test("_", () => {
    expect(actual(0)).toBe(5);
  });
  test("hello", () => {
    expect(actual(5)).toBe(11);
  });
  test("hello_", () => {
    expect(actual(6)).toBe(11);
  });
  test("hello w", () => {
    expect(actual(7)).toBe(11);
  });
  test("split", () => {
    const actual = target.slice(0, 9);
    expect(actual).toEqual("hello wor");
  });
});