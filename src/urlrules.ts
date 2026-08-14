/**
 * @file urlrules.ts
 * @brief Pure URL policy semantics. First matching rule decides, otherwise the default action.
 */

export type MatchType = "exact" | "glob" | "regex";
export type RuleAction = "allow" | "deny";

export interface UrlRule {
  pattern: string;
  matchType: MatchType;
  action: RuleAction;
}

export interface UrlPolicy {
  defaultAction: RuleAction;
  rules: UrlRule[];
}

export const defaultUrlPolicy: UrlPolicy = { defaultAction: "allow", rules: [] };

const regexMetaCharacters = /[.*+?^${}()|[\]\\]/g;

function escapeRegex(source: string): string {
  return source.replace(regexMetaCharacters, "\\$&");
}

const globWildcards: Record<string, string> = {
  "**": ".*",
  "*": "[^/]*",
  "?": "[^/]",
};

const globTokens = /(\*\*|\*|\?)/g;

function globToRegExp(pattern: string): RegExp {
  const body = pattern
    .split(globTokens)
    .map((token) => globWildcards[token] ?? escapeRegex(token))
    .join("");
  return new RegExp(`^${body}$`);
}

function matchesRegex(url: string, pattern: string): boolean {
  try {
    return new RegExp(pattern).test(url);
  } catch {
    return false;
  }
}

/**
 * @fn matchesRule
 * @brief Test a url against a single rule according to its match type.
 * @details glob `**` crosses `/`, while `*` and `?` stay within one path segment.
 * @param string url - The full page url
 * @param UrlRule rule - The rule to test
 * @return boolean
 */
export function matchesRule(url: string, rule: UrlRule): boolean {
  switch (rule.matchType) {
    case "exact":
      return url === rule.pattern;
    case "glob":
      return globToRegExp(rule.pattern).test(url);
    case "regex":
      return matchesRegex(url, rule.pattern);
  }
}

/**
 * @fn resolveAction
 * @brief Decide the action for a url; the first matching rule wins.
 * @param string url - The full page url
 * @param UrlPolicy policy - The policy to evaluate
 * @return RuleAction
 */
export function resolveAction(url: string, policy: UrlPolicy): RuleAction {
  const matched = policy.rules.find((rule) => matchesRule(url, rule));
  return matched ? matched.action : policy.defaultAction;
}

/**
 * @fn findMatchingRuleIndex
 * @brief Locate the first rule matching a url.
 * @param string url - The full page url
 * @param UrlPolicy policy - The policy to evaluate
 * @return number | null - The index of the first matching rule, or null when none matches
 */
export function findMatchingRuleIndex(url: string, policy: UrlPolicy): number | null {
  const index = policy.rules.findIndex((rule) => matchesRule(url, rule));
  return index === -1 ? null : index;
}

/**
 * @fn migrateLegacyUrls
 * @brief Convert the legacy url denylist into a policy of exact deny rules.
 * @param string[] urls - The legacy url list
 * @return UrlPolicy
 */
export function migrateLegacyUrls(urls: string[]): UrlPolicy {
  return {
    defaultAction: "allow",
    rules: urls
      .filter((url) => url.trim() !== "")
      .map((url) => ({ pattern: url, matchType: "exact", action: "deny" })),
  };
}
