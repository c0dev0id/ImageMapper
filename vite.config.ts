/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  // Relative base: the build works under any path (e.g. https://<user>.github.io/mappic/).
  base: './',
  plugins: [solid()],
  test: {
    // vite-plugin-solid switches tests to jsdom unless an environment is set.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
