#!/usr/bin/env bash
set -euo pipefail

echo "== Site Regression: static checks =="
npm run lint
npm run build

echo
echo "== Site Regression: live smoke =="
npm run qa:smoke

echo
echo "== Site Regression: SEO =="
npm run qa:seo:ci

if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo
  echo "== Site Regression: blog content integrity =="
  npm run qa:blog-content

  echo
  echo "== Site Regression: SEO content quality =="
  npm run qa:seo-content

  echo
  echo "== Site Regression: dashboard data audit =="
  npm run qa:admin-dashboard
else
  echo
  echo "[skip] SUPABASE_ACCESS_TOKEN is missing; skipping blog-content, seo-content, and dashboard data audits."
fi

echo
echo "== Site Regression: public critical-path E2E =="
npm run qa:site-critical:e2e

echo
echo "== Site Regression: public journey E2E =="
npm run qa:public-regression:e2e

if [[ -n "${E2E_ADMIN_EMAIL:-}" && -n "${E2E_ADMIN_PASSWORD:-}" ]]; then
  echo
  echo "== Site Regression: admin dashboard E2E =="
  npm run qa:admin-dashboard:e2e
else
  echo
  echo "[skip] E2E_ADMIN_EMAIL or E2E_ADMIN_PASSWORD is missing; skipping admin dashboard E2E."
fi
