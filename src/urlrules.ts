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

const maximumPatternLength = 512;

/**
 * @brief One unit of a group body at the body's own nesting level.
 * @details `group` stands for a nested group, whose `repeats` records whether any
 *          quantifier appears inside it. `other` covers `.`, `^` and `$`.
 */
type Atom =
  | { kind: "literal"; character: string; quantified: boolean }
  | { kind: "escape"; letter: string; quantified: boolean }
  | { kind: "class"; negated: boolean; body: string; quantified: boolean }
  | { kind: "group"; repeats: boolean; quantified: boolean }
  | { kind: "other"; quantified: boolean };

/**
 * @brief A group body while it is being scanned.
 * @details `repeats` holds when a quantifier appears anywhere inside the body, nested
 *          groups included; `alternates` when the body has a top-level `|`.
 */
interface Frame {
  atoms: Atom[];
  repeats: boolean;
  alternates: boolean;
}

const escapedSeparators = new Set([".", "/", "-", ",", ":", ";", "=", "&", "@", "#"]);
const plainSeparators = new Set(["/", ",", ":", ";", "=", "&", "@", "#", "%", "~"]);
const shorthandsExcludingSeparators = new Set(["w", "d", "s"]);

const groupPrefix = /^\?(?:<[=!]|<[^>]*>|[a-zA-Z-]*[:=!])/;
const escapeSequence = /^\\(?:x[0-9a-fA-F]{2}|u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|c[a-zA-Z]|[pP]\{[^}]*\}|k<[^>]*>|[1-9]\d*|[\s\S])/;
const quantifierSyntax = /^(?:[*+?]|\{\d+(,\d*)?\})\??/;

/**
 * @fn quantifierAt
 * @brief Read the quantifier starting at an index, if one starts there.
 * @details `*`, `+` and a brace with no upper bound such as `{2,}` are unbounded; `?`,
 *          `{2}` and `{2,5}` are bounded. A trailing lazy `?` belongs to the quantifier.
 * @param string pattern - The pattern being scanned
 * @param number index - The index to inspect
 * @return { length: number; unbounded: boolean } | null - null when no quantifier starts there
 */
function quantifierAt(pattern: string, index: number): { length: number; unbounded: boolean } | null {
  const match = quantifierSyntax.exec(pattern.slice(index));
  if (match === null) return null;
  const unbounded = match[0].startsWith("*") || match[0].startsWith("+") || match[1] === ",";
  return { length: match[0].length, unbounded };
}

/**
 * @fn classEnd
 * @brief Find the `]` closing the character class opened at an index.
 * @param string pattern - The pattern being scanned
 * @param number index - The index of the opening `[`
 * @return number - The index of the closing `]`, or the pattern length when unclosed
 */
function classEnd(pattern: string, index: number): number {
  for (let cursor = index + 1; cursor < pattern.length; cursor += 1) {
    if (pattern[cursor] === "\\") cursor += 1;
    else if (pattern[cursor] === "]") return cursor;
  }
  return pattern.length;
}

/**
 * @fn classMayMatch
 * @brief Decide whether a character class body could match a separator character.
 * @details Single characters, escaped punctuation and code-point ranges are read exactly;
 *          `\w`, `\d` and `\s` never match a separator. Any other escape, and a range whose
 *          end is escaped, is assumed to match, so the answer errs towards refusal.
 * @param string body - The class body without brackets or a leading `^`
 * @param string separator - The separator character
 * @return boolean
 */
function classMayMatch(body: string, separator: string): boolean {
  let index = 0;
  while (index < body.length) {
    let member = body[index];
    if (member === "\\") {
      const letter = body[index + 1] ?? "";
      index += 2;
      if (shorthandsExcludingSeparators.has(letter)) continue;
      if (/[a-zA-Z0-9]/.test(letter)) return true;
      member = letter;
    } else {
      index += 1;
    }
    if (body[index] === "-" && index + 1 < body.length) {
      const high = body[index + 1];
      index += 2;
      if (high === "\\" || (member <= separator && separator <= high)) return true;
      continue;
    }
    if (member === separator) return true;
  }
  return false;
}

/**
 * @fn separatorOf
 * @brief Name the fixed separator an unquantified atom stands for, if it is one.
 * @param Atom atom - The last atom of a group body
 * @return string | null
 */
function separatorOf(atom: Atom): string | null {
  if (atom.kind === "escape" && escapedSeparators.has(atom.letter)) return atom.letter;
  if (atom.kind === "literal" && plainSeparators.has(atom.character)) return atom.character;
  return null;
}

/**
 * @fn excludesSeparator
 * @brief Decide whether an atom provably cannot match a separator character.
 * @param Atom atom - An atom of the group body
 * @param string separator - The separator ending the body
 * @return boolean - false whenever the atom might match it, including every unknown shape
 */
function excludesSeparator(atom: Atom, separator: string): boolean {
  switch (atom.kind) {
    case "escape":
      return shorthandsExcludingSeparators.has(atom.letter);
    case "literal":
      return atom.character !== separator;
    case "class":
      return !atom.negated && !classMayMatch(atom.body, separator);
    default:
      return false;
  }
}

