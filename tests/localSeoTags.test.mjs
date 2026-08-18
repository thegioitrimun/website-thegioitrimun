import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LOCAL_SEO_TAGS,
  inferLocalSeoTags,
  normalizeLocalSeoTags,
  toLocalSeoHashtag,
} from '../worker/seo/localSeoTags.js';

test('normalizes supported local SEO tags and removes duplicates', () => {
  assert.deepEqual(
    normalizeLocalSeoTags([
      'Trị mụn Phú Quốc',
      '#tri_mun_phu_quoc',
      'trị mụn lưng phú quốc',
      'không thuộc taxonomy',
    ]),
    ['trị mụn phú quốc', 'trị mụn lưng phú quốc'],
  );
});

test('infers acne tags without adding unrelated travel allergy tags', () => {
  const tags = inferLocalSeoTags({
    title: 'Điều trị mụn lưng hiệu quả',
    summary: 'Hướng dẫn chăm sóc mụn lưng và lựa chọn bác sĩ da liễu.',
    content: 'Da liễu chuyên sâu cho người bị mụn vùng lưng.',
  });

  assert.ok(tags.includes('trị mụn phú quốc'));
  assert.ok(tags.includes('trị mụn lưng phú quốc'));
  assert.ok(tags.includes('bác sĩ da liễu phú quốc'));
  assert.ok(!tags.includes('dị ứng hải sản phú quốc'));
  assert.ok(tags.length <= 5);
});

test('infers beach sun-care tags and caps the output at five entries', () => {
  const tags = inferLocalSeoTags({
    title: 'Cháy nắng khi đi biển và cách chọn kem chống nắng',
    summary: 'Chăm sóc da sau nắng cho khách du lịch biển Phú Quốc.',
    content: 'Bảo vệ da khi đi biển và xử lý cháy nắng đúng cách.',
  });

  assert.ok(tags.includes('cháy nắng biển phú quốc'));
  assert.ok(tags.includes('kem chống nắng đi biển phú quốc'));
  assert.ok(tags.length <= 5);
});

test('does not classify generic footer mentions as the primary article topic', () => {
  const tags = inferLocalSeoTags({
    title: 'Cách chăm sóc đau vai gáy tại nhà',
    summary: 'Bài viết giải thích các bước vận động nhẹ và khi nào nên đi khám.',
    content: 'Khám phá thêm các bài trị mụn, chống nắng và chăm sóc da trong thư viện.',
  });

  assert.deepEqual(tags, []);
});

test('formats Vietnamese phrases as readable hashtags', () => {
  assert.equal(toLocalSeoHashtag('khám da liễu ở đâu phú quốc'), '#khám_da_liễu_ở_đâu_phú_quốc');
});

test('exports the fourteen approved phrases', () => {
  assert.equal(LOCAL_SEO_TAGS.length, 14);
});
