import { describe, expect, test } from "vitest";
import { keyChord, selectionSummary } from "../src/keychord";

describe("keyChord", () => {
  test("ctrl+a", () => {
    expect(keyChord({ key: "a", ctrlKey: true, altKey: false, shiftKey: false })).toEqual(["Ctrl", "a"]);
  });
  test("alt+f", () => {
    expect(keyChord({ key: "f", ctrlKey: false, altKey: true, shiftKey: false })).toEqual(["Alt", "f"]);
  });
  test("modifiers keep Ctrl, Alt, Shift order", () => {
    expect(keyChord({ key: "E", ctrlKey: true, altKey: true, shiftKey: true })).toEqual(["Ctrl", "Alt", "Shift", "E"]);
  });
  test("plain key has no modifier entries", () => {
    expect(keyChord({ key: "x", ctrlKey: false, altKey: false, shiftKey: false })).toEqual(["x"]);
  });
  test("space is labeled Space", () => {
    expect(keyChord({ key: " ", ctrlKey: false, altKey: false, shiftKey: false })).toEqual(["Space"]);
  });
  test("named keys pass through", () => {
    expect(keyChord({ key: "ArrowLeft", ctrlKey: false, altKey: false, shiftKey: false })).toEqual(["ArrowLeft"]);
  });
});

describe("selectionSummary", () => {
  test("shows start, end and length", () => {
    expect(selectionSummary({ selectionStart: 3, selectionEnd: 5, value: "hello world" }))
      .toBe("start=3 end=5 len=11");
  });
  test("null selection positions show a dash", () => {
    expect(selectionSummary({ selectionStart: null, selectionEnd: null, value: "abc" }))
      .toBe("start=- end=- len=3");
  });
});
