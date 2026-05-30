-- Migration 015: Translate global template category names to Portuguese
update public.categories set name = 'Moradia'       where name = 'Housing'       and household_id is null;
update public.categories set name = 'Serviços'      where name = 'Utilities'     and household_id is null;
update public.categories set name = 'Mercado'       where name = 'Groceries'     and household_id is null;
update public.categories set name = 'Transporte'    where name = 'Transport'     and household_id is null;
update public.categories set name = 'Saúde'         where name = 'Health'        and household_id is null;
update public.categories set name = 'Educação'      where name = 'Education'     and household_id is null;
update public.categories set name = 'Assinaturas'   where name = 'Subscriptions' and household_id is null;
update public.categories set name = 'Lazer'         where name = 'Entertainment' and household_id is null;
update public.categories set name = 'Roupas'        where name = 'Clothing'      and household_id is null;
update public.categories set name = 'Restaurantes'  where name = 'Dining out'    and household_id is null;
update public.categories set name = 'Investimentos' where name = 'Investments'   and household_id is null;
update public.categories set name = 'Reembolsos'    where name = 'Refunds'       and household_id is null;
update public.categories set name = 'Outros'        where name = 'Other'         and household_id is null;
