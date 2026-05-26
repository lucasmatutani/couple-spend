# CLAUDE.md

This file is read automatically by Claude Code when starting sessions in this project. It contains the minimum context needed for suggestions and changes to respect decisions already made.

**Before any non-trivial change, consult [SPEC.md](./SPEC.md).** It is the source of truth for scope, domain model, and architecture. This file summarizes; the SPEC explains.

---

## 1. What this project is

A **SaaS platform** for shared expense splitting and personal finance tracking. Any group of users (couple, housemates, family) can form a **Household**, track shared costs with configurable split rules, and each member independently manages their personal income, expenses, and investments.

**Multi-tenant from day one.** Every shared table is scoped to a `household_id`. RLS enforces tenant isolation at the database level. See ADR-006 in SPEC.md.

Full details: [SPEC.md §1–4](./SPEC.md).

---

## 2. Stack and structure

**Monorepo** with pnpm workspaces + Turborepo. Decision documented in [ADR-001](./SPEC.md#adr-001--monorepo-with-pnpm-workspaces--turborepo).

```
splitwise/
├── apps/
│   └── web/                    # Next.js 15 (App Router) — UI + API routes + server actions
├── packages/
│   ├── domain/                 # Entities, use cases, ports. ZERO external deps beyond zod.
│   ├── shared/                 # Types, Zod schemas, utils. No business logic.
│   ├── import-core/            # ImportTransactionsUseCase, RawTransaction, TransactionSource port
│   ├── import-ofx/             # OfxFileAdapter
│   ├── import-csv/             # CsvFileAdapter
│   ├── import-open-finance/    # Future (Phase 5). DO NOT create early.
│   └── categorization/         # CategoryResolver (chain of responsibility)
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

**Confirmed stack:**
- TypeScript everywhere, `strict: true` always.
- Next.js 15 (App Router, server actions, no `pages/`).
- Supabase Postgres + Auth + Realtime + RLS.
- Tailwind + shadcn/ui (components in `apps/web/components/ui/`).
- TanStack Query for server state on the client.
- Zod for all input validation (server actions, adapter parsers, forms).
- Vitest for unit tests.
- Playwright for E2E tests.
- `pnpm` exclusively — never `npm` or `yarn` (breaks workspace).

---

## 3. Common commands

```bash
# Setup
pnpm install

# Dev
pnpm dev
pnpm --filter @splitwise/web dev

# Build
pnpm build
pnpm --filter @splitwise/domain build

# Tests
pnpm test
pnpm --filter @splitwise/import-core test
pnpm test -- --watch
pnpm test -- arch                    # architectural tests only

# Lint and typecheck
pnpm lint
pnpm typecheck                       # tsc --noEmit across all packages

# Supabase local
pnpm supabase start
pnpm supabase db reset               # reset + run migrations + seed
pnpm supabase migration new <name>

# Generate DB types
pnpm gen:types                       # supabase gen types typescript > packages/shared/src/database.types.ts
```

**Always run `pnpm typecheck` and `pnpm test` before declaring a task done.**

---

## 4. Non-negotiable architectural rules

These rules reflect committed decisions and are enforced by automated tests. **Breaking any of these breaks CI.**

### 4.1 Import module isolation

Details in [ADR-005](./SPEC.md#adr-005--import-adapters-isolated-via-ports--adapters-hexagonal) and [SPEC §7](./SPEC.md#7-import-module--detailed-design).

- `packages/import-core/` **must not** import from `packages/import-ofx/`, `import-csv/`, `import-open-finance/`. It only knows the `TransactionSource` port and `RawTransaction` DTO.
- Adapters **must not** import use cases from core beyond interfaces. They implement ports, not orchestration.
- `packages/domain/` **must not** import anything from `packages/import-*` or any I/O lib (`ofx-js`, `papaparse`, `@supabase/supabase-js`, `fs`, `http`).
- To add a new import source: create `packages/import-<name>/`, implement `TransactionSource`, register in DI at `apps/web/lib/import-sources.ts`. **Never** edit `import-core` to accommodate a new source — if you had to, the design failed.

Architectural tests live in `packages/*/src/__tests__/architecture.test.ts`.

### 4.2 Multi-tenant isolation

Details in [ADR-006](./SPEC.md#adr-006--multi-tenant-via-household-aggregate-from-day-one) and [ADR-004](./SPEC.md#adr-004--supabase-postgres--rls-for-multi-tenant-privacy).

- Every shared table (`expenses`, `categories`, `category_memory`) **must have** a `household_id` column with a FK to `households`.
- RLS for shared tables uses `household_members` membership, never `true`.
- Individual tables (`incomes`, `personal_expenses`, `investments`, `goals`) use `owner_id = auth.uid()`.
- Never use `service_role` key in frontend or common server actions. Only in admin scripts (`scripts/`).
- Every new table with private data needs: (a) `owner_id` or `household_id`, (b) RLS enabled, (c) explicit policy, (d) E2E test attempting cross-user access that verifies empty result.
- Do not filter by `household_id` in application queries — RLS does it. Adding explicit filters is redundant but not wrong; omitting them is safe because RLS covers it.

### 4.3 Monetary value convention

Details in [ADR-003](./SPEC.md#adr-003--amount_cents-positive--outflow-negative--inflow).

- `amount_cents` is always an **integer** (cents, not currency units). Never `number` representing 12.50.
- In `RawTransaction.amount_cents`: **positive = outflow (expense), negative = inflow (income)**.
- In domain tables (`expenses`, `personal_expenses`, `incomes`, `investments`): `amount_cents > 0` (DB constraint). The sign lives in the table type.
- Adapters are responsible for converting the native sign of their source to this convention.
- **Never use `Math.abs()` in domain code** — if you needed it, something is wrong upstream.

### 4.4 Split rule semantics

Split rules are person-agnostic. No user names in rule types.

```typescript
// CORRECT
type SplitRuleType = "EQUAL" | "ONLY_PAYER" | "ONLY_OTHER" | "CUSTOM"

// WRONG — never do this
type SplitRuleType = "FIFTY_FIFTY" | "ONLY_LUCAS" | "ONLY_JULIA" // ❌
```

`EQUAL` divides by `household_member_count`, not hardcoded to 2.

### 4.5 Language: English only in code

All variable names, column names, function names, type names, enum values, comments in code, and error messages must be in **English**. Portuguese is only acceptable in:
- User-facing UI strings (labels, messages shown to the user).
- This CLAUDE.md and SPEC.md (documentation).

```typescript
// CORRECT
const monthlyIncome = ...
const sharedExpenses = ...

// WRONG
const rendaMensal = ...       // ❌
const gastoCompartilhado = ...  // ❌
```

```sql
-- CORRECT
budget_bucket text check (budget_bucket in ('needs', 'wants', 'savings'))

-- WRONG
budget_bucket text check (budget_bucket in ('necessidades', 'desejos', 'investimento')) -- ❌
```

### 4.6 Conventional commits

Use scope prefixes by affected package:

```
feat(domain): add Investment aggregate
fix(import-ofx): handle missing FITID in older Itaú statements
chore(web): update shadcn
refactor(import-core): extract SplitRulePolicy to port
docs(spec): add ADR-007
test(domain): cover SplitRule invariants
feat(billing): add Stripe webhook handler
```

Valid scopes: `domain`, `shared`, `import-core`, `import-ofx`, `import-csv`, `import-open-finance`, `categorization`, `web`, `billing`, `spec`, `infra`.

---

## 5. Code patterns

### 5.1 TypeScript

- `strict: true`, no exceptions. No loose `any` — use `unknown` with narrowing.
- Prefer `type` over `interface`, except for ports (interfaces) where "implementable contract" semantics matter.
- Branded types for IDs: `type UserId = string & { __brand: "UserId" }`.
- Domain errors are named classes (`DuplicateTransactionError`, `InvalidSplitRuleError`), not generic strings.
- Absolute imports via tsconfig paths: `import { Expense } from "@splitwise/domain"`, not relative paths across packages.

### 5.2 Server actions and API

- Every server action starts with Zod input validation. No exceptions.
- Server actions return `Result<T, E>` (success/error discriminated union), not throw. Expected errors are values.
- `auth.uid()` is obtained via Supabase server client helper. Never trust `userId` from client input.
- After mutations, call `revalidatePath()` or `revalidateTag()` explicitly — Next.js 15 does not auto-revalidate.

### 5.3 Naming conventions

| Thing                | Convention         | Example                          |
| -------------------- | ------------------ | -------------------------------- |
| DB tables            | `snake_case` plural | `personal_expenses`, `household_members` |
| DB columns           | `snake_case`       | `owner_id`, `amount_cents`, `occurred_at` |
| TS types/classes     | `PascalCase`       | `PersonalExpense`, `HouseholdMember` |
| Use cases            | `<Verb><Noun>UseCase` | `ImportTransactionsUseCase`   |
| Ports                | singular noun      | `TransactionSource`, `CategoryResolver` |
| Adapters             | `<Origin><Type>`   | `OfxFileAdapter`, `SupabaseExpenseRepository` |
| Enum values          | `SCREAMING_SNAKE`  | `ONLY_PAYER`, `MAX_NEEDS`        |
| Budget buckets       | `needs`, `wants`, `savings` | (lowercase strings)    |

### 5.4 Dates and timezone

- DB stores `timestamptz` or `date`. Never `timestamp without time zone`.
- Application operates in `America/Sao_Paulo`. Explicit conversions via `date-fns-tz`.
- `occurred_at` is the date **of the event** (when the expense happened), not the settlement or import date.

---

## 6. Known pitfalls

- **Itaú OFX sometimes has no `<FITID>`** on older transactions. `OfxFileAdapter` must generate a deterministic hash as fallback and add a warning to `FetchResult.warnings`.
- **PicPay CSV has a BOM** (`\ufeff`) at the start. Strip before parsing.
- **Supabase Realtime does not work with RLS without an explicit SELECT policy** even for the row's own owner. Ensure SELECT is covered explicitly.
- **Next.js 15 server actions don't auto-revalidate** — call `revalidatePath()` or `revalidateTag()` manually after mutations.
- **`pnpm install` in CI needs `--frozen-lockfile`**, otherwise it regenerates the lockfile and CI becomes non-deterministic.
- **Don't run `npx supabase`** inside the project — use `pnpm supabase` (alias to the pinned devDep version). Version mismatches break migrations.
- **`EQUAL` split divides by member count, not 2.** Always fetch `household_member_count` dynamically — never hardcode 2.

---

## 7. How to add common things

### New expense category

1. Add to global templates in `infra/supabase/migrations/xxx_add_category_<name>.sql` as INSERT into `categories` with `household_id = null` (global template).
2. Update the table in [SPEC §15.1](./SPEC.md#151-default-category-templates-global-seed).
3. If it's household-specific (e.g. "Daycare"), it's created by the user via the UI — not a migration.

### New import adapter

1. `mkdir packages/import-<name>/` and setup the package (copy `import-csv/package.json` as base).
2. Implement `TransactionSource` from `@splitwise/import-core`.
3. Add unit tests covering: valid parsing, invalid parsing, missing stable ID (hash generation).
4. Register in DI at `apps/web/lib/import-sources.ts`.
5. Add upload/connection UI at `apps/web/app/import/<name>/`.
6. **Do not touch** `packages/import-core/` or `packages/domain/`.

Expected PR diff: new files in `packages/import-<name>/` + changes in `apps/web/lib/import-sources.ts` and the UI route. If the PR touches `import-core` or `domain`, something is wrong.

### New table with private data

1. Migration that creates the table with `owner_id uuid not null references users(id)` or `household_id uuid not null references households(id)`.
2. Migration that does `alter table <name> enable row level security`.
3. Migration that creates the policy.
4. E2E test in `apps/web/tests/e2e/privacy.spec.ts` attempting cross-user data access.
5. Run `pnpm gen:types`.

### New ADR

1. Copy the template from [SPEC §14](./SPEC.md#template-for-future-adrs).
2. Number sequentially (next free number).
3. Initial status `Proposed`; change to `Accepted` after implementation or validation.

---

## 8. What NOT to do

- **Do not create `packages/import-open-finance/` before Phase 5.** Anticipating adapters without a real use case creates debt.
- **Do not add dependencies without justification.** Every dependency is weight.
- **Do not use `useEffect` for data fetching.** Use TanStack Query or server components.
- **Do not write inline SQL in server actions.** All queries go through repositories with Supabase-generated types.
- **Do not hardcode user names or counts in business logic.** `ONLY_LUCAS`, `ONLY_JULIA`, `/ 2` — all of these are bugs waiting to surface in production.
- **Do not commit `.env`** — use `.env.local` (gitignored) and `.env.example` (versioned, fake values).
- **Do not run migrations in production manually.** GitHub Actions + Supabase CLI on deploy.
- **Do not write Portuguese in code.** UI strings are the only exception.

---

## 9. When in doubt

In order of priority:

1. Search [SPEC.md](./SPEC.md). Almost everything is there.
2. Check ADRs ([SPEC §14](./SPEC.md#14-architecture-decision-records-adrs)) to understand the *why* behind a decision.
3. Look at a neighboring package as a reference (e.g. to create `import-<name>`, mirror `import-csv`).
4. If it's a new architectural decision, **propose an ADR before implementing**. Don't decide silently.
5. If none of the above resolves it, ask explicitly and wait for an answer before guessing.

---

## 10. Author context

- Lucas is a mid-level Software Engineer at Itaú Unibanco (Java/Spring day job).
- Background in Java/Spring and PHP/Laravel; this project's stack is Next.js + TypeScript.
- Familiar with DDD, hexagonal architecture, CQRS, event sourcing — use advanced terminology freely.
- Uses AI tooling heavily (Claude Code, Cursor, Devin). Prefers suggestions that leverage that.
- This project also serves as a senior-level portfolio. Decisions must be defensible in interviews.