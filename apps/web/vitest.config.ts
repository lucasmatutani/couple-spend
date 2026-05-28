import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    passWithNoTests: true,
    // e2e tests run via Playwright (pnpm test:e2e), not Vitest
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
})
