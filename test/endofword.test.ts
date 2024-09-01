import { expect, test } from "vitest";
import { cursor } from "../src/cursor";

test("moveCursorToBeginning of world", () => {
  const target = "hello world new order";
  const actual = cursor.getEndOfWord(target, 9);
  expect(actual).toBe(11);
});
test("hello world ne", () => {
  const target = "hello world new order";
  const actual = cursor.getEndOfWord(target, 14);
  expect(actual).toBe(15);
});
test("hello world n", () => {
  const target = "hello world new order";
  const actual = cursor.getEndOfWord(target, 13);
  expect(actual).toBe(15);
});
test("hello world new", () => {
  const target = "hello world new order";
  const actual = cursor.getEndOfWord(target, 15);
  expect(actual).toBe(21);
});
test("h", () => {
  const target = "hello world new order";
  const actual = cursor.getEndOfWord(target, 1);
  expect(actual).toBe(5);
});
test("_", () => {
  const target = "hello world new order";
  const actual = cursor.getEndOfWord(target, 0);
  expect(actual).toBe(5);
});
test("hello", () => {
  const target = "hello world new order";
  const actual = cursor.getEndOfWord(target, 5);
  expect(actual).toBe(11);
});
test("hello_", () => {
  const target = "hello world new order";
  const actual = cursor.getEndOfWord(target, 6);
  expect(actual).toBe(11);
});
test("hello w", () => {
  const target = "hello world new order";
  const actual = cursor.getEndOfWord(target, 7);
  expect(actual).toBe(11);
});
test("split", () => {
  const target = "hello world new order";
  const actual = target.slice(0, 9);
  expect(actual).toEqual("hello wor");
});
