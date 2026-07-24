// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: '/',
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
    basicSsl(),
  ],
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@components": path.resolve(__dirname, "src/components"),
      "@assets": path.resolve(__dirname, "src/assets"),
    },
  },
  build: {
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: true,
  },
  esbuild: {
    // Support for both .ts and .tsx files
    include: [
      'src/**/*.ts',
      'src/**/*.tsx'
    ],
  },
  server: {
    https: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  }
});