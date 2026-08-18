#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_ROOT="$ROOT_DIR/output/backups"
TIMESTAMP="$(date '+%Y%m%d-%H%M%S')"
PROJECT_NAME_RAW="$(basename "$ROOT_DIR")"
PROJECT_NAME_SAFE="$(printf '%s' "$PROJECT_NAME_RAW" | LC_ALL=C tr -cs 'A-Za-z0-9._-' '-')"
BACKUP_BASENAME="${PROJECT_NAME_SAFE}full-system-backup-${TIMESTAMP}"
STAGING_DIR="$BACKUP_ROOT/$BACKUP_BASENAME"
ARCHIVE_PATH="$BACKUP_ROOT/${BACKUP_BASENAME}.tar.gz"
WORKSPACE_ARCHIVE_PATH="$STAGING_DIR/workspace.tar.gz"
LOCAL_DB_SNAPSHOTS_DIR="$STAGING_DIR/database/local-snapshots"
REMOTE_DB_DIR="$STAGING_DIR/database/remote-dump"
METADATA_DIR="$STAGING_DIR/metadata"
LOGS_DIR="$STAGING_DIR/logs"
PROJECT_REF=""
LIVE_DUMP_SCHEMA_STATUS="not-attempted"
LIVE_DUMP_DATA_STATUS="not-attempted"
LIVE_DUMP_ROLES_STATUS="not-attempted"
LIVE_DUMP_NOTES=""
REMOTE_DB_PASSWORD="${SUPABASE_DB_PASSWORD:-${DB_PASSWORD:-}}"
REMOTE_DB_URL="${SUPABASE_DB_URL:-}"
INCLUDE_REMOTE_DB_DUMP="${INCLUDE_REMOTE_DB_DUMP:-0}"

mkdir -p "$BACKUP_ROOT" "$STAGING_DIR" "$LOCAL_DB_SNAPSHOTS_DIR" "$REMOTE_DB_DIR" "$METADATA_DIR" "$LOGS_DIR"

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

if [[ -n "${SUPABASE_PROJECT_REF:-}" ]]; then
  PROJECT_REF="$SUPABASE_PROJECT_REF"
elif [[ -f "$ROOT_DIR/supabase/.temp/project-ref" ]]; then
  PROJECT_REF="$(cat "$ROOT_DIR/supabase/.temp/project-ref")"
fi

run_with_timeout() {
  local timeout_seconds="$1"
  shift
  local log_file="$1"
  shift

  : >"$log_file"
  (
    "$@"
  ) >"$log_file" 2>&1 &
  local cmd_pid=$!
  local elapsed=0

  while kill -0 "$cmd_pid" 2>/dev/null; do
    if (( elapsed >= timeout_seconds )); then
      {
        printf 'Timed out after %ss\n' "$timeout_seconds"
      } >>"$log_file"
      kill "$cmd_pid" 2>/dev/null || true
      sleep 1
      kill -9 "$cmd_pid" 2>/dev/null || true
      wait "$cmd_pid" 2>/dev/null || true
      return 124
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  wait "$cmd_pid"
}

copy_if_exists() {
  local source_path="$1"
  local destination_dir="$2"
  if [[ -e "$source_path" ]]; then
    cp -R "$source_path" "$destination_dir/"
  fi
}

