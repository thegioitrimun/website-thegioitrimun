import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const sourceUrl = 'https://provinces.open-api.vn/api/v2/?depth=2';
const response = await fetch(sourceUrl, { headers: { Accept: 'application/json' } });
if (!response.ok) {
  throw new Error(`Could not download Vietnam administrative units: ${response.status}`);
}

const source = await response.json();
const data = source.map((province) => ({
  code: Number(province.code),
  name: String(province.name || '').trim(),
  type: String(province.division_type || '').trim(),
  wards: (province.wards || []).map((ward) => ({
    code: Number(ward.code),
    name: String(ward.name || '').trim(),
    type: String(ward.division_type || '').trim(),
  })),
}));

const wardCount = data.reduce((total, province) => total + province.wards.length, 0);
if (data.length !== 34 || wardCount !== 3321) {
  throw new Error(`Unexpected administrative dataset: ${data.length} provinces, ${wardCount} wards.`);
}

const outputDirectory = path.resolve('public/data');
await mkdir(outputDirectory, { recursive: true });
await writeFile(
  path.join(outputDirectory, 'vietnam-administrative-units-2025.json'),
  `${JSON.stringify(data)}\n`,
  'utf8',
);

console.log(`Wrote ${data.length} provinces and ${wardCount} commune-level units.`);
