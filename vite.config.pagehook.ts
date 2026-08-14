import { defineConfig } from 'vite';

// The page hook runs in the page's own world as a classic script, so this entry
// is built separately as a self-contained IIFE (no import/export statements).
export default defineConfig({
  build: {
    emptyOutDir: false,
    rollupOptions: {
      input: {
        pagehook: "./src/pagehook.ts",
      },
      output: {
        format: "iife",
        name: "razorshellPageHook",
        entryFileNames: "[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
});
