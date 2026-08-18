#!/usr/bin/env node

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'ykcrngqhyinczmvwduox';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';

if (!ACCESS_TOKEN) {
  throw new Error('Missing SUPABASE_ACCESS_TOKEN');
}

const PRODUCT_INGREDIENT_PATCHES = [
  {
    slug: 'harker-herbals-gutbiome-balance-men-can-bang-he-vi-sinh-duong-ruot-130g',
    ingredients:
      'BIO-AZ BEVERAGE™ probiotic & prebiotic blend gồm Bacillus subtilis (1 tỷ CFU), chất xơ hòa tan từ ngô và chicory inulin; FIBRIOTICS™ gồm 36 loại trái cây và rau củ lên men cùng organic tapioca maltodextrin.',
    source:
      'https://harkerherbals.com/products/gut-biome-balance',
  },
  {
    slug: 'unichi-calcium-vitamin-d3-gummy-keo-tang-cuong-canxi-vitamin-d3-chac-khoe-xuong-60-vien',
    ingredients:
      'Maltitol syrup, tricalcium phosphate, gelatin, erythritol, purified water, hương dâu, malic acid, lactic acid, citric acid, sunflower seed oil, lactic acid bacteria flavour, yogurt flavour, glazing agent (carnauba wax và vegetable oil), carmine cochineal, vitamin D3 (cholecalciferol), beta-carotene.',
    source:
      'https://www.teddilab.com/products/t-calcium-vitamin-d3-gummy',
  },
  {
    slug: 'kem-giam-mun-mo-nam-tre-hoa-da-nanogize-tretinoin-0-1-10ml',
    ingredients:
      'Thành phần/hoạt chất chính: Tretinoin 0.1%. Với nhóm tretinoin, nên đối chiếu thêm bảng thành phần trên bao bì để xác nhận tá dược theo từng lô/phân phối.',
    source:
      'https://shop.nzheal.com/products/kem-giam-mun-mo-nam-tre-hoa-da-nanogize-tretinoin-0-1-10ml',
  },
  {
    slug: 'gel-lam-lanh-phuc-hoi-vet-thuong-lavior-wound-care-gel-15ml',
    ingredients:
      'Aqua (Water), Glycerin, Alcohol, Xanthan Gum, Aloe Barbadensis Leaf Juice, Phenoxyethanol, Inula Viscosa Flower/Leaf/Stem Extract, Allantoin, Tocopheryl Acetate (Vitamin E), Propanediol, Ethylhexylglycerin, Sodium Gluconate, Citric Acid, Sodium Hyaluronate, Potassium Sorbate, Sodium Benzoate.',
    source:
      'https://lavior.com/products/hydrogel-wound-dressing',
  },
  {
    slug: 'vien-bo-sung-vitamin-nang-cao-danh-cho-phu-nu-xtend-life-total-balance-womens-premium-210-vien',
    ingredients:
      'Nhóm thành phần nổi bật: vitamin A, C, D3, E, K2 và nhóm B; khoáng chất như canxi, magie, kẽm, selenium; amino acid như L-lysine, glutathione, taurine, arginine, methionine; chiết xuất/thảo dược như sea buckthorn, aloe vera, milk thistle, astragalus, olive leaf, turmeric, ginkgo biloba, grape seed; female health support blend gồm chasteberry, damiana, dong quai, feverfew, sarsaparilla; enzyme blend gồm bromelain, protease, amylase và lipase.',
    source:
      'https://global.xtendlife.com/products/total-balance-womens-premium',
  },
  {
    slug: 'segle-spf50-sun-care-gel-crema---kem-chng-nng-ph-rng-bo-v-ton-din-spf-50-pa',
    ingredients:
      'Aqua (Water), Ethylhexyl Methoxycinnamate, Butylene Glycol, Propylene Glycol, Polymethyl Methacrylate, Butyl Methoxydibenzoylmethane, Ethylhexyl Salicylate, Octocrylene, Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine, Dimethicone, Silica, Spirulina Maxima Extract, Ascorbic Acid, Citric Acid, Ascorbyl Palmitate, Glycerin, Titanium Dioxide, Tocopherol, C20-22 Alkyl Phosphate, C20-22 Alcohols, Tromethamine, Potassium Cetyl Phosphate, PEG-8, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Disodium EDTA, Carbomer, Potassium Sorbate, BHT, Parfum (Fragrance), Chlorphenesin, Phenoxyethanol, Benzyl Salicylate, Linalool.',
    source:
      'https://segle.vn/products/segle-facial-suncream-spf50',
  },
];

async function getServiceRoleKey() {
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`, {
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Cannot read api-keys (${response.status}): ${text.slice(0, 1000)}`);
  }

  const keys = JSON.parse(text);
  const serviceRole = keys.find((entry) => entry.name === 'service_role' && typeof entry.api_key === 'string')?.api_key;
  if (!serviceRole) {
    throw new Error('service_role key not found');
  }
  return serviceRole;
}

async function fetchProducts(serviceRole) {
  const response = await fetch(`https://${PROJECT_REF}.supabase.co/rest/v1/products?select=id,slug,name,ingredients&order=id.asc`, {
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Cannot read products (${response.status}): ${text.slice(0, 1000)}`);
  }

  return JSON.parse(text);
}

async function patchIngredients(serviceRole, slug, ingredients) {
  const response = await fetch(`https://${PROJECT_REF}.supabase.co/rest/v1/products?slug=eq.${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ ingredients }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Cannot update ${slug} (${response.status}): ${text.slice(0, 1000)}`);
  }

  return text ? JSON.parse(text) : [];
}

async function main() {
  const serviceRole = await getServiceRoleKey();
  const products = await fetchProducts(serviceRole);
  const bySlug = new Map(products.map((product) => [product.slug, product]));

  const missingInDb = products.filter((product) => !String(product.ingredients || '').trim()).map((product) => product.slug);

  const results = [];
  for (const patch of PRODUCT_INGREDIENT_PATCHES) {
    const product = bySlug.get(patch.slug);
    if (!product) {
      results.push({ slug: patch.slug, status: 'missing-product-record', source: patch.source });
      continue;
    }

    if (String(product.ingredients || '').trim()) {
      results.push({ slug: patch.slug, status: 'skipped-already-has-ingredients', source: patch.source });
      continue;
    }

    const updatedRows = await patchIngredients(serviceRole, patch.slug, patch.ingredients);
    results.push({
      slug: patch.slug,
      id: product.id,
      status: updatedRows.length > 0 ? 'updated' : 'updated-no-return',
      source: patch.source,
    });
  }

  const remaining = (await fetchProducts(serviceRole))
    .filter((product) => !String(product.ingredients || '').trim())
    .map((product) => ({ id: product.id, slug: product.slug, name: product.name }));

  console.log(JSON.stringify({
    totalProducts: products.length,
    missingBefore: missingInDb.length,
    patched: results,
    missingAfter: remaining.length,
    remaining,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
