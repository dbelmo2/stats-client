// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/stats-client/',
  plugins: [react({
    // Additional React plugin options if needed
    jsxRuntime: 'automatic',
  })],
  build: {
    sourcemap: true
  },
  esbuild: {
    // Additional JSX options
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
  }
});