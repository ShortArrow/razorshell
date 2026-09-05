import { describe, expect, test } from "vitest";
import { defaultKeymap } from "../src/keymap";
import { mergeKeymap } from "../src/keymapmerge";

/**
 * The bindings with no contenteditable counterpart, each a decision rather than
 * an omission. The set is named here so an exception has to be renewed
 * deliberately rather than acquired by forgetting.
 *
 * `yank_pop` (ADR-0010): a pop replaces a recorded range, and in a rich-text
 * root there is no offset pair that survives the host editor's normalisation
 * well enough to verify the range still holds what was inserted. The alternative
 * was an optimistic replace that can delete text the user wrote.
 *
 * The four case and transpose entries: each needs the extent of a word measured
 * in the value, and a contenteditable root has no value to measure. Selection
 * offsets there are a node and an offset inside arbitrary markup, which the host
 * editor may renormalise between the read and the write, so the span a recase
 * would overwrite cannot be pinned down the way it can in a field. A chord with
 * no counterpart is left to the page, which keeps the editor's own Alt+U working
 * instead of swallowing it for a binding that could not act.
 */
const withoutEditableCounterpart = new Set([
  "yank_pop",
  "upcase_word",
  "downcase_word",
  "capitalize_word",
  "transpose_words",
]);

describe("editable operations", () => {
  test("every default entry supports contenteditable targets", () => {
    for (const entry of defaultKeymap) {
      if (withoutEditableCounterpart.has(entry.id)) continue;
      expect(typeof entry.editableOperation, entry.id).toBe("function");
    }
  });

  test("the contenteditable exception list names only entries that exist", () => {
    const ids = new Set(defaultKeymap.map((entry) => entry.id));
    for (const id of withoutEditableCounterpart) expect(ids.has(id), id).toBe(true);
  });

  test("yank_pop is inert in contenteditable rather than half-wired", () => {
    const pop = defaultKeymap.find((entry) => entry.id === "yank_pop");
    expect(pop).toBeDefined();
    expect(pop!.editableOperation).toBeUndefined();
  });

  test("mergeKeymap keeps editableOperation on overridden entries", () => {
    const merged = mergeKeymap(defaultKeymap, {
      [defaultKeymap[0].id]: { key: "m", ctrl: true },
    });
    expect(merged[0].editableOperation).toBe(defaultKeymap[0].editableOperation);
  });
});
