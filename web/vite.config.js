import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built app works from a GitHub Pages subpath.
  base: './',
  server: { port: 5173 },
});
