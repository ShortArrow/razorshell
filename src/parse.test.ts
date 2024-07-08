import { expect, test } from "vitest";
import { parseKeymap } from "../src/parse";

test("Ctrl", () => {
  const actual = parseKeymap("<C-a>");
  expect(actual.ctrl).toBe(true);
});
test("Alt", () => {
  const actual = parseKeymap("<A-a>");
  expect(actual.alt).toBe(true);
});
