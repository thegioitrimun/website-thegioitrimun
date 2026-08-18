#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_TARGET_PROJECT_REF = 'ykcrngqhyinczmvwduox';
const DEFAULT_BACKUP_DIR = process.env.BACKUP_DIR || '';
const TARGET_PROJECT_REF = process.env.TARGET_PROJECT_REF || process.env.SUPABASE_PROJECT_REF || DEFAULT_TARGET_PROJECT_REF;
const APPLY_SCHEMA = process.env.RESTORE_SCHEMA !== 'false';
const APPLY_DATA = process.env.RESTORE_DATA !== 'false';
const APPLY_POST_MIGRATIONS = process.env.APPLY_POST_MIGRATIONS !== 'false';
const MAX_JSON_CHUNK_CHARS = Number(process.env.RESTORE_MAX_JSON_CHUNK_CHARS || 350_000);

const PUBLIC_COPY_SCHEMA_ALLOWLIST = new Set(['public']);
const AUTH_TABLE_ALLOWLIST = new Set(['users', 'identities']);
const STORAGE_TABLE_ALLOWLIST = new Set(['buckets', 'objects']);
const DATA_SKIP_TABLES = new Set([
  'auth.audit_log_entries',
  'auth.flow_state',
  'auth.sessions',
  'auth.refresh_tokens',
  'auth.mfa_amr_claims',
  'auth.mfa_challenges',
  'auth.one_time_tokens',
  'auth.oauth_authorizations',
  'auth.oauth_client_states',
  'auth.oauth_consents',
  'auth.saml_relay_states',
  'auth.webauthn_challenges',
  'storage.migrations',
  'storage.s3_multipart_uploads',
  'storage.s3_multipart_uploads_parts',
]);

function loadDotEnv(file = '.env') {
  if (!fs.existsSync(file)) return {};
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  }
  return env;
}

const dotEnv = loadDotEnv();
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || dotEnv.SUPABASE_ACCESS_TOKEN || '';

if (!SUPABASE_ACCESS_TOKEN) {
  console.error('Missing SUPABASE_ACCESS_TOKEN in env or .env');
  process.exit(1);
}

function resolveBackupDir() {
  if (DEFAULT_BACKUP_DIR) return DEFAULT_BACKUP_DIR;
  const parent = path.resolve('output/backups');
  const candidates = fs.existsSync(parent)
    ? fs.readdirSync(parent)
      .filter((name) => name.startsWith('supabase-restore-'))
      .map((name) => path.join(parent, name))
      .filter((candidate) => fs.existsSync(path.join(candidate, 'remote-schema.sql')))
      .sort()
    : [];
  const latest = candidates.at(-1);
  if (!latest) {
    throw new Error('Cannot find backup dir. Set BACKUP_DIR=/path/with/remote-schema.sql');
  }
  return latest;
}

