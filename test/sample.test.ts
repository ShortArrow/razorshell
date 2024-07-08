import { expect, test } from "vitest";
import { cursor } from "../src/cursor";

test("moveCursorToBeginning", () => {
  const target = "hello world new order";
  const actual = cursor.getTopOfWord(target, 9);
  // todo update input arg current index
  expect(actual).toBe(7);
});
test("split", () => {
  const target = "hello world new order";
  const actual = target.slice(0, 9);
  expect(actual).toEqual("hello wor");
});
