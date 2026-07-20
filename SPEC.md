# Spec: SaaS — Personal Finance + Shared Expense Splitting

| Field          | Value                                                              |
| -------------- | ------------------------------------------------------------------ |
| Codename       | splitwise (internal) — public name TBD                            |
| Author         | Lucas                                                              |
| Status         | Draft                                                              |
| Version        | 0.2 (SaaS-ready)                                                   |
| Last revision  | 2026-05-26                                                         |

---

## 1. Context and motivation

A SaaS platform for couples, housemates, or any group of people who share recurring expenses and want individual financial visibility. The primary use case is a household where members split shared costs and each member independently tracks personal income, expenses, and investments.

The initial version was designed for personal use (replacing a shared Excel spreadsheet). Version 0.2 re-architects the data model for multi-tenancy so the platform can serve any number of households without data isolation issues.

Core problems solved:

- Manual, error-prone spreadsheet management for shared expenses.
- No individual financial view: users cannot answer *"what % of my income did I spend this month?"*.
- No automation for recurring expenses.
- No bank statement import.

## 2. Objectives

### 2.1 Functional

- Allow any group of users to form a **Household** and track shared expenses with configurable split rules.
- Offer two views: **Household** (shared, visible to all members) and **Individual** (private per user).
- Support manual entry, OFX/CSV import, and (future) Open Finance connection.
- Auto-categorize transactions with user-trainable rules.
- Calculate income percentage spent per month, category breakdown, and 12-month surplus/investment projection.
- Allow users to set budget goals (minimum investment rate, minimum surplus).

### 2.2 Non-functional

- **Multi-tenant from day one**: every shared table is scoped to a `household_id`. RLS enforces isolation at the database level.
- Mobile-first PWA.
- Privacy between household members: income, personal expenses, and investments are invisible to other members. Enforced via RLS.
- Full import idempotency: importing the same file twice produces no duplicates.
- Performance: visualization screens load in under 1s for 5 years of data.
- SaaS-ready: subscription plans, billing integration (Stripe), per-household limits.

### 2.3 Non-goals (explicitly out of scope)

- Brokerage or investment execution.
- Tax analysis.
- Multi-currency support (MVP: BRL only, field exists for future).
- Payment processing: the platform records, never moves money.
- More than 10 members per household in MVP.

## 3. Domain glossary

| Term                 | Definition                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `Household`          | A group of users sharing expenses. Replaces the hardcoded "couple" concept. Every piece of shared data belongs to a Household.      |
| `HouseholdMember`    | Join between a User and a Household with a role (`owner`, `member`).                                                                |
| `Expense`            | A shared expense belonging to a Household, subject to a `SplitRule`.                                                                |
| `PersonalExpense`    | An individual expense belonging to a single User. Never split.                                                                      |
| `Income`             | A financial inflow (salary, dividends, freelance). Always individual, never shared.                                                 |
| `Investment`         | An allocation to a financial asset. Not an expense — modeled separately. Never enters `total_spent`.                                |
| `Category`           | Hierarchical taxonomy (e.g. `Housing > Rent`, `Transport > Fuel`). Global templates + per-household custom categories.              |
| `SplitRule`          | Defines how an Expense is divided among Household members. Variants: `EQUAL`, `ONLY_PAYER`, `ONLY_OTHER`, `CUSTOM(payer_percent)`. |
| `RawTransaction`     | Internal DTO representing a transaction **independent of source**. All import adapters must produce this type.                       |
| `TransactionSource`  | Port (interface) abstracting where transactions come from. Implementations: OFX, CSV, Open Finance, manual.                         |
| `Goal`               | A monthly/annual budget goal (e.g. invest min 20% of income, keep min 10% surplus). Variants: `MIN_SAVINGS`, `MIN_SURPLUS`.        |
| `Settlement`         | Immutable monthly snapshot of who owes what to whom within a Household.                                                             |
| `FITID`              | Unique transaction identifier in the OFX standard. Used for deduplication on import.                                                |
| `Plan`               | Subscription tier (`free`, `pro`, `family`). Controls household member limits, import history depth, and feature access.            |

## 4. Product vision

### 4.1 Personas

**Primary user (household owner).** Wants to answer:

1. How much does each member owe this month?
2. What % of my income did I spend?
3. Will I hit my investment goal of $X by December?
4. Which category is growing out of control?

**Secondary user (household member).** Wants to answer:

1. How much do I owe this month?
2. Am I within budget?

### 4.2 Main views

| View                     | Access                  | Content                                                                                         |
| ------------------------ | ----------------------- | ----------------------------------------------------------------------------------------------- |
| **Household**            | All household members   | Shared expenses, split amounts per member, monthly history, settlement balance                  |
| **Individual**           | Owner only (per user)   | Personal income + expenses + investments; % of income spent; 12-month projection               |
| **Import**               | Each user, their own    | Upload OFX/CSV; review and categorize imported transactions                                     |
| **Settings**             | Each user, their own    | Categorization rules, connected sources, goals, plan & billing                                  |
| **Household Settings**   | Household owner only    | Invite members, manage split rules, household name                                              |

