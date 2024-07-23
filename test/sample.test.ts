import { expect, test } from "vitest";
import { cursor } from "../src/cursor";

test("moveCursorToBeginning", () => {
  const target = "hello world new order top of the world";
  const actual = cursor.getTopOfWord(target, 9);
  expect(actual).toBe(7);
  const actual = cursor.getTopOfWord(target, 2);
  expect(actual).toBe(1);
  const actual = cursor.getTopOfWord(target, 11);
  expect(actual).toBe(7);
  const actual = cursor.getTopOfWord(target, 12);
  expect(actual).toBe(7);
});
test("split", () => {
  const target = "hello world new order";
  const actual = target.slice(0, 9);
  expect(actual).toEqual("hello wor");
});
