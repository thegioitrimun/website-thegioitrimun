#!/usr/bin/env node

const SOURCE_PROJECT_REF = process.env.SOURCE_PROJECT_REF || 'vwzgibsdtednpitbrdeb';
const TARGET_PROJECT_REF = process.env.TARGET_PROJECT_REF || 'ykcrngqhyinczmvwduox';
const SOURCE_TOKEN = process.env.SOURCE_SUPABASE_TOKEN || '';
const TARGET_TOKEN = process.env.TARGET_SUPABASE_TOKEN || '';

if (!SOURCE_TOKEN || !TARGET_TOKEN) {
  console.error('Missing SOURCE_SUPABASE_TOKEN or TARGET_SUPABASE_TOKEN');
  process.exit(1);
}

const MAX_JSON_CHUNK_CHARS = 450_000;

const PUBLIC_TABLES_INSERT_ORDER = [
  'tax_profiles',
  'tax_rates',
  'site_info',
  'homepage_hero',
  'footer_content',
  'auth_page_images',
  'payment_settings',
  'about_page_content',
  'about_features',
  'about_values',
  'services',
  'procedure_steps',
  'featured_services',
  'blog_categories',
  'product_categories',
  'product_brands',
  'products',
  'product_images',
  'patients',
  'doctors',
  'featured_doctors',
  'faq_items',
  'blog_posts',
  'featured_posts',
  'contact_page_content',
  'appointments',
  'medical_records',
  'performed_services',
  'prescribed_medications',
  'invoices',
  'discount_codes',
  'product_orders',
  'product_order_items',
  'discount_code_usages',
  'order_status_history',
  'order_payments',
  'order_refunds',
  'product_reviews',
  'patient_uploaded_documents',
  'user_wishlist',
  'funnel_events',
  'testimonials',
];

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function chunkRows(rows, maxChars = MAX_JSON_CHUNK_CHARS) {
  const chunks = [];
  let current = [];
  let currentSize = 2; // []

  for (const row of rows) {
    const rowStr = JSON.stringify(row);
    const nextSize = currentSize + rowStr.length + (current.length > 0 ? 1 : 0);
    if (current.length > 0 && nextSize > maxChars) {
      chunks.push(current);
      current = [row];
      currentSize = 2 + rowStr.length;
      continue;
    }
    current.push(row);
    currentSize = nextSize;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

async function runQuery(projectRef, token, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Query failed (${projectRef}): ${res.status} ${text.slice(0, 1000)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response (${projectRef}): ${text.slice(0, 1000)}`);
  }
}

async function fetchTableRows(projectRef, token, schema, table) {
  return runQuery(projectRef, token, `SELECT * FROM ${schema}.${table};`);
}

async function insertTableRows(projectRef, token, schema, table, rows) {
  if (!rows.length) return;
  const chunks = chunkRows(rows);
  for (let i = 0; i < chunks.length; i += 1) {
    const json = JSON.stringify(chunks[i]);
    const query = `
WITH data AS (SELECT ${sqlLiteral(json)}::jsonb AS j)
INSERT INTO ${schema}.${table}
SELECT * FROM jsonb_populate_recordset(NULL::${schema}.${table}, (SELECT j FROM data));
`;
    await runQuery(projectRef, token, query);
    console.log(`  - ${schema}.${table}: inserted chunk ${i + 1}/${chunks.length} (${chunks[i].length} rows)`);
  }
}

async function migrateAuthTables() {
  console.log('Migrating auth.users ...');
  const sourceUsers = await runQuery(
    SOURCE_PROJECT_REF,
    SOURCE_TOKEN,
    `SELECT id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, phone, is_sso_user, is_anonymous FROM auth.users ORDER BY created_at ASC;`
  );

  const userChunks = chunkRows(sourceUsers);
  for (let i = 0; i < userChunks.length; i += 1) {
    const json = JSON.stringify(userChunks[i]);
    const query = `
WITH data AS (SELECT ${sqlLiteral(json)}::jsonb AS j)
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  phone, is_sso_user, is_anonymous
)
SELECT
  x.id, x.aud, x.role, x.email, x.encrypted_password, x.email_confirmed_at,
  x.raw_app_meta_data, x.raw_user_meta_data, x.created_at, x.updated_at,
  x.phone, x.is_sso_user, x.is_anonymous
FROM jsonb_to_recordset((SELECT j FROM data)) AS x(
  id uuid,
  aud text,
  role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  phone text,
  is_sso_user boolean,
  is_anonymous boolean
)
ON CONFLICT (id) DO NOTHING;
`;
    await runQuery(TARGET_PROJECT_REF, TARGET_TOKEN, query);
    console.log(`  - auth.users: inserted chunk ${i + 1}/${userChunks.length} (${userChunks[i].length} rows)`);
  }
  console.log(`  - auth.users: ${sourceUsers.length} rows migrated`);

  console.log('Migrating auth.identities ...');
  const sourceIdentities = await runQuery(
    SOURCE_PROJECT_REF,
    SOURCE_TOKEN,
    `SELECT provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id FROM auth.identities ORDER BY created_at ASC;`
  );

  const identityChunks = chunkRows(sourceIdentities);
  for (let i = 0; i < identityChunks.length; i += 1) {
    const json = JSON.stringify(identityChunks[i]);
    const query = `
WITH data AS (SELECT ${sqlLiteral(json)}::jsonb AS j)
INSERT INTO auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at,
  created_at, updated_at, id
)
SELECT
  x.provider_id, x.user_id, x.identity_data, x.provider, x.last_sign_in_at,
  x.created_at, x.updated_at, x.id
FROM jsonb_to_recordset((SELECT j FROM data)) AS x(
  provider_id text,
  user_id uuid,
  identity_data jsonb,
  provider text,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  id uuid
)
ON CONFLICT (id) DO NOTHING;
`;
    await runQuery(TARGET_PROJECT_REF, TARGET_TOKEN, query);
    console.log(`  - auth.identities: inserted chunk ${i + 1}/${identityChunks.length} (${identityChunks[i].length} rows)`);
  }
  console.log(`  - auth.identities: ${sourceIdentities.length} rows migrated`);
}

async function truncateTargetPublicTables() {
  const tableList = PUBLIC_TABLES_INSERT_ORDER.map((t) => `public.${t}`).join(', ');
  const query = `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`;
  await runQuery(TARGET_PROJECT_REF, TARGET_TOKEN, query);
  console.log('Target public tables truncated (RESTART IDENTITY CASCADE).');
}

async function syncPublicTable(table) {
  // Inserting into product_orders can fire triggers that auto-create rows
  // in these audit/payment tables. Clear them right before source restore.
  if (table === 'order_status_history' || table === 'order_payments') {
    await runQuery(
      TARGET_PROJECT_REF,
      TARGET_TOKEN,
      `TRUNCATE TABLE public.${table} RESTART IDENTITY CASCADE;`
    );
    console.log(`  - public.${table}: truncated again to remove trigger-generated rows`);
  }

  const rows = await fetchTableRows(SOURCE_PROJECT_REF, SOURCE_TOKEN, 'public', table);
  console.log(`Syncing public.${table} (${rows.length} rows) ...`);
  await insertTableRows(TARGET_PROJECT_REF, TARGET_TOKEN, 'public', table, rows);
}

async function resetPublicSequences() {
  const query = `
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
`;
  await runQuery(TARGET_PROJECT_REF, TARGET_TOKEN, query);
  console.log('Public sequences reset.');
}

async function compareCounts() {
  const unionSql = PUBLIC_TABLES_INSERT_ORDER
    .map((table) => `SELECT '${table}' AS table_name, COUNT(*)::bigint AS row_count FROM public.${table}`)
    .join(' UNION ALL ');
  const countSql = `${unionSql} ORDER BY table_name;`;

  const sourceCounts = await runQuery(SOURCE_PROJECT_REF, SOURCE_TOKEN, countSql);
  const targetCounts = await runQuery(TARGET_PROJECT_REF, TARGET_TOKEN, countSql);

  const targetMap = new Map(targetCounts.map((row) => [row.table_name, Number(row.row_count)]));
  let mismatch = 0;

  console.log('\nRow-count verification:');
  for (const src of sourceCounts) {
    const table = src.table_name;
    const srcCount = Number(src.row_count);
    const dstCount = targetMap.get(table) ?? 0;
    const ok = srcCount === dstCount;
    if (!ok) mismatch += 1;
    console.log(`- ${table}: source=${srcCount} target=${dstCount} ${ok ? 'OK' : 'MISMATCH'}`);
  }

  if (mismatch > 0) {
    throw new Error(`Count verification failed on ${mismatch} table(s).`);
  }
}

async function main() {
  console.log(`Source: ${SOURCE_PROJECT_REF}`);
  console.log(`Target: ${TARGET_PROJECT_REF}`);

  await migrateAuthTables();
  await truncateTargetPublicTables();

  for (const table of PUBLIC_TABLES_INSERT_ORDER) {
    await syncPublicTable(table);
  }

  await resetPublicSequences();
  await compareCounts();

  console.log('\nMigration completed successfully.');
}

main().catch((error) => {
  console.error('\nMigration failed:', error.message);
  process.exit(1);
});
