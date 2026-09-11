# Admin PWA order notifications

Only `/admin` imports the notification UI. Permission and subscriptions are offered in the installed standalone admin app, for `admin` / `master_admin` users. The customer application does not register a service worker or request permission. `/admin/sw.js` is scoped to `/admin/` and has no fetch/cache handler.

On iPhone, add `https://thegioitrimun.vn/admin/` to the Home Screen, open TGTM Admin, sign in and tap **Bật thông báo đơn hàng**, then allow notifications. iOS 16.4+ is required. Lock Screen, Badges and Focus settings still control OS presentation. A real iPhone must verify delivery while the app is closed and the phone is locked.

New orders show a notification containing the order code, without customer details. Tapping opens the admin order. The icon number counts new orders since the first subscription that have not been marked read. **Đánh dấu đã đọc** acknowledges the displayed cursor for the current administrator; concurrent later orders remain unread. Other devices refresh their count on the next push/open (no silent push, which iOS forbids).

## Deployment

1. Verify Cloudflare authentication with `npx wrangler whoami`.
2. Apply only the additive migration:
   `D1_WRANGLER_CONFIG=wrangler.d1.production.jsonc D1_MIGRATION_TARGET=app D1_MIGRATION_ONLY=0022_admin_web_push node scripts/d1_apply_migrations.mjs --remote`
3. Provision the key pair once: `node scripts/setup_admin_push_vapid.mjs --apply`. This preserves existing keys and never prints/writes the private key. Do not rotate VAPID keys without a device re-subscription plan.
4. Run `node --test tests/admin-web-push.test.mjs`, then `npm run deploy:d1:production`.

An atomic D1 trigger records future inserted orders, including POS and integrations, and per-device deliveries. Existing orders and historical imports older than one day do not alert. Checkout and admin order creation dispatch in `waitUntil`; the existing two-minute cron covers retries and integration-created orders. Delivery is at least once, with atomic leases and stable notification tags to coalesce retries. There is no guarantee of an exact delivery time from iOS/push providers.

Every API requires an active admin session; writes additionally require CSRF. Each device subscription is bound to its login session. Delivery re-checks session expiry/revocation, user status and admin role. HTTP 404/410 disables the subscription; transient errors retry with backoff up to eight attempts, with a 24-hour delivery lifetime. Logout unsubscribes locally and revokes the server session. A newly enabled device receives future events only.

Operational counts can be inspected without exposing endpoints or encryption keys:

```sql
SELECT status, COUNT(*) AS count FROM admin_push_deliveries GROUP BY status;
SELECT COUNT(*) AS active_devices FROM admin_push_subscriptions WHERE active = 1;
```

Local tests decrypt payloads independently, exercise the actual SQLite trigger/routes and delivery retries, validate access control and confirm the service worker always shows a visible notification. Browser mocks verify UI behavior but cannot prove APNs/iPhone delivery.
