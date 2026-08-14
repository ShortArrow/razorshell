/**
 * Visual regression suite configuration.
 *
 * Screenshots are compared with animations frozen so that daisyUI's
 * loading-dots in the keymap capture mode does not make baselines flaky.
 */
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/playwright",
  workers: 1,
  outputDir: "test-results",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
    },
  },
});
