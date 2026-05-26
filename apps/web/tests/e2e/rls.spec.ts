/**
 * E2E privacy tests: Row-Level Security enforcement.
 *
 * Prerequisites: `pnpm supabase:start` and `pnpm supabase:reset` must be run
 * before this suite. Tests use the Supabase JS client directly — no browser
 * is required — to verify that RLS policies are correctly enforced at the
 * database layer independent of application code.
 *
 * Scenarios (CLAUDE.md §4.2 rule: every table needs a cross-user access test):
 *   1. User B cannot read expenses belonging to User A's household.
 *   2. User B cannot read User A's income (personal data).
 *   3. User C, after joining Household H1, can read H1 expenses.
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@splitwise/shared'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? ''
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''

if (!ANON_KEY || !SERVICE_KEY) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example → .env.local and fill in the values from `pnpm supabase:status`.',
  )
}

/** Admin client — bypasses RLS. Use ONLY for test setup/teardown. */
const admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

/** Creates an anon client authenticated as the given user JWT. */
function clientAs(accessToken: string) {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  })
}

// ── Shared test state ─────────────────────────────────────────────────────────

let tokenA: string
let tokenB: string
let tokenC: string
let userAId: string
let householdH1Id: string
let firstCategoryId: string

// ── Test suite ────────────────────────────────────────────────────────────────

test.describe('RLS: multi-tenant isolation', () => {
  test.beforeAll(async () => {
    const ts = Date.now()

    // Create three isolated test users via the admin API (service role bypasses
    // email confirmation so tests are self-contained).
    const [resA, resB, resC] = await Promise.all([
      admin.auth.admin.createUser({
        email: `rls-a-${ts}@test.local`,
        password: 'Test1234!',
        email_confirm: true,
      }),
      admin.auth.admin.createUser({
        email: `rls-b-${ts}@test.local`,
        password: 'Test1234!',
        email_confirm: true,
      }),
      admin.auth.admin.createUser({
        email: `rls-c-${ts}@test.local`,
        password: 'Test1234!',
        email_confirm: true,
      }),
    ])

    expect(resA.error).toBeNull()
    expect(resB.error).toBeNull()
    expect(resC.error).toBeNull()

    userAId = resA.data.user!.id
    const userBId = resB.data.user!.id
    const userCId = resC.data.user!.id

    // Sign in each user to get an access token
    const [sessA, sessB, sessC] = await Promise.all([
      createClient<Database>(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
        .auth.signInWithPassword({ email: `rls-a-${ts}@test.local`, password: 'Test1234!' }),
      createClient<Database>(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
        .auth.signInWithPassword({ email: `rls-b-${ts}@test.local`, password: 'Test1234!' }),
      createClient<Database>(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
        .auth.signInWithPassword({ email: `rls-c-${ts}@test.local`, password: 'Test1234!' }),
    ])

    tokenA = sessA.data.session!.access_token
    tokenB = sessB.data.session!.access_token
    tokenC = sessC.data.session!.access_token

    // User A creates Household H1 (INSERT policy: created_by = auth.uid()).
    // The trigger `household_creator_becomes_owner` auto-inserts user A as owner.
    const { data: h1, error: h1Error } = await clientAs(tokenA)
      .from('households')
      .insert({ name: `H1-${ts}`, created_by: userAId })
      .select('id')
      .single()

    expect(h1Error).toBeNull()
    householdH1Id = h1!.id

    // User B creates Household H2 (isolated from H1)
    const { error: h2Error } = await clientAs(tokenB)
      .from('households')
      .insert({ name: `H2-${ts}`, created_by: userBId })
      .select('id')
      .single()

    expect(h2Error).toBeNull()

    // Grab a global template category ID for the expense fixtures
    const { data: cats } = await admin.from('categories').select('id').is('household_id', null).limit(1)
    firstCategoryId = cats![0]!.id

    // User A records an expense in H1
    const { error: expError } = await clientAs(tokenA)
      .from('expenses')
      .insert({
        household_id:    householdH1Id,
        paid_by:         userAId,
        category_id:     firstCategoryId,
        occurred_at:     '2026-05-01',
        amount_cents:    5000,
        split_rule_type: 'EQUAL',
      })

    expect(expError).toBeNull()

    // User A records personal income
    const { error: incError } = await admin.from('incomes').insert({
      owner_id:     userAId,
      occurred_at:  '2026-05-01',
      amount_cents: 500_000,
      source:       'Salary',
    })

    expect(incError).toBeNull()

    // Add User C to H1 as a member (admin bypasses the owner-only INSERT policy)
    await admin
      .from('household_members')
      .insert({ household_id: householdH1Id, user_id: userCId, role: 'member' })
  })

  // ── Test 1 ─────────────────────────────────────────────────────────────────

  test('User B cannot read H1 expenses (cross-household isolation)', async () => {
    const { data, error } = await clientAs(tokenB)
      .from('expenses')
      .select('id')
      .eq('household_id', householdH1Id)

    expect(error).toBeNull()
    // RLS must return an empty set, not a permission error
    expect(data).toHaveLength(0)
  })

  // ── Test 2 ─────────────────────────────────────────────────────────────────

  test('User B cannot read User A income (personal data isolation)', async () => {
    const { data, error } = await clientAs(tokenB)
      .from('incomes')
      .select('id')
      .eq('owner_id', userAId)

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  // ── Test 3 ─────────────────────────────────────────────────────────────────

  test('User C, a member of H1, can read H1 expenses', async () => {
    const { data, error } = await clientAs(tokenC)
      .from('expenses')
      .select('id')
      .eq('household_id', householdH1Id)

    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThan(0)
  })
})
