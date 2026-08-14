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
});
