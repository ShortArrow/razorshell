import { describe, expect, test } from "vitest";
import { defaultKeymap } from "../src/keymap";
import { mergeKeymap } from "../src/keymapmerge";

/**
 * `yank_pop` is the one binding with no contenteditable counterpart, and that
 * is a decision rather than an omission (ADR-0010): a pop replaces a recorded
 * range, and in a rich-text root there is no offset pair that survives the host
 * editor's normalisation well enough to verify the range still holds what was
 * inserted. The alternative was an optimistic replace that can delete text the
 * user wrote. It is named here so the exception has to be renewed deliberately
 * if a future entry joins it.
 */
const withoutEditableCounterpart = new Set(["yank_pop"]);

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
