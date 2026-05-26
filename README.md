# Splitwise

A SaaS platform for shared expense splitting and personal finance tracking.

[![CI](https://github.com/lucasmatutani/couple-spend/actions/workflows/ci.yml/badge.svg)](https://github.com/lucasmatutani/couple-spend/actions/workflows/ci.yml)

## Local setup

### Prerequisites

- Node.js ≥ 18.18.0
- pnpm ≥ 9.0.0
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Docker (for Supabase local)

### Getting started

```bash
# Install dependencies
pnpm install

# Copy env file and fill in values (Supabase start prints the keys)
cp .env.example apps/web/.env.local

# Start Supabase local (requires Docker)
pnpm supabase start
# Studio → http://localhost:54323

# Run migrations and seed
pnpm supabase db reset

# Generate TypeScript types from DB schema
pnpm gen:types

# Start the dev server
pnpm dev
# App → http://localhost:3000
```

### Common commands

```bash
pnpm typecheck          # Type-check all packages
pnpm test               # Run all unit tests
pnpm lint               # Lint all packages
pnpm build              # Build all packages

# Scoped commands
pnpm --filter @splitwise/web dev
pnpm --filter @splitwise/domain test
```

## Project structure

```
apps/
  web/              # Next.js 15 App Router (@splitwise/web)
packages/
  domain/           # Entities, use cases, ports — zero I/O deps (@splitwise/domain)
  shared/           # Types, Zod schemas, utils (@splitwise/shared)
  import-core/      # ImportTransactionsUseCase, ports (@splitwise/import-core)
  import-ofx/       # OFX file adapter (@splitwise/import-ofx)
  import-csv/       # CSV file adapter (@splitwise/import-csv)
  categorization/   # CategoryResolver chain (@splitwise/categorization)
infra/
  supabase/         # Migrations, seed, config
scripts/            # Admin scripts (service role key allowed here)
```

See [SPEC.md](./SPEC.md) for full architecture and ADRs.