## 5. Domain model (DDD)

### 5.1 Entity diagram

```
┌──────────┐       ┌──────────────────┐       ┌──────────┐
│   User   │ 1   N │ HouseholdMember  │ N   1 │Household │
│          │───────│ role, joined_at  │───────│          │
└──────────┘       └──────────────────┘       └──────────┘
     │                                              │
     │ 1                                            │ 1
     │                                              │
     │ N                                            │ N
┌────┴────────────┐                         ┌──────┴────┐
│ PersonalExpense │ N   1  ┌──────────┐   1 │  Expense  │
│  owner_id (FK)  │────────│ Category │────-│household_id│
└─────────────────┘        └──────────┘     └──────────┘
                                 │ 1              │ 1
                                 │                │
                                 │ N              │ 1
                            ┌────┘          ┌─────┴────┐
                            │               │SplitRule │
                            │               └──────────┘
┌──────────┐         ┌──────┴───┐
│Investment│ N     1 │ User     │
│ owner_id │─────────│          │
└──────────┘         └──────────┘
┌──────────┐
│  Income  │ N     1 User
│ owner_id │
└──────────┘
```

### 5.2 Aggregates

Four aggregates, each with its own root:

1. **Household aggregate** — root `Household`. Includes `HouseholdMember` as child entities.
2. **Expense aggregate** — root `Expense`. Includes `SplitRule` as value object. Belongs to a Household.
3. **PersonalExpense aggregate** — root `PersonalExpense`. Belongs to a single User.
4. **Income aggregate** — root `Income`. Belongs to a single User.
5. **Investment aggregate** — root `Investment`. Belongs to a single User.

`Category` is a **shared kernel**: global template categories + household-scoped custom categories. Not an aggregate — treated as reference data.

### 5.3 Domain invariants

- Every `Expense` belongs to exactly one `Household` and has exactly one `SplitRule` and one `Category`.
- `CUSTOM(payer_percent)` requires `0 <= payer_percent <= 100`.
- `Income.amount_cents > 0` always. Refunds are `PersonalExpense` with category `Refunds`, not negative Income.
- `Investment` is never an `Expense`. Shown together in "committed income %" in UI, but modeled separately.
- `Settlement` for a closed month is immutable. Retroactive entries become adjustments in the current month.
- A `User` can belong to multiple Households (e.g. personal + shared with roommates).
- Only a `HouseholdMember` with role `owner` can invite/remove members or change split rules.

## 6. Architecture

### 6.1 Stack

| Layer        | Technology                                                             | Reason                                                              |
| ------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Frontend     | Next.js 15 (App Router) + Tailwind + shadcn/ui + TanStack Query        | Familiar stack; PWA built-in                                        |
| Backend      | Next.js API routes + server actions                                    | Same runtime, no extra server overhead                              |
| Database     | Supabase Postgres                                                      | RLS enforces multi-tenant isolation natively                        |
| Auth         | Supabase Auth (magic link)                                             | Passwordless, low friction                                          |
| Realtime     | Supabase Realtime                                                      | When one member adds an Expense, others see it instantly            |
| OFX parsing  | `ofx-js`                                                               | Mature library, OFX is stable                                       |
| Billing      | Stripe                                                                 | Plans, subscriptions, webhooks                                      |
| LLM (future) | Anthropic API (Claude Haiku for categorization fallback)               | Low cost per transaction, sufficient quality                        |
| Hosting      | Vercel                                                                 | Native monorepo support; auto-deploy                                |

### 6.2 Module structure

```
src/
  modules/
    accounting/        # Core domain — Expense, Income, Investment, Category, Household
      domain/
      application/     # Use cases
      infrastructure/  # Repositories (Supabase)
    importing/         # Isolated import module — see §7 for full design
      domain/
      application/
      adapters/
        ofx/
        csv/
        manual/
        open-finance/  # Future (Phase 5)
    categorization/    # Resolver chain (rules → memory → llm)
    budgeting/         # % of income, surplus/investment goals
    projection/        # 12-month projection
    billing/           # Stripe integration, plan enforcement
  shared/
    kernel/            # Shared types (Money, DateRange, YearMonth, etc.)
    ui/                # Customized shadcn components
  app/                 # Next.js App Router (routes)
```

---

## 7. Import module — detailed design

The import module is architecturally isolated so that adding Open Finance (or any future source) requires **zero changes to domain or business logic**.

### 7.1 Guiding principle

> Business logic never knows about OFX, CSV, JSON from Belvo/Pluggy, Open Finance webhooks, OAuth, XML parsing, statement encoding, or any source-specific detail.

