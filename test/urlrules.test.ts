import { describe, expect, test } from "vitest";
import {
  matchesRule,
  resolveAction,
  findMatchingRuleIndex,
  migrateLegacyUrls,
  defaultUrlPolicy,
  UrlPolicy,
} from "../src/urlrules";

describe("matchesRule", () => {
  test("exact matches the whole url only", () => {
    const rule = { pattern: "https://example.com/a", matchType: "exact", action: "deny" } as const;
    expect(matchesRule("https://example.com/a", rule)).toBe(true);
    expect(matchesRule("https://example.com/a/b", rule)).toBe(false);
    expect(matchesRule("https://example.com/", rule)).toBe(false);
  });

  test("glob * spans any characters", () => {
    const rule = { pattern: "https://*.example.com/*", matchType: "glob", action: "deny" } as const;
    expect(matchesRule("https://app.example.com/page", rule)).toBe(true);
    expect(matchesRule("https://a.b.example.com/", rule)).toBe(true);
    expect(matchesRule("https://example.com/page", rule)).toBe(false);
    expect(matchesRule("https://evil.com/?u=app.example.com/x", rule)).toBe(false);
  });

  test("glob ? matches exactly one character", () => {
    const rule = { pattern: "https://example.com/?", matchType: "glob", action: "deny" } as const;
    expect(matchesRule("https://example.com/a", rule)).toBe(true);
    expect(matchesRule("https://example.com/ab", rule)).toBe(false);
  });

  test("glob escapes regex metacharacters in the pattern", () => {
    const rule = { pattern: "https://example.com/a.b", matchType: "glob", action: "deny" } as const;
    expect(matchesRule("https://example.com/a.b", rule)).toBe(true);
    expect(matchesRule("https://example.com/aXb", rule)).toBe(false);
  });

  test("glob ** spans path separators", () => {
    const rule = { pattern: "https://example.com/**", matchType: "glob", action: "deny" } as const;
    expect(matchesRule("https://example.com/a/b/c", rule)).toBe(true);
    expect(matchesRule("https://example.com/", rule)).toBe(true);
    expect(matchesRule("https://example.org/a", rule)).toBe(false);
  });

  test("glob * stays within a segment while ** crosses", () => {
    const deep = { pattern: "https://*.example.com/**", matchType: "glob", action: "deny" } as const;
    expect(matchesRule("https://app.example.com/a/b", deep)).toBe(true);
    expect(matchesRule("https://evil.com/?u=app.example.com/x/y", deep)).toBe(false);
    const shallow = { pattern: "https://example.com/*", matchType: "glob", action: "deny" } as const;
    expect(matchesRule("https://example.com/a/b", shallow)).toBe(false);
  });

  test("regex is applied as a javascript regular expression", () => {
    const rule = { pattern: "^https://(www\\.)?example\\.com/", matchType: "regex", action: "deny" } as const;
    expect(matchesRule("https://example.com/x", rule)).toBe(true);
    expect(matchesRule("https://www.example.com/x", rule)).toBe(true);
    expect(matchesRule("https://sub.example.com/x", rule)).toBe(false);
  });

  test("invalid regex never matches", () => {
    const rule = { pattern: "(", matchType: "regex", action: "deny" } as const;
    expect(matchesRule("https://example.com/", rule)).toBe(false);
  });
});

describe("resolveAction: first match wins, then default policy", () => {
  const policy: UrlPolicy = {
    defaultAction: "allow",
    rules: [
      { pattern: "https://app.example.com/", matchType: "exact", action: "allow" },
      { pattern: "https://*.example.com/*", matchType: "glob", action: "deny" },
    ],
  };

  test("earlier rule wins over later rule", () => {
    expect(resolveAction("https://app.example.com/", policy)).toBe("allow");
  });
  test("later rule applies when earlier does not match", () => {
    expect(resolveAction("https://docs.example.com/page", policy)).toBe("deny");
  });
  test("no match falls through to defaultAction", () => {
    expect(resolveAction("https://other.com/", policy)).toBe("allow");
  });
  test("defaultAction deny turns unmatched pages off", () => {
    const denyByDefault: UrlPolicy = { ...policy, defaultAction: "deny" };
    expect(resolveAction("https://other.com/", denyByDefault)).toBe("deny");
  });
});

describe("findMatchingRuleIndex", () => {
  const policy: UrlPolicy = {
    defaultAction: "allow",
    rules: [
      { pattern: "https://app.example.com/", matchType: "exact", action: "allow" },
      { pattern: "https://*.example.com/**", matchType: "glob", action: "deny" },
    ],
  };

  test("returns the index of the first matching rule", () => {
    expect(findMatchingRuleIndex("https://app.example.com/", policy)).toBe(0);
  });
  test("later rules match when earlier ones do not", () => {
    expect(findMatchingRuleIndex("https://docs.example.com/page", policy)).toBe(1);
  });
  test("no match returns null", () => {
    expect(findMatchingRuleIndex("https://other.com/", policy)).toBe(null);
  });
});

describe("migrateLegacyUrls", () => {
  test("legacy urls become exact deny rules", () => {
    expect(migrateLegacyUrls(["https://a.com/", "https://b.com/"])).toEqual({
      defaultAction: "allow",
      rules: [
        { pattern: "https://a.com/", matchType: "exact", action: "deny" },
        { pattern: "https://b.com/", matchType: "exact", action: "deny" },
      ],
    });
  });
  test("empty and blank entries are dropped", () => {
    expect(migrateLegacyUrls(["", "https://a.com/"])).toEqual({
      defaultAction: "allow",
      rules: [{ pattern: "https://a.com/", matchType: "exact", action: "deny" }],
    });
  });
});

describe("defaultUrlPolicy", () => {
  test("is allow-everything with no rules", () => {
    expect(defaultUrlPolicy).toEqual({ defaultAction: "allow", rules: [] });
    expect(resolveAction("https://anything.example/", defaultUrlPolicy)).toBe("allow");
  });
});
