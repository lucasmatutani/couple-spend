import { defineConfig } from '@playwright/test'
import path from 'path'
import { config } from 'dotenv'

// Load local env so tests can reach the Supabase local instance
config({ path: path.resolve(__dirname, '.env.local') })

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  // No browser needed for these API/RLS tests
  use: {
    baseURL: process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? 'http://127.0.0.1:54321',
  },
  // Require supabase to be running; do not start a webserver
  webServer: undefined,
})