The use case `ImportTransactionsUseCase` receives a `TransactionSource` (port), calls `.fetch()`, and processes `RawTransaction[]`. It does not know — and must not know — whether the data came from a file upload, a bank API, or manual entry.

### 7.2 Central contract: `RawTransaction`

```typescript
// packages/import-core/src/domain/RawTransaction.ts
export interface RawTransaction {
  /**
   * Unique, stable identifier of the transaction AT THE SOURCE.
   * - OFX: <FITID>
   * - CSV: deterministic hash of (date + amount + description)
   * - Open Finance: bank's transactionId
   * - Manual: generated uuid
   *
   * Used for deduplication. Adapter is responsible for ensuring
   * the same event always produces the same externalId.
   */
  externalId: string;

  /** Transaction date (not settlement date). */
  occurredAt: Date;

  /**
   * Amount in cents. Positive = outflow (expense), negative = inflow (income).
   * Expenses are the dominant case; positive outflow reduces sign manipulation
   * in domain code. See ADR-003.
   */
  amountCents: number;

  /** Raw description from source. Do NOT normalize here. */
  description: string;

  /** ISO 4217 currency. Always "BRL" in MVP, explicit for future use. */
  currency: "BRL";

  /** Institution or source name. E.g. "Itaú", "PicPay", "Manual". */
  sourceInstitution: string;

  /** Raw transaction type, if provided by source. Optional. */
  rawType?: "DEBIT" | "CREDIT" | "PIX" | "TRANSFER" | "FEE" | "OTHER";

  /** Source-specific metadata. Not used in domain — for audit/debug only. */
  metadata?: Record<string, unknown>;
}
```

### 7.3 Primary port: `TransactionSource`

```typescript
// packages/import-core/src/domain/ports/TransactionSource.ts
export interface TransactionSource {
  readonly id: string;
  readonly displayName: string;
  fetch(params: FetchParams): Promise<FetchResult>;
}

export interface FetchParams {
  dateRange?: { from: Date; to: Date };
  limit?: number;
}

export interface FetchResult {
  transactions: RawTransaction[];
  effectiveRange: { from: Date; to: Date };
  warnings: string[];
}
```

### 7.4 Secondary ports (driven)

```typescript
// packages/import-core/src/domain/ports/TransactionRepository.ts
export interface TransactionRepository {
  existsByExternalId(externalId: string, sourceId: string): Promise<boolean>;
  saveBatch(transactions: ImportedTransaction[]): Promise<void>;
}

// packages/import-core/src/domain/ports/CategoryResolver.ts
export interface CategoryResolver {
  resolve(raw: RawTransaction): Promise<CategoryResolution>;
}

export interface CategoryResolution {
  categoryId: string;
  confidence: number; // 0..1
  source: "rule" | "memory" | "llm" | "default";
}
```

### 7.5 Central use case

```typescript
// packages/import-core/src/application/ImportTransactionsUseCase.ts
export class ImportTransactionsUseCase {
  constructor(
    private readonly repository: TransactionRepository,
    private readonly resolver: CategoryResolver,
    private readonly splitPolicy: SplitRulePolicy,
    private readonly clock: Clock,
  ) {}

  async execute(
    source: TransactionSource,
    params: FetchParams,
    ownerId: UserId,
    householdId: HouseholdId,  // required for multi-tenancy
  ): Promise<ImportSummary> {
    const result = await source.fetch(params);

    const imported: ImportedTransaction[] = [];
    const skipped: SkippedTransaction[] = [];

    for (const raw of result.transactions) {
      if (await this.repository.existsByExternalId(raw.externalId, source.id)) {
        skipped.push({ raw, reason: "duplicate" });
        continue;
      }

      const resolution = await this.resolver.resolve(raw);
      const splitRule = this.splitPolicy.apply(raw, resolution.categoryId);

      imported.push({
        ownerId,
        householdId,
        sourceId: source.id,
        raw,
        categoryId: resolution.categoryId,
        categoryConfidence: resolution.confidence,
        categorySource: resolution.source,
        splitRule,
        importedAt: this.clock.now(),
      });
    }

    await this.repository.saveBatch(imported);

    return {
      sourceId: source.id,
      effectiveRange: result.effectiveRange,
      total: result.transactions.length,
      imported: imported.length,
      skipped: skipped.length,
      lowConfidence: imported.filter(t => t.categoryConfidence < 0.7).length,
      warnings: result.warnings,
    };
  }
}
```

### 7.6 Concrete adapters

#### 7.6.1 OfxFileAdapter (Phase 3)

