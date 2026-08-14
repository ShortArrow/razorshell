/**
 * Visual regression tests for the options page keymap table.
 *
 * The extension is loaded unpacked from the repository `dist/` directory, so
 * its ID is derived deterministically from that absolute path. The constant
 * below is the ID for `V:\razorshell\dist`; it changes if the repository is
 * checked out elsewhere.
 *
 * Chromium must be the full build (`channel: "chromium"`) because the default
 * headless shell cannot load extensions.
 *
 * The capture-mode indicator is daisyUI's `loading-dots`, whose motion lives in
 * SMIL `<animate>` elements inside a `mask-image` data URI. Playwright's
 * `animations: "disabled"` reaches CSS animations only, so the dots keep moving
 * and the frozen frame differs run to run. `FREEZE_LOADING_DOTS_CSS` replaces
 * that mask with a static three-dot image so the row's captured state stays the
 * subject of the comparison.
 */
import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXTENSION_ID = "aampaghhhfgjcdofgkafhlbbjaflkokn";

const distPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../dist",
);
const optionsUrl = `chrome-extension://${EXTENSION_ID}/options.html`;
const firstRebindTestId = "rebind-move_cursor_to_the_beginning";

const staticDotsMask =
  "url(\"data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='4' cy='12' r='3'/%3E%3Ccircle cx='12' cy='12' r='3'/%3E%3Ccircle cx='20' cy='12' r='3'/%3E%3C/svg%3E\")";

const FREEZE_LOADING_DOTS_CSS = `.loading-dots {
  -webkit-mask-image: ${staticDotsMask} !important;
  mask-image: ${staticDotsMask} !important;
}`;

let context: BrowserContext;
let userDataDir: string;

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "razorshell-pw-"));
  context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${distPath}`,
      `--load-extension=${distPath}`,
    ],
  });
});

test.afterEach(async () => {
  await context.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

test("keymap table (idle)", async () => {
  const page = await context.newPage();
  await page.goto(optionsUrl);

  const keymapTable = page
    .locator("table")
    .filter({ has: page.locator(`[data-testid="${firstRebindTestId}"]`) });
  await expect(keymapTable).toBeVisible();

  await expect(keymapTable).toHaveScreenshot("keymap-table.png");
});

test("keymap row capturing", async () => {
  const page = await context.newPage();
  await page.goto(optionsUrl);
  await page.addStyleTag({ content: FREEZE_LOADING_DOTS_CSS });

  const keymapTable = page
    .locator("table")
    .filter({ has: page.locator(`[data-testid="${firstRebindTestId}"]`) });
  await expect(keymapTable).toBeVisible();

  await page.locator(`[data-testid="${firstRebindTestId}"]`).click();
  await expect(keymapTable).toHaveScreenshot("keymap-table-capturing.png");

  await page.keyboard.press("Escape");
});
