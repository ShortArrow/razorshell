/**
 * delete-horizontal-space: the region it removes, the field it edits, and the
 * chord that reaches it.
 *
 * The expectations are readline's `rl_delete_horizontal_space` (`text.c`),
 * which walks back from the point while `whitespace (rl_line_buffer[...])`
 * holds, then forward from the point the same way, deletes the span and leaves
 * the point at its start. readline's `whitespace` is space and tab only, so a
 * newline bounds the run and a no-break space is text.
 *
 * It is a delete, not a kill: nothing reaches the ring, and the entry carries
 * no `ringRole`, so the dispatcher reports it as a foreign command and a kill
 * chain around it breaks — the same contract the character deletes keep.
 */
// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from "vitest";
import fc from "fast-check";
import { horizontalSpaceRegion } from "../src/killregion";
import { operation } from "../src/operation";
import { clearRing, ringSnapshot } from "../src/killring";
import { defaultKeymap, keymaching } from "../src/keymap";

/** The text a region removes. */
function removed(value: string, region: { start: number; end: number }): string {
  return value.slice(region.start, region.end);
}

describe("horizontalSpaceRegion covers the blank classes @C1.16", () => {
  test("blanks on both sides of the caret leave together", () => {
    expect(horizontalSpaceRegion("a  \t  b", 3)).toEqual({ start: 1, end: 6 });
  });
  test("blanks only before the caret", () => {
    expect(horizontalSpaceRegion("a  b", 3)).toEqual({ start: 1, end: 3 });
  });
  test("blanks only after the caret", () => {
    expect(horizontalSpaceRegion("a  b", 1)).toEqual({ start: 1, end: 3 });
  });
  test("no blank at the caret is an empty region at the caret", () => {
    expect(horizontalSpaceRegion("ab", 1)).toEqual({ start: 1, end: 1 });
  });
  test("a newline bounds the run on both sides", () => {
    expect(horizontalSpaceRegion("a\n  \t \nb", 4)).toEqual({ start: 2, end: 6 });
  });
  test("a run at the start of the value", () => {
    expect(horizontalSpaceRegion("  x", 1)).toEqual({ start: 0, end: 2 });
  });
  test("a run at the end of the value", () => {
    expect(horizontalSpaceRegion("x  ", 3)).toEqual({ start: 1, end: 3 });
  });
  test("an all-blank value goes whole", () => {
    expect(horizontalSpaceRegion(" \t ", 1)).toEqual({ start: 0, end: 3 });
  });
  test("an empty value is an empty region", () => {
    expect(horizontalSpaceRegion("", 0)).toEqual({ start: 0, end: 0 });
  });
  test("a no-break space is text, as readline's whitespace() has it", () => {
    expect(horizontalSpaceRegion("a  b", 3)).toEqual({ start: 2, end: 3 });
  });

  test("the region holds only blanks, contains the caret, and no blank borders it", () => {
    const text = fc
      .array(fc.constantFrom(" ", "\t", "\n", "a", " "), { maxLength: 12 })
      .map((chars) => chars.join(""));
    fc.assert(
      fc.property(
        text.chain((value) => fc.tuple(fc.constant(value), fc.integer({ min: 0, max: value.length }))),
        ([value, caret]) => {
          const region = horizontalSpaceRegion(value, caret);
          expect(region.start).toBeLessThanOrEqual(caret);
          expect(region.end).toBeGreaterThanOrEqual(caret);
          expect(removed(value, region)).toMatch(/^[ \t]*$/);
          expect(value[region.start - 1] ?? "x").not.toMatch(/[ \t]/);
          expect(value[region.end] ?? "x").not.toMatch(/[ \t]/);
        },
      ),
    );
  });
});

function makeInput(value: string, start: number, end = start): HTMLInputElement {
  const el = document.createElement("input");
  el.type = "text";
  el.value = value;
  el.setSelectionRange(start, end);
  return el;
}

describe("Alt+\\ deletes the blanks around the caret without the ring @C1.16", () => {
  beforeEach(() => {
    clearRing();
  });

  test("the run leaves, the caret lands at its start, and the ring stays empty", () => {
    const el = makeInput("one  \t two", 5);
    operation.deleteHorizontalSpace(el);
    expect(el.value).toBe("onetwo");
    expect(el.selectionStart).toBe(3);
    expect(el.selectionEnd).toBe(3);
    expect(ringSnapshot()).toEqual([]);
  });

  test("nothing to remove leaves the value and the caret alone", () => {
    const el = makeInput("one two", 2);
    operation.deleteHorizontalSpace(el);
    expect(el.value).toBe("one two");
    expect(el.selectionStart).toBe(2);
    expect(el.selectionEnd).toBe(2);
  });

  test("a textarea keeps its newlines", () => {
    const el = document.createElement("textarea");
    el.value = "one  \n  two";
    el.setSelectionRange(7, 7);
    operation.deleteHorizontalSpace(el);
    expect(el.value).toBe("one  \ntwo");
    expect(el.selectionStart).toBe(6);
  });

  /**
   * readline has no selection, so the caret is the selection's end — the
   * position the case operations and transpose-words read — and the selected
   * text itself survives.
   */
  test("a non-collapsed selection is measured from its end", () => {
    const el = makeInput("ab  cd", 0, 3);
    operation.deleteHorizontalSpace(el);
    expect(el.value).toBe("abcd");
    expect(el.selectionStart).toBe(2);
    expect(el.selectionEnd).toBe(2);
  });

  test("a readonly field is left alone", () => {
    const el = makeInput("a  b", 2);
    el.readOnly = true;
    operation.deleteHorizontalSpace(el);
    expect(el.value).toBe("a  b");
  });

  test("a disabled field is left alone", () => {
    const el = makeInput("a  b", 2);
    el.disabled = true;
    operation.deleteHorizontalSpace(el);
    expect(el.value).toBe("a  b");
  });
});

describe("the delete_horizontal_space entry @C1.16", () => {
  const entry = defaultKeymap.find((candidate) => candidate.id === "delete_horizontal_space");
  const keydown = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);

  test("ships bound to Alt+\\ with a rich text counterpart and a description", () => {
    expect(entry).toBeDefined();
    expect(entry!.unassigned).toBeUndefined();
    expect(keymaching(keydown({ key: "\\", altKey: true }), entry!)).toBe(true);
    expect(typeof entry!.editableOperation).toBe("function");
    expect(entry!.description).toBeTypeOf("function");
  });

  test("a bare backslash and Ctrl+\\ are left to the page", () => {
    expect(keymaching(keydown({ key: "\\" }), entry!)).toBe(false);
    expect(keymaching(keydown({ key: "\\", ctrlKey: true }), entry!)).toBe(false);
  });

  /**
   * The absence is the property: a role-less entry is reported to the ring as a
   * foreign command, so a kill on either side of Alt+\ starts its own entry.
   */
  test("is foreign to the ring", () => {
    expect(entry!.ringRole).toBeUndefined();
  });
});
