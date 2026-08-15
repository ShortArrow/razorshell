import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseSettings } from "../src/settingsio";

describe("config.sample.json", () => {
  const text = readFileSync(join(__dirname, "..", "config.sample.json"), "utf8");

  test("parses as a valid settings file", () => {
    const result = parseSettings(text);
    expect(result.ok).toBe(true);
  });

  test("demonstrates every supported key", () => {
    const result = parseSettings(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.settings.urlPolicy).toBeDefined();
      expect(result.settings.keymapOverrides).toBeDefined();
      expect(result.settings.language).toBeDefined();
      expect(result.settings.theme).toBeDefined();
      expect(result.settings.enableContentEditable).toBeDefined();
    }
  });
});
