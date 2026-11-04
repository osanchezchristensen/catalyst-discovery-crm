import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Main-process tests run in node; screen tests opt into jsdom with `// @vitest-environment jsdom`.
export default defineConfig({
  resolve: { alias: { '@': resolve('src/renderer/src') } },
  test: { include: ['src/**/*.test.{ts,tsx}'], environment: 'node' }
})
