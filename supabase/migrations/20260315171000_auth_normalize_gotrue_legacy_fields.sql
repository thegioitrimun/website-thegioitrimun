-- Normalize legacy GoTrue rows so Auth Admin API can load migrated users reliably.
-- Some imported rows kept NULL values in token fields and phone, which causes
-- Admin API "Database error loading/finding users" on the new project.

UPDATE auth.users
SET confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change = COALESCE(email_change, ''),
    reauthentication_token = COALESCE(reauthentication_token, '')
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change_token_new IS NULL
   OR email_change IS NULL
   OR reauthentication_token IS NULL;

UPDATE auth.users
SET phone = 'legacy-' || REPLACE(id::text, '-', '')
WHERE phone IS NULL;
