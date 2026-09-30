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
      // The windows CI runner antialiases differently from the machine that
      // captured the baselines. On 2026-09-23 the 25-row keymap table differed
      // in ~47,000 pixels, every one by at most 60 of 255 in a channel; the
      // default per-pixel threshold of 0.2 counted 45 of them, so the count
      // grew with the number of rows until it crossed the budget. At 0.25 the
      // same CI images count zero. Real regressions move far more: the
      // select-arrow swap alone was ~72px per select and color changes reach
      // thousands, so the pixel budget stays where it was.
      threshold: 0.25,
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
