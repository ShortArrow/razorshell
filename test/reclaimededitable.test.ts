/**
 * The reclaimed chords in a rich text root: the walk that measures the rubout
 * and the rule that keeps a transpose inside one text node.
 *
 * Neither `Selection.modify` nor `execCommand` exists in jsdom, so
 * the engine half — the walk over rendered characters, the delete through the
 * host's history, the probe for the end of the line — is the e2e suite's. What
 * runs here are the two decisions that do not need an engine:
 *
 * - The rubout walk, driven over a fake selection that steps one character of
 *   a plain string per `modify`. The walk must stop exactly where
 *   `unixWordRuboutRegion` stops in a field, which is what "mirror the field
 *   version" means for an operation that cannot read a value.
 * - Whether a transpose in a text node is the readline transpose or a refusal:
 *   it is the readline one only when both graphemes it swaps lie in that node.
 */
import { describe, expect, test } from "vitest";
import fc from "fast-check";
import { extendOverUnixWord } from "../src/editableoperation";
import { transposeCharsEdit, transposeWithinTextNode, unixWordRuboutRegion } from "../src/reclaimedregion";

/**
 * A selection over a plain string with the anchor fixed at the caret, moving
 * its focus one code unit per `extend` and reading back what lies between.
 */
function fakeSelection(value: string, caret: number) {
  let focus = caret;
  return {
    modify(alter: string, direction: string, granularity: string) {
      if (alter !== "extend" || granularity !== "character") throw new Error("unexpected modify");
      focus = direction === "backward" ? Math.max(0, focus - 1) : Math.min(value.length, focus + 1);
    },
    toString() {
      return value.slice(Math.min(focus, caret), Math.max(focus, caret));
    },
    get focus() {
      return focus;
    },
  };
}

describe("the rich text rubout walks to where the field rubout stops @C1.18", () => {
  test("a word at the caret goes whole, hyphen and all", () => {
    const sel = fakeSelection("foo bar-baz", 11);
    extendOverUnixWord(sel);
    expect(sel.toString()).toBe("bar-baz");
  });

  test("the whitespace behind the caret goes with the word before it", () => {
    const sel = fakeSelection("foo bar  ", 9);
    extendOverUnixWord(sel);
    expect(sel.toString()).toBe("bar  ");
  });

  test("a block boundary reads back as a newline and is whitespace", () => {
    const sel = fakeSelection("foo\nbar", 4);
    extendOverUnixWord(sel);
    expect(sel.toString()).toBe("foo\n");
  });

  test("a word stops at the line break before it", () => {
    const sel = fakeSelection("foo\nbar", 7);
    extendOverUnixWord(sel);
    expect(sel.toString()).toBe("bar");
  });

  test("at the start of the root nothing is selected", () => {
    const sel = fakeSelection("foo", 0);
    extendOverUnixWord(sel);
    expect(sel.toString()).toBe("");
  });

  test("a no-break space is text, as in the field version", () => {
    const sel = fakeSelection("foo bar", 7);
    extendOverUnixWord(sel);
    expect(sel.toString()).toBe("foo bar");
  });

  test("for any text and caret the walk selects the field rubout's region", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("a", "b", "-", " ", "\t", "\n", " "), { maxLength: 12 }).map((cs) => cs.join("")),
        fc.nat(),
        (value, seed) => {
          const caret = seed % (value.length + 1);
          const sel = fakeSelection(value, caret);
          extendOverUnixWord(sel);
          const region = unixWordRuboutRegion(value, caret, caret);
          expect(sel.toString()).toBe(value.slice(region.start, region.end));
          expect(sel.focus).toBe(region.start);
        },
      ),
    );
  });
});

describe("a rich text transpose stays inside one text node @C1.18", () => {
  test("mid-node it is the readline transpose", () => {
    expect(transposeWithinTextNode("abcd", 2, false)).toEqual(transposeCharsEdit("abcd", 2));
    expect(transposeWithinTextNode("abcd", 2, false)).toEqual({ start: 1, end: 3, text: "cb", caret: 3 });
  });

  test("mid-node the line end does not matter", () => {
    expect(transposeWithinTextNode("abcd", 2, true)).toEqual({ start: 1, end: 3, text: "cb", caret: 3 });
  });

  test("at the start of the node the character before lies elsewhere, so it refuses", () => {
    expect(transposeWithinTextNode("abcd", 0, false)).toBeNull();
    expect(transposeWithinTextNode("abcd", 0, true)).toBeNull();
  });

  test("at the end of the node with more of the line after it, it refuses", () => {
    expect(transposeWithinTextNode("abcd", 4, false)).toBeNull();
  });

  test("at the end of the node and of the line, the two before the caret swap", () => {
    expect(transposeWithinTextNode("abcd", 4, true)).toEqual({ start: 2, end: 4, text: "dc", caret: 4 });
  });

  test("at the end of the line with one grapheme in the node, the other lies elsewhere", () => {
    expect(transposeWithinTextNode("a", 1, true)).toBeNull();
  });

  test("an emoji crosses the caret whole", () => {
    expect(transposeWithinTextNode("a\u{1F600}", 3, true)).toEqual({
      start: 0,
      end: 3,
      text: "\u{1F600}a",
      caret: 3,
    });
  });

  test("an offset past the data is the end of the node", () => {
    expect(transposeWithinTextNode("ab", 9, false)).toBeNull();
    expect(transposeWithinTextNode("ab", 9, true)).toEqual({ start: 0, end: 2, text: "ba", caret: 2 });
  });
});
