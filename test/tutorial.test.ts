/**
 * The tutorial's advance rule: a step passes when a key the keymap handled
 * leaves the field in the step's Then state (see ADR-0018, "A tutorial opens
 * from the toolbar icon's menu and advances on the field state each chord
 * produces").
 */
import { describe, expect, test } from "vitest";
import { advances, type FieldState } from "../src/tutorial";

const then: FieldState = { value: "hello world", selectionStart: 0, selectionEnd: 0 };

describe("advances", () => {
  test("a handled key that leaves the Then state advances the step", () => {
    expect(advances(then, { ...then }, true)).toBe(true);
  });

  test("the Then state reached by a key the keymap did not handle does not advance", () => {
    expect(advances(then, { ...then }, false)).toBe(false);
  });

  test("a handled key that leaves another value does not advance", () => {
    expect(advances(then, { ...then, value: "hello" }, true)).toBe(false);
  });

  test("a handled key that leaves the caret elsewhere does not advance", () => {
    expect(advances(then, { ...then, selectionStart: 5, selectionEnd: 5 }, true)).toBe(false);
  });

  test("a handled key that leaves a selection where the Then state has a caret does not advance", () => {
    expect(advances(then, { ...then, selectionEnd: 5 }, true)).toBe(false);
  });
});