const BACKUP_DIR = resolveBackupDir();
const SCHEMA_SQL_PATH = path.join(BACKUP_DIR, 'remote-schema.sql');
const DATA_SQL_PATH = path.join(BACKUP_DIR, 'remote-data.sql');

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function runQuery(query, label) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${TARGET_PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${label || 'query'} failed: ${res.status} ${text.slice(0, 1200)}`);
  }

  if (!text) return [];
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

function stripPsqlMeta(sql) {
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('\\'))
    .join('\n');
}

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let single = false;
  let double = false;
  let lineComment = false;
  let blockComment = false;
  let dollarTag = null;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];
    current += char;

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        current += next;
        i += 1;
        blockComment = false;
      }
      continue;
    }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        current += sql.slice(i + 1, i + dollarTag.length);
        i += dollarTag.length - 1;
        dollarTag = null;
      }
      continue;
    }
    if (single) {
      if (char === "'" && next === "'") {
        current += next;
        i += 1;
      } else if (char === "'") {
        single = false;
      }
      continue;
    }
    if (double) {
      if (char === '"' && next === '"') {
        current += next;
        i += 1;
      } else if (char === '"') {
        double = false;
      }
      continue;
    }

    if (char === '-' && next === '-') {
      current += next;
      i += 1;
      lineComment = true;
      continue;
    }
    if (char === '/' && next === '*') {
      current += next;
      i += 1;
      blockComment = true;
      continue;
    }
    if (char === "'") {
      single = true;
      continue;
    }
    if (char === '"') {
      double = true;
      continue;
    }
    if (char === '$') {
      const match = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        dollarTag = match[0];
        current += sql.slice(i + 1, i + dollarTag.length);
        i += dollarTag.length - 1;
        continue;
      }
    }
    if (char === ';') {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = '';
    }
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

function isBenignSchemaError(message) {
  return [
    'already exists',
    'multiple primary keys for table',
    'relation "schema_migrations" already exists',
  ].some((needle) => message.toLowerCase().includes(needle));
}

function isDeferredSchemaStatement(statement) {
  const normalized = statement
    .replace(/^--.*$/gm, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

  return normalized.startsWith('CREATE OR REPLACE FUNCTION ')
    || normalized.startsWith('CREATE FUNCTION ')
    || normalized.startsWith('ALTER FUNCTION ')
    || normalized.startsWith('CREATE OR REPLACE TRIGGER ')
    || normalized.startsWith('CREATE TRIGGER ')
    || normalized.startsWith('CREATE POLICY ')
    || normalized.startsWith('ALTER POLICY ')
    || normalized.includes(' ON FUNCTION ');
}

async function applySchema() {
  const raw = fs.readFileSync(SCHEMA_SQL_PATH, 'utf8');
  const statements = splitSqlStatements(stripPsqlMeta(raw))
    .filter((statement) => statement && !/^--/.test(statement));
  const immediateStatements = statements.filter((statement) => !isDeferredSchemaStatement(statement));
  const deferredStatements = statements.filter(isDeferredSchemaStatement);

  console.log(`Applying schema to ${TARGET_PROJECT_REF}: ${statements.length} statements`);
  let applied = 0;
  let skipped = 0;

  const runStatements = async (phaseName, phaseStatements) => {
    console.log(`  - ${phaseName}: ${phaseStatements.length} statements`);
    for (let i = 0; i < phaseStatements.length; i += 1) {
      const statement = phaseStatements[i];
      try {
        await runQuery(statement, `${phaseName} statement ${i + 1}/${phaseStatements.length}`);
        applied += 1;
      } catch (error) {
        if (isBenignSchemaError(error.message)) {
          skipped += 1;
          continue;
        }
        throw error;
      }
      if (applied % 100 === 0 || i === phaseStatements.length - 1) {
        console.log(`    progress: ${i + 1}/${phaseStatements.length}`);
      }
    }
  };

  const runRetryableStatements = async (phaseName, phaseStatements) => {
    console.log(`  - ${phaseName}: ${phaseStatements.length} statements`);
    let pending = phaseStatements.map((statement, index) => ({ statement, index }));
    let pass = 0;

    while (pending.length > 0) {
      pass += 1;
      const next = [];
      let passApplied = 0;
      let lastError = null;

      for (const item of pending) {
        try {
          await runQuery(item.statement, `${phaseName} statement ${item.index + 1}/${phaseStatements.length} pass ${pass}`);
          applied += 1;
          passApplied += 1;
        } catch (error) {
          if (isBenignSchemaError(error.message)) {
            skipped += 1;
            passApplied += 1;
            continue;
          }
          lastError = error;
          next.push(item);
        }
      }

      console.log(`    pass ${pass}: applied_or_skipped=${passApplied} remaining=${next.length}`);
      if (next.length === 0) break;
      if (passApplied === 0 || pass >= 10) {
        throw lastError || new Error(`${phaseName} failed with ${next.length} remaining statements`);
      }
      pending = next;
    }
  };

  await runStatements('schema base', immediateStatements);
  await runRetryableStatements('schema deferred functions/policies', deferredStatements);

  /*
  for (let i = 0; i < statements.length; i += 1) {
    const statement = statements[i];
    try {
      await runQuery(statement, `schema statement ${i + 1}/${statements.length}`);
      applied += 1;
    } catch (error) {
      if (isBenignSchemaError(error.message)) {
        skipped += 1;
        continue;
      }
      throw error;
    }
    if (applied % 100 === 0 || i === statements.length - 1) {
      console.log(`  - schema progress: ${i + 1}/${statements.length}`);
    }
  }
  */
  console.log(`Schema applied. applied=${applied} skipped=${skipped}`);
}

function parseCopyHeader(line) {
  const match = line.match(/^COPY "([^"]+)"\."([^"]+)" \((.*)\) FROM stdin;$/);
  if (!match) return null;
  const columns = [...match[3].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  return { schema: match[1], table: match[2], columns };
}

function parseCopyValue(value) {
  if (value === '\\N') return null;
  let output = '';
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char !== '\\') {
      output += char;
      continue;
    }
    const next = value[i + 1];
    i += 1;
    switch (next) {
      case 'b':
        output += '\b';
        break;
      case 'f':
        output += '\f';
        break;
      case 'n':
        output += '\n';
        break;
      case 'r':
        output += '\r';
        break;
      case 't':
        output += '\t';
        break;
      case 'v':
        output += '\v';
        break;
      case '\\':
        output += '\\';
        break;
      default:
        output += next || '';
        break;
    }
  }
  return output;
}

function maybeJsonValue(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || !/^[{[]/.test(trimmed)) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function shouldImportCopyBlock(schema, table) {
  const key = `${schema}.${table}`;
  if (DATA_SKIP_TABLES.has(key)) return false;
  if (PUBLIC_COPY_SCHEMA_ALLOWLIST.has(schema)) return true;
  if (schema === 'auth' && AUTH_TABLE_ALLOWLIST.has(table)) return true;
  if (schema === 'storage' && STORAGE_TABLE_ALLOWLIST.has(table)) return true;
  return false;
}

function* parseCopyBlocks(sqlPath) {
  const lines = fs.readFileSync(sqlPath, 'utf8').split(/\r?\n/);
  let current = null;
  for (const line of lines) {
    const header = parseCopyHeader(line);
    if (header) {
      current = { ...header, rows: [] };
      continue;
    }
    if (!current) continue;
    if (line === '\\.') {
      yield current;
      current = null;
      continue;
    }
    if (!shouldImportCopyBlock(current.schema, current.table)) continue;
    const values = line.split('\t').map(parseCopyValue).map(maybeJsonValue);
    const row = {};
    current.columns.forEach((column, index) => {
      row[column] = values[index] ?? null;
    });
    current.rows.push(row);
  }
}

function chunkRows(rows) {
  const chunks = [];
  let current = [];
  let size = 2;
  for (const row of rows) {
    const encoded = JSON.stringify(row);
    const nextSize = size + encoded.length + (current.length > 0 ? 1 : 0);
    if (current.length > 0 && nextSize > MAX_JSON_CHUNK_CHARS) {
      chunks.push(current);
      current = [row];
      size = 2 + encoded.length;
      continue;
    }
    current.push(row);
    size = nextSize;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

async function insertRows(schema, table, columns, rows) {
  if (!rows.length) return 0;
  const qSchema = quoteIdent(schema);
  const qTable = quoteIdent(table);
  const qColumns = columns.map(quoteIdent).join(', ');
  const qSelect = columns.map(quoteIdent).join(', ');
  const chunks = chunkRows(rows);

  for (let i = 0; i < chunks.length; i += 1) {
    const json = JSON.stringify(chunks[i]);
    const query = `
WITH data AS (SELECT ${sqlLiteral(json)}::jsonb AS j)
INSERT INTO ${qSchema}.${qTable} (${qColumns})
SELECT ${qSelect}
FROM jsonb_populate_recordset(NULL::${qSchema}.${qTable}, (SELECT j FROM data))
ON CONFLICT DO NOTHING;
`;
    await runQuery(query, `insert ${schema}.${table} chunk ${i + 1}/${chunks.length}`);
  }
  return rows.length;
}

async function resetPublicSequences() {
  await runQuery(`
DO $$
DECLARE
  rec RECORD;
  v_max bigint;
  v_seq text;
BEGIN
  FOR rec IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) IS NOT NULL
  LOOP
    EXECUTE format('SELECT pg_get_serial_sequence(%L, %L)', format('%I.%I', rec.schema_name, rec.table_name), rec.column_name) INTO v_seq;
    EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %I.%I', rec.column_name, rec.schema_name, rec.table_name) INTO v_max;
    IF v_max > 0 THEN
      EXECUTE format('SELECT setval(%L, %s, true)', v_seq, v_max);
    ELSE
      EXECUTE format('SELECT setval(%L, 1, false)', v_seq);
    END IF;
  END LOOP;
