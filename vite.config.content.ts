import { defineConfig } from 'vite';

// Content scripts run as classic scripts, so this entry is built
// separately as a self-contained IIFE (no import/export statements).
export default defineConfig({
  build: {
    emptyOutDir: false,
    rollupOptions: {
      input: {
        content: "./src/content.ts",
      },
      output: {
        format: "iife",
        name: "razorshell",
        entryFileNames: "[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
});
