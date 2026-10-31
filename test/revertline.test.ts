/**
 * revert-line: the focus-time snapshot it restores, when it takes the key, and
 * the field it rewrites.
 *
 * readline's `rl_revert_line` undoes every change made to the line since
 * editing began. A text field has no line buffer of its own, so editing begins
 * when the field gains focus and the snapshot is the value it held then (see
 * ADR-0016, "revert-line restores the value a field held when it gained
 * focus").
 *
 * jsdom has no `execCommand`, so the write takes the splice fallback and
 * nothing here can assert undo or input events; the e2e suite owns that half.
 */
// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from "vitest";
import {
  canRevertLine,
  focusValue,
  forgetFocusValues,
  noteFocus,
  noteFocusElsewhere,
  noteKeydown,
  noteWindowBlur,
  revertLine,
} from "../src/revertline";
import { keyEventHandling } from "../src/keyhandling";
import { defaultKeymap, keymaching } from "../src/keymap";
import { operation } from "../src/operation";

function makeInput(value: string, type = "text"): HTMLInputElement {
  const el = document.createElement("input");
  el.type = type;
  el.value = value;
  return el;
}

beforeEach(() => {
  forgetFocusValues();
});

describe("the focus-time snapshot @C1.16", () => {
  test("a focus records the value the field holds", () => {
    const el = makeInput("draft");
    noteFocus(el);
    expect(focusValue(el)).toBe("draft");
  });

  test("a later focus replaces the snapshot", () => {
    const el = makeInput("first");
    noteFocus(el);
    el.value = "second";
    noteFocus(el);
    expect(focusValue(el)).toBe("second");
  });

  test("a keydown records the value when no focus was seen", () => {
    const el = makeInput("autofocused");
    noteKeydown(el);
    expect(focusValue(el)).toBe("autofocused");
  });

  test("a keydown leaves an existing snapshot alone", () => {
    const el = makeInput("at focus");
    noteFocus(el);
    el.value = "edited";
    noteKeydown(el);
    expect(focusValue(el)).toBe("at focus");
  });

  test("each field keeps its own snapshot", () => {
    const one = makeInput("one");
    const two = makeInput("two");
    noteFocus(one);
    noteFocus(two);
    expect(focusValue(one)).toBe("one");
    expect(focusValue(two)).toBe("two");
  });

  test("a password field is never recorded, by focus or by keydown", () => {
    const el = makeInput("hunter2", "password");
    noteFocus(el);
    noteKeydown(el);
    expect(focusValue(el)).toBeUndefined();
  });

  /** A show-password toggle turns the field to text with the password in it. */
  test("a password field shown as text is not recorded by the next keydown", () => {
    const el = makeInput("", "password");
    noteFocus(el);
    el.value = "hunter2";
    el.type = "text";
    noteKeydown(el);
    expect(focusValue(el)).toBeUndefined();
  });

  test("a password field shown as text is not recorded by a later focus", () => {
    const el = makeInput("", "password");
    noteKeydown(el);
    el.value = "hunter2";
    el.type = "text";
    noteFocus(el);
    expect(focusValue(el)).toBeUndefined();
  });

  test("forgetting drops every snapshot", () => {
    const el = makeInput("kept");
    noteFocus(el);
    forgetFocusValues();
    expect(focusValue(el)).toBeUndefined();
  });

  test("focus returning to the field the window blurred on keeps the snapshot", () => {
    const el = makeInput("at focus");
    noteFocus(el);
    el.value = "edited";
    noteWindowBlur(el);
    noteFocus(el);
    expect(focusValue(el)).toBe("at focus");
  });

  test("after a window blur, focus landing on another field records that field", () => {
    const one = makeInput("one");
    const two = makeInput("two");
    noteFocus(one);
    noteWindowBlur(one);
    noteFocus(two);
    expect(focusValue(two)).toBe("two");
  });

  test("the return is spent once: a later refocus of the same field records anew", () => {
    const el = makeInput("at focus");
    const other = makeInput("other");
    noteFocus(el);
    el.value = "edited";
    noteWindowBlur(el);
    noteFocus(other);
    noteFocus(el);
    expect(focusValue(el)).toBe("edited");
  });

  test("focus on a non-field element spends the return too", () => {
    const el = makeInput("at focus");
    noteFocus(el);
    el.value = "edited";
    noteWindowBlur(el);
    noteFocusElsewhere();
    noteFocus(el);
    expect(focusValue(el)).toBe("edited");
  });

  test("a window blur while nothing was focused does not hold a later focus back", () => {
    const el = makeInput("at focus");
    noteFocus(el);
    el.value = "edited";
    noteWindowBlur(el);
    noteWindowBlur(null);
    noteFocus(el);
    expect(focusValue(el)).toBe("edited");
  });

  test("the dispatcher records lazily on the first keydown in a field", () => {
    const el = makeInput("before typing");
    keyEventHandling(new KeyboardEvent("keydown", { key: "x", cancelable: true }), el);
    expect(focusValue(el)).toBe("before typing");
  });
});