END $$;
`, 'reset public sequences');
}

async function applyData() {
  console.log(`Restoring data to ${TARGET_PROJECT_REF}`);
  let importedTables = 0;
  let importedRows = 0;

  for (const block of parseCopyBlocks(DATA_SQL_PATH)) {
    if (!shouldImportCopyBlock(block.schema, block.table)) continue;
    if (!block.rows.length) continue;
    const count = await insertRows(block.schema, block.table, block.columns, block.rows);
    importedTables += 1;
    importedRows += count;
    console.log(`  - ${block.schema}.${block.table}: ${count} rows`);
  }

  await resetPublicSequences();
  console.log(`Data restored. tables=${importedTables} rows=${importedRows}`);
}

async function applyPostMigrations() {
  const migration = 'supabase/migrations/20260416171000_add_footer_floating_contact_links.sql';
  if (!fs.existsSync(migration)) return;
  const statements = splitSqlStatements(fs.readFileSync(migration, 'utf8'));
  console.log(`Applying post-backup migration: ${migration}`);
  for (let i = 0; i < statements.length; i += 1) {
    await runQuery(statements[i], `post migration ${i + 1}/${statements.length}`);
  }
}

async function verify() {
  const rows = await runQuery(`
SELECT 'products' AS name, COUNT(*)::int AS count FROM public.products
UNION ALL SELECT 'product_images', COUNT(*)::int FROM public.product_images
UNION ALL SELECT 'blog_posts', COUNT(*)::int FROM public.blog_posts
UNION ALL SELECT 'services', COUNT(*)::int FROM public.services
UNION ALL SELECT 'product_brands', COUNT(*)::int FROM public.product_brands
UNION ALL SELECT 'auth_users', COUNT(*)::int FROM auth.users
UNION ALL SELECT 'storage_objects', COUNT(*)::int FROM storage.objects
ORDER BY name;
`, 'verification counts');
  console.log('Verification counts:');
  for (const row of rows) {
    console.log(`  - ${row.name}: ${row.count}`);
  }
}

async function main() {
  console.log(`Target project: ${TARGET_PROJECT_REF}`);
  console.log(`Backup dir: ${BACKUP_DIR}`);

  if (APPLY_SCHEMA) await applySchema();
  if (APPLY_DATA) await applyData();
  if (APPLY_POST_MIGRATIONS) await applyPostMigrations();
  await verify();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
