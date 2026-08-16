// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { matchesRule, migrateLegacyUrls } from "../src/urlrules";
import { analyzeHandlerSource } from "../src/handleranalysis";
import { cursor } from "../src/cursor";
import { dispatchEditableKey, dispatchKey } from "../src/keyhandling";
import { findConflict, mergeKeymap } from "../src/keymapmerge";
import { selectionSummary } from "../src/keychord";
import { loadContentEditableSetting } from "../src/contenteditablesetting";
import { Keymap } from "../src/operation";

const noop = () => {};

describe("glob ? stays within a segment", () => {
  test("? does not match a path separator", () => {
    const rule = { pattern: "https://example.com/?", matchType: "glob", action: "deny" } as const;
    expect(matchesRule("https://example.com//", rule)).toBe(false);
  });
});

describe("legacy migration drops blank entries", () => {
  test("whitespace-only urls are dropped", () => {
    expect(migrateLegacyUrls([" ", "\t"])).toEqual({ defaultAction: "allow", rules: [] });
  });
});

describe("handler analysis requires every asserted modifier", () => {
  const ctrlShiftK = { key: "k", ctrl: true, shift: true };

  test("a handler testing only ctrl does not match a ctrl+shift chord", () => {
    const source = `(e)=>{if(e.ctrlKey&&e.key==='k'){e.preventDefault();}}`;
    expect(analyzeHandlerSource(source, [ctrlShiftK])).toEqual([]);
  });
  test("a handler testing both modifiers matches", () => {
    const source = `(e)=>{if(e.ctrlKey&&e.shiftKey&&e.key==='k'){e.preventDefault();}}`;
    expect(analyzeHandlerSource(source, [ctrlShiftK])).toEqual([ctrlShiftK]);
  });
});

describe("word motion boundaries", () => {
  test("end of word at the end of the buffer stays put", () => {
    expect(cursor.getEndOfWord("hello", 5)).toBe(5);
  });
  test("end of word stops at a newline", () => {
    expect(cursor.getEndOfWord("foo\nbar", 0)).toBe(3);
  });
  test("end of word stops at a tab", () => {
    expect(cursor.getEndOfWord("aa\tbb", 0)).toBe(2);
  });
  test("top of word crosses back over a newline boundary", () => {
    expect(cursor.getTopOfWord("foo\nbar", 7)).toBe(4);
  });
});

describe("dispatchEditableKey", () => {
  function ctrlKeydown(key: string): KeyboardEvent {
    return new KeyboardEvent("keydown", { key, ctrlKey: true, cancelable: true });
  }
  const root = document.createElement("div");

  test("an entry without an editable counterpart leaves the event to the page", () => {
    const keymap: Keymap[] = [
      { id: "one", label: "one", operation: noop, ctrl: true, key: "a" },
    ];
    const event = ctrlKeydown("a");
    dispatchEditableKey(event, root, keymap);
    expect(event.defaultPrevented).toBe(false);
  });

  test("an entry with an editable counterpart runs it and cancels the event", () => {
    const editable = vi.fn();
    const keymap: Keymap[] = [
      { id: "one", label: "one", operation: noop, editableOperation: editable, ctrl: true, key: "a" },
    ];
    const event = ctrlKeydown("a");
    dispatchEditableKey(event, root, keymap);
    expect(editable).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  test("only the first matching entry runs", () => {
    const first = vi.fn();
    const second = vi.fn();
    const keymap: Keymap[] = [
      { id: "one", label: "one", operation: noop, editableOperation: first, ctrl: true, key: "a" },
      { id: "two", label: "two", operation: noop, editableOperation: second, ctrl: true, key: "a" },
    ];
    dispatchEditableKey(ctrlKeydown("a"), root, keymap);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });
});

describe("keydown during IME composition is left alone @C1.2", () => {
  function composingCtrlKeydown(key: string): KeyboardEvent {
    const event = new KeyboardEvent("keydown", { key, ctrlKey: true, cancelable: true });
    Object.defineProperty(event, "isComposing", { value: true });
    return event;
  }

  test("dispatchKey does not act while composing", () => {
    const op = vi.fn();
    const keymap: Keymap[] = [
      { id: "one", label: "one", operation: op, ctrl: true, key: "a" },
    ];
    const input = document.createElement("input");
    const event = composingCtrlKeydown("a");
    dispatchKey(event, input, keymap);
    expect(op).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  test("dispatchEditableKey does not act while composing", () => {
    const editable = vi.fn();
    const keymap: Keymap[] = [
      { id: "one", label: "one", operation: noop, editableOperation: editable, ctrl: true, key: "a" },
    ];
    dispatchEditableKey(composingCtrlKeydown("a"), document.createElement("div"), keymap);
    expect(editable).not.toHaveBeenCalled();
  });
});

describe("chord comparison is case sensitive", () => {
  test("Ctrl+A does not conflict with ctrl+a", () => {
    const merged = mergeKeymap([
      { id: "one", label: "one", operation: noop, ctrl: true, key: "a" },
    ]);
    expect(findConflict({ key: "A", ctrl: true }, merged, "other")).toBe(null);
  });
});

describe("selection summary reports raw length", () => {
  test("trailing whitespace counts", () => {
    expect(selectionSummary({ selectionStart: 1, selectionEnd: 1, value: "ab " }))
      .toBe("start=1 end=1 len=3");
  });
});

describe("contenteditable stays off by default", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("an empty storage resolves to disabled", async () => {
    const get = vi.fn((defaults: Record<string, unknown>) => Promise.resolve(defaults));
    vi.stubGlobal("chrome", { storage: { sync: { get } } });
    await expect(loadContentEditableSetting()).resolves.toBe(false);
    expect(get).toHaveBeenCalledWith({ enableContentEditable: false });
  });
});