attempt_supabase_live_dump() {
  if ! command -v supabase >/dev/null 2>&1; then
    LIVE_DUMP_NOTES="supabase-cli-not-installed"
    return 0
  fi

  if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    LIVE_DUMP_NOTES="missing-SUPABASE_ACCESS_TOKEN"
    return 0
  fi

  if [[ -z "$PROJECT_REF" ]]; then
    LIVE_DUMP_NOTES="missing-project-ref"
    return 0
  fi

  if [[ -n "$REMOTE_DB_URL" ]]; then
    local schema_log="$LOGS_DIR/supabase-db-schema.log"
    if run_with_timeout 240 "$schema_log" supabase db dump --db-url "$REMOTE_DB_URL" --file "$REMOTE_DB_DIR/remote-schema.sql"; then
      LIVE_DUMP_SCHEMA_STATUS="ok"
    else
      LIVE_DUMP_SCHEMA_STATUS="failed-or-timeout"
    fi

    local data_log="$LOGS_DIR/supabase-db-data.log"
    if run_with_timeout 360 "$data_log" supabase db dump --db-url "$REMOTE_DB_URL" --data-only --use-copy --file "$REMOTE_DB_DIR/remote-data.sql"; then
      LIVE_DUMP_DATA_STATUS="ok"
    else
      LIVE_DUMP_DATA_STATUS="failed-or-timeout"
    fi

    local roles_log="$LOGS_DIR/supabase-db-roles.log"
    if run_with_timeout 180 "$roles_log" supabase db dump --db-url "$REMOTE_DB_URL" --role-only --file "$REMOTE_DB_DIR/remote-roles.sql"; then
      LIVE_DUMP_ROLES_STATUS="ok"
    else
      LIVE_DUMP_ROLES_STATUS="failed-or-timeout"
    fi

    if [[ "$LIVE_DUMP_SCHEMA_STATUS" != "ok" || "$LIVE_DUMP_DATA_STATUS" != "ok" || "$LIVE_DUMP_ROLES_STATUS" != "ok" ]]; then
      LIVE_DUMP_NOTES="remote-dump-partial-or-unavailable-via-db-url"
    else
      LIVE_DUMP_NOTES="remote-dump-complete-via-db-url"
    fi
    return 0
  fi

  if [[ -z "$REMOTE_DB_PASSWORD" ]]; then
    LIVE_DUMP_NOTES="missing-db-password-or-db-url"
    return 0
  fi

  local temp_workdir
  temp_workdir="$(mktemp -d)"
  mkdir -p "$temp_workdir/supabase"
  printf 'project_id = "backup-temp"\n' >"$temp_workdir/supabase/config.toml"

  local link_log="$LOGS_DIR/supabase-link.log"
  if ! run_with_timeout 60 "$link_log" supabase link --workdir "$temp_workdir" --project-ref "$PROJECT_REF" --password "$REMOTE_DB_PASSWORD"; then
    LIVE_DUMP_NOTES="supabase-link-failed-or-timeout"
    rm -rf "$temp_workdir"
    return 0
  fi

  local schema_log="$LOGS_DIR/supabase-db-schema.log"
  if run_with_timeout 240 "$schema_log" supabase db dump --workdir "$temp_workdir" --linked --password "$REMOTE_DB_PASSWORD" --file "$REMOTE_DB_DIR/remote-schema.sql"; then
    LIVE_DUMP_SCHEMA_STATUS="ok"
  else
    LIVE_DUMP_SCHEMA_STATUS="failed-or-timeout"
  fi

  local data_log="$LOGS_DIR/supabase-db-data.log"
  if run_with_timeout 360 "$data_log" supabase db dump --workdir "$temp_workdir" --linked --password "$REMOTE_DB_PASSWORD" --data-only --use-copy --file "$REMOTE_DB_DIR/remote-data.sql"; then
    LIVE_DUMP_DATA_STATUS="ok"
  else
    LIVE_DUMP_DATA_STATUS="failed-or-timeout"
  fi

  local roles_log="$LOGS_DIR/supabase-db-roles.log"
  if run_with_timeout 180 "$roles_log" supabase db dump --workdir "$temp_workdir" --linked --password "$REMOTE_DB_PASSWORD" --role-only --file "$REMOTE_DB_DIR/remote-roles.sql"; then
    LIVE_DUMP_ROLES_STATUS="ok"
  else
    LIVE_DUMP_ROLES_STATUS="failed-or-timeout"
  fi

  if [[ "$LIVE_DUMP_SCHEMA_STATUS" != "ok" || "$LIVE_DUMP_DATA_STATUS" != "ok" || "$LIVE_DUMP_ROLES_STATUS" != "ok" ]]; then
    LIVE_DUMP_NOTES="remote-dump-partial-or-unavailable-via-linked-password"
  else
    LIVE_DUMP_NOTES="remote-dump-complete-via-linked-password"
  fi

  rm -rf "$temp_workdir"
}

printf 'Creating workspace archive...\n'
tar -czf "$WORKSPACE_ARCHIVE_PATH" \
  --exclude='./node_modules' \
  --exclude='./dist' \
  --exclude='./.playwright-cli' \
  --exclude='./output' \
  --exclude='./.wrangler' \
  --exclude='./supabase/.temp' \
  --exclude='./.env' \
  --exclude='./.env.*' \
  --exclude='./.dev.vars' \
  --exclude='./.dev.vars.*' \
  --exclude='./*.pem' \
  --exclude='./*.key' \
  --exclude='./*.p12' \
  --exclude='./.DS_Store' \
  -C "$ROOT_DIR" .

