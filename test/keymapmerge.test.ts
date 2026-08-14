import { describe, expect, test } from "vitest";
import { defaultKeymap } from "../src/keymap";
import { mergeKeymap, findConflict } from "../src/keymapmerge";
import { Keymap } from "../src/operation";

const opOne = () => {};
const opTwo = () => {};

const defaults: Keymap[] = [
  { id: "one", label: "one", operation: opOne, ctrl: true, key: "a" },
  { id: "two", label: "two", operation: opTwo, alt: true, key: "f" },
];

describe("mergeKeymap layers later-wins", () => {
  test("no layers returns the defaults unchanged", () => {
    const merged = mergeKeymap(defaults);
    expect(merged).toHaveLength(2);
    expect(merged[0].operation).toBe(opOne);
    expect(merged[0].key).toBe("a");
    expect(merged[0].ctrl).toBe(true);
  });

  test("an override replaces the whole chord and keeps the rest", () => {
    const merged = mergeKeymap(defaults, { one: { key: "m", ctrl: true } });
    expect(merged[0].key).toBe("m");
    expect(merged[0].ctrl).toBe(true);
    expect(merged[0].alt).toBe(false);
    expect(merged[0].shift).toBe(false);
    expect(merged[0].label).toBe("one");
    expect(merged[0].operation).toBe(opOne);
    expect(merged[1].key).toBe("f");
  });

  test("missing modifier flags mean false", () => {
    const merged = mergeKeymap(defaults, { one: { key: "m" } });
    expect(merged[0].ctrl).toBe(false);
    expect(merged[0].alt).toBe(false);
    expect(merged[0].shift).toBe(false);
  });

  test("unknown ids are ignored", () => {
    const merged = mergeKeymap(defaults, { ghost: { key: "z" } });
    expect(merged).toHaveLength(2);
    expect(merged[0].key).toBe("a");
  });

  test("a later layer wins over an earlier one", () => {
    const merged = mergeKeymap(
      defaults,
      { one: { key: "l", ctrl: true }, two: { key: "w", alt: true } },
      { one: { key: "g", ctrl: true } },
    );
    expect(merged[0].key).toBe("g");
    expect(merged[1].key).toBe("w");
  });
});

describe("findConflict", () => {
  const merged = mergeKeymap(defaults);

  test("returns the id of the row holding the same chord", () => {
    expect(findConflict({ key: "f", alt: true }, merged, "one")).toBe("two");
  });
  test("the row being rebound is excluded", () => {
    expect(findConflict({ key: "a", ctrl: true }, merged, "one")).toBe(null);
  });
  test("a free chord conflicts with nothing", () => {
    expect(findConflict({ key: "m", ctrl: true }, merged, "one")).toBe(null);
  });
  test("modifier differences are distinct chords", () => {
    expect(findConflict({ key: "a", ctrl: true, shift: true }, merged, "two")).toBe(null);
  });
});

describe("defaultKeymap ids", () => {
  test("every entry has a non-empty id", () => {
    for (const entry of defaultKeymap) {
      expect(entry.id.length).toBeGreaterThan(0);
    }
  });
  test("ids are unique", () => {
    const ids = defaultKeymap.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
