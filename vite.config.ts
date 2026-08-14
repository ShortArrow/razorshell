import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: 'src/options.html', dest: '.', rename: { stripBase: 1 } },
        { src: 'src/manifest.json', dest: '.', rename: { stripBase: 1 } },
        {
          src: [
            'src/images/16.png',
            'src/images/32.png',
            'src/images/48.png',
            'src/images/128.png',
            'src/images/icon.svg',
          ],
          dest: '.',
          rename: { stripBase: 1 },
        },
        { src: 'src/_locales', dest: '.', rename: { stripBase: 1 } },
      ],
    })
  ],
  build: {
    rollupOptions: {
      input: {
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
