import { describe, expect, test } from "vitest";
import { parseSettings, serializeSettings, SettingsFile } from "../src/settingsio";

const full: SettingsFile = {
  version: 1,
  urlPolicy: {
    defaultAction: "allow",
    rules: [
      { pattern: "https://example.com/**", matchType: "glob", action: "deny" },
    ],
  },
  keymapOverrides: {
    move_cursor_to_the_beginning: { key: "m", ctrl: true },
  },
  language: "ja",
  theme: "dark",
  enableContentEditable: true,
};

function expectError(text: string, fragment: string) {
  const result = parseSettings(text);
  expect(result.ok).toBe(false);
  if (result.ok === false) {
    expect(result.error).toContain(fragment);
  }
}

describe("serializeSettings", () => {
  test("round trips through parseSettings", () => {
    const result = parseSettings(serializeSettings(full));
    expect(result).toEqual({ ok: true, settings: full });
  });

  test("output is pretty printed for hand editing", () => {
    const text = serializeSettings(full);
    expect(text).toContain("\n");
    expect(text).toContain('  "version": 1');
  });
});

describe("parseSettings rejects", () => {
  test("invalid json", () => {
    expectError("{nope", "JSON");
  });
  test("a non-object document", () => {
    expectError('"hello"', "object");
  });
  test("a missing version", () => {
    expectError('{"language":"ja"}', "version");
  });
  test("an unsupported version", () => {
    expectError('{"version":2}', "version");
  });
  test("an unknown top-level key, naming it", () => {
    expectError('{"version":1,"foo":true}', "foo");
  });
  test("a rule with an unknown matchType", () => {
    expectError(
      '{"version":1,"urlPolicy":{"defaultAction":"allow","rules":[{"pattern":"x","matchType":"prefix","action":"deny"}]}}',
      "matchType",
    );
  });
  test("a rule with an unknown action", () => {
    expectError(
      '{"version":1,"urlPolicy":{"defaultAction":"allow","rules":[{"pattern":"x","matchType":"exact","action":"block"}]}}',
      "action",
    );
  });
  test("a policy whose rules are not an array", () => {
    expectError(
      '{"version":1,"urlPolicy":{"defaultAction":"allow","rules":{}}}',
      "rules",
    );
  });
  test("an override without a key", () => {
    expectError(
      '{"version":1,"keymapOverrides":{"move_cursor_to_the_beginning":{"ctrl":true}}}',
      "key",
    );
  });
  test("an override with a non-boolean modifier", () => {
    expectError(
      '{"version":1,"keymapOverrides":{"move_cursor_to_the_beginning":{"key":"m","ctrl":"yes"}}}',
      "ctrl",
    );
  });
  test("a language outside auto and the packaged locales", () => {
    expectError('{"version":1,"language":"xx"}', "language");
  });
  test("a theme outside light and dark", () => {
    expectError('{"version":1,"theme":"blue"}', "theme");
  });
  test("a non-boolean enableContentEditable", () => {
    expectError('{"version":1,"enableContentEditable":"yes"}', "enableContentEditable");
  });
});

describe("parseSettings accepts", () => {
  test("a partial document, leaving absent keys undefined", () => {
    const result = parseSettings('{"version":1,"language":"ja"}');
    expect(result).toEqual({ ok: true, settings: { version: 1, language: "ja" } });
  });
  test("auto as a language", () => {
    const result = parseSettings('{"version":1,"language":"auto"}');
    expect(result.ok).toBe(true);
  });
});
