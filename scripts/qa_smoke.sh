#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://thegioitrimun.vn}"
BASE_URL="${BASE_URL%/}"

pass() {
  printf "[PASS] %s\n" "$1"
}

fail() {
  printf "[FAIL] %s\n" "$1" >&2
  exit 1
}

check_status() {
  local url="$1"
  local expected="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [[ "$code" != "$expected" ]]; then
    fail "HTTP $code for $url (expected $expected)"
  fi
  pass "HTTP $expected $url"
}

check_redirect_contains() {
  local url="$1"
  local expected_substring="$2"
  local status
  local location
  status=$(curl -s -o /dev/null -w "%{http_code}" -I "$url")
  location=$(curl -s -I "$url" | awk -F': ' 'BEGIN{IGNORECASE=1} /^location:/{print $2}' | tr -d '\r')
  if [[ "$status" != "301" && "$status" != "302" && "$status" != "308" ]]; then
    fail "No redirect for $url (status $status)"
  fi
  if [[ "$location" != *"$expected_substring"* ]]; then
    fail "Redirect location mismatch for $url (got: $location)"
  fi
  pass "Redirect $url -> $location"
}

check_contains() {
  local url="$1"
  local needle="$2"
  local body
  body=$(curl -s "$url")
  if ! grep -q "$needle" <<<"$body"; then
    fail "Missing '$needle' in $url"
  fi
  pass "Found '$needle' in $url"
}

echo "== Gate 1: Static checks =="
node --check _worker.js
pass "_worker.js syntax"

npm run lint >/dev/null
pass "npm run lint"

npm run build >/dev/null
pass "npm run build"

echo
echo "== Gate 1: SEO endpoints =="
check_status "$BASE_URL/sitemap.xml" "200"
check_status "$BASE_URL/rss.xml" "200"
check_status "$BASE_URL/robots.txt" "200"

echo
echo "== Gate 1: Core routes =="
check_status "$BASE_URL/" "200"
check_status "$BASE_URL/san-pham" "200"
check_status "$BASE_URL/kien-thuc" "200"
check_status "$BASE_URL/dich-vu" "200"
check_status "$BASE_URL/ve-chung-toi" "200"

echo
echo "== Gate 1: Redirect/canonical =="
check_redirect_contains "$BASE_URL/nha-thuoc" "/san-pham"
check_redirect_contains "$BASE_URL/dich-vu/1" "/dich-vu/"

echo
echo "== Gate 1: SEO detail prerender =="
node scripts/qa_seo_detail_bot.mjs "$BASE_URL"

echo
echo "== Gate 1: Meta sanity =="
check_contains "$BASE_URL/" "<title>"
check_contains "$BASE_URL/" "canonical"
check_contains "$BASE_URL/san-pham" "canonical"
check_contains "$BASE_URL/kien-thuc" "canonical"
check_contains "$BASE_URL/dich-vu" "canonical"

echo
echo "== DONE =="
echo "Smoke test passed for $BASE_URL"
