#!/usr/bin/env bash
set -euo pipefail

echo "== Admin Regression: static checks =="
npm run lint
npm run build

echo
echo "== Admin Regression: live smoke =="
npm run qa:smoke

if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo
  echo "== Admin Regression: dashboard data audit =="
  npm run qa:admin-dashboard
else
  echo
  echo "[skip] SUPABASE_ACCESS_TOKEN is missing; skipping dashboard data audit."
fi

if [[ -n "${E2E_ADMIN_EMAIL:-}" && -n "${E2E_ADMIN_PASSWORD:-}" ]]; then
  echo
  echo "== Admin Regression: UI runtime audit =="
  npm run qa:admin-ui

  echo
  echo "== Admin Regression: navigation e2e =="
  npm run qa:admin-navigation:e2e

  echo
  echo "== Admin Regression: dashboard e2e =="
  npm run qa:admin-dashboard:e2e

  echo
  echo "== Admin Regression: business flows =="
  npm run qa:admin-business:e2e
else
  echo
  echo "[skip] E2E_ADMIN_EMAIL or E2E_ADMIN_PASSWORD is missing; skipping dashboard E2E."
fi
