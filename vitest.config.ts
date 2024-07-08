/// <reference types="vitest" />
import { defineConfig, mergeConfig } from "vite";
import viteConfig from "./vite.config";

const vitestConfig = defineConfig({
  test: {
    globals: true,
    coverage: {
      include: ["src/**/*.{ts,tsx}", "tests/vitest/**/*.{ts,tsx}"],
    },
    exclude: ["**/node_modules/**", "**/dist/**", "**/cypress/**", "tests/playwright/**"],
  },
});

export default mergeConfig(viteConfig, vitestConfig);
