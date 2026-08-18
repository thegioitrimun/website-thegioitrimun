#!/usr/bin/env bash
set -euo pipefail

APP_DB_NAME="${APP_D1_DATABASE_NAME:-thegioitrimun-app}"
INCI_DB_NAME="${INCI_D1_DATABASE_NAME:-thegioitrimun-inci-runtime}"
NOTIFICATION_QUEUE_NAME="${NOTIFICATION_QUEUE_NAME:-thegioitrimun-notifications}"
SHIPPING_QUEUE_NAME="${SHIPPING_QUEUE_NAME:-thegioitrimun-shipping}"
PANCAKE_QUEUE_NAME="${PANCAKE_QUEUE_NAME:-thegioitrimun-pancake}"
NOTIFICATION_DLQ_NAME="${NOTIFICATION_DLQ_NAME:-thegioitrimun-notifications-dlq}"
SHIPPING_DLQ_NAME="${SHIPPING_DLQ_NAME:-thegioitrimun-shipping-dlq}"
PANCAKE_DLQ_NAME="${PANCAKE_DLQ_NAME:-thegioitrimun-pancake-dlq}"
PRIVATE_RECORDS_BUCKET_NAME="${PRIVATE_RECORDS_BUCKET_NAME:-thegioitrimun-private-records}"

npx wrangler d1 create "$APP_DB_NAME"
npx wrangler d1 create "$INCI_DB_NAME"
npx wrangler queues create "$NOTIFICATION_QUEUE_NAME"
npx wrangler queues create "$SHIPPING_QUEUE_NAME"
npx wrangler queues create "$PANCAKE_QUEUE_NAME"
npx wrangler queues create "$NOTIFICATION_DLQ_NAME"
npx wrangler queues create "$SHIPPING_DLQ_NAME"
npx wrangler queues create "$PANCAKE_DLQ_NAME"
npx wrangler r2 bucket create "$PRIVATE_RECORDS_BUCKET_NAME"

printf '\nCopy the returned D1 database IDs into a staging Wrangler config only after capacity validation.\n'
