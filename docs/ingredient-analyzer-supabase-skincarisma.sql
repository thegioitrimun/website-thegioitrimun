-- Run this SQL in the separate Supabase Skincarisma project, not in the main
-- thegioitrimun.vn database. It creates a compact lookup table so the Worker
-- can match INCI names, Vietnamese names, and aliases without downloading the
-- full ingredients table.

begin;

create table if not exists public.ingredient_search_terms (
    term_norm text primary key,
    ingredient_id text not null references public.ingredients(id) on delete cascade,
    source text not null default 'alias'
);

create index if not exists ingredient_search_terms_ingredient_id_idx
    on public.ingredient_search_terms (ingredient_id);

truncate table public.ingredient_search_terms;

with terms as (
    select
        id as ingredient_id,
        'id' as source,
        id as raw_term
    from public.ingredients
    union all
    select
        id as ingredient_id,
        'inci_name' as source,
        inci_name as raw_term
    from public.ingredients
    where inci_name is not null
    union all
    select
        id as ingredient_id,
        'vi_name' as source,
        vi_name as raw_term
    from public.ingredients
    where vi_name is not null
    union all
    select
        ingredients.id as ingredient_id,
        'alias' as source,
        alias.value as raw_term
    from public.ingredients
    cross join lateral jsonb_array_elements_text(coalesce(ingredients.aliases, '[]'::jsonb)) as alias(value)
    where length(trim(alias.value)) between 2 and 80
),
normalized as (
    select distinct on (term_norm)
        lower(trim(regexp_replace(regexp_replace(raw_term, '[®™©]', '', 'g'), '[^a-zA-Z0-9]+', ' ', 'g'))) as term_norm,
        ingredient_id,
        source
    from terms
    where raw_term is not null and trim(raw_term) <> ''
    order by term_norm, case source when 'id' then 1 when 'inci_name' then 2 when 'vi_name' then 3 else 4 end
)
insert into public.ingredient_search_terms (term_norm, ingredient_id, source)
select term_norm, ingredient_id, source
from normalized
where term_norm <> '';

grant select on public.ingredient_search_terms to anon, authenticated;
grant select, insert, update, delete on public.ingredient_search_terms to service_role;

alter table public.ingredient_search_terms enable row level security;

drop policy if exists "Public read ingredient search terms" on public.ingredient_search_terms;
create policy "Public read ingredient search terms"
    on public.ingredient_search_terms
    for select
    to anon, authenticated
    using (true);

commit;
