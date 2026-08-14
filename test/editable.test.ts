import { describe, expect, test } from "vitest";
import { defaultKeymap } from "../src/keymap";
import { mergeKeymap } from "../src/keymapmerge";

describe("editable operations", () => {
  test("every default entry supports contenteditable targets", () => {
    for (const entry of defaultKeymap) {
      expect(typeof entry.editableOperation, entry.id).toBe("function");
    }
  });

  test("mergeKeymap keeps editableOperation on overridden entries", () => {
    const merged = mergeKeymap(defaultKeymap, {
      [defaultKeymap[0].id]: { key: "m", ctrl: true },
    });
    expect(merged[0].editableOperation).toBe(defaultKeymap[0].editableOperation);
  });
});
