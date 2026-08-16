/**
 * The traceability gate for `docs/assurance.md`.
 *
 * The assurance case names its sub-claims in a table and deliberately does not
 * repeat the claim-to-test mapping: the mapping lives in the suites, as `@C1.x`
 * tags on test titles, describe titles, story `tags` arrays, and — where one
 * spec generates its tests from a list — in the spec's header comment. A
 * document holding the mapping in prose drifts silently; this test is what
 * keeps the two sides honest, in both directions:
 *
 * - a sub-claim with no tagged test anywhere is a claim resting on nothing, so
 *   the doc may not add a row without evidence following it;
 * - a tag naming a claim the table no longer lists is a dangling reference, so
 *   the doc may not drop or renumber a row without the suites following it.
 *
 * It reads files and asserts; it writes nothing and snapshots nothing, so it
 * has no way to "fix" a mismatch by absorbing it.
 */
import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Sub-claim rows read as `| C1.4 | <property> |`; nothing else in the doc does. */
const claimRowPattern = /^\|\s*(C\d+\.\d+)\s*\|/;
const tagPattern = /@C\d+\.\d+/g;

/**
 * Where evidence may live. Each entry is a directory, whether it is searched
 * recursively, and which basenames count — chosen rather than globbed so that
 * adding a suite is a deliberate edit here.
 */
const evidenceSources = [
  { dir: "tests/e2e", recursive: true, matches: (name: string) => name.endsWith(".spec.ts") },
  { dir: "tests/storybook", recursive: true, matches: (name: string) => name.endsWith(".spec.ts") },
  { dir: "tests/playwright", recursive: true, matches: (name: string) => name.endsWith(".spec.ts") },
  { dir: "src/ui", recursive: false, matches: (name: string) => name.endsWith(".stories.tsx") },
  {
    dir: "test",
    recursive: true,
    matches: (name: string) => name.endsWith(".test.ts") && name !== "assurance.test.ts",
  },
];

function readClaimIds(): string[] {
  const doc = fs.readFileSync(path.join(repoRoot, "docs/assurance.md"), "utf8");
  const ids = doc
    .split(/\r?\n/)
    .map((line) => claimRowPattern.exec(line)?.[1])
    .filter((id): id is string => id !== undefined);
  return Array.from(new Set(ids));
}

function collectFiles(source: (typeof evidenceSources)[number]): string[] {
  const root = path.join(repoRoot, source.dir);
  if (!fs.existsSync(root)) return [];

  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return source.recursive ? walk(full) : [];
      return source.matches(entry.name) ? [full] : [];
    });

  return walk(root);
}

/** Every tag occurrence in the suites, each kept with the file that carries it. */
function collectTags(): { tag: string; file: string }[] {
  return evidenceSources.flatMap(collectFiles).flatMap((file) => {
    const text = fs.readFileSync(file, "utf8");
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    return (text.match(tagPattern) ?? []).map((tag) => ({ tag, file: relative }));
  });
}

describe("assurance traceability", () => {
  const claimIds = readClaimIds();
  const tags = collectTags();

  test("the sub-claim table is where it is expected to be", () => {
    expect(
      claimIds.length,
      "no sub-claim rows found in docs/assurance.md; the table moved or changed shape, " +
        "and this gate is checking nothing until its row pattern matches again",
    ).toBeGreaterThan(0);
  });

  test("every sub-claim has at least one tagged test", () => {
    const tagged = new Set(tags.map((entry) => entry.tag.slice(1)));
    const uncovered = claimIds.filter((id) => !tagged.has(id));
    expect(
      uncovered,
      `sub-claims with no tagged evidence: ${uncovered.join(", ")}. ` +
        "Evidence must be a tagged test: add @<claim> to a test title, a describe " +
        "title, a story's tags array, or the header of a spec that generates its tests.",
    ).toEqual([]);
  });

  test("every tag names a sub-claim the document still lists", () => {
    const known = new Set(claimIds);
    const stale = tags.filter((entry) => !known.has(entry.tag.slice(1)));
    const described = stale.map((entry) => `${entry.tag} in ${entry.file}`);
    expect(
      described,
      `tags naming sub-claims absent from docs/assurance.md: ${described.join(", ")}. ` +
        "Either the row was dropped or renumbered, or the tag is a typo.",
    ).toEqual([]);
  });
});
