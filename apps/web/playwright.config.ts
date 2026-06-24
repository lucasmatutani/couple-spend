import { defineConfig } from '@playwright/test'
import path from 'path'
import { config } from 'dotenv'

config({ path: path.resolve(__dirname, '.env.local') })

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? 'http://127.0.0.1:54321',
  },
  // webServer omitted: tests hit the Supabase API directly, no Next.js server needed
})
