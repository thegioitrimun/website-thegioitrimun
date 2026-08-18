import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_INPUT_DIR = '/Users/PHUC/Nội dung sản phẩm';
const inputDirectory = path.resolve(process.argv[2] || DEFAULT_INPUT_DIR);
const outputDirectory = path.resolve(
  process.argv[3] || `tmp/product-content-import-${new Date().toISOString().replace(/[:.]/g, '-')}`,
);

const updateFields = [
  'name',
  'description',
  'long_description',
  'usage_instructions',
  'ingredients',
];

const isProductJsonFile = (file) => (
  file.endsWith('.json')
  && !file.startsWith('_')
  && file !== 'package.json'
);

const assertStringField = (product, field, file) => {
  if (typeof product[field] !== 'string' || product[field].trim().length === 0) {
    throw new Error(`${file}: field "${field}" must be a non-empty string.`);
  }
};

const assertProductPayload = (product, file) => {
  if (!Number.isInteger(product.id) || product.id <= 0) {
    throw new Error(`${file}: field "id" must be a positive integer.`);
  }
  assertStringField(product, 'slug', file);
  assertStringField(product, 'name', file);
  assertStringField(product, 'description', file);
  assertStringField(product, 'usage_instructions', file);
  assertStringField(product, 'ingredients', file);
  if (!Array.isArray(product.long_description) || product.long_description.length === 0) {
    throw new Error(`${file}: field "long_description" must be a non-empty array.`);
  }
};

const files = (await readdir(inputDirectory)).filter(isProductJsonFile).sort();
const products = [];

for (const file of files) {
  const product = JSON.parse(await readFile(path.join(inputDirectory, file), 'utf8'));
  assertProductPayload(product, file);
  products.push({
    source_file: file,
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    long_description: product.long_description,
    usage_instructions: product.usage_instructions,
    ingredients: product.ingredients,
  });
}

const duplicateIds = products
  .map((product) => product.id)
  .filter((id, index, ids) => ids.indexOf(id) !== index);

const duplicateSlugs = products
  .map((product) => product.slug)
  .filter((slug, index, slugs) => slugs.indexOf(slug) !== index);

if (duplicateIds.length > 0 || duplicateSlugs.length > 0) {
  throw new Error(JSON.stringify({
    message: 'Duplicate product identities detected.',
    duplicateIds: [...new Set(duplicateIds)],
    duplicateSlugs: [...new Set(duplicateSlugs)],
  }, null, 2));
}

if (products.length === 0) {
  throw new Error(`No product JSON files found in ${inputDirectory}.`);
}

const delimiter = 'product_content_import_payload_20260627';
const payload = JSON.stringify(products);
const batchSize = Number.parseInt(process.env.PRODUCT_CONTENT_IMPORT_BATCH_SIZE || '8', 10);

const incomingCte = `incoming as (
  select *
  from jsonb_to_recordset($${delimiter}$${payload}$${delimiter}$::jsonb) as product(
    source_file text,
    id integer,
    slug text,
    name text,
    description text,
    long_description jsonb,
    usage_instructions text,
    ingredients text
  )
)`;

const changedPredicate = updateFields
  .map((field) => `products.${field} is distinct from incoming.${field}`)
  .join('\n      or ');

const dryRunSql = `with
${incomingCte},
matched as (
  select incoming.*, products.id as product_id
  from incoming
  join public.products products on products.id = incoming.id and products.slug = incoming.slug
),
unmatched as (
  select incoming.*
  from incoming
  left join public.products products on products.id = incoming.id and products.slug = incoming.slug
  where products.id is null
),
changed as (
  select incoming.id, incoming.slug, incoming.source_file
  from incoming
  join public.products products on products.id = incoming.id and products.slug = incoming.slug
  where ${changedPredicate}
)
select jsonb_pretty(jsonb_build_object(
  'incoming_count', (select count(*) from incoming),
  'matched_count', (select count(*) from matched),
  'unmatched_count', (select count(*) from unmatched),
  'changed_count', (select count(*) from changed),
  'unchanged_count', (select count(*) from matched) - (select count(*) from changed),
  'unmatched_samples', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'slug', slug, 'file', source_file) order by source_file) from (select * from unmatched limit 20) sample), '[]'::jsonb),
  'changed_samples', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'slug', slug, 'file', source_file) order by source_file) from (select * from changed limit 20) sample), '[]'::jsonb)
)) as report;
`;

