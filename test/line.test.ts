import { describe, expect, test } from "vitest";
import { cursor } from "../src/cursor";

describe("getTopOfLine", () => {
  const target = "first line\nsecond line\nthird";

  test("single line text returns 0", () => {
    expect(cursor.getTopOfLine("hello world", 5)).toBe(0);
  });
  test("cursor on first line returns 0", () => {
    expect(cursor.getTopOfLine(target, 5)).toBe(0);
  });
  test("cursor on second line returns start of second line", () => {
    expect(cursor.getTopOfLine(target, 15)).toBe(11);
  });
  test("cursor at start of second line stays", () => {
    expect(cursor.getTopOfLine(target, 11)).toBe(11);
  });
  test("cursor at end of text returns start of last line", () => {
    expect(cursor.getTopOfLine(target, target.length)).toBe(23);
  });
  test("cursor just after newline returns that position", () => {
    expect(cursor.getTopOfLine(target, 23)).toBe(23);
  });
  test("cursor at 0 returns 0", () => {
    expect(cursor.getTopOfLine(target, 0)).toBe(0);
  });
});

describe("getEndOfLine", () => {
  const target = "first line\nsecond line\nthird";

  test("single line text returns length", () => {
    expect(cursor.getEndOfLine("hello world", 5)).toBe(11);
  });
  test("cursor on first line returns position of first newline", () => {
    expect(cursor.getEndOfLine(target, 5)).toBe(10);
  });
  test("cursor on second line returns position of second newline", () => {
    expect(cursor.getEndOfLine(target, 15)).toBe(22);
  });
  test("cursor on last line returns text length", () => {
    expect(cursor.getEndOfLine(target, 24)).toBe(target.length);
  });
  test("cursor at end of line stays", () => {
    expect(cursor.getEndOfLine(target, 10)).toBe(10);
  });
});
