/**
 * The descriptor behind the keymap table's two browser-managed rows.
 *
 * The row's whole usefulness is that it names a command the user can find on
 * chrome://extensions/shortcuts. A descriptor naming a command the manifest does
 * not declare would render a row for a shortcut that cannot be assigned, and
 * `chrome.commands.getAll()` would never report it — so the row would sit
 * permanently gray with nothing the user could do about it. Reading the manifest
 * rather than restating the names is what makes a rename of either side go red.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { browserChords } from "../src/browserchords";
import { transposeCharsCommand, unixWordRuboutCommand } from "../src/commandroute";

const manifest = JSON.parse(
  readFileSync(join(__dirname, "..", "src", "manifest.json"), "utf8"),
) as { commands: Record<string, unknown> };

describe("browser-managed chord descriptors", () => {
  test("describe exactly the manifest's commands", () => {
    expect(browserChords.map((entry) => entry.command)).toEqual(
      Object.keys(manifest.commands),
    );
  });

  test("ask for the two chords Chrome reserves", () => {
    expect(browserChords.map((entry) => entry.chord)).toEqual([
      { key: "w", ctrl: true },
      { key: "t", ctrl: true },
    ]);
  });

  test("carry a label for the action column", () => {
    for (const entry of browserChords) {
      expect(entry.label, entry.command).not.toBe("");
    }
  });

  /**
   * The names are duplicated between this module and `commandroute.ts` on
   * purpose, and the duplication is checked from the TEST rather than removed by
   * an import.
   *
   * Importing `commandroute` from `browserchords` puts one module in both the
   * options bundle and the service worker's, and Vite then emits it as a shared
   * chunk that `service.js` pulls in with a static `import`. The manifest
   * registers the worker without `"type": "module"`, so that worker registers no
   * listeners — measured as the toolbar badge silently never updating, with the
   * content script still reporting its state correctly. A test-only import
   * cannot reach a bundle, so the agreement is pinned here instead.
   */
  test("agree with the command names the router dispatches on", () => {
    expect(browserChords.map((entry) => entry.command)).toEqual([
      unixWordRuboutCommand,
      transposeCharsCommand,
    ]);
  });

  test("do not drag commandroute into the options bundle", () => {
    const source = readFileSync(join(__dirname, "..", "src", "browserchords.ts"), "utf8");
    expect(source).not.toMatch(/from\s+["']\.\/commandroute["']/);
  });
});
