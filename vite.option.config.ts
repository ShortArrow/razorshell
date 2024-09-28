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
        { src: 'src/images', dest: '.' },
      ],
    })
  ],
  build: {
    emptyOutDir: false,
    rollupOptions: {
      input: {
        options: "./src/options.tsx",
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
});
