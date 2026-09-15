import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { defaultKeymap } from "../src/keymap";
import { Keymap } from "../src/operation";

const readme = readFileSync(join(__dirname, "..", "README.md"), "utf8");

function tableRows(section: string): string[] {
  const start = readme.indexOf(`<!-- keymap:${section}:start -->`);
  const end = readme.indexOf(`<!-- keymap:${section}:end -->`);
  expect(start, `${section} start marker`).toBeGreaterThan(-1);
  expect(end, `${section} end marker`).toBeGreaterThan(start);
  return readme
    .slice(start, end)
    .split("\n")
    .filter((line) => /^\|\s*`/.test(line));
}

function chordOf(row: string): string {
  const cells = row.split("|").map((cell) => cell.trim());
  return cells[1].replace(/`/g, "").replace(/\s+/g, "");
}

function chordsOf(entries: Keymap[]): string[] {
  return entries
    .map((entry) => {
      const parts = [];
      if (entry.ctrl) parts.push("Ctrl");
      if (entry.alt) parts.push("Alt");
      if (entry.shift) parts.push("Shift");
      parts.push(entry.key);
      return parts.join("+");
    })
    .sort();
}

describe("README keymap tables", () => {
  test("the implemented table lists exactly the bound defaults, chord for chord", () => {
    const documented = tableRows("implemented").map(chordOf).sort();
    expect(documented).toEqual(chordsOf(defaultKeymap.filter((entry) => !entry.unassigned)));
  });

  test("the opt-in table lists exactly the unassigned entries by suggested chord", () => {
    const documented = tableRows("optin").map(chordOf).sort();
    expect(documented).toEqual(chordsOf(defaultKeymap.filter((entry) => entry.unassigned)));
  });
});