```typescript
export class OfxFileAdapter implements TransactionSource {
  readonly id = "ofx-file";
  readonly displayName = "OFX File";

  constructor(
    private readonly fileBuffer: Buffer,
    private readonly institutionHint?: string,
  ) {}

  async fetch(_params: FetchParams): Promise<FetchResult> {
    // parse OFX buffer
    // map STMTTRN[] -> RawTransaction[]
    // OFX uses negative for outflow; invert per ADR-003
    // generate hash-based externalId if FITID is absent (known Itaú issue)
  }
}
```

#### 7.6.2 CsvFileAdapter (Phase 3)

Deterministic `externalId`: `sha256(date_iso|amount_cents|normalized_description)`.

#### 7.6.3 ManualAdapter (Phase 3)

Trivial — wraps user form input into `RawTransaction` with `externalId = uuidv4()`.

#### 7.6.4 OpenFinanceAdapter (Phase 5 — future)

```typescript
export class PluggyAdapter implements TransactionSource {
  readonly id = "open-finance-pluggy";
  readonly displayName = "Open Finance";

  constructor(
    private readonly pluggyClient: PluggyClient,
    private readonly itemId: string,
  ) {}

  async fetch(params: FetchParams): Promise<FetchResult> {
    const transactions = await this.pluggyClient.transactions.list({
      itemId: this.itemId,
      from: params.dateRange?.from,
      to: params.dateRange?.to,
    });

    return {
      transactions: transactions.map(this.toRaw),
      effectiveRange: { /* from API response */ },
      warnings: [],
    };
  }

  private toRaw = (t: PluggyTransaction): RawTransaction => ({
    externalId: t.id,
    occurredAt: new Date(t.date),
    amountCents: Math.round(t.amount * -100), // Pluggy: positive = inflow, invert
    description: t.description,
    currency: "BRL",
    sourceInstitution: t.institutionName,
    metadata: { pluggyAccountId: t.accountId },
  });
}
```

**Domain diff to support Open Finance: zero.** Only register the new adapter in the DI container and add the OAuth UI in `app/`.

### 7.7 Architectural tests

```typescript
// packages/import-core/src/__tests__/architecture.test.ts
test("domain does not import adapters", () => {
  expect(filesIn("src/modules/importing/domain")).not.toImport([
    "src/modules/importing/adapters/**",
    "ofx-js",
    "pluggy-sdk",
    "papaparse",
  ]);
});

test("use cases do not import infrastructure", () => {
  expect(filesIn("src/modules/importing/application")).not.toImport([
    "@supabase/supabase-js",
    "src/**/infrastructure/**",
  ]);
});
```

### 7.8 Import sequence flow

```
User               UI              UseCase          Adapter        Resolver      Repository
 │                  │                 │                │               │               │
 │  upload file     │                 │                │               │               │
 │ ───────────────► │                 │                │               │               │
 │                  │ execute(source) │                │               │               │
 │                  │ ──────────────► │                │               │               │
 │                  │                 │ fetch()        │               │               │
 │                  │                 │ ─────────────► │               │               │
 │                  │                 │ ◄─── raw[]     │               │               │
 │                  │                 │                │               │               │
 │                  │                 │ for each raw:  │               │               │
 │                  │                 │ existsById() ──────────────────────────────── ►│
 │                  │                 │ ◄─── false     │               │               │
 │                  │                 │ resolve(raw) ──────────────── ►│               │
 │                  │                 │ ◄─── category  │               │               │
 │                  │                 │ saveBatch() ───────────────────────────────── ►│
 │                  │                 │ ◄─── ok        │               │               │
 │                  │ ◄─── summary    │                │               │               │
 │ ◄─── review UI  │                 │                │               │               │
```

---

## 8. Categorization module

`CategoryResolver` is a **chain of responsibility**, composed at runtime:

```typescript
const resolver = new ChainCategoryResolver([
  new RuleBasedResolver(userRules),        // 1. User-defined regex rules
  new UserMemoryResolver(memoryRepo),      // 2. "I've seen this description before"
  new LlmResolver(anthropicClient),        // 3. (future) Ask Claude
  new DefaultResolver(),                   // 4. "Other", confidence 0
]);
```

Each link attempts to resolve; if confidence < threshold, passes to next. Default threshold: 0.7.

LLM resolver is **opt-in**, off by default. Cost per transaction is billed per household (future: plan-gated).

---

## 9. Persistence

### 9.1 Postgres schema (Supabase)

