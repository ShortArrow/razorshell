import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { availableLocales } from "../src/i18n";

const localesDir = join(__dirname, "..", "src", "_locales");

function keysOf(locale: string): string[] {
  const raw = readFileSync(join(localesDir, locale, "messages.json"), "utf8");
  return Object.keys(JSON.parse(raw)).sort();
}

describe("packaged locales", () => {
  test("directories match availableLocales", () => {
    expect(readdirSync(localesDir).sort()).toEqual([...availableLocales].sort());
  });

  const english = keysOf("en");

  test.each([...availableLocales])("%s has the same keys as en", (locale) => {
    expect(keysOf(locale)).toEqual(english);
  });

  test.each([...availableLocales])("%s has no empty messages", (locale) => {
    const raw = readFileSync(join(localesDir, locale, "messages.json"), "utf8");
    const dict = JSON.parse(raw) as Record<string, { message: string }>;
    for (const [key, value] of Object.entries(dict)) {
      expect(value.message.trim(), `${locale}/${key}`).not.toBe("");
    }
  });

  /**
   * getMessage falls back to the empty string for a key no locale defines,
   * so a stale key renders as blank UI instead of failing anywhere.
   */
  test("every getMessage key in src exists in en", () => {
    const srcDir = join(__dirname, "..", "src");
    const sources: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name)) sources.push(full);
      }
    };
    walk(srcDir);

    const known = new Set(english);
    for (const file of sources) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/getMessage\(\s*['"]([^'"]+)['"]/g)) {
        expect(known.has(match[1]), `${file} references missing key ${match[1]}`).toBe(true);
      }
    }
  });
});
