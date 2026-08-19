/**
 * Which modifier combinations `keymaching` accepts.
 *
 * The chord model has three modifiers — ctrl, alt, shift — and each is compared
 * exactly: a chord that does not ask for a modifier requires that modifier to
 * be absent. Meta is not part of the model at all, which is precisely why an
 * event carrying it must not match: an unmodelled modifier held down means the
 * user pressed a different chord than any this extension binds.
 */
import { describe, expect, test } from "vitest";
import { keymaching } from "../src/keymap";
import { Keymap } from "../src/operation";

const ctrlK: Keymap = { id: "k", label: "", operation: () => {}, ctrl: true, key: "k" };
const altF: Keymap = { id: "f", label: "", operation: () => {}, alt: true, key: "f" };

describe("Meta is never part of a chord", () => {
  test("an otherwise matching chord does not match while Meta is held", () => {
    const withMeta = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, metaKey: true });
    expect(keymaching(withMeta, ctrlK)).toBe(false);
  });

  test("the same chord without Meta still matches", () => {
    const withoutMeta = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, metaKey: false });
    expect(keymaching(withoutMeta, ctrlK)).toBe(true);
  });

  test("Meta alone does not match an unmodified chord", () => {
    const plain: Keymap = { id: "a", label: "", operation: () => {}, key: "a" };
    const metaOnly = new KeyboardEvent("keydown", { key: "a", metaKey: true });
    expect(keymaching(metaOnly, plain)).toBe(false);
  });

  test("Meta held over an Alt chord does not match", () => {
    const event = new KeyboardEvent("keydown", { key: "f", altKey: true, metaKey: true });
    expect(keymaching(event, altF)).toBe(false);
  });
});

describe("AltGr", () => {
  /**
   * On layouts where AltGr raises `ctrlKey` and `altKey` together, an Alt-only
   * chord must not fire while the user is typing an AltGr glyph. Exact modifier
   * comparison is what delivers that, so this pins the property by its
   * consequence rather than trusting the implementation to keep it.
   */
  test("an alt-only chord does not match an event with ctrl and alt both set", () => {
    const altGr = new KeyboardEvent("keydown", { key: "f", ctrlKey: true, altKey: true });
    expect(keymaching(altGr, altF)).toBe(false);
  });

  test("a plain Alt chord still matches when ctrl is absent", () => {
    const plainAlt = new KeyboardEvent("keydown", { key: "f", altKey: true });
    expect(keymaching(plainAlt, altF)).toBe(true);
  });
});
