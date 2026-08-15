import { describe, expect, test } from "vitest";
import { availableLocales, normalizeLocale, lookupMessage } from "../src/i18n";

describe("availableLocales", () => {
  test("lists the packaged locales", () => {
    expect(availableLocales).toEqual(
      ["ar", "de", "en", "es", "fr", "id", "ja", "ko", "pt_BR", "ru", "zh_CN"],
    );
  });
});

describe("normalizeLocale", () => {
  test("known locale passes through", () => {
    expect(normalizeLocale("ja")).toBe("ja");
  });
  test("region locale passes through", () => {
    expect(normalizeLocale("pt_BR")).toBe("pt_BR");
  });
  test("hyphenated form maps to the packaged name", () => {
    expect(normalizeLocale("pt-BR")).toBe("pt_BR");
  });
  test("case differences are ignored", () => {
    expect(normalizeLocale("EN")).toBe("en");
  });
  test("auto means no override", () => {
    expect(normalizeLocale("auto")).toBe(null);
  });
  test("undefined means no override", () => {
    expect(normalizeLocale(undefined)).toBe(null);
  });
  test("unknown locale means no override", () => {
    expect(normalizeLocale("xx")).toBe(null);
  });
});

describe("lookupMessage", () => {
  const english = {
    move_cursor_to_the_beginning: { message: "Move cursor to the beginning" },
    only_english: { message: "english only" },
  };
  const japanese = {
    move_cursor_to_the_beginning: { message: "行の先頭までカーソルを移動" },
  };

  test("primary dictionary wins", () => {
    expect(
      lookupMessage({ primary: japanese, english }, "move_cursor_to_the_beginning"),
    ).toBe("行の先頭までカーソルを移動");
  });
  test("missing key falls back to english", () => {
    expect(lookupMessage({ primary: japanese, english }, "only_english"))
      .toBe("english only");
  });
  test("no primary dictionary reads english", () => {
    expect(
      lookupMessage({ primary: undefined, english }, "move_cursor_to_the_beginning"),
    ).toBe("Move cursor to the beginning");
  });
  test("key missing everywhere returns the key", () => {
    expect(lookupMessage({ primary: japanese, english }, "nope")).toBe("nope");
  });
});
