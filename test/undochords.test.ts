/**
 * The chords v0.0.5 adds, matched exactly.
 *
 * Every expectation about `event.key` here is an empirical observation, not a
 * guess. Measured 2026-09-05 in Playwright Chromium (channel "chromium",
 * headless), reading `keydown` on a focused text input:
 *
 * - `Alt+Backspace` reports `key: "Backspace"` with `altKey` true and
 *   `shiftKey` false.
 * - Ctrl held while Shift+Minus is struck — what a US-layout user's hands do
 *   for Ctrl+underscore — reports `key: "_"`, `code: "Minus"`, `ctrlKey` and
 *   `shiftKey` both true.
 * - Ctrl+Slash reports `key: "/"`, `code: "Slash"`, `shiftKey` false.
 *
 * Playwright's own `press("Control+_")` shorthand is the odd one out: it
 * fabricates the `_` character with `shiftKey` FALSE, which no physical layout
 * produces. The binding is written for the keyboard, so the e2e suite presses
 * the chord in its down/up form instead of using that shorthand.
 *
 * Two chords reach one operation, so they are two entries with two ids. The
 * matcher is what keeps them from bleeding into each other, and the negative
 * cases below are the half that a permissive matcher would fail.
 */
import { describe, expect, test } from "vitest";
import { defaultKeymap, keymaching } from "../src/keymap";
import { Keymap } from "../src/operation";