/**
 * @fn refusesRepetition
 * @brief Judge whether a group body may be repeated an unbounded number of times.
 * @details A body without a quantifier always may. A body with one may only when it has
 *          no alternation, its last atom is an unquantified separator, and no quantified
 *          atom or nested repeating group can match that separator: each repetition then
 *          ends at a separator the inner quantifiers cannot consume, so the input splits
 *          into repetitions one way only.
 * @param Frame body - The closed group body
 * @return boolean
 */
function refusesRepetition(body: Frame): boolean {
  if (!body.repeats) return false;
  if (body.alternates) return true;
  const last = body.atoms[body.atoms.length - 1];
  const separator = last === undefined || last.quantified ? null : separatorOf(last);
  if (separator === null) return true;
  return body.atoms.some((atom) =>
    (atom.quantified || (atom.kind === "group" && atom.repeats)) && !excludesSeparator(atom, separator));
}

/**
 * @fn repeatsARepeatingGroup
 * @brief Detect the nested-quantifier shape whose backtracking grows exponentially.
 * @details A group holding a quantifier and repeated an unbounded number of times, as in
 *          `(a+)+`, can take longer than a session to reject a non-matching string, unless
 *          `refusesRepetition` finds each repetition ending on a fixed separator. The scan
 *          is syntactic: it steps over escapes and character classes, reads `(?:`, `(?=`,
 *          `(?!`, `(?<=`, `(?<!` and `(?<name>` as group prefixes, and closes groups
 *          innermost first. The pattern is assumed to compile.
 * @param string pattern - The regular expression source
 * @return boolean
 */
function repeatsARepeatingGroup(pattern: string): boolean {
  const frames: Frame[] = [{ atoms: [], repeats: false, alternates: false }];
  let index = 0;
  while (index < pattern.length) {
    const frame = frames[frames.length - 1];
    const character = pattern[index];
    const quantifier = quantifierAt(pattern, index);
    if (quantifier !== null) {
      const last = frame.atoms[frame.atoms.length - 1];
      if (last !== undefined) last.quantified = true;
      frame.repeats = true;
      index += quantifier.length;
    } else if (character === "\\") {
      const sequence = escapeSequence.exec(pattern.slice(index))?.[0] ?? character;
      frame.atoms.push({ kind: "escape", letter: pattern[index + 1] ?? "", quantified: false });
      index += sequence.length;
    } else if (character === "[") {
      const end = classEnd(pattern, index);
      const body = pattern.slice(index + 1, end);
      const negated = body.startsWith("^");
      frame.atoms.push({ kind: "class", negated, body: negated ? body.slice(1) : body, quantified: false });
      index = end + 1;
    } else if (character === "(") {
      const prefix = groupPrefix.exec(pattern.slice(index + 1))?.[0] ?? "";
      frames.push({ atoms: [], repeats: false, alternates: false });
      index += 1 + prefix.length;
    } else if (character === ")" && frames.length > 1) {
      const body = frames.pop() as Frame;
      if (quantifierAt(pattern, index + 1)?.unbounded === true && refusesRepetition(body)) return true;
      const parent = frames[frames.length - 1];
      parent.atoms.push({ kind: "group", repeats: body.repeats, quantified: false });
      parent.repeats ||= body.repeats;
      index += 1;
    } else if (character === "|") {
      frame.alternates = true;
      index += 1;
    } else {
      const other = character === "." || character === "^" || character === "$";
      frame.atoms.push(other
        ? { kind: "other", quantified: false }
        : { kind: "literal", character, quantified: false });
      index += 1;
    }
  }
  return false;
}

/**
 * @fn patternRejection
 * @brief Judge a pattern about to become a rule, naming the first reason it cannot.
 * @details The length cap and the regex reasons apply to regex rules only; glob and exact
 *          patterns are plain text, so a shape that would be catastrophic as a regex is
 *          harmless there, and a long exact url is ordinary. The judgement is made when a
 *          rule is typed or imported; `matchesRule` does not consult it.
 * @param string pattern - The pattern as typed or as read from a settings document
 * @param MatchType matchType - The match type chosen beside it
 * @return string | null - The reason to show, or null when the pattern is acceptable
 */
export function patternRejection(pattern: string, matchType: MatchType): string | null {
  if (pattern.trim() === "") return "pattern is empty";
  if (matchType !== "regex") return null;
  if (pattern.length > maximumPatternLength) {
    return `pattern is longer than ${maximumPatternLength} characters`;
  }
  try {
    new RegExp(pattern);
  } catch {
    return "invalid regular expression";
  }
  if (repeatsARepeatingGroup(pattern)) {
    return "regular expression repeats a group that itself repeats, which can take forever to evaluate; end each repetition on a fixed separator such as `\\.` or write it without the inner quantifier";
  }
  return null;
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
 * @details glob `**` crosses `/`, while `*` and `?` stay within one path segment. A regex
 *          rule runs whether or not `patternRejection` would accept it now, so a rule
 *          stored by an older version keeps deciding the pages it decided before; one that
 *          does not compile never matches.
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
