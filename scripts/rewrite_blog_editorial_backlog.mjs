#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { buildMetaDescription, countWords, runQuery, sqlString } from './lib/seo_batch_shared.mjs';

const AUDIT_JSON_PATH = process.env.BLOG_EDITORIAL_AUDIT_JSON || 'output/audits/blog-editorial-audit.json';
const OUTPUT_DIR = process.env.BLOG_EDITORIAL_REWRITE_OUTPUT_DIR || 'output/audits';
const DRY_RUN = process.env.BLOG_EDITORIAL_REWRITE_DRY_RUN === '1';

const ACNE_CORE_SOURCES = [
  ['AAD: Adult acne treatment dermatologists recommend', 'https://www.aad.org/public/diseases/acne/diy/adult-acne-treatment'],
  ['AAD: 10 skin care habits that can worsen acne', 'https://www.aad.org/public/diseases/acne/skin-care/habits-stop'],
  ['Mayo Clinic: Nonprescription acne treatment', 'https://www.mayoclinic.org/diseases-conditions/acne/in-depth/acne-treatments/art-20045814'],
  ['MedlinePlus: Acne', 'https://medlineplus.gov/ency/article/000873.htm'],
];

const DIET_SOURCES = [
  ['AAD: Can the right diet get rid of acne?', 'https://www.aad.org/practice-tools/quality-care/clinical-guidelines/acne/role-of-diet-in-acne/'],
  ['AAD: Should I take vitamins or supplements for my skin?', 'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/supplements-for-your-skin'],
  ['Mayo Clinic: Nonprescription acne treatment', 'https://www.mayoclinic.org/diseases-conditions/acne/in-depth/acne-treatments/art-20045814'],
];

const HOME_REMEDY_SOURCES = [
  ['AAD: Adult acne treatment dermatologists recommend', 'https://www.aad.org/public/diseases/acne/diy/adult-acne-treatment'],
  ['AAD: How to treat a deep, painful pimple at home', 'https://www.aad.org/news/how-to-treat-painful-pimple-home'],
  ['Mayo Clinic: Nonprescription acne treatment', 'https://www.mayoclinic.org/diseases-conditions/acne/in-depth/acne-treatments/art-20045814'],
  ['NCCIH: How Safe Is This Product or Practice?', 'https://www.nccih.nih.gov/health/how-safe-is-this-product-or-practice'],
];

const ALOE_SOURCES = [
  ['NCCIH: Aloe vera', 'https://www.nccih.nih.gov/health/aloe-vera'],
  ...HOME_REMEDY_SOURCES.slice(0, 3),
];

const TURMERIC_SOURCES = [
  ['NCCIH: Turmeric', 'https://www.nccih.nih.gov/health/turmeric'],
  ...HOME_REMEDY_SOURCES.slice(0, 3),
];

const MEDICATION_SOURCES = [
  ['AAD: Adult acne treatment dermatologists recommend', 'https://www.aad.org/public/diseases/acne/diy/adult-acne-treatment'],
  ['Mayo Clinic: Nonprescription acne treatment', 'https://www.mayoclinic.org/diseases-conditions/acne/in-depth/acne-treatments/art-20045814'],
  ['MedlinePlus: Benzoyl peroxide topical', 'https://medlineplus.gov/druginfo/meds/a601026.html'],
  ['MedlinePlus: Adapalene', 'https://medlineplus.gov/druginfo/meds/a604001.html'],
  ['MedlinePlus: Tazarotene topical', 'https://medlineplus.gov/druginfo/meds/a616052.html'],
  ['MedlinePlus: Doxycycline', 'https://medlineplus.gov/druginfo/meds/a682063.html'],
];

const MISDIAGNOSIS_SOURCES = [
  ['AAD: Is that stubborn acne really acne?', 'https://www.aad.org/public/diseases/acne/really-acne/stubborn-acne'],
  ['MedlinePlus: Folliculitis', 'https://medlineplus.gov/ency/article/000823.htm'],
  ['MedlinePlus: Rosacea', 'https://medlineplus.gov/rosacea.html'],
  ['MedlinePlus: Warts', 'https://medlineplus.gov/warts.html'],
];

