// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { isTextField } from "../src/keyhandling";

function inputOfType(type: string): HTMLInputElement {
  const el = document.createElement("input");
  el.setAttribute("type", type);
  return el;
}

describe("isTextField", () => {
  test.each(["text", "search", "url", "tel", "password"])(
    "input type %s is a target",
    (type) => {
      expect(isTextField(inputOfType(type))).toBe(true);
    },
  );

  test("an input without a type attribute is a target", () => {
    const el = document.createElement("input");
    expect(isTextField(el)).toBe(true);
  });

  test.each(["email", "number", "checkbox", "date", "color", "range"])(
    "input type %s is not a target because the selection API does not apply",
    (type) => {
      expect(isTextField(inputOfType(type))).toBe(false);
    },
  );

  test("textarea is a target", () => {
    expect(isTextField(document.createElement("textarea"))).toBe(true);
  });
});
