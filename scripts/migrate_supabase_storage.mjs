#!/usr/bin/env node

const SOURCE_PROJECT_REF = process.env.SOURCE_PROJECT_REF || 'vwzgibsdtednpitbrdeb';
const TARGET_PROJECT_REF = process.env.TARGET_PROJECT_REF || 'ykcrngqhyinczmvwduox';
const SOURCE_TOKEN = process.env.SOURCE_SUPABASE_TOKEN || '';
const TARGET_TOKEN = process.env.TARGET_SUPABASE_TOKEN || '';
const CONCURRENCY = Number(process.env.STORAGE_COPY_CONCURRENCY || 4);
const ABORT_ON_RESTRICTED_SOURCE = process.env.ABORT_ON_RESTRICTED_SOURCE !== 'false';

if (!SOURCE_TOKEN || !TARGET_TOKEN) {
  console.error('Missing SOURCE_SUPABASE_TOKEN or TARGET_SUPABASE_TOKEN');
  process.exit(1);
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function encodeObjectPath(path) {
  return String(path)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function parsePgArray(text) {
  if (!text || text === '{}') return [];
  return text
    .slice(1, -1)
    .split(',')
    .map((item) => item.replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"'))
    .filter(Boolean);
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

async function getServiceRoleKey(projectRef, token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/api-keys`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Cannot read api-keys for ${projectRef}: ${res.status} ${text.slice(0, 1000)}`);
  }

  const keys = JSON.parse(text);
  const serviceRole = keys.find((k) => k.name === 'service_role' && typeof k.api_key === 'string');
  if (!serviceRole?.api_key) {
    throw new Error(`service_role key not found for ${projectRef}`);
  }
  return serviceRole.api_key;
}

async function fetchSourceBuckets() {
  return runQuery(
    SOURCE_PROJECT_REF,
    SOURCE_TOKEN,
    `SELECT id, name, public, file_size_limit, allowed_mime_types
     FROM storage.buckets
     ORDER BY id;`
  );
}

async function upsertTargetBuckets(buckets) {
  if (!buckets.length) return;
  const json = JSON.stringify(buckets);
  const query = `
WITH data AS (SELECT ${sqlLiteral(json)}::jsonb AS j)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT x.id, x.name, x.public, x.file_size_limit, x.allowed_mime_types
FROM jsonb_to_recordset((SELECT j FROM data)) AS x(
  id text,
  name text,
  public boolean,
  file_size_limit bigint,
  allowed_mime_types text[]
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
`;
  await runQuery(TARGET_PROJECT_REF, TARGET_TOKEN, query);
}

async function fetchSourcePolicies() {
  return runQuery(
    SOURCE_PROJECT_REF,
    SOURCE_TOKEN,
    `SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
     FROM pg_policies
     WHERE schemaname = 'storage'
     ORDER BY tablename, policyname;`
  );
}

function buildPolicySql(policy) {
  const qSchema = quoteIdent(policy.schemaname);
  const qTable = quoteIdent(policy.tablename);
  const qName = quoteIdent(policy.policyname);
  const mode = policy.permissive === 'RESTRICTIVE' ? 'AS RESTRICTIVE' : 'AS PERMISSIVE';
  const cmd = String(policy.cmd || 'ALL').toUpperCase();
  const roles = parsePgArray(policy.roles);
  const toClause = roles.length ? `TO ${roles.map((r) => quoteIdent(r)).join(', ')}` : 'TO PUBLIC';

  const clauses = [
    `DROP POLICY IF EXISTS ${qName} ON ${qSchema}.${qTable};`,
    `CREATE POLICY ${qName} ON ${qSchema}.${qTable} ${mode} FOR ${cmd} ${toClause}`,
  ];

  if (policy.qual) clauses.push(`USING (${policy.qual})`);
  if (policy.with_check) clauses.push(`WITH CHECK (${policy.with_check})`);

  return `${clauses.join(' ')};`;
}

async function syncPolicies(sourcePolicies) {
  if (!sourcePolicies.length) return;

  // Clear existing storage policies, then re-create from source.
  await runQuery(
    TARGET_PROJECT_REF,
    TARGET_TOKEN,
    `DO $$
DECLARE rec RECORD;
BEGIN
  FOR rec IN
    SELECT policyname, schemaname, tablename
    FROM pg_policies
    WHERE schemaname = 'storage'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', rec.policyname, rec.schemaname, rec.tablename);
  END LOOP;
END $$;`
  );

  for (const policy of sourcePolicies) {
    const sql = buildPolicySql(policy);
    await runQuery(TARGET_PROJECT_REF, TARGET_TOKEN, sql);
  }
}

async function fetchSourceObjects() {
  return runQuery(
    SOURCE_PROJECT_REF,
    SOURCE_TOKEN,
    `SELECT bucket_id, name,
            COALESCE(metadata->>'mimetype', 'application/octet-stream') AS mimetype,
            COALESCE(metadata->>'cacheControl', metadata->>'cache_control', 'max-age=3600') AS cache_control
     FROM storage.objects
     ORDER BY bucket_id, name;`
  );
}

async function fetchCounts(projectRef, token) {
  return runQuery(
    projectRef,
    token,
    `SELECT bucket_id, COUNT(*)::int AS object_count
     FROM storage.objects
     GROUP BY bucket_id
     ORDER BY bucket_id;`
  );
}

function countMap(rows) {
  return new Map(rows.map((r) => [r.bucket_id, Number(r.object_count)]));
}

async function downloadObject(sourceServiceKey, bucket, name) {
  const encoded = `${encodeURIComponent(bucket)}/${encodeObjectPath(name)}`;
  const url = `https://${SOURCE_PROJECT_REF}.supabase.co/storage/v1/object/${encoded}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${sourceServiceKey}`,
      apikey: sourceServiceKey,
    },
  });

  if (!res.ok) {
    const msg = await res.text();
    const err = new Error(`DOWNLOAD_FAILED status=${res.status} bucket=${bucket} name=${name} msg=${msg.slice(0, 300)}`);
    err.status = res.status;
    err.messageBody = msg;
    throw err;
  }

  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function uploadObject(targetServiceKey, bucket, name, bytes, mimetype, cacheControl) {
  const encoded = `${encodeURIComponent(bucket)}/${encodeObjectPath(name)}`;
  const url = `https://${TARGET_PROJECT_REF}.supabase.co/storage/v1/object/${encoded}`;

  const headers = {
    Authorization: `Bearer ${targetServiceKey}`,
    apikey: targetServiceKey,
    'x-upsert': 'true',
    'content-type': mimetype || 'application/octet-stream',
  };
  if (cacheControl) headers['cache-control'] = cacheControl;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: bytes,
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`UPLOAD_FAILED status=${res.status} bucket=${bucket} name=${name} msg=${msg.slice(0, 300)}`);
  }
}