const applySql = `begin;

create temp table tmp_product_content_import on commit drop as
select *
from jsonb_to_recordset($${delimiter}$${payload}$${delimiter}$::jsonb) as product(
  source_file text,
  id integer,
  slug text,
  name text,
  description text,
  long_description jsonb,
  usage_instructions text,
  ingredients text
);

do $$
declare
  incoming_count integer;
  duplicate_id_count integer;
  duplicate_slug_count integer;
  unmatched_count integer;
begin
  select count(*) into incoming_count from tmp_product_content_import;
  select count(*) into duplicate_id_count
  from (
    select id from tmp_product_content_import group by id having count(*) > 1
  ) duplicates;
  select count(*) into duplicate_slug_count
  from (
    select slug from tmp_product_content_import group by slug having count(*) > 1
  ) duplicates;
  select count(*) into unmatched_count
  from tmp_product_content_import incoming
  left join public.products products on products.id = incoming.id and products.slug = incoming.slug
  where products.id is null;

  if incoming_count <> ${products.length} then
    raise exception 'Unexpected incoming product count: %', incoming_count;
  end if;
  if duplicate_id_count > 0 or duplicate_slug_count > 0 then
    raise exception 'Duplicate identities found: duplicate_id_count=%, duplicate_slug_count=%', duplicate_id_count, duplicate_slug_count;
  end if;
  if unmatched_count > 0 then
    raise exception 'Import aborted: % incoming products do not match public.products by id + slug.', unmatched_count;
  end if;
end $$;

with updated as (
  update public.products products
  set
    name = incoming.name,
    description = incoming.description,
    long_description = incoming.long_description,
    usage_instructions = incoming.usage_instructions,
    ingredients = incoming.ingredients,
    updated_at = now()
  from tmp_product_content_import incoming
  where products.id = incoming.id
    and products.slug = incoming.slug
    and (
      ${changedPredicate}
    )
  returning products.id, products.slug, incoming.source_file
)
select jsonb_pretty(jsonb_build_object(
  'incoming_count', ${products.length},
  'updated_count', (select count(*) from updated),
  'updated_samples', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'slug', slug, 'file', source_file) order by source_file) from (select * from updated limit 20) sample), '[]'::jsonb)
)) as report;

commit;
`;

const verifySql = `with
${incomingCte},
mismatch as (
  select incoming.id, incoming.slug, incoming.source_file
  from incoming
  join public.products products on products.id = incoming.id and products.slug = incoming.slug
  where ${changedPredicate}
),
unmatched as (
  select incoming.*
  from incoming
  left join public.products products on products.id = incoming.id and products.slug = incoming.slug
  where products.id is null
)
select jsonb_pretty(jsonb_build_object(
  'incoming_count', (select count(*) from incoming),
  'unmatched_count', (select count(*) from unmatched),
  'mismatch_count', (select count(*) from mismatch),
  'mismatch_samples', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'slug', slug, 'file', source_file) order by source_file) from (select * from mismatch limit 20) sample), '[]'::jsonb)
)) as report;
`;

await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, 'payload.json'), `${JSON.stringify(products, null, 2)}\n`, 'utf8');
await writeFile(path.join(outputDirectory, 'dry-run.sql'), dryRunSql, 'utf8');
await writeFile(path.join(outputDirectory, 'apply.sql'), applySql, 'utf8');
await writeFile(path.join(outputDirectory, 'verify.sql'), verifySql, 'utf8');

