import { describe, expect, test } from "vitest";
import { cursor } from "../src/cursor";

describe("move cursor to beginning", () => {
  const target = "hello world new order";

  function actual(current: number) {
    return cursor.getTopOfWord(target, current);
  }

  test("moveCursorToBeginning of world", () => {
    expect(actual(9)).toBe(6);
  });
  test("hello world new order_", () => {
    expect(actual(22)).toBe(21);
  });
  test("hello world new order", () => {
    expect(actual(21)).toBe(16);
  });
  test("hello world ne", () => {
    expect(actual(14)).toBe(12);
  });
  test("hello world n", () => {
    expect(actual(13)).toBe(12);
  });
  test("hello world new", () => {
    expect(actual(15)).toBe(12);
  });
  test("h", () => {
    expect(actual(1)).toBe(0);
  });
  test("_", () => {
    expect(actual(0)).toBe(0);
  });
  test("hello", () => {
    expect(actual(5)).toBe(0);
  });
  test("hello_", () => {
    expect(actual(6)).toBe(5);
  });
  test("hello w", () => {
    expect(actual(7)).toBe(6);
  });
  test("split", () => {
    const actual = target.slice(0, 9);
    expect(actual).toEqual("hello wor");
  });
});