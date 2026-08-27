/**
 * Applying a kill region to a real field.
 *
 * These run in jsdom, which implements no `document.execCommand`. That is not a
 * gap here but a fixture: it exercises the value-splice fallback exactly, while
 * the undo and input-event half of the contract — the part only a real engine
 * can show — is claimed by the tagged e2e tests instead. Nothing below asserts
 * undo, because nothing here could observe it.
 */
// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { operation } from "../src/operation";
import { applyKillRegion } from "../src/killregion";
import { clearRing, newestEntry } from "../src/killring";

function makeInput(value: string, start: number, end = start): HTMLInputElement {
  const el = document.createElement("input");
  el.type = "text";
  el.value = value;
  el.setSelectionRange(start, end);
  return el;
}

describe("an empty kill region is not an edit @C1.14", () => {
  test("applyKillRegion on an empty region leaves value and caret untouched", () => {
    const el = makeInput("hello world", 5);
    applyKillRegion(el, { start: 5, end: 5 });
    expect(el.value).toBe("hello world");
    expect(el.selectionStart).toBe(5);
    expect(el.selectionEnd).toBe(5);
  });

  test("an empty region fires no input event", () => {
    const el = makeInput("hello", 5);
    const seen = vi.fn();
    el.addEventListener("input", seen);
    applyKillRegion(el, { start: 5, end: 5 });
    expect(seen).not.toHaveBeenCalled();
  });

  test("deleteToEOL at the end of a line changes nothing", () => {
    const el = makeInput("hello", 5);
    operation.deleteToEOL(el);
    expect(el.value).toBe("hello");
    expect(el.selectionStart).toBe(5);
  });

  test("deleteToTOL at the start of a line changes nothing", () => {
    const el = makeInput("hello", 0);
    operation.deleteToTOL(el);
    expect(el.value).toBe("hello");
    expect(el.selectionStart).toBe(0);
  });
});

describe("the fallback path splices the value @C1.14", () => {
  test("a non-empty region is removed and the caret lands at its start", () => {
    const el = makeInput("hello world", 5);
    applyKillRegion(el, { start: 5, end: 11 });
    expect(el.value).toBe("hello");
    expect(el.selectionStart).toBe(5);
    expect(el.selectionEnd).toBe(5);
  });

  test("a leading region is removed and the caret lands at 0", () => {
    const el = makeInput("hello world", 6);
    applyKillRegion(el, { start: 0, end: 6 });
    expect(el.value).toBe("world");
    expect(el.selectionStart).toBe(0);
  });

  test("a failing execCommand still leaves the field killed", () => {
    const el = makeInput("hello world", 5);
    const execCommand = vi.fn(() => false);
    Object.defineProperty(document, "execCommand", {
      value: execCommand,
      configurable: true,
      writable: true,
    });
    try {
      applyKillRegion(el, { start: 5, end: 11 });
      expect(execCommand).toHaveBeenCalled();
      expect(el.value).toBe("hello");
      expect(el.selectionStart).toBe(5);
    } finally {
      Reflect.deleteProperty(document, "execCommand");
    }
  });
});

describe("a password kill is wired as unstorable @C1.15", () => {
  /**
   * The ring's own tests prove it stores nothing when told `storable: false`,
   * passing the flag by hand. What none of them can show is that `operation.ts`
   * ever passes it — the secret reaches the ring through this call site or not
   * at all, so the wiring needs an assertion of its own against a real field.
   */
  test("deleteToEOL on a password input leaves the ring untouched", () => {
    clearRing();
    const el = document.createElement("input");
    el.type = "password";
    el.value = "hunter2 secret";
    el.setSelectionRange(0, 0);

    operation.deleteToEOL(el);

    expect(el.value).toBe("");
    expect(newestEntry()).toBeUndefined();
  });

  test("the same kill on a text input does reach the ring", () => {
    clearRing();
    const el = makeInput("hunter2 secret", 0);

    operation.deleteToEOL(el);

    expect(newestEntry()).toBe("hunter2 secret");
  });
});

describe("a field that refuses edits is left alone @C1.14", () => {
  test("a readonly field keeps its value", () => {
    const el = makeInput("hello world", 5);
    el.readOnly = true;
    operation.deleteToEOL(el);
    expect(el.value).toBe("hello world");
  });

  test("a readonly field keeps its value under deleteToTOL", () => {
    const el = makeInput("hello world", 6);
    el.readOnly = true;
    operation.deleteToTOL(el);
    expect(el.value).toBe("hello world");
  });

  test("a disabled field keeps its value", () => {
    const el = makeInput("hello world", 5);
    el.disabled = true;
    operation.deleteToEOL(el);
    expect(el.value).toBe("hello world");
  });

  test("a readonly field fires no input event", () => {
    const el = makeInput("hello world", 5);
    el.readOnly = true;
    const seen = vi.fn();
    el.addEventListener("input", seen);
    applyKillRegion(el, { start: 5, end: 11 });
    expect(seen).not.toHaveBeenCalled();
  });
});
