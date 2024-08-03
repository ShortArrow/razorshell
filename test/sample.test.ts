import { expect, test } from "vitest";
import { cursor } from "../src/cursor";

test("moveCursorToBeginning of world", () => {
  const target = "hello world new order";
  const actual = cursor.getTopOfWord(target, 9);
  expect(actual).toBe(7);
});
test("moveCursorToBeginning of new", () => {
  const target = "hello world new order";
  const actual = cursor.getTopOfWord(target, 14);
  expect(actual).toBe(13);
});
test("moveCursorToBeginning of new", () => {
  const target = "hello world new order";
  const actual = cursor.getTopOfWord(target, 13);
  expect(actual).toBe(13);
});
test("moveCursorToBeginning of new", () => {
  const target = "hello world new order";
  const actual = cursor.getTopOfWord(target, 15);
  expect(actual).toBe(13);
});
test("split", () => {
  const target = "hello world new order";
  const actual = target.slice(0, 9);
  expect(actual).toEqual("hello wor");
});
