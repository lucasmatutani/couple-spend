-- Migration 023: Custom AI categorization hint for household categories
--
-- Global template categories already have a hardcoded hint in
-- packages/import-pdf/src/prompt.ts (CATEGORY_HINTS). Custom household
-- categories have no entry there, so the PDF categorization prompt falls
-- back to the raw category name — a weak signal for the LLM. This column
-- lets the household owner supply their own hint (merchant names, keywords)
-- when creating a custom category.

alter table public.categories
  add column keywords_hint text;