printf 'Copying local database snapshot artifacts...\n'
copy_if_exists "$ROOT_DIR/dbdump.txt" "$LOCAL_DB_SNAPSHOTS_DIR"
copy_if_exists "$ROOT_DIR/schema.txt" "$LOCAL_DB_SNAPSHOTS_DIR"
copy_if_exists "$ROOT_DIR/schema_mockData_Pharmacy.txt" "$LOCAL_DB_SNAPSHOTS_DIR"
copy_if_exists "$ROOT_DIR/schema_storage_bucket.txt" "$LOCAL_DB_SNAPSHOTS_DIR"
copy_if_exists "$ROOT_DIR/update_trigger.sql" "$LOCAL_DB_SNAPSHOTS_DIR"
copy_if_exists "$ROOT_DIR/supabase/migrations" "$LOCAL_DB_SNAPSHOTS_DIR"
copy_if_exists "$ROOT_DIR/supabase/functions" "$LOCAL_DB_SNAPSHOTS_DIR"
copy_if_exists "$ROOT_DIR/supabase/config.toml" "$LOCAL_DB_SNAPSHOTS_DIR"

if [[ "$INCLUDE_REMOTE_DB_DUMP" == "1" ]]; then
  printf 'Attempting opt-in remote Supabase database dump...\n'
  attempt_supabase_live_dump
else
  LIVE_DUMP_NOTES="skipped-by-default-set-INCLUDE_REMOTE_DB_DUMP-1-to-enable"
fi

{
  printf 'backup_created_at=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  printf 'project_name=%s\n' "$PROJECT_NAME_RAW"
  printf 'project_root=%s\n' "$ROOT_DIR"
  printf 'backup_archive=%s\n' "$ARCHIVE_PATH"
  printf 'workspace_archive=workspace.tar.gz\n'
  printf 'git_branch=%s\n' "$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || printf 'unknown')"
  printf 'git_commit=%s\n' "$(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null || printf 'unknown')"
  printf 'git_dirty=%s\n' "$(if [[ -n "$(git -C "$ROOT_DIR" status --porcelain 2>/dev/null)" ]]; then printf 'yes'; else printf 'no'; fi)"
  printf 'supabase_project_ref=%s\n' "${PROJECT_REF:-unknown}"
  printf 'remote_dump_credential_mode=%s\n' "$(if [[ -n "$REMOTE_DB_URL" ]]; then printf 'db-url'; elif [[ -n "$REMOTE_DB_PASSWORD" ]]; then printf 'db-password'; else printf 'missing'; fi)"
  printf 'included_env_file=%s\n' 'no'
  printf 'included_secret_files=%s\n' 'no'
  printf 'remote_schema_dump=%s\n' "$LIVE_DUMP_SCHEMA_STATUS"
  printf 'remote_data_dump=%s\n' "$LIVE_DUMP_DATA_STATUS"
  printf 'remote_roles_dump=%s\n' "$LIVE_DUMP_ROLES_STATUS"
  printf 'remote_dump_notes=%s\n' "${LIVE_DUMP_NOTES:-none}"
  printf 'includes_frontend=%s\n' 'yes'
  printf 'includes_worker=%s\n' 'yes'
  printf 'includes_supabase_folder=%s\n' 'yes'
  printf 'includes_backend_edge_functions=%s\n' 'yes'
  printf 'includes_local_db_snapshots=%s\n' 'yes'
} >"$METADATA_DIR/backup-manifest.txt"

{
  printf 'This backup bundle contains:\n'
  printf '%s\n' '- workspace.tar.gz: source workspace without env files, Wrangler cache, dependencies, build output, keys, or local output'
  printf '%s\n' '- database/local-snapshots: repo database artifacts, migrations, functions, and Supabase config'
  printf '%s\n' '- database/remote-dump: remote live dump files only when INCLUDE_REMOTE_DB_DUMP=1 is explicitly set'
  printf '%s\n' '- logs: Supabase live dump logs'
  printf '%s\n' '- metadata/backup-manifest.txt: backup status and scope summary'
  printf '\n'
  printf 'Secret files are intentionally excluded. Keep this archive private because application data may still be sensitive.\n'
} >"$METADATA_DIR/README.txt"

printf 'Packing final backup archive...\n'
tar -czf "$ARCHIVE_PATH" -C "$BACKUP_ROOT" "$BACKUP_BASENAME"
chmod 600 "$ARCHIVE_PATH"
rm -rf "$STAGING_DIR"

printf 'Backup created: %s\n' "$ARCHIVE_PATH"
