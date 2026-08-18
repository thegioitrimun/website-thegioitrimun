alter table public.footer_content
    add column if not exists zalo_url text,
    add column if not exists messenger_url text,
    add column if not exists floating_contact_enabled boolean not null default true;

comment on column public.footer_content.zalo_url is 'Zalo chat URL used by the floating contact button.';
comment on column public.footer_content.messenger_url is 'Messenger chat URL used by the floating contact button.';
comment on column public.footer_content.floating_contact_enabled is 'Controls whether public floating contact buttons are shown.';
