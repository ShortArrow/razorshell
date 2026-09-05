/**
 * The reclaimed chords as they reach the ring and the field.
 *
 * These run in jsdom, so `applyKillRegion` and the insert path take their
 * documented splice fallbacks and nothing here can assert undo or input events —
 * the e2e suite owns that half. What these show, and the region tests cannot, is
 * the wiring: that the rubout records a BACKWARD kill and therefore chains with
 * the backward line kill that may follow it, that a password rubout is never
 * stored, and that transpose carries no ring role at all.
 *
 * The backward+backward chain is the case worth stating: until the `caretBefore`
 * fix earlier in this release two backward kills at one caret could never chain,
 * because the comparison asked whether both kills ENDED in the same place rather
 * than whether the second BEGAN where the first stopped.
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

describe("the unix word rubout reaches the ring @C1.18", () => {
  test("a rubout kills the whitespace word behind the caret and stores it", () => {
    const el = makeInput("foo bar-baz", 11);
    operation.unixWordRubout(el);
    expect(el.value).toBe("foo ");
    expect(el.selectionStart).toBe(4);
    expect(newestEntry()).toBe("bar-baz");
  });

  /**
   * The chain, and the whole reason this is a kill rather than a delete: a
   * rubout then a Ctrl+U at the caret the rubout left behind must give back the
   * line in its original order, backward pieces prepending.
   */
  test("a rubout chains with a following backward line kill", () => {
    const el = makeInput("foo bar", 7);
    operation.unixWordRubout(el);
    expect(el.value).toBe("foo ");
    expect(newestEntry()).toBe("bar");

    operation.deleteToTOL(el);
    expect(el.value).toBe("");
    expect(ringSnapshot()).toEqual(["foo bar"]);
  });

  test("two rubouts at one caret accumulate into one entry", () => {
    const el = makeInput("one two three", 13);
    operation.unixWordRubout(el);
    operation.unixWordRubout(el);
    expect(el.value).toBe("one ");
    expect(ringSnapshot()).toEqual(["two three"]);
  });

  test("a foreign command between two rubouts keeps them as two entries", () => {
    const el = makeInput("one two three", 13);
    operation.unixWordRubout(el);
    noteForeignCommand();
    operation.unixWordRubout(el);
    expect(ringSnapshot()).toEqual(["two ", "three"]);
  });

  test("a rubout at the value start stores nothing and leaves the field alone", () => {
    const el = makeInput("hello", 0);
    operation.unixWordRubout(el);
    expect(el.value).toBe("hello");
    expect(ringSnapshot()).toEqual([]);
  });

  test("a rubout in a password field is never stored", () => {
    const el = document.createElement("input");
    el.type = "password";
    el.value = "hunter2 secret";
    el.setSelectionRange(14, 14);
    operation.unixWordRubout(el);
    expect(el.value).toBe("hunter2 ");
    expect(newestEntry()).toBeUndefined();
  });

  test("a readonly field is left alone", () => {
    const el = makeInput("foo bar", 7);
    el.readOnly = true;
    operation.unixWordRubout(el);
    expect(el.value).toBe("foo bar");
    expect(ringSnapshot()).toEqual([]);
  });

  test("a rubout then a yank round trips", () => {
    const el = makeInput("foo bar", 7);
    operation.unixWordRubout(el);
    operation.yank(el);
    expect(el.value).toBe("foo bar");
  });
});

describe("transpose-chars edits the field without touching the ring @C1.18", () => {
  test("mid-line the caret advances past both characters", () => {
    const el = makeInput("abc", 1);
    operation.transposeChars(el);
    expect(el.value).toBe("bac");
    expect(el.selectionStart).toBe(2);
  });

  test("at the end of the value the last two characters swap", () => {
    const el = makeInput("abc", 3);
    operation.transposeChars(el);
    expect(el.value).toBe("acb");
    expect(el.selectionStart).toBe(3);
  });

  test("at position 0 nothing happens at all", () => {
    const el = makeInput("abc", 0);
    operation.transposeChars(el);
    expect(el.value).toBe("abc");
    expect(el.selectionStart).toBe(0);
  });

  test("an emoji crosses the caret whole", () => {
    const el = makeInput("a\u{1F600}", 3);
    operation.transposeChars(el);
    expect(el.value).toBe("\u{1F600}a");
  });

  /**
   * Transpose carries no `ringRole`, so a transpose between two kills breaks the
   * chain rather than letting them splice across the text it rearranged — the
   * property the case operations and character deletes already buy by the same
   * absence.
   */
  test("a transpose does not disturb the ring's entries", () => {
    const el = makeInput("foo bar", 7);
    operation.unixWordRubout(el);
    expect(newestEntry()).toBe("bar");

    operation.transposeChars(el);
    expect(ringSnapshot()).toEqual(["bar"]);
  });

  test("a readonly field is left alone", () => {
    const el = makeInput("abc", 3);
    el.readOnly = true;
    operation.transposeChars(el);
    expect(el.value).toBe("abc");
  });
});
