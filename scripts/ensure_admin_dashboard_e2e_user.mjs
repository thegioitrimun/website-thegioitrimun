#!/usr/bin/env node

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'ykcrngqhyinczmvwduox';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';
const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin-dashboard-e2e@internal.thegioitrimun.vn';
const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || '';
const E2E_ADMIN_NAME = process.env.E2E_ADMIN_NAME || 'Admin Dashboard E2E';

if (!ACCESS_TOKEN) {
  throw new Error('Missing SUPABASE_ACCESS_TOKEN');
}

if (!E2E_ADMIN_PASSWORD) {
  throw new Error('Missing E2E_ADMIN_PASSWORD');
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function runDbQuery(query) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`DB query failed (${response.status}): ${text.slice(0, 1000)}`);
  }
  return JSON.parse(text);
}

async function getServiceRoleKey() {
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Cannot fetch API keys (${response.status}): ${text.slice(0, 1000)}`);
  }
  const keys = JSON.parse(text);
  const serviceRole = keys.find((entry) => entry.name === 'service_role' && typeof entry.api_key === 'string')?.api_key;
  if (!serviceRole) {
    throw new Error('Could not resolve service_role key.');
  }
  return serviceRole;
}

async function listUsers(serviceRoleKey) {
  const response = await fetch(`https://${PROJECT_REF}.supabase.co/auth/v1/admin/users?page=1&per_page=1000`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Cannot list auth users (${response.status}): ${text.slice(0, 1000)}`);
  }
  const payload = JSON.parse(text);
  return Array.isArray(payload?.users) ? payload.users : [];
}

async function upsertAuthUser(serviceRoleKey) {
  const users = await listUsers(serviceRoleKey);
  const existing = users.find((entry) => String(entry.email || '').toLowerCase() === E2E_ADMIN_EMAIL.toLowerCase());

  const payload = {
    email: E2E_ADMIN_EMAIL,
    password: E2E_ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: E2E_ADMIN_NAME,
      dob: '1990-01-01',
      phone: '0900000000',
    },
  };

  if (existing?.id) {
    const response = await fetch(`https://${PROJECT_REF}.supabase.co/auth/v1/admin/users/${existing.id}`, {
      method: 'PUT',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Cannot update E2E auth user (${response.status}): ${text.slice(0, 1000)}`);
    }
    const data = JSON.parse(text);
    return data?.user?.id || data?.id || existing.id;
  }

  const response = await fetch(`https://${PROJECT_REF}.supabase.co/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Cannot create E2E auth user (${response.status}): ${text.slice(0, 1000)}`);
  }
  const data = JSON.parse(text);
  const userId = data?.user?.id || data?.id;
  if (!userId) {
    throw new Error('Cannot resolve E2E auth user id.');
  }
  return userId;
}

async function upsertPatient(userId) {
  await runDbQuery(`
INSERT INTO public.patients (
  id,
  name,
  dob,
  phone,
  email,
  gender,
  citizen_id_number,
  nationality,
  role
)
VALUES (
  ${sqlLiteral(userId)},
  ${sqlLiteral(E2E_ADMIN_NAME)},
  '1990-01-01',
  '0900000000',
  ${sqlLiteral(E2E_ADMIN_EMAIL)},
  'other',
  'ADMIN-DASHBOARD-E2E',
  'Vietnam',
  'master_admin'
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  dob = EXCLUDED.dob,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  gender = EXCLUDED.gender,
  citizen_id_number = EXCLUDED.citizen_id_number,
  nationality = EXCLUDED.nationality,
  role = 'master_admin';
`);
}

async function main() {
  const serviceRoleKey = await getServiceRoleKey();
  const userId = await upsertAuthUser(serviceRoleKey);
  await upsertPatient(userId);
  console.log(JSON.stringify({
    ok: true,
    projectRef: PROJECT_REF,
    email: E2E_ADMIN_EMAIL,
    userId,
    role: 'master_admin',
  }, null, 2));
}

await main();