function entry(id: string): Keymap {
  const found = defaultKeymap.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no keymap entry with id ${id}`);
  return found;
}

function keydown(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent("keydown", init);
}

describe("the two undo chords @C1.16", () => {
  test("Ctrl+Shift+minus matches undo", () => {
    expect(keymaching(keydown({ key: "_", ctrlKey: true, shiftKey: true }), entry("undo"))).toBe(true);
  });

  test("the same chord without shift does not match undo", () => {
    // The measured physical chord carries shift; a `_` arriving without it is
    // a different event, and the exact-modifier rule must say so.
    expect(keymaching(keydown({ key: "_", ctrlKey: true }), entry("undo"))).toBe(false);
  });

  test("Ctrl+slash matches undo_slash", () => {
    expect(keymaching(keydown({ key: "/", ctrlKey: true }), entry("undo_slash"))).toBe(true);
  });

  test("Ctrl+Shift+slash does NOT match undo_slash", () => {
    expect(keymaching(keydown({ key: "/", ctrlKey: true, shiftKey: true }), entry("undo_slash"))).toBe(false);
  });

  test("neither undo chord matches the other's entry", () => {
    expect(keymaching(keydown({ key: "/", ctrlKey: true }), entry("undo"))).toBe(false);
    expect(keymaching(keydown({ key: "_", ctrlKey: true, shiftKey: true }), entry("undo_slash"))).toBe(false);
  });

  test("a bare slash reaches neither", () => {
    expect(keymaching(keydown({ key: "/" }), entry("undo_slash"))).toBe(false);
    expect(keymaching(keydown({ key: "_" }), entry("undo"))).toBe(false);
  });

  test("the two entries share one label and one operation", () => {
    expect(entry("undo").label).toBe("undo");
    expect(entry("undo_slash").label).toBe("undo");
    expect(entry("undo_slash").operation).toBe(entry("undo").operation);
  });
});

describe("the word and character chords @C1.16", () => {
  test("Alt+d matches kill_word, as Playwright reports the chord", () => {
    expect(keymaching(keydown({ key: "d", altKey: true }), entry("kill_word"))).toBe(true);
  });

  test("Alt+Backspace matches backward_kill_word by its measured key name", () => {
    expect(
      keymaching(keydown({ key: "Backspace", altKey: true }), entry("backward_kill_word")),
    ).toBe(true);
  });

  test("a bare Backspace is left to the field", () => {
    expect(keymaching(keydown({ key: "Backspace" }), entry("backward_kill_word"))).toBe(false);
  });

  test("Ctrl+Backspace is a different chord and does not match", () => {
    expect(
      keymaching(keydown({ key: "Backspace", ctrlKey: true }), entry("backward_kill_word")),
    ).toBe(false);
  });

  test("Ctrl+d matches delete_char and Ctrl+h matches backward_delete_char", () => {
    expect(keymaching(keydown({ key: "d", ctrlKey: true }), entry("delete_char"))).toBe(true);
    expect(keymaching(keydown({ key: "h", ctrlKey: true }), entry("backward_delete_char"))).toBe(true);
  });

  test("Alt+d and Ctrl+d do not reach each other's entries", () => {
    expect(keymaching(keydown({ key: "d", altKey: true }), entry("delete_char"))).toBe(false);
    expect(keymaching(keydown({ key: "d", ctrlKey: true }), entry("kill_word"))).toBe(false);
  });
});

describe("the new entries declare their relation to the ring @C1.16", () => {
  test("the word kills are kills", () => {
    expect(entry("kill_word").ringRole).toBe("kill");
    expect(entry("backward_kill_word").ringRole).toBe("kill");
  });

  /**
   * The character deletes carry no role on purpose. The dispatcher reports
   * every role-less binding to the ring as a foreign command, which is exactly
   * what makes a Ctrl+d between two kills break their chain — the property is
   * bought by this absence, not by any code in the operation.
   */
  test("the character deletes and the undo entries are foreign to the ring", () => {
    expect(entry("delete_char").ringRole).toBeUndefined();
    expect(entry("backward_delete_char").ringRole).toBeUndefined();
    expect(entry("undo").ringRole).toBeUndefined();
    expect(entry("undo_slash").ringRole).toBeUndefined();
  });

  test("every new entry carries a description", () => {
    for (const id of [
      "kill_word",
      "backward_kill_word",
      "delete_char",
      "backward_delete_char",
      "undo",
      "undo_slash",
    ]) {
      expect(entry(id).description, id).toBeTypeOf("function");
    }
  });

  test("no two entries hold the same id", () => {
    const ids = defaultKeymap.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/**
 * The four case and transpose chords — Alt+U, Alt+L, Alt+C and Alt+T — and what
 * they declare to the ring.
 *
 * Alt+letter chords report the plain letter in `event.key` under assumption A8,
 * which is the same premise the shipped Alt+D, Alt+F and Alt+B rest on; nothing
 * new is measured here, and macOS stays outside it for the reason A8 gives.
 */
describe("the case and transpose chords @C1.17", () => {
  const chords: [string, string][] = [
    ["upcase_word", "u"],
    ["downcase_word", "l"],
    ["capitalize_word", "c"],
    ["transpose_words", "t"],
  ];

  test.each(chords)("%s matches its Alt chord", (id, key) => {
    expect(keymaching(keydown({ key, altKey: true }), entry(id))).toBe(true);
  });

  test.each(chords)("%s does not match the bare letter", (id, key) => {
    expect(keymaching(keydown({ key }), entry(id))).toBe(false);
  });

  test.each(chords)("%s does not match the Ctrl chord", (id, key) => {
    expect(keymaching(keydown({ key, ctrlKey: true }), entry(id))).toBe(false);
  });

  /**
   * None of the four is a kill: nothing they touch leaves the field. The absence
   * of a `ringRole` is what makes the dispatcher report them as foreign commands,
   * so a recase between two kills breaks the chain instead of letting the two
   * splice into a line the user never had — the property is bought here, not in
   * the operations.
   */
  test("none of them claims a ring role", () => {
    for (const [id] of chords) {
      expect(entry(id).ringRole, id).toBeUndefined();
    }
  });

  /**
   * They ship without a contenteditable counterpart on purpose: a rich-text root
   * has no value to slice, and the word extents cannot be read off a selection
   * that the host editor normalises. A chord with no counterpart is left to the
   * page rather than swallowed by a binding that could not act.
   */
  test("none of them claims a contenteditable counterpart", () => {
    for (const [id] of chords) {
      expect(entry(id).editableOperation, id).toBeUndefined();
    }
  });

  test("every one of them carries a description", () => {
    for (const [id] of chords) {
      expect(entry(id).description, id).toBeTypeOf("function");
    }
  });

  test("they do not collide with the chords already shipped", () => {
    for (const [id, key] of chords) {
      const matches = defaultKeymap.filter((candidate) =>
        keymaching(keydown({ key, altKey: true }), candidate),
      );
      expect(matches.map((m) => m.id), id).toEqual([id]);
    }
  });
});