```sql
-- Plans
create type plan_type as enum ('free', 'pro', 'family');

-- Users
create table users (
  id              uuid primary key default auth.uid(),
  display_name    text not null,
  email           text not null,
  plan            plan_type not null default 'free',
  stripe_customer_id text,
  trial_ends_at   timestamptz,
  created_at      timestamptz default now()
);

-- Households
create table households (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  created_by      uuid not null references users(id),
  created_at      timestamptz default now()
);

-- Household membership
create table household_members (
  household_id    uuid not null references households(id) on delete cascade,
  user_id         uuid not null references users(id),
  role            text not null check (role in ('owner', 'member')),
  joined_at       timestamptz default now(),
  primary key (household_id, user_id)
);

-- Categories (global templates + household custom)
create table categories (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid references households(id),  -- null = global template
  parent_id       uuid references categories(id),
  name            text not null,
  default_split_rule text not null,
  is_template     boolean not null default false
);

-- Shared expenses (household-scoped)
create table expenses (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references households(id),
  paid_by               uuid not null references users(id),
  category_id           uuid not null references categories(id),
  occurred_at           date not null,
  amount_cents          bigint not null check (amount_cents > 0),
  description           text,
  split_rule_type       text not null check (split_rule_type in ('EQUAL', 'ONLY_PAYER', 'ONLY_OTHER', 'CUSTOM')),
  split_rule_payer_percent int check (split_rule_payer_percent between 0 and 100),
  source_id             text not null,
  external_id           text not null,
  imported_at           timestamptz default now(),
  unique (household_id, source_id, external_id)
);

-- Personal expenses (user-scoped)
create table personal_expenses (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references users(id),
  category_id     uuid not null references categories(id),
  occurred_at     date not null,
  amount_cents    bigint not null check (amount_cents > 0),
  description     text,
  source_id       text not null,
  external_id     text not null,
  imported_at     timestamptz default now(),
  unique (owner_id, source_id, external_id)
);

-- Income (user-scoped)
create table incomes (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references users(id),
  occurred_at     date not null,
  amount_cents    bigint not null check (amount_cents > 0),
  source          text not null,
  recurring       boolean not null default false,
  created_at      timestamptz default now()
);

-- Investments (user-scoped)
create table investments (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references users(id),
  occurred_at     date not null,
  amount_cents    bigint not null check (amount_cents > 0),
  asset_class     text not null,
  description     text,
  created_at      timestamptz default now()
);

-- Categorization memory (household-scoped)
create table category_memory (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references households(id),
  owner_id            uuid not null references users(id),
  description_pattern text not null,
  category_id         uuid not null references categories(id),
  confidence          numeric(3,2) not null default 1.0,
  unique (household_id, owner_id, description_pattern)
);

-- Budget goals (user-scoped)
create table goals (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references users(id),
  goal_type       text not null check (goal_type in ('MIN_SAVINGS', 'MIN_SURPLUS')),
  target_percent  int not null check (target_percent between 0 and 100),
  applies_to_month date,  -- null = recurring
  created_at      timestamptz default now()
);

-- Connected bank accounts (Open Finance)
create table connected_accounts (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references users(id),
  provider            text not null,   -- 'pluggy', 'belvo', etc.
  provider_item_id    text not null,
  institution_name    text not null,
  connected_at        timestamptz default now(),
  last_synced_at      timestamptz,
  status              text not null default 'active',
  unique (owner_id, provider, provider_item_id)
);
```

### 9.2 Row-Level Security

```sql
-- Households: members see their own households
alter table households enable row level security;
create policy households_member_select on households
  for select using (
    id in (select household_id from household_members where user_id = auth.uid())
  );

-- Expenses: scoped to household members
alter table expenses enable row level security;
create policy expenses_household_member on expenses
  for select using (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );
create policy expenses_insert_member on expenses
  for insert with check (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
    and paid_by = auth.uid()
  );

-- Personal expenses: owner only
alter table personal_expenses enable row level security;
create policy personal_expenses_owner on personal_expenses
  for all using (auth.uid() = owner_id);

-- Income: owner only
alter table incomes enable row level security;
create policy incomes_owner on incomes
  for all using (auth.uid() = owner_id);

-- Investments: owner only
alter table investments enable row level security;
create policy investments_owner on investments
  for all using (auth.uid() = owner_id);

-- Category memory: owner only (but scoped to household)
alter table category_memory enable row level security;
create policy category_memory_owner on category_memory
  for all using (auth.uid() = owner_id);

-- Goals: owner only
alter table goals enable row level security;
create policy goals_owner on goals
  for all using (auth.uid() = owner_id);

-- Connected accounts: owner only
alter table connected_accounts enable row level security;
create policy connected_accounts_owner on connected_accounts
  for all using (auth.uid() = owner_id);
```

---

## 10. Core calculations

### 10.1 Split

```
for user U in household H in month M:
  shared_share_U = sum(
    e.amount_cents * payer_share(e.split_rule, U, e.paid_by)
    for e in Expenses where household_id = H and month(occurred_at) = M
  )
  where payer_share(rule, user, payer):
    EQUAL       -> 1 / household_member_count
    ONLY_PAYER  -> if user == payer then 1.0 else 0.0
    ONLY_OTHER  -> if user != payer then 1.0 else 0.0
    CUSTOM(p)   -> if user == payer then p/100 else (100-p)/100
```

