import { describe, expect, test } from "vitest";
import {
  matchesRule,
  resolveAction,
  findMatchingRuleIndex,
  migrateLegacyUrls,
  patternRejection,
  defaultUrlPolicy,
  UrlPolicy,
} from "../src/urlrules";

describe("matchesRule @C1.3", () => {
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

describe("resolveAction: first match wins, then default policy @C1.3", () => {
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

describe("patternRejection guards what a rule may compile @C1.7", () => {
  const repeatedGroup = "regular expression repeats a group that itself repeats, which can take forever to evaluate; end each repetition on a fixed separator such as `\\.` or write it without the inner quantifier";
  const tooLong = "pattern is longer than 512 characters";

  test.each([
    ["a repeated group whose body repeats", "(x+x+)+y", repeatedGroup],
    ["a starred group around a quantified body", "^(\\w+\\s?)*$", repeatedGroup],
    ["subdomain labels each ending on a dot", "^https://(\\w+\\.)+example\\.com/", null],
    ["a starred label class ending on a dot", "^https://([a-z0-9-]+\\.)*example\\.com/", null],
    ["a non-capturing group ending on a dot", "^https://(?:www\\.)+example\\.com/", null],
    ["digits each ending on a comma", "(\\d+,)+", null],
    ["words each ending on a slash", "(\\w+/)+", null],
    ["a negated class that can match the separator", "([^/]+\\.)+", repeatedGroup],
    ["a class that contains the separator", "([a-z.]+\\.)+", repeatedGroup],
    ["a dot that matches anything", "(.+\\.)+", repeatedGroup],
    ["a body that does not end on a separator", "(a\\w+)+", repeatedGroup],
    ["a separator that is itself quantified", "(\\w+\\.?)+", repeatedGroup],
    ["a named group ending on a dot", "(?<host>\\w+\\.)+", null],
    ["a bounded outer quantifier", "(a+){2}", null],
    ["a repeated group with no inner quantifier", "(ab)+c", null],
  ])("%s: %s", (_, pattern, expected) => {
    expect(patternRejection(pattern, "regex")).toBe(expected);
  });

  test("an inner quantifier with no outer one is allowed", () => {
    expect(patternRejection("(a+)b", "regex")).toBe(null);
  });
  test("a plus inside a character class is a literal", () => {
    expect(patternRejection("[a+]+", "regex")).toBe(null);
  });
  test("escaped parentheses do not open a group", () => {
    expect(patternRejection("\\(a+\\)+", "regex")).toBe(null);
  });
  test("the sample configuration's rule is allowed", () => {
    expect(patternRejection("^https://[^/]*\\.example\\.com/", "regex")).toBe(null);
  });
  test("a regex that does not compile is refused", () => {
    expect(patternRejection("(", "regex")).toBe("invalid regular expression");
  });
  test("a regex longer than 512 characters is refused", () => {
    expect(patternRejection("a".repeat(513), "regex")).toBe(tooLong);
  });
  test("a regex of exactly 512 characters is allowed", () => {
    expect(patternRejection("a".repeat(512), "regex")).toBe(null);
  });
  test("a glob longer than 512 characters is allowed", () => {
    expect(patternRejection("a".repeat(513), "glob")).toBe(null);
  });
  test("an exact pattern longer than 512 characters is allowed", () => {
    expect(patternRejection("https://example.com/" + "a".repeat(600), "exact")).toBe(null);
  });
  test("a blank pattern is refused", () => {
    expect(patternRejection("   ", "exact")).toBe("pattern is empty");
  });
  test("glob text is not read as a regular expression", () => {
    expect(patternRejection("(x+x+)+y", "glob")).toBe(null);
  });
  test("matchesRule runs a stored regex the guard would refuse", () => {
    const refused = { pattern: "(x+x+)+y", matchType: "regex", action: "deny" } as const;
    expect(matchesRule("https://a.b.c", refused)).toBe(false);
    const subdomains = { pattern: "^https://([^/]+\\.)+example\\.com/", matchType: "regex", action: "deny" } as const;
    expect(patternRejection(subdomains.pattern, "regex")).not.toBe(null);
    expect(matchesRule("https://mail.example.com/", subdomains)).toBe(true);
  });
});
