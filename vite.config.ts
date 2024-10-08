import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: 'src/options.html', dest: '.' },
        { src: 'src/manifest.json', dest: '.' },
        { src: 'src/images', dest: '.' },
        { src: 'src/_locales', dest: '.' },
      ],
    })
  ],
  build: {
    rollupOptions: {
      input: {
        content: "./src/content.ts",
        options: "./src/options.tsx",
        service: "./src/service.ts",
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
});
