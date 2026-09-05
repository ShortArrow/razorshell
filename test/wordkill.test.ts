/**
 * The word kills and character deletes as they reach the ring and the field.
 *
 * These run in jsdom, so `applyKillRegion` takes its documented splice fallback
 * and nothing here can assert undo or input events — the e2e suite owns that
 * half. What these can show, and the region tests cannot, is the wiring: that
 * Alt+d records a forward kill, that Alt+Backspace records a backward one, and
 * that Ctrl+d carries no ring role at all and therefore breaks a kill chain
 * instead of joining it.
 *
 * The chain expectations come from readline: consecutive kills at one caret
 * accumulate into a single entry with forward pieces appended and backward
 * pieces prepended, and any command that is not a kill starts a fresh entry.
 */
// @vitest-environment jsdom
import { describe, expect, test, beforeEach } from "vitest";
import { operation } from "../src/operation";
import { clearRing, newestEntry, noteForeignCommand, ringSnapshot } from "../src/killring";

function makeInput(value: string, start: number, end = start): HTMLInputElement {
  const el = document.createElement("input");
  el.type = "text";
  el.value = value;
  el.setSelectionRange(start, end);
  return el;
}

beforeEach(() => {
  clearRing();
});

describe("a word kill reaches the ring @C1.16", () => {
  test("Alt+d kills the word ahead of the caret and stores it", () => {
    const el = makeInput("one two three", 4);
    operation.killWord(el);
    expect(el.value).toBe("one  three");
    expect(el.selectionStart).toBe(4);
    expect(newestEntry()).toBe("two");
  });

  test("Alt+Backspace kills the word behind the caret and stores it", () => {
    const el = makeInput("one two three", 7);
    operation.backwardKillWord(el);
    expect(el.value).toBe("one  three");
    expect(el.selectionStart).toBe(4);
    expect(newestEntry()).toBe("two");
  });

  test("a word kill at the end of the value stores nothing", () => {
    const el = makeInput("one", 3);
    operation.killWord(el);
    expect(el.value).toBe("one");
    expect(ringSnapshot()).toEqual([]);
  });

  test("a backward word kill at the start of the value stores nothing", () => {
    const el = makeInput("one", 0);
    operation.backwardKillWord(el);
    expect(el.value).toBe("one");
    expect(ringSnapshot()).toEqual([]);
  });

  test("a word kill in a password field is never stored", () => {
    const el = document.createElement("input");
    el.type = "password";
    el.value = "hunter2 secret";
    el.setSelectionRange(0, 0);
    operation.killWord(el);
    expect(el.value).toBe(" secret");
    expect(newestEntry()).toBeUndefined();
  });

  test("a readonly field is left alone", () => {
    const el = makeInput("one two", 0);
    el.readOnly = true;
    operation.killWord(el);
    expect(el.value).toBe("one two");
    expect(ringSnapshot()).toEqual([]);
  });
});

