// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { probeConflicts } from "../src/inspect";
import { Keymap } from "../src/operation";

const noop = () => {};

const keymap: Keymap[] = [
  { id: "one", label: "one", operation: noop, ctrl: true, key: "a" },
  { id: "two", label: "two", operation: noop, ctrl: true, key: "k" },
  { id: "three", label: "three", operation: noop, alt: true, key: "f" },
];

function makeInput(): HTMLInputElement {
  const el = document.createElement("input");
  el.type = "text";
  el.value = "hello world";
  document.body.appendChild(el);
  el.setSelectionRange(5, 5);
  return el;
}

describe("probeConflicts", () => {
  test("a field with no listeners reports no conflicts", () => {
    const el = makeInput();
    expect(probeConflicts(el, keymap)).toEqual([]);
    el.remove();
  });

  test("a chord the page prevents is reported once", () => {
    const el = makeInput();
    el.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === "k") e.preventDefault();
    });
    const conflicts = probeConflicts(el, keymap);
    expect(conflicts.map((c) => c.id)).toEqual(["two"]);
    el.remove();
  });

  test("a listener preventing everything reports every entry", () => {
    const el = makeInput();
    el.addEventListener("keydown", (e) => e.preventDefault());
    expect(probeConflicts(el, keymap).map((c) => c.id)).toEqual(["one", "two", "three"]);
    el.remove();
  });

  test("value and selection survive a mutating listener", () => {
    const el = makeInput();
    el.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === "a") {
        e.preventDefault();
        el.value = "mutated";
      }
    });
    probeConflicts(el, keymap);
    expect(el.value).toBe("hello world");
    expect(el.selectionStart).toBe(5);
    expect(el.selectionEnd).toBe(5);
    el.remove();
  });
});