Note: `EQUAL` divides cost equally among **all** household members, not hardcoded to two.

### 10.2 Individual budget % (individual view)

```
income_M      = sum(incomes where owner_id = U and month = M)
spent_M       = shared_share_U_M
              + sum(personal_expenses where owner_id = U and month = M)
invested_M    = sum(investments where owner_id = U and month = M)

pct_spent     = spent_M / income_M
pct_invested  = invested_M / income_M
surplus       = income_M - spent_M - invested_M
```

Investments do **not** enter `spent_M`. Explicit decision — see ADR-003 rationale for analogous reasoning.

### 10.3 Surplus projection (12 months)

MVP: simple 3-month moving average.

```
projected_monthly_surplus = avg(surplus_M-1, surplus_M-2, surplus_M-3)
projected_balance_in_N_months = current_balance + (projected_monthly_surplus * N)
```

Future: linear regression over last N months, or scenario analysis (optimistic/realistic/pessimistic).

---

## 11. Delivery plan (phases)

### Phase 1 — Household shared view, manual entry (week 1)

- Postgres schema + RLS including `households` and `household_members`.
- Household creation and member invite flow.
- Household view: list, manual entry, auto split.
- Auth (magic link).

**Acceptance criteria:** Two users can create a household, add shared expenses, and see correct split amounts.

### Phase 2 — Individual view, manual entry (week 2)

- Schema + RLS for `incomes`, `personal_expenses`, `investments`.
- Individual view with income %, category breakdown, surplus card.
- Manual entry for all individual types.

**Acceptance criteria:** User sees "I spent 51% of my income in May". Other household member cannot see this data.

### Phase 3 — Categorization + OFX/CSV import (weeks 3–4)

- `TransactionSource`, `RawTransaction`, `ImportTransactionsUseCase`.
- `OfxFileAdapter`, `CsvFileAdapter`, `ManualAdapter`.
- `RuleBasedResolver` + `UserMemoryResolver`.
- Import review UI.
- Architectural tests in CI.

**Acceptance criteria:** User uploads OFX, 80%+ of transactions are pre-categorized, remainder reviewable in under 5 minutes.

### Phase 4 — Projection + goals (week 5)

- `Projector` with moving average.
- Goals (max % per bucket, min investment).
- In-app alerts when a goal is at risk.

### Phase 5 — Open Finance (future, no deadline)

- `OpenFinanceAdapter` (Pluggy).
- OAuth flow.
- Background daily sync job.

**Design acceptance criterion:** this phase touches zero files in `accounting/`, `categorization/`, `budgeting/`, or `projection/`. Only new files in `importing/adapters/open-finance/` and in `app/`.

### Phase 6 — SaaS billing (parallel to Phase 4+)

- Stripe integration: plans (`free`, `pro`, `family`), checkout, webhook handler.
- Plan enforcement middleware: household member limits, import history depth.
- Billing portal for subscription management.
- `billing/` module in the monorepo.

---

## 12. Risks and mitigations

| Risk                                                        | Probability | Impact   | Mitigation                                                                                       |
| ----------------------------------------------------------- | ----------- | -------- | ------------------------------------------------------------------------------------------------ |
| Poor auto-categorization causes user abandonment            | High        | High     | User memory learning from day 1 of Phase 3                                                       |
| OFX from Brazilian banks comes malformed                    | Medium      | Medium   | Treat as warning, not fatal error; fall back to CSV                                              |
| Privacy leak between household members                      | Low         | Critical | RLS in DB + E2E tests that attempt cross-user data access                                         |
| Architectural boundary leaks over time                      | Medium      | High     | Architectural tests in CI; any change to `importing/domain/` is a deliberate reviewed decision   |
| Open Finance API changes                                    | Medium      | Medium   | Abstraction isolates it — only the adapter is affected                                            |
| Stripe webhook handling bugs causing billing inconsistency  | Medium      | High     | Idempotency keys on all webhook handlers; test with Stripe CLI                                    |

---

## 13. Open decisions

