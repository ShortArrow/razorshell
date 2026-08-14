// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { operation } from "../src/operation";

function makeInput(value: string, position: number): HTMLInputElement {
  const el = document.createElement("input");
  el.type = "text";
  el.value = value;
  el.setSelectionRange(position, position);
  return el;
}

function makeTextarea(value: string, position: number): HTMLTextAreaElement {
  const el = document.createElement("textarea");
  el.value = value;
  el.setSelectionRange(position, position);
  return el;
}

describe("single line input keeps whole-value behavior", () => {
  test("moveToTOL moves to 0", () => {
    const el = makeInput("hello world", 5);
    operation.moveToTOL(el);
    expect(el.selectionStart).toBe(0);
    expect(el.selectionEnd).toBe(0);
  });
  test("moveToEOL moves to length", () => {
    const el = makeInput("hello world", 5);
    operation.moveToEOL(el);
    expect(el.selectionStart).toBe(11);
  });
  test("deleteToEOL removes tail", () => {
    const el = makeInput("hello world", 5);
    operation.deleteToEOL(el);
    expect(el.value).toBe("hello");
    expect(el.selectionStart).toBe(5);
  });
  test("deleteToTOL removes head", () => {
    const el = makeInput("hello world", 6);
    operation.deleteToTOL(el);
    expect(el.value).toBe("world");
    expect(el.selectionStart).toBe(0);
  });
});

describe("textarea operates per line", () => {
  const text = "first line\nsecond line\nthird";

  test("moveToTOL moves to top of current line", () => {
    const el = makeTextarea(text, 15);
    operation.moveToTOL(el);
    expect(el.selectionStart).toBe(11);
  });
  test("moveToEOL moves to end of current line", () => {
    const el = makeTextarea(text, 15);
    operation.moveToEOL(el);
    expect(el.selectionStart).toBe(22);
  });
  test("deleteToEOL deletes to end of current line only", () => {
    const el = makeTextarea(text, 15);
    operation.deleteToEOL(el);
    expect(el.value).toBe("first line\nseco\nthird");
    expect(el.selectionStart).toBe(15);
  });
  test("deleteToTOL deletes to top of current line only", () => {
    const el = makeTextarea(text, 15);
    operation.deleteToTOL(el);
    expect(el.value).toBe("first line\nnd line\nthird");
    expect(el.selectionStart).toBe(11);
  });
});