async function copyAllObjects(sourceObjects, sourceServiceKey, targetServiceKey) {
  let index = 0;
  let copied = 0;
  let failed = 0;
  let restrictedError = null;

  const worker = async () => {
    while (index < sourceObjects.length) {
      const current = index;
      index += 1;
      const obj = sourceObjects[current];

      if (restrictedError) return;

      try {
        const bytes = await downloadObject(sourceServiceKey, obj.bucket_id, obj.name);
        await uploadObject(
          targetServiceKey,
          obj.bucket_id,
          obj.name,
          bytes,
          obj.mimetype,
          obj.cache_control
        );
        copied += 1;
        if (copied % 25 === 0 || copied === sourceObjects.length) {
          console.log(`  - copied ${copied}/${sourceObjects.length}`);
        }
      } catch (err) {
        const isRestricted =
          err?.status === 402 &&
          typeof err?.messageBody === 'string' &&
          err.messageBody.includes('exceed_egress_quota');

        if (isRestricted && ABORT_ON_RESTRICTED_SOURCE) {
          restrictedError = err;
          return;
        }

        failed += 1;
        console.error(`  - failed ${obj.bucket_id}/${obj.name}: ${err.message}`);
      }
    }
  };

  const parallel = Math.max(1, Number.isFinite(CONCURRENCY) ? CONCURRENCY : 4);
  await Promise.all(Array.from({ length: parallel }, () => worker()));

  if (restrictedError) {
    throw new Error(
      `Source storage is restricted (HTTP 402 exceed_egress_quota). Unable to download object bytes. ` +
        `Please wait for quota reset or request Supabase support unlock.`
    );
  }

  return { copied, failed };
}

function printCountComparison(sourceCounts, targetCounts) {
  const sMap = countMap(sourceCounts);
  const tMap = countMap(targetCounts);
  const allBuckets = Array.from(new Set([...sMap.keys(), ...tMap.keys()])).sort();
  let mismatches = 0;
  console.log('\nStorage object row-count verification (storage.objects):');
  for (const bucket of allBuckets) {
    const s = sMap.get(bucket) ?? 0;
    const t = tMap.get(bucket) ?? 0;
    const ok = s === t;
    if (!ok) mismatches += 1;
    console.log(`- ${bucket}: source=${s} target=${t} ${ok ? 'OK' : 'MISMATCH'}`);
  }
  return mismatches;
}

async function main() {
  console.log(`Source: ${SOURCE_PROJECT_REF}`);
  console.log(`Target: ${TARGET_PROJECT_REF}`);

  const [sourceServiceKey, targetServiceKey] = await Promise.all([
    getServiceRoleKey(SOURCE_PROJECT_REF, SOURCE_TOKEN),
    getServiceRoleKey(TARGET_PROJECT_REF, TARGET_TOKEN),
  ]);

  console.log('Syncing buckets...');
  const sourceBuckets = await fetchSourceBuckets();
  await upsertTargetBuckets(sourceBuckets);
  console.log(`  - ${sourceBuckets.length} bucket(s) synchronized`);

  console.log('Syncing storage policies...');
  const sourcePolicies = await fetchSourcePolicies();
  await syncPolicies(sourcePolicies);
  console.log(`  - ${sourcePolicies.length} policy row(s) synchronized`);

  console.log('Copying object bytes...');
  const sourceObjects = await fetchSourceObjects();
  console.log(`  - source objects: ${sourceObjects.length}`);
  const result = await copyAllObjects(sourceObjects, sourceServiceKey, targetServiceKey);
  console.log(`  - copied=${result.copied}, failed=${result.failed}`);

  const [sourceCounts, targetCounts] = await Promise.all([
    fetchCounts(SOURCE_PROJECT_REF, SOURCE_TOKEN),
    fetchCounts(TARGET_PROJECT_REF, TARGET_TOKEN),
  ]);
  const mismatches = printCountComparison(sourceCounts, targetCounts);
  if (mismatches > 0) {
    throw new Error(`Storage verification mismatch on ${mismatches} bucket(s).`);
  }

  console.log('\nStorage migration completed successfully.');
}

main().catch((error) => {
  console.error('\nStorage migration failed:', error.message);
  process.exit(1);
});