const buildBatchSql = (batchProducts, batchIndex) => {
  const batchDelimiter = `${delimiter}_batch_${String(batchIndex).padStart(3, '0')}`;
  const batchPayload = JSON.stringify(batchProducts);
  const batchIncomingCte = `incoming as (
  select *
  from jsonb_to_recordset($${batchDelimiter}$${batchPayload}$${batchDelimiter}$::jsonb) as product(
    source_file text,
    id integer,
    slug text,
    name text,
    description text,
    long_description jsonb,
    usage_instructions text,
    ingredients text
  )
)`;

  const batchDryRunSql = `with
${batchIncomingCte},
matched as (
  select incoming.*, products.id as product_id
  from incoming
  join public.products products on products.id = incoming.id and products.slug = incoming.slug
),
unmatched as (
  select incoming.*
  from incoming
  left join public.products products on products.id = incoming.id and products.slug = incoming.slug
  where products.id is null
),
changed as (
  select incoming.id, incoming.slug, incoming.source_file
  from incoming
  join public.products products on products.id = incoming.id and products.slug = incoming.slug
  where ${changedPredicate}
)
select jsonb_pretty(jsonb_build_object(
  'batch', ${batchIndex},
  'incoming_count', (select count(*) from incoming),
  'matched_count', (select count(*) from matched),
  'unmatched_count', (select count(*) from unmatched),
  'changed_count', (select count(*) from changed),
  'unchanged_count', (select count(*) from matched) - (select count(*) from changed),
  'unmatched_samples', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'slug', slug, 'file', source_file) order by source_file) from (select * from unmatched limit 20) sample), '[]'::jsonb),
  'changed_samples', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'slug', slug, 'file', source_file) order by source_file) from (select * from changed limit 20) sample), '[]'::jsonb)
)) as report;
`;

  const batchApplySql = `begin;

create temp table tmp_product_content_import on commit drop as
select *
from jsonb_to_recordset($${batchDelimiter}$${batchPayload}$${batchDelimiter}$::jsonb) as product(
  source_file text,
  id integer,
  slug text,
  name text,
  description text,
  long_description jsonb,
  usage_instructions text,
  ingredients text
);

do $$
declare
  incoming_count integer;
  duplicate_id_count integer;
  duplicate_slug_count integer;
  unmatched_count integer;
begin
  select count(*) into incoming_count from tmp_product_content_import;
  select count(*) into duplicate_id_count
  from (
    select id from tmp_product_content_import group by id having count(*) > 1
  ) duplicates;
  select count(*) into duplicate_slug_count
  from (
    select slug from tmp_product_content_import group by slug having count(*) > 1
  ) duplicates;
  select count(*) into unmatched_count
  from tmp_product_content_import incoming
  left join public.products products on products.id = incoming.id and products.slug = incoming.slug
  where products.id is null;

  if incoming_count <> ${batchProducts.length} then
    raise exception 'Unexpected incoming product count in batch ${batchIndex}: %', incoming_count;
  end if;
  if duplicate_id_count > 0 or duplicate_slug_count > 0 then
    raise exception 'Duplicate identities found in batch ${batchIndex}: duplicate_id_count=%, duplicate_slug_count=%', duplicate_id_count, duplicate_slug_count;
  end if;
  if unmatched_count > 0 then
    raise exception 'Import batch ${batchIndex} aborted: % incoming products do not match public.products by id + slug.', unmatched_count;
  end if;
end $$;

with updated as (
  update public.products products
  set
    name = incoming.name,
    description = incoming.description,
    long_description = incoming.long_description,
    usage_instructions = incoming.usage_instructions,
    ingredients = incoming.ingredients,
    updated_at = now()
  from tmp_product_content_import incoming
  where products.id = incoming.id
    and products.slug = incoming.slug
    and (
      ${changedPredicate}
    )
  returning products.id, products.slug, incoming.source_file
)
select jsonb_pretty(jsonb_build_object(
  'batch', ${batchIndex},
  'incoming_count', ${batchProducts.length},
  'updated_count', (select count(*) from updated),
  'updated_samples', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'slug', slug, 'file', source_file) order by source_file) from (select * from updated limit 20) sample), '[]'::jsonb)
)) as report;

commit;
`;

  const batchVerifySql = `with
${batchIncomingCte},
mismatch as (
  select incoming.id, incoming.slug, incoming.source_file
  from incoming
  join public.products products on products.id = incoming.id and products.slug = incoming.slug
  where ${changedPredicate}
),
unmatched as (
  select incoming.*
  from incoming
  left join public.products products on products.id = incoming.id and products.slug = incoming.slug
  where products.id is null
)
select jsonb_pretty(jsonb_build_object(
  'batch', ${batchIndex},
  'incoming_count', (select count(*) from incoming),
  'unmatched_count', (select count(*) from unmatched),
  'mismatch_count', (select count(*) from mismatch),
  'mismatch_samples', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'slug', slug, 'file', source_file) order by source_file) from (select * from mismatch limit 20) sample), '[]'::jsonb)
)) as report;
`;

  return { dryRunSql: batchDryRunSql, applySql: batchApplySql, verifySql: batchVerifySql };
};

const batches = [];
for (let index = 0; index < products.length; index += batchSize) {
  batches.push(products.slice(index, index + batchSize));
}

const batchManifest = [];
for (const [zeroBasedIndex, batchProducts] of batches.entries()) {
  const batchIndex = zeroBasedIndex + 1;
  const prefix = `batch-${String(batchIndex).padStart(3, '0')}`;
  const sqlSet = buildBatchSql(batchProducts, batchIndex);
  const batchFiles = {
    dryRunSql: path.join(outputDirectory, `${prefix}-dry-run.sql`),
    applySql: path.join(outputDirectory, `${prefix}-apply.sql`),
    verifySql: path.join(outputDirectory, `${prefix}-verify.sql`),
  };
  await writeFile(batchFiles.dryRunSql, sqlSet.dryRunSql, 'utf8');
  await writeFile(batchFiles.applySql, sqlSet.applySql, 'utf8');
  await writeFile(batchFiles.verifySql, sqlSet.verifySql, 'utf8');
  batchManifest.push({
    batch: batchIndex,
    product_count: batchProducts.length,
    first_file: batchProducts[0]?.source_file,
    last_file: batchProducts.at(-1)?.source_file,
    files: batchFiles,
  });
}

await writeFile(
  path.join(outputDirectory, 'batch-manifest.json'),
  `${JSON.stringify({ batchSize, batchCount: batches.length, batches: batchManifest }, null, 2)}\n`,
  'utf8',
);

console.log(JSON.stringify({
  inputDirectory,
  outputDirectory,
  productCount: products.length,
  batchSize,
  batchCount: batches.length,
  files: {
    payload: path.join(outputDirectory, 'payload.json'),
    dryRunSql: path.join(outputDirectory, 'dry-run.sql'),
    applySql: path.join(outputDirectory, 'apply.sql'),
    verifySql: path.join(outputDirectory, 'verify.sql'),
    batchManifest: path.join(outputDirectory, 'batch-manifest.json'),
  },
}, null, 2));
