/**
 * Yank-pop's legality check: when a recorded region may still be replaced.
 *
 * A pop overwrites a range. Aimed at a range that no longer means what it did,
 * it destroys text the user wrote and never offered — so the question these
 * tests ask is not "does the pop work" but "when does it refuse". The answer
 * readline's semantics give, and the one the revised ADR-0010 states, is that a
 * pop follows its yank immediately: the recorded region must still read back as
 * the inserted text AND the caret must still sit collapsed at its end. Anything
 * between the two — a keystroke, a click, a page rewrite — makes it illegal.
 *
 * The caret half is what makes the ring's last-command tracking honest. An
 * unmatched keystroke never reports to the ring, so it cannot break the chain
 * by announcing itself; what it does do is move the caret, and that is what
 * this check sees.
 *
 * These run in jsdom, which has no `document.execCommand`, so every insertion
 * below takes the value-splice fallback — the same fixture `killapply.test.ts`
 * documents. The undo and input-event half is claimed by the e2e suite instead.
 */
// @vitest-environment jsdom
import { describe, expect, test, beforeEach } from "vitest";
import { applyYank, canYankPop, clearYankRecord } from "../src/yank";
import { canYankPopField } from "../src/operation";
import { dispatchKey } from "../src/keyhandling";
import { defaultKeymap } from "../src/keymap";
import { clearRing } from "../src/killring";

function makeInput(value: string, start = value.length, end = start): HTMLInputElement {
  const el = document.createElement("input");
  el.type = "text";
  el.value = value;
  document.body.appendChild(el);
  el.setSelectionRange(start, end);
  return el;
}

/** An Alt+Y keydown, as the dispatcher would see it from a real keypress. */
function altY(): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: "y", altKey: true, cancelable: true });
}

beforeEach(() => {
  document.body.innerHTML = "";
  clearRing();
  clearYankRecord();
});

describe("yank-pop refuses without a record @C1.15", () => {
  test("U-y1 Alt+Y with no record does nothing and leaves the key to the page", () => {
    const field = makeInput("hello");
    expect(canYankPopField(field)).toBe(false);

    const event = altY();
    dispatchKey(event, field, defaultKeymap);

    expect(event.defaultPrevented).toBe(false);
    expect(field.value).toBe("hello");
  });
});

describe("yank-pop verifies text and place @C1.15", () => {
  test("U-y2 a record from a different field is not a licence to pop here", () => {
    const yanked = makeInput("");
    applyYank(yanked, "abc");
    const other = makeInput("abc");
    other.setSelectionRange(3, 3);

    expect(canYankPop(yanked)).toBe(true);
    expect(canYankPop(other)).toBe(false);
  });

  test("U-y3 a Backspace after a yank fails both conditions at once", () => {
    const field = makeInput("");
    applyYank(field, "abc");
    // What Backspace leaves: the region no longer reads back as "abc", and the
    // caret no longer sits at its end. Neither alone may be relied on here.
    field.value = "ab";
    field.setSelectionRange(2, 2);

    expect(field.value.slice(0, 3)).not.toBe("abc");
    expect(field.selectionStart).not.toBe(3);
    expect(canYankPop(field)).toBe(false);
  });

  test("U-y4 a selection ending at the region end is still not a collapsed caret", () => {
    const field = makeInput("");
    applyYank(field, "abc");
    // The text is untouched and the selection ends exactly where the record
    // does; only its being a range rather than a caret makes this illegal.
    field.setSelectionRange(1, 3);

    expect(field.value.slice(0, 3)).toBe("abc");
    expect(field.selectionEnd).toBe(3);
    expect(canYankPop(field)).toBe(false);
  });

  test("U-y5 the caret is legal at the region end and illegal on either side", () => {
    // The region sits mid-value, so both neighbours of the boundary exist and
    // the pair is a real boundary test rather than one clipped by the ends.
    const field = makeInput("[]");
    field.setSelectionRange(1, 1);
    applyYank(field, "abc");
    expect(field.value).toBe("[abc]");

    const end = 4;
    field.setSelectionRange(end, end);
    expect(canYankPop(field)).toBe(true);

    field.setSelectionRange(end - 1, end - 1);
    expect(canYankPop(field)).toBe(false);

    field.setSelectionRange(end + 1, end + 1);
    expect(canYankPop(field)).toBe(false);
  });
});
