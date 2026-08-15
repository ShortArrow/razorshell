import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { defaultKeymap } from "../src/keymap";

const readme = readFileSync(join(__dirname, "..", "README.md"), "utf8");

function implementedRows(): string[] {
  const start = readme.indexOf("<!-- keymap:implemented:start -->");
  const end = readme.indexOf("<!-- keymap:implemented:end -->");
  expect(start, "start marker").toBeGreaterThan(-1);
  expect(end, "end marker").toBeGreaterThan(start);
  return readme
    .slice(start, end)
    .split("\n")
    .filter((line) => /^\|\s*`/.test(line));
}

function chordOf(row: string): string {
  const cells = row.split("|").map((cell) => cell.trim());
  return cells[1].replace(/`/g, "").replace(/\s+/g, "");
}

describe("README implemented keymap table", () => {
  test("lists exactly the default keymap, chord for chord", () => {
    const documented = implementedRows().map(chordOf).sort();
    const implemented = defaultKeymap
      .map((entry) => {
        const parts = [];
        if (entry.ctrl) parts.push("Ctrl");
        if (entry.alt) parts.push("Alt");
        if (entry.shift) parts.push("Shift");
        parts.push(entry.key);
        return parts.join("+");
      })
      .sort();
    expect(documented).toEqual(implemented);
  });
});
