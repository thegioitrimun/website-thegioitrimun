import fs from 'node:fs/promises';
import path from 'node:path';

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'ykcrngqhyinczmvwduox';
const OUTPUT_PATH = process.env.ADMIN_DASHBOARD_AUDIT_PATH || 'ADMIN_DASHBOARD_AUDIT_2026-03-20.md';

if (!ACCESS_TOKEN) {
  console.error('Missing SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

async function runQuery(query) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || `Query failed with status ${response.status}`);
  }
  return payload;
}

function markdownTable(rows) {
  if (!rows.length) return '_No rows_';
  const headers = Object.keys(rows[0]);
  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${headers.map((header) => String(row[header] ?? '')).join(' | ')} |`),
  ];
  return lines.join('\n');
}

const summarySql = `
with order_facts as (
  select
    id,
    user_id,
    created_at,
    coalesce(grand_total, total_price, 0) as order_total,
    coalesce(payment_status,
      case
        when status = 'completed'::public.order_status then 'paid'::public.payment_status
        when status = 'refunded'::public.order_status then 'refunded'::public.payment_status
        else 'unpaid'::public.payment_status
      end
    ) as payment_status,
    coalesce(fulfillment_status,
      case
        when status = 'processing'::public.order_status then 'processing'::public.fulfillment_status
        when status = 'shipped'::public.order_status then 'shipped'::public.fulfillment_status
        when status = 'completed'::public.order_status then 'completed'::public.fulfillment_status
        when status = 'cancelled'::public.order_status then 'cancelled'::public.fulfillment_status
        when status = 'refunded'::public.order_status then 'completed'::public.fulfillment_status
        else 'pending'::public.fulfillment_status
      end
    ) as fulfillment_status
  from public.product_orders
),
refund_facts as (
  select coalesce(sum(amount), 0) as refund_total
  from public.order_refunds
  where status = 'completed'
)
select
  (select count(*) from public.patients where role = 'customer') as total_customers,
  (select count(*) from public.product_orders) as total_orders,
  (select count(*) from order_facts where payment_status in ('paid','refunded')) as paid_orders,
  (select count(*) from order_facts where fulfillment_status = 'pending') as pending_orders,
  (select count(*) from public.appointments) as total_appointments,
  (select count(*) from public.products where is_published = true) as published_products,
  (select coalesce(sum(order_total), 0) from order_facts where payment_status in ('paid','refunded')) as gross_revenue,
  (select refund_total from refund_facts) as refund_total;
`;

const anomalySql = `
with duplicate_emails as (
  select count(*) as duplicate_groups
  from (
    select lower(email) as email_key
    from public.patients
    where nullif(btrim(coalesce(email, '')), '') is not null
    group by lower(email)
    having count(*) > 1
  ) x
),
duplicate_phones as (
  select count(*) as duplicate_groups
  from (
    select regexp_replace(phone, '\\D', '', 'g') as phone_key
    from public.patients
    where nullif(btrim(coalesce(phone, '')), '') is not null
    group by regexp_replace(phone, '\\D', '', 'g')
    having count(*) > 1
  ) x
)
select 'orders_missing_total' as check_name, count(*)::bigint as finding_count
from public.product_orders
where coalesce(grand_total, total_price, 0) <= 0

union all

select 'paid_orders_without_payment_logs', count(*)::bigint
from public.product_orders po
where coalesce(
  po.payment_status,
  case
    when po.status = 'completed'::public.order_status then 'paid'::public.payment_status
    when po.status = 'refunded'::public.order_status then 'refunded'::public.payment_status
    else 'unpaid'::public.payment_status
  end
) in ('paid','refunded')
and not exists (
  select 1 from public.order_payments op where op.order_id = po.id
)

union all

select 'pending_orders_older_than_2h', count(*)::bigint
from public.product_orders po
where coalesce(
  po.fulfillment_status,
  case
    when po.status = 'processing'::public.order_status then 'processing'::public.fulfillment_status
    when po.status = 'shipped'::public.order_status then 'shipped'::public.fulfillment_status
    when po.status = 'completed'::public.order_status then 'completed'::public.fulfillment_status
    when po.status = 'cancelled'::public.order_status then 'cancelled'::public.fulfillment_status
    when po.status = 'refunded'::public.order_status then 'completed'::public.fulfillment_status
    else 'pending'::public.fulfillment_status
  end
) = 'pending'
and po.created_at <= now() - interval '2 hours'

union all

select 'appointments_missing_doctor_or_service', count(*)::bigint
from public.appointments
where doctor_id is null or service_id is null

union all

select 'published_products_out_of_stock', count(*)::bigint
from public.products
where is_published = true and coalesce(stock_quantity, 0) <= 0

union all

select 'published_products_low_stock', count(*)::bigint
from public.products
where is_published = true
  and coalesce(stock_quantity, 0) > 0
  and coalesce(low_stock_threshold, 0) > 0
  and coalesce(stock_quantity, 0) <= coalesce(low_stock_threshold, 0)

union all

select 'duplicate_customer_emails', duplicate_groups::bigint
from duplicate_emails

union all

select 'duplicate_customer_phones', duplicate_groups::bigint
from duplicate_phones;
`;

const topFindingsSql = `
select
  po.order_code,
  po.customer_name,
  po.customer_phone,
  po.created_at
from public.product_orders po
where coalesce(
  po.fulfillment_status,
  case
    when po.status = 'processing'::public.order_status then 'processing'::public.fulfillment_status
    when po.status = 'shipped'::public.order_status then 'shipped'::public.fulfillment_status
    when po.status = 'completed'::public.order_status then 'completed'::public.fulfillment_status
    when po.status = 'cancelled'::public.order_status then 'cancelled'::public.fulfillment_status
    when po.status = 'refunded'::public.order_status then 'completed'::public.fulfillment_status
    else 'pending'::public.fulfillment_status
  end
) = 'pending'
and po.created_at <= now() - interval '2 hours'
order by po.created_at asc
limit 10;
`;

const appointmentsDrilldownSql = `
select
  count(*)::bigint as rows_count,
  count(*) filter (where status = 'pending')::bigint as pending_count,
  count(*) filter (where invoice_payment_status in ('paid','partial'))::bigint as billed_count
from public.admin_appointments_drilldown(
  null,
  null,
  null,
  null,
  null,
  null,
  250,
  0
);
`;

const [summaryRows, anomalyRows, topPendingRows, appointmentsRows] = await Promise.all([
  runQuery(summarySql),
  runQuery(anomalySql),
  runQuery(topFindingsSql),
  runQuery(appointmentsDrilldownSql),
]);

const findingsCount = anomalyRows.reduce((sum, row) => sum + Number(row.finding_count || 0), 0);

const markdown = `# Admin Dashboard Audit

- Project ref: \`${PROJECT_REF}\`
- Generated at: \`${new Date().toISOString()}\`
- Total anomaly findings: **${findingsCount}**

## Summary

${markdownTable(summaryRows)}

## Anomaly Counts

${markdownTable(anomalyRows)}

## Pending Orders Older Than 2 Hours

${markdownTable(topPendingRows)}

## Appointment Drilldown Spot Check

${markdownTable(appointmentsRows)}
`;

await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await fs.writeFile(OUTPUT_PATH, markdown, 'utf8');
console.log(markdown);
