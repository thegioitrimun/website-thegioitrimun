alter table public.products
add column if not exists faq_items jsonb not null default '[]'::jsonb;

alter table public.services
add column if not exists faq_items jsonb not null default '[]'::jsonb;

comment on column public.products.faq_items is 'Structured FAQ managed in admin for product detail page and SEO FAQ schema.';
comment on column public.services.faq_items is 'Structured FAQ managed in admin for service detail page and SEO FAQ schema.';
