import { defineConfig } from "vite";
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'src/manifest.json', dest: '.' },
        { src: 'src/assets', dest: '.' }
      ],
    })
  ],
  build: {
    rollupOptions: {
      input: {
        content: "./src/content.ts",
        background: "./src/background.ts",
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
});