function compact(text) {
  return String(text || '')
    .trim()
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

function fitTextLength(text, min, max) {
  const clean = compact(text).replace(/\n+/g, ' ').trim();
  if (clean.length >= min && clean.length <= max) return clean;
  if (clean.length > max) {
    return `${clean.slice(0, max - 3).replace(/[,:;\-\s]+$/g, '')}...`;
  }
  return `${clean} ${'Bài viết tập trung vào cách hiểu an toàn hơn, tránh tự xử trí sai và nhận biết khi nào nên đi khám.'.slice(0, Math.max(0, max - clean.length - 1))}`.trim();
}

function sentenceCase(value) {
  const text = String(value || '').trim();
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function stripNoise(title) {
  return String(title || '')
    .replace(/^\[giải đáp\]\s*/i, '')
    .replace(/\bgiải đáp từ bác sĩ da liễu\b/gi, '')
    .replace(/\bbác sĩ da liễu\b/gi, '')
    .replace(/\bbác sĩ\b/gi, '')
    .replace(/\breview\b/gi, '')
    .replace(/\bđược yêu thích nhất hiện nay\b/gi, '')
    .replace(/\bđược ưa chuộng nhất năm 2025\b/gi, '')
    .replace(/\bđược tin dùng năm 2025\b/gi, '')
    .replace(/\b2025\b/gi, '')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\s+-\s+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function slugIncludes(slug, patterns) {
  return patterns.some((pattern) => slug.includes(pattern));
}

function mdSources(entries) {
  const seen = new Set();
  const lines = ['## Nguồn tham khảo y khoa', ''];
  for (const [label, url] of entries) {
    const key = `${label}|${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`- [${label}](${url})`);
  }
  return lines.join('\n');
}

function finalize({ title, summary, content, sources }) {
  let cleanTitle = sentenceCase(stripNoise(title)).replace(/\s+\?/g, '?').trim();
  if (cleanTitle.length < 25) {
    cleanTitle = `${cleanTitle} trong chăm sóc da mụn`.trim();
  }
  const cleanContent = compact(content);
  const cleanSummary = fitTextLength(summary, 110, 220);
  const metaDescription = fitTextLength(buildMetaDescription(cleanSummary, cleanContent, cleanTitle), 120, 170);
  return { title: cleanTitle, summary: cleanSummary, metaDescription, content: cleanContent, sources };
}

function buildFoodTitle(title) {
  const clean = stripNoise(title).replace(/^TOP\s+\d+\s*/i, '').trim();
  if (/^ăn\s+/i.test(clean)) return clean.replace(/\?+$/, '?');
  if (/^uống\s+/i.test(clean)) return clean.replace(/\?+$/, '?');
  if (/bị mụn nên ăn/i.test(clean)) return 'Người bị mụn nên ăn uống thế nào để da ổn định hơn?';
  if (/thực phẩm gây mụn/i.test(clean)) return 'Chế độ ăn có thể ảnh hưởng đến mụn như thế nào?';
  if (/vitamin/i.test(clean)) return clean.replace(/\?+$/, '?');
  return clean || 'Chế độ ăn có thể ảnh hưởng đến mụn như thế nào?';
}

function buildFoodArticle(post) {
  const title = buildFoodTitle(post.title);
  const itemMatch = title.match(/^(ăn|uống)\s+(.+?)\s+có/i);
  const item = itemMatch ? itemMatch[2].trim() : '';
  const isSupplement = /(vitamin|kẽm|sắt|canxi|b2|vitamin c|vitamin e)/i.test(title);
  const isGenericDiet = /ăn gì|kiêng ăn|thực phẩm|rau gì|mát gan/i.test(title);

  const summary = isGenericDiet
    ? 'Mụn không bị quyết định bởi một món ăn riêng lẻ. Bài viết giúp bạn nhìn lại vai trò thực sự của chế độ ăn, thực phẩm dễ làm mụn nặng hơn ở một số người và cách theo dõi cơ địa hợp lý.'
    : `Không có bằng chứng cho thấy ${item || 'thực phẩm này'} sẽ gây mụn ở mọi người. Điều quan trọng hơn là tổng thể chế độ ăn, lượng đường hấp thu nhanh, sữa bò ở một số người và cách theo dõi phản ứng thật của da.`;

  const content = compact(`
${isGenericDiet
    ? 'Chế độ ăn có thể ảnh hưởng đến mụn, nhưng thường không theo kiểu “ăn một món là nổi mụn ngay”. Dữ liệu hiện có cho thấy một số yếu tố như thực phẩm có tải đường huyết cao và sữa bò có thể làm mụn nặng hơn ở một số người. Tuy nhiên, mụn vẫn là bệnh lý đa yếu tố; vì vậy, thay đổi ăn uống chỉ là một phần của kế hoạch kiểm soát mụn.'
    : `${title} là câu hỏi rất thường gặp khi da đang bùng mụn. Cách trả lời an toàn nhất là: không có bằng chứng cho thấy ${item || 'thực phẩm hoặc đồ uống này'} gây mụn ở tất cả mọi người. Điều quan trọng hơn là bối cảnh dùng, lượng dùng, tổng thể chế độ ăn và cơ địa từng người.`}

## Điều gì đã được ghi nhận về ăn uống và mụn?

Theo AAD, chế độ ăn có thể đóng vai trò trong một số trường hợp, nhưng hiếm khi là nguyên nhân duy nhất. Những yếu tố có dữ liệu được nhắc đến nhiều hơn là thực phẩm làm đường huyết tăng nhanh và sữa bò ở một số người. Vì vậy, thay vì quy hết trách nhiệm cho một món ăn, cách tiếp cận hợp lý hơn là nhìn vào **mẫu ăn uống lặp lại**.

## ${isSupplement ? 'Vì sao uống bổ sung vẫn có thể thấy nổi mụn?' : 'Vì sao nhiều người cảm thấy sau khi ăn hoặc uống thì da nổi mụn hơn?'}

### 1. Trùng thời điểm chứ không phải quan hệ nhân quả trực tiếp

Mụn hình thành âm thầm trong nhiều ngày trước khi bùng lên bề mặt. Vì vậy, một đợt mụn xuất hiện sau khi bạn ${itemMatch ? itemMatch[1].toLowerCase() : 'dùng'} ${item || 'một món nào đó'} chưa đủ để kết luận đó là nguyên nhân trực tiếp.

### 2. Tổng thể chế độ ăn quan trọng hơn một món riêng lẻ

Nếu khẩu phần của bạn kéo dài trong tình trạng nhiều đường hấp thu nhanh, nước ngọt, món tráng miệng ngọt, ngủ muộn và stress, da có thể bùng mụn dù món bị “đổ lỗi” thực ra không phải yếu tố chính.

### 3. Công thức sản phẩm hoặc cách dùng có thể là vấn đề

${isSupplement
    ? 'Với viên uống hoặc thực phẩm bổ sung, đường, hương liệu, tá dược hoặc liều dùng quá mức mới là thứ cần xem lại trước. Ngoài ra, không phải ai cũng cần bổ sung vitamin nếu đang ăn uống bình thường.'
    : 'Với thực phẩm chế biến sẵn hoặc đồ uống đóng gói, lượng đường thêm vào, sữa, whey hoặc phụ gia đôi khi đáng lưu ý hơn chính nguyên liệu chính.'}

## ${isGenericDiet ? 'Nếu đang bị mụn, nên ăn theo hướng nào?' : `Có cần kiêng hẳn ${item || 'món này'} không?`}

${isGenericDiet
    ? `Không nên chuyển sang chế độ kiêng khem cực đoan. Cách an toàn hơn là ưu tiên bữa ăn cân bằng, tăng rau và thực phẩm ít tinh chế, hạn chế đồ ngọt đậm, quan sát phản ứng của da với sữa bò nếu bạn nghi ngờ mình nhạy với nhóm này, và duy trì lịch sinh hoạt đều hơn.`
    : `Nếu bạn chưa từng thấy da phản ứng rõ và lặp lại nhiều lần với ${item || 'món này'}, không có lý do mạnh để loại bỏ hoàn toàn. Điều hợp lý là dùng ở mức vừa phải, tránh biến nó thành phần chiếm ưu thế trong chế độ ăn, rồi theo dõi da trong vài tuần.`}

## Khi nào nên nghĩ đến việc điều chỉnh chế độ ăn nghiêm túc hơn?

- Mụn nặng lên lặp đi lặp lại sau cùng một nhóm thực phẩm hoặc đồ uống.
- Bạn đang dùng nhiều thực phẩm có tải đường huyết cao, ít ngủ và stress kéo dài.
- Bạn đang tự dùng nhiều loại bổ sung cùng lúc mà không có chỉ định rõ ràng.
- Mụn không cải thiện dù đã chăm sóc da đúng và đều trong nhiều tuần.

## Điều gì đáng làm hơn việc kiêng bừa?

- Duy trì routine dịu nhẹ, chống nắng và treatment phù hợp.
- Theo dõi bằng nhật ký ăn uống nếu thật sự nghi ngờ có yếu tố kích phát.
- Không dùng liều cao thực phẩm bổ sung chỉ vì hy vọng “đẹp da nhanh”.
- Đi khám nếu mụn viêm nhiều, đau, để lại sẹo hoặc kéo dài.

${mdSources(isSupplement ? [...DIET_SOURCES, ['NIH ODS: Zinc fact sheet for consumers', 'https://ods.od.nih.gov/pdf/factsheets/Zinc-Consumer.pdf']] : DIET_SOURCES)}
  `);

  return finalize({ title, summary, content, sources: isSupplement ? [...DIET_SOURCES, ['NIH ODS: Zinc fact sheet for consumers', 'https://ods.od.nih.gov/pdf/factsheets/Zinc-Consumer.pdf']] : DIET_SOURCES });
}

function buildHomeRemedyArticle(post) {
  const title = stripNoise(post.title)
    .replace(/^tham khảo\s+/i, '')
    .replace(/^tổng hợp\s+/i, '')
    .replace(/^gợi ý\s+/i, '');
  const subject = (() => {
    const patterns = [
      [/nha đam/i, 'nha đam'],
      [/nghệ/i, 'nghệ'],
      [/khổ qua/i, 'khổ qua'],
      [/mật ong/i, 'mật ong'],
      [/khoai tây/i, 'khoai tây'],
      [/rau má/i, 'rau má'],
      [/dầu dừa/i, 'dầu dừa'],
      [/mỡ trăn/i, 'mỡ trăn'],
      [/nước vo gạo/i, 'nước vo gạo'],
      [/cà chua/i, 'cà chua'],
      [/phấn rôm/i, 'phấn rôm'],
      [/đá lạnh|nước đá/i, 'đá lạnh'],
      [/giấm táo/i, 'giấm táo'],
      [/chanh/i, 'chanh'],
    ];
    for (const [regex, label] of patterns) if (regex.test(title)) return label;
    return 'nguyên liệu tự nhiên';
  })();

  const sources =
    /nha đam/i.test(subject) ? ALOE_SOURCES :
    /nghệ/i.test(subject) ? TURMERIC_SOURCES :
    HOME_REMEDY_SOURCES;

  const summary = `${sentenceCase(subject)} thường được truyền miệng như một mẹo trị mụn tại nhà, nhưng bằng chứng lâm sàng thường hạn chế hoặc không đủ mạnh. Bài viết giúp bạn nhìn đúng vai trò hỗ trợ, giới hạn và rủi ro kích ứng khi tự dùng.`;
  const content = compact(`
${sentenceCase(subject)} là nguyên liệu xuất hiện rất nhiều trong các mẹo trị mụn tại nhà. Vấn đề là mức độ phổ biến trên mạng không đồng nghĩa với hiệu quả điều trị đã được chứng minh. Với da mụn, điều quan trọng không phải là nguyên liệu “tự nhiên” hay “quen thuộc”, mà là nó có đủ bằng chứng, có phù hợp với hàng rào da hiện tại và có trì hoãn điều trị đúng hay không.

## ${sentenceCase(subject)} có phải phương pháp trị mụn chuẩn không?

Không. Các hướng dẫn điều trị mụn hiện hành không xem ${subject} là phương pháp nền tảng để kiểm soát mụn trứng cá. Một số nguyên liệu tự nhiên có thể có tiềm năng chống viêm hoặc làm dịu da ở mức nghiên cứu cơ bản, nhưng điều đó chưa đủ để xem là treatment chính.

## Vì sao mẹo dân gian này vẫn được nhiều người áp dụng?

Có ba lý do thường gặp:

- nguyên liệu dễ kiếm và rẻ;
- da có thể thấy “dịu” hoặc “khô” tạm thời sau khi dùng;
- người dùng dễ quy kết sự cải thiện tự nhiên của mụn cho nguyên liệu vừa thử.

Nhưng mụn là bệnh lý tiến triển theo đợt. Một nốt mụn tự xẹp không có nghĩa là phương pháp vừa dùng đã điều trị đúng cơ chế.

## Rủi ro khi tự dùng ${subject} trên da mụn

### Kích ứng da

Da mụn, nhất là da đang dùng treatment, dễ đỏ rát hơn bình thường. Một nguyên liệu tưởng chừng lành tính vẫn có thể gây châm chích, ngứa, nóng da hoặc nổi thêm sẩn viêm.

### Không kiểm soát được nồng độ và độ sạch

Nguyên liệu tươi, hỗn hợp tự xay hoặc công thức trộn nhiều thành phần không có chuẩn nồng độ ổn định. Bạn cũng khó kiểm soát nguy cơ nhiễm bẩn hoặc phản ứng chéo với các thứ đang bôi trên da.

### Trì hoãn điều trị đúng

Đây là rủi ro lớn nhất. Nhiều người thử mẹo tại nhà hàng tuần đến hàng tháng trong khi mụn tiếp tục viêm, để thâm, hoặc bắt đầu sẹo hóa.

## Nếu vẫn muốn thử, cần giữ giới hạn nào?

- Không bôi lên da đang trợt xước, rỉ dịch hoặc mới nặn mụn.
- Không trộn với chanh, cồn, tinh dầu mạnh hoặc các chất dễ gây xót.
- Thử trên vùng nhỏ trước.
- Ngừng ngay nếu da rát, đỏ, ngứa hoặc nóng bừng.
- Không dùng ${subject} để thay thế toàn bộ routine trị mụn có cơ sở.

## Điều gì đáng ưu tiên hơn?

Nếu mục tiêu là làm dịu da, hãy ưu tiên sản phẩm đơn giản, ít hương liệu và không gây bít tắc. Nếu mục tiêu là giảm mụn thật sự, treatment đã được nghiên cứu rõ hơn như adapalene, benzoyl peroxide, salicylic acid hoặc azelaic acid thường đáng tin cậy hơn. Với mụn viêm vừa đến nặng, bác sĩ da liễu nên là người quyết định bước tiếp theo.

${mdSources(sources)}
  `);
  return finalize({ title, summary, content, sources });
}

function buildConditionArticle(post) {
  const title = stripNoise(post.title).replace(/\s*&\s*/g, ' và ');
  const summary = `${title} là chủ đề dễ bị hiểu theo mẹo truyền miệng hoặc tự xử trí sai. Bài viết hệ thống lại cách nhận biết, nguyên nhân thường gặp, hướng xử lý an toàn và thời điểm nên đi khám để tránh thâm sẹo hoặc bỏ sót bệnh da liễu khác.`;
  const extraSources = [];
  if (/viêm nang lông/i.test(title)) extraSources.push(['MedlinePlus: Folliculitis', 'https://medlineplus.gov/ency/article/000823.htm']);
  if (/mụn trứng cá đỏ/i.test(title)) extraSources.push(['MedlinePlus: Rosacea', 'https://medlineplus.gov/rosacea.html']);
  if (/mụn cơm/i.test(title)) extraSources.push(['MedlinePlus: Warts', 'https://medlineplus.gov/warts.html']);
  if (/mụn mọc quanh miệng/i.test(title)) extraSources.push(['MedlinePlus: Perioral dermatitis', 'https://medlineplus.gov/ency/article/001455.htm']);
  const sources = extraSources.length ? [...MISDIAGNOSIS_SOURCES, ...extraSources] : ACNE_CORE_SOURCES;
  const content = compact(`
${title} không chỉ là câu chuyện thẩm mỹ. Nhiều tình trạng có thể trông giống mụn nhưng cơ chế khác nhau, đáp ứng với sản phẩm cũng rất khác nhau. Vì vậy, bước đầu tiên luôn là nhận diện đúng loại tổn thương thay vì bôi thử quá nhiều thứ cùng lúc.

## Cần nhìn tình trạng này theo hướng nào?

Nếu đây là mụn trứng cá thật sự, nguyên nhân thường liên quan đến bít tắc nang lông, bã nhờn, phản ứng viêm và vi khuẩn C. acnes. Nếu tổn thương đau nhiều, nằm sâu, kéo dài hoặc khu trú ở vị trí không điển hình, bác sĩ da liễu thường phải nghĩ thêm đến các tình trạng dễ nhầm khác.

## Những nguyên nhân hoặc yếu tố làm nặng thêm

- chăm sóc da quá mạnh hoặc chồng nhiều treatment;
- mỹ phẩm gây bít tắc hoặc không hợp;
- nội tiết, stress, thiếu ngủ;
- ma sát, thói quen sờ nặn, đội mũ, đeo khẩu trang hoặc cọ xát kéo dài;
- dùng thuốc hoặc sản phẩm bôi gây kích ứng.

## Xử lý an toàn trước khi nghĩ đến thủ thuật

### Giữ routine tối giản

Rửa mặt dịu nhẹ, dưỡng ẩm không gây bít tắc và chống nắng là nền tảng. Nếu đang kích ứng, ưu tiên phục hồi hàng rào da trước khi thêm sản phẩm mới.

### Không nặn khi chưa rõ loại tổn thương

Các tổn thương đau sâu, cứng, nằm sát vùng mũi miệng hoặc dễ để sẹo không nên tự nặn. Việc nặn sai lúc có thể làm viêm lan rộng hoặc để lại thâm sẹo kéo dài.

### Dùng treatment theo mục tiêu rõ ràng

Với mụn trứng cá thông thường, có thể cân nhắc hoạt chất không kê đơn phù hợp với độ nhạy cảm của da. Nhưng nếu nghi ngờ là tình trạng dễ nhầm với mụn, tốt hơn nên khám trước khi tự điều trị kéo dài.

## Khi nào nên đi khám sớm?

- tổn thương đau nhiều, lan nhanh hoặc tái đi tái lại;
- đã để lại sẹo, thâm kéo dài hoặc biến dạng da;
- bạn nghi ngờ đây không phải mụn trứng cá thông thường;
- đã chăm sóc đúng nhiều tuần nhưng không cải thiện.

${mdSources(sources)}
  `);
  return finalize({ title, summary, content, sources });
}

function buildAftercareArticle(post) {
  const rawTitle = stripNoise(post.title);
  const title = /peel da/i.test(rawTitle) && /sản phẩm/i.test(rawTitle)
    ? 'Peel da tại nhà: khi nào không nên tự dùng sản phẩm mạnh'
    : rawTitle;
  const summary = `${title} là nhóm câu hỏi rất dễ bị trả lời bằng mẹo lan truyền trên mạng. Bài viết tập trung vào cách chăm da sau thủ thuật hoặc sau kích ứng theo hướng an toàn hơn, giảm nguy cơ viêm kéo dài, thâm và sẹo.`;
  const content = compact(`
${title} thường được tìm kiếm khi da đang ở trạng thái nhạy cảm: vừa nặn mụn, vừa peel, vừa lăn kim hoặc vừa nổi mụn sau một sản phẩm mới. Ở giai đoạn này, mục tiêu quan trọng nhất không phải “đẩy nhanh kết quả”, mà là giảm viêm và bảo vệ hàng rào da.

## Nguyên tắc xử lý an toàn

### 1. Giảm số bước trong routine

Khi da vừa chịu tổn thương cơ học hoặc hóa học, việc chồng thêm nhiều hoạt chất mạnh dễ làm nóng rát kéo dài. Routine nên quay về mức tối giản: làm sạch dịu nhẹ, dưỡng ẩm phù hợp, chống nắng và tránh các yếu tố gây ma sát.

### 2. Không cố làm khô hoặc làm sạch quá mức

Chà xát mạnh, tẩy da chết, cồn bôi, chanh, kem đánh răng hoặc mặt nạ tự chế đều có thể khiến vùng da vừa tổn thương viêm hơn và lâu lành hơn.

### 3. Theo dõi xem đây là kích ứng hay bùng mụn thật

Nếu da đỏ rát lan tỏa, châm chích, bong vảy hoặc nóng sau khi dùng sản phẩm mới, đó thường nghiêng về kích ứng hơn là “đẩy mụn”. Nếu tiếp tục dùng trong tình huống này, da có thể xấu đi rõ rệt.

## Khi nào có thể tự theo dõi, khi nào cần khám?

Bạn có thể theo dõi ngắn hạn nếu tổn thương nhẹ, khu trú và giảm dần sau vài ngày chăm sóc tối giản. Nên đi khám nếu có mụn mủ lan rộng, đau sâu, rỉ dịch, sưng nóng đỏ đau, hoặc phản ứng kéo dài sau peel, laser, lăn kim hay sản phẩm mới.

## Mục tiêu đúng sau can thiệp trên da mụn

Thay vì hỏi “bôi gì cho xẹp ngay”, nên hỏi:

- da đang cần phục hồi hay cần treatment?
- có dấu hiệu nhiễm trùng hoặc viêm nặng không?
- sản phẩm đang dùng có làm da kích ứng thêm không?

Trả lời đúng ba câu này thường hữu ích hơn rất nhiều so với việc thử thêm một mẹo mới.

${mdSources(ACNE_CORE_SOURCES)}
  `);
  return finalize({ title, summary, content, sources: ACNE_CORE_SOURCES });
}

function productGuideTitle(title) {
  const clean = stripNoise(title)
    .replace(/^top\s*\d+\s+/i, '')
    .replace(/^\d+\s+/i, '')
    .replace(/\bđược ưa chuộng.*$/i, '')
    .replace(/\bđược tin dùng.*$/i, '')
    .replace(/\bbán chạy.*$/i, '')
    .replace(/\bbác sĩ khuyên dùng.*$/i, '')
    .trim();

  if (/serum b5/i.test(clean)) return 'Serum B5 cho da dầu mụn: cách chọn và lưu ý khi dùng';
  if (/huyết thanh trị mụn/i.test(clean)) return 'Serum trị mụn: có nên dùng và cách chọn an toàn';
  if (/serum/i.test(clean) && /mụn đầu đen/i.test(clean)) return 'Serum cho da có mụn đầu đen: cách chọn và lưu ý khi dùng';
  if (/sữa rửa mặt/i.test(clean)) return 'Sữa rửa mặt cho da dầu mụn: cách chọn và cách dùng';
  if (/kem chống nắng/i.test(clean)) return 'Kem chống nắng cho da dầu mụn: tiêu chí chọn và cách dùng';
  if (/kem trị mụn trứng cá tuổi dậy thì/i.test(clean)) return 'Trị mụn tuổi dậy thì: cách chọn sản phẩm bôi an toàn';
  if (/thuốc bôi trị mụn đầu trắng/i.test(clean)) return 'Mụn đầu trắng: khi nào cần thuốc bôi và cách dùng an toàn';
  if (/thuốc trị mụn viêm/i.test(clean)) return 'Điều trị mụn viêm: khi nào cần thuốc và lưu ý';
  if (/thuốc trị mụn lưng/i.test(clean)) return 'Điều trị mụn lưng: khi nào cần thuốc bôi hoặc thuốc uống?';
  if (/miếng dán/i.test(clean)) return 'Miếng dán mụn đầu đen: khi nào nên dùng và giới hạn của phương pháp';
  if (/gel lột/i.test(clean)) return 'Gel lột mụn đầu đen: khi nào không nên dùng và lựa chọn thay thế';
  if (/mặt nạ đất sét/i.test(clean)) return 'Da mụn có nên dùng mặt nạ đất sét không?';
  if (/mặt nạ giấy/i.test(clean)) return 'Da mụn có nên dùng mặt nạ giấy không?';
  if (/nhau thai cừu/i.test(clean)) return 'Da mụn có nên dùng mặt nạ nhau thai cừu không?';
  if (/mặt nạ giảm thâm mụn/i.test(clean)) return 'Mặt nạ giảm thâm mụn: vai trò và giới hạn cần biết';
  if (/mặt nạ kháng viêm/i.test(clean)) return 'Mặt nạ cho da viêm sau mụn: khi nào nên dùng?';
  if (/peel da/i.test(clean) && /sản phẩm/i.test(clean)) return 'Peel da tại nhà: khi nào không nên tự dùng sản phẩm mạnh';
  if (/mặt nạ/i.test(clean)) return 'Mặt nạ cho da mụn: khi nào nên dùng và giới hạn';
  if (/bha kết hợp/i.test(clean)) return 'BHA nên phối hợp thế nào trong routine trị mụn?';
  if (/aha hay bha/i.test(clean)) return 'AHA hay BHA cho da mụn ẩn: chọn theo mục tiêu nào?';
  if (/bha hay retinol/i.test(clean)) return 'BHA hay retinol cho mụn ẩn: nên chọn theo tình trạng da';
  if (/tretinoin hay adapalene/i.test(clean)) return 'Tretinoin hay adapalene cho mụn: nên chọn theo mức độ nào?';
  if (/megaduo.*klenzit|klenzit.*megaduo/i.test(clean)) return 'Khi nào nên phối hợp hoặc đổi sản phẩm trị mụn trong routine?';
  if (/derma forte.*megaduo|megaduo.*derma forte/i.test(clean)) return 'Sản phẩm bôi thâm sau mụn nên so sánh theo tiêu chí nào?';
  if (/adapalene/i.test(clean)) return 'Adapalene trong điều trị mụn: công dụng và lưu ý';
  if (/tazarotene/i.test(clean)) return 'Tazarotene trong điều trị mụn: công dụng và lưu ý';
  if (/doxycycline/i.test(clean)) return 'Doxycycline trong điều trị mụn: khi nào được chỉ định?';
  if (/epiduo/i.test(clean)) return 'Epiduo trong điều trị mụn: công dụng và lưu ý';
  if (/differin/i.test(clean)) return 'Differin gel trong điều trị mụn: công dụng và lưu ý';
  if (/niacinamide/i.test(clean)) return 'Niacinamide cho da mụn và thâm sau mụn: cách dùng an toàn';
  if (/retinol/i.test(clean)) return 'Retinol cho da mụn: khi nào nên dùng và khi nào nên tránh';
  if (/glycolic acid/i.test(clean)) return 'Glycolic acid cho da mụn: vai trò và cách dùng an toàn';
  if (/bha/i.test(clean) || /aha/i.test(clean)) return 'AHA/BHA cho da dầu mụn: cách chọn và giới hạn cần biết';
  if (/sulfur|lưu huỳnh/i.test(clean)) return 'Lưu huỳnh trong điều trị mụn: khi nào có thể cân nhắc?';
  if (/laser/i.test(clean)) return 'Laser trong điều trị mụn và thâm mụn: điều cần biết';
  if (/ipl/i.test(clean)) return 'IPL trong da liễu: khi nào có thể được cân nhắc cho da mụn?';
  if (/tế bào gốc/i.test(clean)) return 'Tế bào gốc trong điều trị mụn: kỳ vọng nào là thực tế?';
  if (/nước tẩy trang/i.test(clean)) return 'Da mụn có nên dùng nước tẩy trang không?';
  if (/tẩy tế bào chết/i.test(clean)) return 'Tẩy tế bào chết cho da dầu mụn: khi nào nên dùng?';
  if (/serum/i.test(clean)) return 'Serum cho da mụn: cách chọn và cách dùng an toàn';
  return clean || 'Sản phẩm trị mụn: cách chọn và giới hạn cần biết';
}

function selectProductSources(title) {
  const sources = [...ACNE_CORE_SOURCES];
  if (/adapalene|differin/i.test(title)) sources.push(['MedlinePlus: Adapalene', 'https://medlineplus.gov/druginfo/meds/a604001.html']);
  if (/tazarotene/i.test(title)) sources.push(['MedlinePlus: Tazarotene topical', 'https://medlineplus.gov/druginfo/meds/a616052.html']);
  if (/doxycycline|kháng sinh/i.test(title)) sources.push(['MedlinePlus: Doxycycline', 'https://medlineplus.gov/druginfo/meds/a682063.html']);
  if (/benzoyl peroxide|epiduo/i.test(title)) sources.push(['MedlinePlus: Benzoyl peroxide topical', 'https://medlineplus.gov/druginfo/meds/a601026.html']);
  return sources;
}

function buildProductArticle(post) {
  const title = productGuideTitle(post.title);
  const sources = selectProductSources(title);
  const summary = `${title} không nên được đánh giá chỉ bằng review hoặc danh sách “top”. Bài viết tập trung vào vai trò thực sự của hoạt chất hoặc sản phẩm, nguy cơ kích ứng và tiêu chí chọn dùng an toàn hơn cho da mụn.`;
  const content = compact(`
${title} là nhóm chủ đề rất dễ bị biến thành nội dung bán hàng. Với da mụn, cách tiếp cận an toàn hơn là bỏ tư duy “sản phẩm nào tốt nhất cho tất cả mọi người” và thay bằng câu hỏi: sản phẩm hoặc hoạt chất này có mục tiêu gì, có phù hợp với kiểu mụn và mức chịu đựng của da mình hay không?

## Vai trò thực sự của sản phẩm hoặc hoạt chất này

Một sản phẩm cho da mụn thường chỉ làm tốt một vài việc: làm sạch, hỗ trợ thông thoáng lỗ chân lông, giảm viêm, giảm kích ứng, bảo vệ khỏi nắng hoặc hỗ trợ phục hồi hàng rào da. Vì vậy, đừng kỳ vọng một món có thể vừa trị mụn, vừa trị thâm, vừa se khít lỗ chân lông, vừa thay luôn điều trị chuyên khoa.

## Cách chọn hợp lý hơn là chọn theo “top list”

### 1. Chọn theo mục tiêu

Bạn đang cần giảm bít tắc, giảm viêm, phục hồi da hay chống nắng? Mỗi mục tiêu cần nhóm sản phẩm khác nhau. Chọn sai mục tiêu là lý do rất thường gặp khiến routine càng ngày càng phức tạp nhưng kết quả không tốt hơn.

### 2. Chọn theo độ dung nạp của da

Da đang đỏ rát hoặc bong tróc sẽ không phải lúc tốt để thêm hoạt chất mạnh. Trong giai đoạn này, thứ cần ưu tiên thường là giảm kích ứng và ổn định hàng rào da trước.

### 3. Chọn theo vị trí của nó trong routine

Nhiều lỗi xảy ra không phải vì sản phẩm “dở”, mà vì dùng sai thời điểm, dùng quá dày, kết hợp chồng chéo với treatment khác hoặc tăng tần suất quá nhanh.

## Khi nào không nên tự mua theo review?

- Bạn có mụn nốt, mụn nang hoặc bắt đầu sẹo.
- Da rất nhạy, từng kích ứng với nhiều sản phẩm.
- Bạn đang mang thai, cho con bú hoặc có bệnh da liễu khác đi kèm.
- Bạn đang dùng thuốc kê đơn và muốn thêm một sản phẩm hoạt tính mạnh.

## Nếu muốn bắt đầu an toàn hơn

- Thêm từng sản phẩm một.
- Thử ở vùng nhỏ trước.
- Bắt đầu với tần suất thấp nếu là sản phẩm hoạt tính.
- Không lấy cảm giác châm chích làm dấu hiệu “đang có tác dụng”.
- Ngừng và đánh giá lại nếu da đỏ rát, nóng, bong vảy kéo dài.

## Dấu hiệu cho thấy đã đến lúc cần bác sĩ da liễu

Bạn nên đi khám nếu đã thử nhiều sản phẩm nhưng mụn vẫn nặng dần, nếu mỗi lần thêm sản phẩm mới da đều kích ứng, hoặc nếu bạn cần dùng thuốc bôi, thuốc uống, peel, laser hay thủ thuật liên quan. Lúc này, kế hoạch điều trị cá nhân hóa thường giá trị hơn nhiều so với việc tiếp tục thử sản phẩm theo danh sách xếp hạng.

${mdSources(sources)}
  `);
  return finalize({ title, summary, content, sources });
}

function buildGeneralAcneArticle(post) {
  const title = stripNoise(post.title)
    .replace(/^bật mí\s+/i, '')
    .replace(/^chia sẻ\s+/i, '')
    .replace(/^bác sĩ giải đáp\s+/i, '')
    .replace(/^3 nỗi lo lớn nhất khi trị mụn:.*$/i, 'Ba vấn đề người điều trị mụn thường quan tâm: hiệu quả, chi phí và thời gian')
    .trim();
  const summary = `${title} là chủ đề người bị mụn thường tìm rất nhiều nhưng dễ gặp nội dung thổi phồng. Bài viết hệ thống lại điều quan trọng nhất theo hướng thực tế hơn: kiểm soát mụn cần đúng mục tiêu, đúng thời gian và đúng mức kỳ vọng.`;
  const content = compact(`
${title} là kiểu câu hỏi không thể trả lời tốt bằng một mẹo ngắn. Với mụn trứng cá, điều làm khác biệt thường không phải một “bí quyết” đơn lẻ mà là việc hiểu đúng cơ chế bệnh, chọn routine hợp lý và kiên trì đủ lâu trước khi kết luận.

## Điều cần hiểu trước

Mụn là bệnh viêm mạn tính của đơn vị nang lông - tuyến bã. Điều này giải thích vì sao mụn dễ tái phát và vì sao điều trị thường cần theo dõi trong nhiều tuần hoặc nhiều tháng chứ không chỉ vài ngày.

## Sai lầm thường gặp

- đổi sản phẩm quá nhanh;
- nặn hoặc cạy tổn thương đang viêm;
- dùng treatment mạnh chồng chéo;
- bỏ dưỡng ẩm hoặc chống nắng;
- tin vào hứa hẹn “hết mụn cấp tốc”.

## Cách tiếp cận thực tế hơn

### Giữ routine đơn giản

Làm sạch dịu nhẹ, dưỡng ẩm, chống nắng và một treatment chính thường hiệu quả hơn việc nhồi nhiều sản phẩm cùng lúc.

### Đặt mốc theo dõi rõ ràng

Nhiều treatment cần ít nhất 6 đến 8 tuần mới cho thấy xu hướng cải thiện. Đánh giá quá sớm dễ dẫn đến đổi routine liên tục.

### Tách mục tiêu mụn và mục tiêu thâm sẹo

Giảm mụn mới, giảm viêm, mờ thâm và cải thiện sẹo là bốn mục tiêu khác nhau. Khi bạn cố đạt tất cả cùng lúc, nguy cơ kích ứng tăng rất nhanh.

## Khi nào nên chuyển sang điều trị chuyên khoa?

Bạn nên đi khám nếu có mụn nốt hoặc nang, mụn để lại sẹo, mụn kéo dài dù đã chăm da đúng, hoặc nếu da thường xuyên kích ứng khi tự dùng treatment. Điều trị chuyên khoa không phải là bước “cuối cùng khi hết cách”; trong nhiều trường hợp, đó là bước giúp tránh mất thêm thời gian và tổn thương da.

${mdSources(ACNE_CORE_SOURCES)}
  `);
  return finalize({ title, summary, content, sources: ACNE_CORE_SOURCES });
}

function classifyPost(post) {
  const title = stripNoise(post.title);
  if (/^(ăn|uống)\s+/i.test(title) || /bị mụn nên ăn|người bị mụn mủ kiêng ăn|thực phẩm gây mụn|vitamin c có trị thâm/i.test(title)) return 'food';
  if (/nha đam|nghệ|khổ qua|khoai tây|mật ong|rau má|dầu dừa|mỡ trăn|nước vo gạo|cà chua|phấn rôm|đá lạnh|nước đá|giấm táo|chanh|thuốc rượu|mặt nạ trị mụn/i.test(title)) return 'home_remedy';
  if (/nặn mụn|peel da|lăn kim|xông mặt|break out|purging|bôi serum bị nổi mụn|dùng sữa rửa mặt bị nổi mụn|skincare càng lên mụn|đang peel da/i.test(title)) return 'aftercare';
  if (/serum|sữa rửa mặt|kem chống nắng|kem trị mụn|thuốc bôi|thuốc trị mụn|miếng dán|gel lột|mặt nạ|megaduo|klenzit|derma forte|bha|aha|retinol|tretinoin|adapalene|tazarotene|doxycycline|niacinamide|sulfur|huyết thanh|serum b5|azanex|glycolic acid|tế bào gốc|laser|ipl|nước tẩy trang|tẩy tế bào chết|epiduo|differin|decumar|peel da/i.test(title)) return 'product';
  if (/mụn|sẹo rỗ|thâm đỏ|viêm nang lông|mụn trứng cá đỏ|mụn cơm|mụn đinh râu|mụn thịt/i.test(title)) return 'condition';
  return 'general';
}

async function main() {
  const auditRows = JSON.parse(await fs.readFile(AUDIT_JSON_PATH, 'utf8'));
  const rewriteRows = auditRows.filter((row) => row.action === 'rewrite');
  const slugs = rewriteRows.map((row) => row.slug).filter(Boolean);
  if (slugs.length === 0) {
    console.log(JSON.stringify({ dryRun: DRY_RUN, rewritten: 0 }, null, 2));
    return;
  }

  const slugSql = slugs.map(sqlString).join(', ');
  const posts = await runQuery(`
    select slug, title, summary, meta_description, content
    from public.blog_posts
    where slug in (${slugSql})
    order by slug asc;
  `);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const backupPath = path.join(OUTPUT_DIR, `blog-editorial-rewrite-backup-${timestamp}.json`);
  await fs.writeFile(backupPath, JSON.stringify(posts, null, 2), 'utf8');

  const results = [];
  for (const post of posts) {
    const category = classifyPost(post);
    const next =
      category === 'food' ? buildFoodArticle(post) :
      category === 'home_remedy' ? buildHomeRemedyArticle(post) :
      category === 'aftercare' ? buildAftercareArticle(post) :
      category === 'product' ? buildProductArticle(post) :
      category === 'condition' ? buildConditionArticle(post) :
      buildGeneralAcneArticle(post);

    if (next.title.length < 25 || next.title.length > 90) {
      throw new Error(`${post.slug}: title length ${next.title.length} invalid`);
    }
    if (next.summary.length < 110 || next.summary.length > 220) {
      throw new Error(`${post.slug}: summary length ${next.summary.length} invalid`);
    }
    if (next.metaDescription.length < 120 || next.metaDescription.length > 170) {
      throw new Error(`${post.slug}: meta length ${next.metaDescription.length} invalid`);
    }
    if (countWords(next.content) < 280) {
      throw new Error(`${post.slug}: content too thin`);
    }

    if (!DRY_RUN) {
      await runQuery(`
        update public.blog_posts
        set
          title = ${sqlString(next.title)},
          summary = ${sqlString(next.summary)},
          meta_description = ${sqlString(next.metaDescription)},
          content = ${sqlString(next.content)},
          updated_at = now()
        where slug = ${sqlString(post.slug)};
      `);
    }

    results.push({
      slug: post.slug,
      category,
      title: next.title,
      summaryLength: next.summary.length,
      metaLength: next.metaDescription.length,
      wordCount: countWords(next.content),
    });
  }

  const reportPath = path.join(OUTPUT_DIR, `blog-editorial-rewrite-report-${timestamp}.md`);
  const lines = [
    '# Blog Editorial Backlog Rewrite Report',
    '',
    `- Generated at: \`${new Date().toISOString()}\``,
    `- Dry run: **${DRY_RUN ? 'yes' : 'no'}**`,
    `- Rewritten posts: **${results.length}**`,
    `- Backup: \`${backupPath}\``,
    '',
    '| slug | category | title | summary_len | meta_len | words |',
    '| --- | --- | --- | ---: | ---: | ---: |',
    ...results.map((row) => `| ${row.slug} | ${row.category} | ${row.title.replace(/\|/g, '\\|')} | ${row.summaryLength} | ${row.metaLength} | ${row.wordCount} |`),
    '',
  ];
  await fs.writeFile(reportPath, `${lines.join('\n')}\n`, 'utf8');

  console.log(JSON.stringify({
    dryRun: DRY_RUN,
    rewritten: results.length,
    backupPath,
    reportPath,
    sample: results.slice(0, 20),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
