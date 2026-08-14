// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { dispatchKey } from "../src/keyhandling";
import { Keymap } from "../src/operation";

function ctrlKeydown(key: string): KeyboardEvent {
  return new KeyboardEvent("keydown", { key, ctrlKey: true, cancelable: true });
}

describe("dispatchKey runs only the first matching entry", () => {
  test("duplicate chords fire once, first wins", () => {
    const first = vi.fn();
    const second = vi.fn();
    const keymap: Keymap[] = [
      { id: "one", label: "one", operation: first, ctrl: true, key: "a" },
      { id: "two", label: "two", operation: second, ctrl: true, key: "a" },
    ];
    const input = document.createElement("input");
    const event = ctrlKeydown("a");
    dispatchKey(event, input, keymap);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  test("no match leaves the event alone", () => {
    const op = vi.fn();
    const keymap: Keymap[] = [
      { id: "one", label: "one", operation: op, ctrl: true, key: "a" },
    ];
    const input = document.createElement("input");
    const event = ctrlKeydown("x");
    dispatchKey(event, input, keymap);
    expect(op).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