describe("word kills chain like line kills @C1.16", () => {
  /**
   * Readline's order: a backward kill prepends to the entry a forward kill at
   * the same caret started, so Ctrl+u then Alt+d at one caret gives back the
   * pieces in the order the line held them.
   */
  test("a backward line kill then a forward word kill make one entry in original order", () => {
    const el = makeInput("abc def ghi", 4);
    operation.deleteToTOL(el);
    expect(el.value).toBe("def ghi");
    operation.killWord(el);
    expect(ringSnapshot()).toEqual(["abc def"]);
  });

  test("two word kills at one caret append into a single entry", () => {
    const el = makeInput("one two three", 4);
    operation.killWord(el);
    operation.killWord(el);
    expect(el.value).toBe("one ");
    expect(ringSnapshot()).toEqual(["two three"]);
  });

  /**
   * Readline's rule, through the real operations: consecutive backward kills
   * accumulate into one entry, each piece prepended, so the entry reads in the
   * order the line held it.
   *
   * From the end of "one two three" the first Alt+Backspace takes "three" and
   * leaves the caret at 8; the second starts there and takes "two ". Prepending
   * gives "two three". Nothing about that is coincidental to the caret numbers —
   * it is the definition of a run of kills at one place — so this is the
   * specification, not a characterization of whatever the code happens to do.
   */
  test("two backward word kills at one place prepend into a single entry", () => {
    const el = makeInput("one two three", 13);
    operation.backwardKillWord(el);
    expect(el.value).toBe("one two ");
    operation.backwardKillWord(el);
    expect(el.value).toBe("one ");
    expect(ringSnapshot()).toEqual(["two three"]);
  });

  /**
   * A backward kill and a forward kill meeting at one caret, which is the case
   * the ADR names: what the two took together reads back as the text that was
   * there. The backward piece prepends and the forward piece appends, so the
   * order survives regardless of which key was pressed first.
   */
  test("a backward word kill then a forward word kill at one caret keep the order", () => {
    const el = makeInput("one two three", 7);
    operation.backwardKillWord(el);
    expect(el.value).toBe("one  three");
    operation.killWord(el);
    expect(el.value).toBe("one ");
    expect(ringSnapshot()).toEqual(["two three"]);
  });

  test("a foreign command between two word kills makes two entries", () => {
    const el = makeInput("one two three", 4);
    operation.killWord(el);
    noteForeignCommand(el);
    operation.killWord(el);
    expect(ringSnapshot()).toEqual([" three", "two"]);
  });
});

describe("a character delete is not a kill @C1.16", () => {
  test("Ctrl+d removes one character forward and stores nothing", () => {
    const el = makeInput("abc", 1);
    operation.deleteChar(el);
    expect(el.value).toBe("ac");
    expect(el.selectionStart).toBe(1);
    expect(ringSnapshot()).toEqual([]);
  });

  test("Ctrl+h removes one character backward and stores nothing", () => {
    const el = makeInput("abc", 2);
    operation.backwardDeleteChar(el);
    expect(el.value).toBe("ac");
    expect(el.selectionStart).toBe(1);
    expect(ringSnapshot()).toEqual([]);
  });

  test("Ctrl+d at the end of the value is a complete no-op", () => {
    const el = makeInput("abc", 3);
    operation.deleteChar(el);
    expect(el.value).toBe("abc");
    expect(el.selectionStart).toBe(3);
    expect(el.selectionEnd).toBe(3);
  });

  test("Ctrl+h at the start of the value is a complete no-op", () => {
    const el = makeInput("abc", 0);
    operation.backwardDeleteChar(el);
    expect(el.value).toBe("abc");
    expect(el.selectionStart).toBe(0);
  });

  test("Ctrl+d on an empty value is a complete no-op", () => {
    const el = makeInput("", 0);
    operation.deleteChar(el);
    expect(el.value).toBe("");
  });

  test("an emoji leaves whole rather than half", () => {
    const el = makeInput("a\u{1F600}b", 1);
    operation.deleteChar(el);
    expect(el.value).toBe("ab");
    expect(el.value.isWellFormed()).toBe(true);
  });

  test("a readonly field is left alone", () => {
    const el = makeInput("abc", 1);
    el.readOnly = true;
    operation.deleteChar(el);
    expect(el.value).toBe("abc");
  });

  /**
   * The chain-breaking property, and the reason `delete_char` carries no
   * `ringRole`: the dispatcher reports every role-less binding to the ring as a
   * foreign command, so the kill after a character delete cannot concatenate
   * onto the kill before it. Asserted through the dispatcher rather than by
   * calling the operation directly, because the report lives there — calling
   * `operation.deleteChar` alone would prove nothing about the wiring.
   */
  test("a character delete between two kills keeps them as two entries", () => {
    const el = makeInput("one two three", 4);
    operation.killWord(el);
    noteForeignCommand(el); // what the dispatcher does for a role-less binding
    operation.killWord(el);
    expect(ringSnapshot()).toHaveLength(2);
  });
});
