#!/usr/bin/env bash
set -uo pipefail

BASE_URL="${1:-https://thegioitrimun.vn}"
BASE_URL="${BASE_URL%/}"
PROJECT_NAME="${CLOUDFLARE_PAGES_PROJECT:-website-thegioitrimun}"
REPORT_DATE="$(date +%F)"
REPORT_FILE="PHASE5_RELEASE_REPORT_${REPORT_DATE}.md"
TMP_DIR=".tmp-phase5"
RUNTIME_JSON="${TMP_DIR}/runtime_matrix.json"
RUNTIME_LOG="${TMP_DIR}/runtime_matrix.log"
DEPLOY_LOG="${TMP_DIR}/deployments.log"
latest_production_id=""
latest_production_source=""
latest_production_url=""

mkdir -p "$TMP_DIR"

print_step() {
  printf "\n== %s ==\n" "$1"
}

status_lint="FAIL"
status_build="FAIL"
status_smoke="FAIL"
status_runtime="SKIP"
runtime_summary="Runtime matrix skipped (missing SUPABASE_ACCESS_TOKEN)."

print_step "Phase 5 - Technical Gates"
if npm run lint >/dev/null 2>&1; then
  status_lint="PASS"
  echo "[PASS] npm run lint"
else
  echo "[FAIL] npm run lint"
fi

if npm run build >/dev/null 2>&1; then
  status_build="PASS"
  echo "[PASS] npm run build"
else
  echo "[FAIL] npm run build"
fi

if npm run qa:smoke "$BASE_URL" >/dev/null 2>&1; then
  status_smoke="PASS"
  echo "[PASS] npm run qa:smoke $BASE_URL"
else
  echo "[FAIL] npm run qa:smoke $BASE_URL"
fi

print_step "Phase 5 - Runtime Matrix"
if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  export PHASE5_RUNTIME_OUT="$RUNTIME_JSON"
  if node scripts/phase5_runtime_matrix.mjs >"$RUNTIME_LOG" 2>&1; then
    status_runtime="PASS"
    runtime_summary="Runtime matrix passed."
    echo "[PASS] Runtime matrix"
  else
    status_runtime="FAIL"
    runtime_summary="Runtime matrix failed."
    echo "[FAIL] Runtime matrix"
  fi
else
  echo "[SKIP] Runtime matrix (missing SUPABASE_ACCESS_TOKEN)"
fi

print_step "Phase 5 - Deployment Snapshot"
if npx wrangler pages deployment list --project-name "$PROJECT_NAME" >"$DEPLOY_LOG" 2>&1; then
  latest_production_line="$(grep -m1 "│ .*Production .*│" "$DEPLOY_LOG" || true)"
  if [[ -n "$latest_production_line" ]]; then
    latest_production_id="$(echo "$latest_production_line" | cut -d'│' -f2 | sed 's/^ *//;s/ *$//')"
    latest_production_source="$(echo "$latest_production_line" | cut -d'│' -f5 | sed 's/^ *//;s/ *$//')"
    latest_production_url="$(echo "$latest_production_line" | cut -d'│' -f6 | sed 's/^ *//;s/ *$//')"
  fi
  echo "[PASS] Pulled deployment list for $PROJECT_NAME"
else
  latest_production_id=""
  latest_production_source=""
  latest_production_url=""
  echo "[WARN] Could not pull deployment list"
fi

all_auto_pass="NO"
if [[ "$status_lint" == "PASS" && "$status_build" == "PASS" && "$status_smoke" == "PASS" && "$status_runtime" != "FAIL" ]]; then
  all_auto_pass="YES"
fi

runtime_details_md=""
if [[ -f "$RUNTIME_JSON" ]]; then
  runtime_details_md="$(node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const lines=(p.checks||[]).map(c=>'- ['+(c.passed?'x':' ')+'] '+c.check+' — '+(c.details||'')); console.log(lines.join('\\n'));" "$RUNTIME_JSON")"
fi

cat > "$REPORT_FILE" <<REPORT
# PHASE 5 RELEASE REPORT

Date: ${REPORT_DATE}
Base URL: ${BASE_URL}
Project: ${PROJECT_NAME}

## A. Automated Gates

- [${status_lint/PASS/x}] npm run lint
- [${status_build/PASS/x}] npm run build
- [${status_smoke/PASS/x}] npm run qa:smoke
- [${status_runtime/PASS/x}] Runtime matrix (COD/Bank, discount yes/no, GHTK/manual, cancel/refund/restock)

Runtime summary: ${runtime_summary}

## B. Runtime Matrix Details

${runtime_details_md:-_No runtime details available._}

## C. Manual Gates Pending (Gate 2/3)

- [ ] Auth: login/logout
- [ ] User profile update
- [ ] Booking create flow
- [ ] Checkout real order create on production UI
- [ ] Admin: Product/Service/Blog CRUD quick sanity
- [ ] Customer Order History UI: timeline + invoice PDF save-as

## D. Deployment Snapshot

- Latest production deployment id: ${latest_production_id:-N/A}
- Latest production source commit: ${latest_production_source:-N/A}
- Latest production URL: ${latest_production_url:-N/A}
- Full deployment list captured: ${DEPLOY_LOG}

## E. Go/No-Go

- Automated gates all pass: **${all_auto_pass}**
- Final decision: **NO-GO until manual gates complete**
REPORT

printf "\nReport written: %s\n" "$REPORT_FILE"

if [[ "$status_lint" != "PASS" || "$status_build" != "PASS" || "$status_smoke" != "PASS" || "$status_runtime" == "FAIL" ]]; then
  exit 1
fi
