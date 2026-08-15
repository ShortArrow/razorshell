/// <reference types="vitest" />
/**
 * Vitest projects.
 *
 * `unit` is the jsdom suite under test/, unchanged. `storybook` runs every
 * story from .storybook/main.ts in a real chromium through the Storybook
 * plugin, which is what makes play functions and the a11y checks meaningful:
 * jsdom has no layout, so axe cannot judge contrast or visibility there.
 * The plugin resolves asynchronously, hence the async config.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { defineConfig, mergeConfig } from "vite";
import viteConfig from "./vite.config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const unitProject = mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      name: "unit",
      globals: true,
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/cypress/**",
        "tests/playwright/**",
        "tests/e2e/**",
        "tests/storybook/**",
      ],
      environment: "jsdom",
    },
  }),
);

export default defineConfig(async () => ({
  test: {
    coverage: {
      include: ["src/**/*.{ts,tsx}", "tests/vitest/**/*.{ts,tsx}"],
    },
    projects: [
      unitProject,
      {
        plugins: await storybookTest({
          configDir: path.join(dirname, ".storybook"),
        }),
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: "playwright",
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
}));