describe("canRevertLine takes the key only when there is something to restore @C1.16", () => {
  test("a changed field with a snapshot is handled", () => {
    const el = makeInput("original");
    noteFocus(el);
    el.value = "changed";
    expect(canRevertLine(el)).toBe(true);
  });

  test("an unchanged field is left to the page", () => {
    const el = makeInput("same");
    noteFocus(el);
    expect(canRevertLine(el)).toBe(false);
  });

  test("a field with no snapshot is left to the page", () => {
    expect(canRevertLine(makeInput("never focused"))).toBe(false);
  });

  test("a password field is left to the page", () => {
    const el = makeInput("secret", "password");
    noteFocus(el);
    el.value = "secret2";
    expect(canRevertLine(el)).toBe(false);
  });

  /** A field shown as text and switched to password still holds no revert. */
  test("a field that became a password field is left to the page", () => {
    const el = makeInput("shown");
    noteFocus(el);
    el.value = "shown2";
    el.type = "password";
    expect(canRevertLine(el)).toBe(false);
  });

  test("a readonly field is left to the page", () => {
    const el = makeInput("original");
    noteFocus(el);
    el.value = "changed";
    el.readOnly = true;
    expect(canRevertLine(el)).toBe(false);
  });

  test("a disabled field is left to the page", () => {
    const el = makeInput("original");
    noteFocus(el);
    el.value = "changed";
    el.disabled = true;
    expect(canRevertLine(el)).toBe(false);
  });

  test("a contenteditable root is left to the page", () => {
    expect(canRevertLine(document.createElement("div"))).toBe(false);
  });
});

describe("revertLine restores the focus-time value @C1.16", () => {
  test("the value comes back and the caret lands at its end", () => {
    const el = makeInput("original");
    noteFocus(el);
    el.value = "changed a lot";
    el.setSelectionRange(2, 2);
    revertLine(el);
    expect(el.value).toBe("original");
    expect(el.selectionStart).toBe(8);
    expect(el.selectionEnd).toBe(8);
  });

  test("an empty snapshot empties the field", () => {
    const el = makeInput("");
    noteFocus(el);
    el.value = "typed";
    revertLine(el);
    expect(el.value).toBe("");
    expect(el.selectionStart).toBe(0);
  });

  test("a textarea gets its whole value back, not the caret's line", () => {
    const el = document.createElement("textarea");
    el.value = "one\ntwo";
    noteFocus(el);
    el.value = "one!\ntwo!\nthree";
    el.setSelectionRange(6, 6);
    revertLine(el);
    expect(el.value).toBe("one\ntwo");
    expect(el.selectionStart).toBe(7);
  });

  test("the snapshot survives the revert, so a second edit reverts again", () => {
    const el = makeInput("original");
    noteFocus(el);
    el.value = "first edit";
    revertLine(el);
    el.value = "second edit";
    revertLine(el);
    expect(el.value).toBe("original");
  });

  test("a readonly field is left alone", () => {
    const el = makeInput("original");
    noteFocus(el);
    el.value = "changed";
    el.readOnly = true;
    revertLine(el);
    expect(el.value).toBe("changed");
  });

  test("a disabled field is left alone", () => {
    const el = makeInput("original");
    noteFocus(el);
    el.value = "changed";
    el.disabled = true;
    revertLine(el);
    expect(el.value).toBe("changed");
  });

  test("a field with no snapshot is left alone", () => {
    const el = makeInput("changed");
    revertLine(el);
    expect(el.value).toBe("changed");
  });

  test("the operation entry point reaches it", () => {
    const el = makeInput("original");
    noteFocus(el);
    el.value = "changed";
    operation.revertLine(el);
    expect(el.value).toBe("original");
  });
});

describe("the revert_line entry @C1.16", () => {
  const entry = defaultKeymap.find((candidate) => candidate.id === "revert_line");
  const keydown = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);

  test("ships bound to Alt+R with a description and a canHandle", () => {
    expect(entry).toBeDefined();
    expect(entry!.label).toBe("revert line");
    expect(entry!.unassigned).toBeUndefined();
    expect(keymaching(keydown({ key: "r", altKey: true }), entry!)).toBe(true);
    expect(entry!.canHandle).toBe(canRevertLine);
    expect(entry!.description).toBeTypeOf("function");
  });

  test("a bare r and Ctrl+R are left to the page", () => {
    expect(keymaching(keydown({ key: "r" }), entry!)).toBe(false);
    expect(keymaching(keydown({ key: "r", ctrlKey: true }), entry!)).toBe(false);
  });

  /** Text fields only: in a rich text editor the chord stays the editor's. */
  test("has no rich text counterpart", () => {
    expect(entry!.editableOperation).toBeUndefined();
  });

  /**
   * The absence is the property: a role-less entry is reported to the ring as a
   * foreign command, so a kill on either side of Alt+R starts its own entry.
   */
  test("is foreign to the ring", () => {
    expect(entry!.ringRole).toBeUndefined();
  });
});
