# AUTH AUDIT 2026-03-15

## Scope

- Frontend auth flow (`login`, `register`, `forgot password`, recovery callback)
- Supabase Auth config on project `vjowphilfeoqesvcfqnb`
- Auth/profile consistency between `auth.users` and `public.patients`
- Public data exposure through `public.patients` RLS

## Verified Remote Config

- `site_url`: `https://thegioitrimun.vn`
- `disable_signup`: `false`
- `mailer_autoconfirm`: `true`
- Google provider: `enabled`
- Google authorize redirect currently resolves to:
  - `https://vjowphilfeoqesvcfqnb.supabase.co/auth/v1/callback`

## Findings Fixed

1. Legacy auth rows were incomplete.
   - `auth.users.instance_id` was `NULL` for older migrated accounts.
   - Some older rows also had `NULL` values in GoTrue token fields.
   - Result: Auth Admin API could not load/list those users reliably.

2. `public.patients` was missing rows for many existing `auth.users`.
   - App loads profile from `patients`, so affected users could authenticate but fail when app fetched profile data.

3. Public privacy leak existed on `public.patients`.
   - Anonymous clients could read `email`, `phone`, `dob` of doctor/admin rows through REST.

4. Frontend forgot-password flow was incomplete.
   - App could send reset email, but had no UI to finish password update after recovery redirect.

## Changes Applied

### Remote data fixes

- Backfilled missing `public.patients` rows from `auth.users`
- Normalized legacy `auth.users.instance_id`
- Normalized legacy GoTrue token fields
- Normalized problematic legacy `phone` values so Auth Admin API can load old rows again

### Repo changes

- Added migration:
  - `supabase/migrations/20260315164000_auth_hardening_public_profile_views.sql`
  - `supabase/migrations/20260315171000_auth_normalize_gotrue_legacy_fields.sql`
- Added public-safe views:
  - `public_doctors_directory`
  - `public_blog_posts`
  - `public_product_reviews`
- Removed broad public SELECT policy on `public.patients`
- Frontend now reads public doctor/blog/review author data from public-safe views, with fallback logic
- Added reset password UI and recovery handling in SPA auth flow

## Runtime Checks Performed

- Email/password signup: PASS
- Email/password login: PASS
- New signup creates matching `public.patients` row: PASS
- Normal user can read own `patients` row: PASS
- Normal user cannot read another user's `patients` row: PASS
- Anonymous user cannot read doctor/admin private fields from `patients`: PASS
- Public-safe blog view returns author name/avatar fields: PASS
- Google authorize endpoint returns correct new project callback: PASS
- Production smoke after deploy: PASS

## Residual Notes

- The interactive Google sign-in screen itself was not completed in-browser during this audit.
- Password reset email delivery was not mailbox-verified end-to-end in this audit, but the frontend recovery completion path is now implemented.
