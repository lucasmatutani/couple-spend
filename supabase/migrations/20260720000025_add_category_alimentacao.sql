-- Migration 025: Add "Alimentação" global template category

insert into public.categories (household_id, parent_id, name, default_split_rule, is_template) values
  (null, null, 'Alimentação', 'EQUAL', true);
