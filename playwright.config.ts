/**
 * Playwright suites.
 *
 * `e2e` drives the unpacked extension in a persistent context; its blocks run
 * as one serial scenario over a shared browser, so it needs a timeout well
 * above the default. `visual` compares screenshots with animations frozen so
 * that daisyUI's loading-dots in the keymap capture mode does not make
 * baselines flaky. A single worker keeps the two suites from competing for
 * the browser and keeps the extension's storage writes ordered.
 */
import { defineConfig } from "@playwright/test";

export default defineConfig({
  workers: 1,
  outputDir: "test-results",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      // The windows CI runner renders fonts a dozen-odd pixels differently
      // from the machine that captured the baselines (measured 14-16px).
      // Real regressions move far more: the select-arrow swap alone was
      // ~72px per select and color changes reach thousands.
      maxDiffPixels: 40,
    },
  },
  projects: [
    {
      name: "e2e",
      testDir: "tests/e2e",
      timeout: 120_000,
    },
    {
      name: "visual",
      testDir: "tests/playwright",
      // Naming the project would otherwise insert it into the snapshot path;
      // this template keeps the committed `<name>-<platform>.png` baselines.
      snapshotPathTemplate:
        "{testDir}/{testFileName}-snapshots/{arg}-{platform}{ext}",
    },
    {
      name: "storybook",
      testDir: "tests/storybook",
      snapshotPathTemplate:
        "{testDir}/{testFileName}-snapshots/{arg}-{platform}{ext}",
    },
  ],
});
