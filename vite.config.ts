/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  // Relative base: the build works under any path (e.g. https://<user>.github.io/mappic/).
  base: './',
  plugins: [solid()],
  build: {
    // MapLibre alone is about 1 MB minified and is needed on first paint.
    chunkSizeWarningLimit: 1500,
  },
  test: {
    // vite-plugin-solid switches tests to jsdom unless an environment is set.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