- [ ] `category_memory` shared across household members or per user? Inclination: per user, opt-in to share.
- [ ] LLM resolver in Phase 3 or Phase 4? Inclination: Phase 4 — start with zero $ cost.
- [ ] How to handle intra-household transfers? (User A pays user B's share in cash.) Ideally auto-becomes a `Settlement`, not an `Expense`/`Income`.
- [ ] `free` plan limits: how many members per household? How many months of import history? TBD before Phase 6.
- [ ] Household invite flow: email invite or shareable link? Inclination: shareable link (lower friction).

---

## 14. Architecture Decision Records (ADRs)

ADRs document **relevant architectural decisions** and the context that motivated each one. Unlike §6 (which describes the final architecture), here is the *reasoning* — alternatives considered, trade-offs, and why we chose the path we did.

---

### ADR-001 — Monorepo with pnpm workspaces + Turborepo

**Status:** Accepted
**Date:** 2026-05-26

**Context.** The project has frontend (Next.js), backend (Next.js API routes), and multiple domain modules that benefit from clear boundaries. We need to decide: everything in one repo (monorepo) or one repo per component (polyrepo).

**Decision.** Adopt monorepo using `pnpm workspaces` for dependency management and `Turborepo` for build orchestration and caching.

```
splitwise/
├── apps/
│   └── web/                    # Next.js fullstack
├── packages/
│   ├── domain/
│   ├── shared/
│   ├── import-core/
│   ├── import-ofx/
│   ├── import-csv/
│   ├── import-open-finance/    # Future
│   └── categorization/
├── turbo.json
└── pnpm-workspace.yaml
```

**Positive consequences:**
- Cross-cutting refactors (renaming `Expense`, adjusting `RawTransaction`) are atomic.
- Sharing contracts between front and back is trivial (`import { ExpenseDto } from '@splitwise/shared'`).
- AI tools (Claude Code, Cursor, Devin) have full project context in a single root.
- `import-open-finance` enters as a new package — no new repo, no new CI config.

**Negative consequences:**
- Mixed git history. Mitigation: conventional commits with package scope prefixes.
- CI must be smart to avoid rebuilding everything on each PR. Mitigation: Turborepo handles this with affected detection and remote cache.

**Alternatives considered:**
1. **Polyrepo.** Rejected: solo project, homogeneous TS stack, shared contract overhead doesn't pay off.
2. **Nx instead of Turborepo.** More powerful but steeper learning curve. Turborepo covers all needs with minimal config.

**Revision criteria.** Reconsider if: team grows to 5+ with separate squads, or a component migrates to a different language.

---

### ADR-002 — Next.js fullstack instead of Spring Boot + separate frontend

**Status:** Accepted
**Date:** 2026-05-26

**Context.** Author has primary expertise in Java/Spring Boot. The "natural" choice would be Spring Boot backend + Next.js frontend. However, the project is solo with a need for fast iteration, and the stack is homogeneous TypeScript throughout.

**Decision.** Use Next.js as fullstack (API routes + server actions + UI). No separate Java backend.

**Positive consequences:** Dramatically shorter time to MVP; TypeScript types flow from DB to UI without manual serialization; Vercel hosts the entire monorepo for free.

**Negative consequences:** Less Java portfolio exposure. Mitigation: the SPEC itself demonstrates senior-level architectural reasoning independent of language.

**Revision criteria.** Reconsider if: project grows to require heavy batch processing that benefits from the JVM, or a Java/Kotlin SDK is the only mature option for a required integration.

---

### ADR-003 — `amount_cents` positive = outflow, negative = inflow

**Status:** Accepted
**Date:** 2026-05-26

**Context.** The sign convention for monetary amounts is inconsistent across sources: OFX uses negative for outflow; Pluggy sometimes inverts; accounting tradition uses negative for debit.

**Decision.** In `RawTransaction.amount_cents`: **positive = outflow (expense), negative = inflow (income)**.

**Positive consequences:** Expenses are the dominant case (~95% of transactions). Convention optimizes the common case: `amount_cents` is typically positive, no sign manipulation in domain. `SUM(amount_cents)` = total spent.

**Negative consequences:** Counter-intuitive for people coming from accounting or bank APIs. Mitigation: explicitly documented in the contract's JSDoc comment.

**Revision criteria.** Reconsider if: we start modeling genuinely bidirectional transactions in a single schema — in that case, separate entities are better than changing the convention.

---

### ADR-004 — Supabase Postgres + RLS for multi-tenant privacy

**Status:** Accepted
**Date:** 2026-05-26

**Context.** Privacy between users (and between households) is critical. Individual income, personal expenses, and investments must be invisible to other users. Shared household expenses must be visible only to household members.

**Decision.** Use Supabase Postgres with Row-Level Security (RLS) on all tables. Policies use `auth.uid()` and `household_members` membership to enforce isolation.

**Positive consequences:**
- Defense in depth: even if application code has a bug, Postgres rejects unauthorized queries.
- Single source of truth for access rules.
- Scales to any number of households with no application code changes.

**Negative consequences:**
- Complex queries crossing user/household boundaries become harder. Mitigation: `security definer` views for specific cross-boundary reads where both parties consent.
- Debug friction: a query that "should return data" returns empty because JWT lacks permission. Mitigation: log `auth.uid()` in development.

**Alternatives considered:**
1. **Application-level filtering only.** Rejected: any query or endpoint bug becomes a data leak. RLS is defense-in-depth.
2. **Separate DB per household.** Overkill; makes cross-household operations (admin, analytics) impossible without sync.

---

### ADR-005 — Import adapters isolated via Ports & Adapters (Hexagonal)

**Status:** Accepted
**Date:** 2026-05-26

**Context.** The import module must support multiple sources today (OFX, CSV, manual) and Open Finance in the future. The architectural choice directly impacts the ability to add new sources without touching business logic.

**Decision.** Apply Hexagonal Architecture strictly in the `importing` module. Domain defines `TransactionSource` port and `RawTransaction` DTO. Each format implements `TransactionSource` in a separate package. `ImportTransactionsUseCase` operates only on the port and DTO, with no knowledge of any concrete format.

**Positive consequences:**
- Adding Open Finance = create `packages/import-open-finance/`. Domain diff: zero.
- Each adapter is independently testable.
- `RawTransaction` is the single point of contract evolution — changes are deliberate and visible.
- Structural guarantee via package separation: `import-core` literally cannot import `ofx-js` (not in its `package.json`).

**Negative consequences:**
- More boilerplate upfront. Mitigation: acceptable given long-term value; boilerplate is trivial and localized.

**Revision criteria.** Reconsider if: adapters need to be loaded at runtime as third-party plugins — then the system becomes plugin-based rather than purely hexagonal.

---

### ADR-006 — Multi-tenant via Household aggregate from day one

**Status:** Accepted
**Date:** 2026-05-26

**Context.** Version 0.1 of the spec was designed for exactly two users (a couple). This created several hardcoded assumptions: `ONLY_LUCAS`/`ONLY_JULIA` split rules, `split_rule_lucas_percent` column, no `household_id` on shared tables, and an RLS policy allowing all users to read all expenses. These would cause catastrophic data leakage if more than one household used the platform.

**Decision.** Introduce `Household` as a first-class domain aggregate. Every shared table (`expenses`, `categories`, `category_memory`) carries a `household_id` foreign key. RLS policies for shared tables are based on `household_members` membership, not `true`. Split rules are renamed to be person-agnostic: `ONLY_PAYER`/`ONLY_OTHER` instead of `ONLY_LUCAS`/`ONLY_JULIA`. The `EQUAL` rule divides by `household_member_count`, not hardcoded to 2.

**Positive consequences:**
- Any number of households can coexist without data isolation issues.
- A user can belong to multiple households (personal + shared with roommates).
- Split rule semantics are generic and person-agnostic.
- Enables SaaS billing model (per-household plans).

**Negative consequences:**
- Slightly more complex queries (join to `household_members`). Mitigation: covered entirely by RLS policies — application code doesn't need to repeat the filter.
- Household creation and invite flow needed before core features can be tested. Mitigation: seed script creates a default household for local development.

**Alternatives considered:**
1. **Stay single-tenant and migrate later.** Rejected: adding `household_id` retroactively to a live database with real data is a painful migration. The cost of doing it now is a handful of extra columns and one extra table.
2. **Organization/workspace model (like Notion/Linear).** Functionally equivalent to Household. "Household" is more domain-appropriate for the use case.

**Revision criteria.** Reconsider if: the product pivots to a fundamentally different sharing model (e.g. each user is always their own isolated tenant with no shared expenses).

---

### Template for future ADRs

```markdown
### ADR-NNN — [Short title, imperative]

**Status:** Proposed | Accepted | Superseded by ADR-XXX | Deprecated
**Date:** YYYY-MM-DD

**Context.** [Why does this decision need to be made now?]

**Decision.** [What we decided, imperatively: "We will use X"]

**Positive consequences:**
- [Benefit 1]

**Negative consequences:**
- [Trade-off 1] Mitigation: [how we handle it]

**Alternatives considered:**
1. **[Alternative A].** [Why rejected]

**Revision criteria.** Reconsider if: [conditions that would invalidate this decision]
```

---

## 15. Appendices

### 15.1 Default category templates (global seed)

| Category           | Default split rule |
| ------------------ | ------------------ |
| Housing            | EQUAL              |
| Utilities          | EQUAL              |
| Groceries          | EQUAL              |
| Transport          | EQUAL              |
| Health             | EQUAL              |
| Education          | EQUAL              |
| Subscriptions      | (varies)           |
| Entertainment      | (individual)       |
| Clothing           | (individual)       |
| Dining out         | EQUAL              |
| Investments        | n/a (not expense)  |
| Refunds            | n/a                |
| Other              | (unset)             |

These are **templates** seeded globally. Each household can create custom sub-categories (e.g. `Education > Daycare`, `Health > Gym`).

The "Investments" template category is a historical leftover with zero expense
rows referencing it — real investments are tracked via the separate
Investments feature (`investments` table), not as a personal-expense
category. Categories no longer carry a budget classification at all
(`budget_bucket` was removed in migration 024, along with the `MAX_NEEDS`/
`MAX_WANTS` goal types it fed) — consider removing this template entirely if
it keeps causing confusion.