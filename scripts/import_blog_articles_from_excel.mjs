import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_WORKBOOK_PATH = '/Users/PHUC/Desktop/O2skin/tri-mun-articles-with-content.xlsx';
const DEFAULT_LIMIT = 60;
const OUTPUT_DIR = path.resolve('output/imports');
const SUPABASE_URL = 'https://ykcrngqhyinczmvwduox.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Tk-pvnzWINmKS6xe-5aKkA_aWr5DIVc';

const argMap = new Map(
  process.argv.slice(2).map((entry) => {
    const [key, value] = entry.split('=');
    return [key, value ?? 'true'];
  }),
);

const workbookPath = path.resolve(argMap.get('--file') || DEFAULT_WORKBOOK_PATH);
const shouldApply = argMap.has('--apply');
const limit = Number.parseInt(argMap.get('--limit') || String(DEFAULT_LIMIT), 10);
const allowedReasons = new Set(
  String(argMap.get('--allow-reasons') || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean),
);
const selectedRows = String(argMap.get('--rows') || '')
  .split(',')
  .map((entry) => Number.parseInt(entry.trim(), 10))
  .filter((value) => Number.isFinite(value) && value >= 2);

const slugify = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

const normalizeCompare = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const capitalizeFirstLetter = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.charAt(0).toLocaleUpperCase('vi-VN') + text.slice(1);
};

const parseEnvFile = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8');
  return Object.fromEntries(
    raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
};

const env = parseEnvFile(path.resolve('.env'));

const exclusionRules = {
  promo: /ưu đãi|quà tặng|thông tin chương trình|căn cứ pháp lý|thông báo số|tổng giá trị giải thưởng/i,
  brandedTitle: /natural skin/i,
  productTitle:
    /\btop\b|review|bán chạy|được yêu thích|bác sĩ khuyên dùng|serum|sữa rửa mặt|miếng dán|gel lột|megaduo|derma forte|epiduo|tretinoin|adapalene|azelaic acid|bha|aha|b5|thuốc bôi|thuốc trị mụn|kem chống nắng/i,
  folkTitle: /cỏ sữa|khoai tây|mật ong|nghệ tươi|nước vo gạo|mỡ trăn|nha đam|kem đánh răng|trị mụn.*tại nhà|công thức trị mụn/i,
};

const classifyCategorySlug = (title, content) => {
  const titleText = String(title || '').toLowerCase();
  if (
    /ăn |uống |vitamin|thực phẩm|rau|trái cây|hoa quả|sữa |ngủ|rửa mặt|tẩy trang|dưỡng ẩm|chăm sóc da|skincare|thói quen|sinh hoạt|kiêng|mặt nạ|nặn mụn xong|bôi gì/i.test(
      titleText,
    )
  ) {
    return 'cham-soc-da';
  }
  return 'dieu-tri-mun';
};

const neutralizeBranding = (value) =>
  String(value || '')
    .replace(/theo\s+bác sĩ\s+natural skin/giu, 'theo bác sĩ da liễu')
    .replace(/bác sĩ\s+natural skin/giu, 'bác sĩ da liễu')
    .replace(/natural skin/giu, 'chuyên gia da liễu');

const stripCallToAction = (value) =>
  String(value || '')
    .replace(/\b(tham khảo ngay nhé!?|cùng tìm hiểu ngay nhé!?|xem ngay bạn nhé\.?|xem ngay nhé\.?|xem ngay\.?)\b/giu, '')
    .replace(/xem thêm nguyên nhân và cách khắc phục trong bài viết sau đây\.?/giu, '')
    .replace(/xem ngay bài viết để biết[^.]*\./giu, '')
    .replace(/tìm hiểu chi tiết hơn trong bài viết sau!?/giu, '')
    .replace(/đừng ngần ngại chia sẻ với bác sĩ[^.]*\./giu, '')
    .replace(/đặt hẹn ngay hôm nay[^.]*\./giu, '')
    .trim();

const sanitizeArticleLine = (value) =>
  stripCallToAction(neutralizeBranding(value))
    .replace(/[“”]/g, '')
    .replace(/bài viết (sau đây|này)[^.]*?(giúp bạn|hướng dẫn chi tiết|sẽ cung cấp cho bạn)[^.]*\./giu, '')
    .replace(/trong bài viết này[^.]*\./giu, '')
    .replace(/bài viết dưới đây[^.]*\./giu, '')
    .replace(/tham khảo ngay nhé!?/giu, '')
    .replace(/cùng tìm hiểu ngay\.?/giu, '')
    .replace(/xem ngay bạn nhé\.?/giu, '')
    .replace(/xem nguyên nhân và cách khắc phục ngay\.?/giu, '')
    .replace(/bạn nhé\.?/giu, '')
    .replace(/bác sĩ da liễu\s+chuyên gia da liễu/giu, 'bác sĩ da liễu')
    .replace(/\s{2,}/g, ' ')
    .trim();

const extractTocStructure = (lines) => {
  const tocIndex = lines.findIndex((line) => /^mục lục$/i.test(line));
  if (tocIndex === -1 || tocIndex === lines.length - 1) {
    return { introLines: lines, tocItems: [], bodyLines: [] };
  }

  const firstTocItem = lines[tocIndex + 1];
  const bodyStartIndex = lines.findIndex(
    (line, index) => index > tocIndex + 1 && normalizeCompare(line) === normalizeCompare(firstTocItem),
  );

  if (bodyStartIndex === -1) {
    return {
      introLines: lines.filter((line, index) => index !== tocIndex),
      tocItems: [],
      bodyLines: [],
    };
  }

  return {
    introLines: lines.slice(0, tocIndex),
    tocItems: lines.slice(tocIndex + 1, bodyStartIndex),
    bodyLines: lines.slice(bodyStartIndex),
  };
};

const shouldDiscardArticleLine = (line, tocSet) => {
  const text = String(line || '').trim();
  if (!text) return true;
  if (
    /^(>>|👉|:|đặt hẹn|đặt lịch|tại đây|xem thêm|xem thêm:?)$/i.test(text) ||
    /^natural skin ưu đãi đặc biệt/i.test(text) ||
    /^natural skin – /i.test(text) ||
    /^thông báo số:/i.test(text) ||
    /^căn cứ pháp lý$/i.test(text)
  ) {
    return true;
  }
  if (/tại chuyên gia da liễu|tại natural skin|liên hệ với chuyên gia da liễu|liên hệ với natural skin|đặt lịch hẹn khám ngay/i.test(text)) {
    return true;
  }
  if (
    !tocSet.has(normalizeCompare(text)) &&
    /^[A-ZÀ-Ỹ]/u.test(text) &&
    text.length <= 110 &&
    /[:?]/.test(text) &&
    !/[.!]$/.test(text)
  ) {
    return true;
  }
  return false;
};

const isLikelyTopLevelTocItem = (line, currentTopLevel) => {
  const text = String(line || '').trim();
  if (!text) return false;
  if (/^các câu hỏi thường gặp$/i.test(currentTopLevel)) return false;
  if (/^\d+\.\s+/.test(text) || /^(bước|nhóm)\s+\d+/i.test(text) || /:$/.test(text)) return false;
  if (
    /^(nguyên tắc quan trọng nhất|thực hiện các biện pháp|khi nào cần thăm khám|thông báo tiền sử|không tự ý dùng thuốc|theo dõi và điều trị kịp thời)/i.test(
      text,
    )
  ) {
    return false;
  }
  return true;
};

const cleanHeadingText = (value) =>
  capitalizeFirstLetter(
    String(value || '')
      .replace(/^\[[^\]]+\]\s*/, '')
      .replace(/:$/, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );

const appendParagraphLine = (segments, line) => {
  const text = String(line || '').trim();
  if (!text) return;
  const lastIndex = segments.length - 1;
  if (lastIndex < 0 || /^(##|###|- )/.test(segments[lastIndex])) {
    segments.push(capitalizeFirstLetter(text));
    return;
  }

  if (/^[a-zà-ỹđ(]/iu.test(text) || !/[.!?]$/.test(segments[lastIndex])) {
    segments[lastIndex] = `${segments[lastIndex]} ${text}`.replace(/\s+/g, ' ').trim();
    return;
  }

  segments.push(capitalizeFirstLetter(text));
};

const cleanContent = (rawContent) => {
  const normalized = String(rawContent || '')
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  let lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^[>.👉]+$/.test(line) && line !== '.');

  const seeMoreIndex = lines.findIndex((line) => /^xem thêm$/i.test(line));
  if (seeMoreIndex >= 0) {
    lines = lines.slice(0, seeMoreIndex);
  }

  lines = lines
    .map((line) => sanitizeArticleLine(line))
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const { introLines, tocItems, bodyLines } = extractTocStructure(lines);
  const tocSet = new Set(tocItems.map((item) => normalizeCompare(item)));
  const segments = [];

  for (const line of introLines) {
    if (shouldDiscardArticleLine(line, tocSet)) continue;
    appendParagraphLine(segments, line);
  }

  let currentTopLevelHeading = '';

  for (let index = 0; index < bodyLines.length; index += 1) {
    const line = bodyLines[index];
    if (shouldDiscardArticleLine(line, tocSet)) continue;
    const nextLine = bodyLines[index + 1] ? String(bodyLines[index + 1]).trim() : '';

    const normalizedLine = normalizeCompare(line);
    if (tocSet.has(normalizedLine)) {
      const isTopLevel = isLikelyTopLevelTocItem(line, currentTopLevelHeading);
      const prefix = isTopLevel ? '##' : '###';
      segments.push(`${prefix} ${cleanHeadingText(line)}`);
      if (isTopLevel) currentTopLevelHeading = line;
      continue;
    }

    if (/:$/.test(line) && line.length <= 110) {
      segments.push(`### ${cleanHeadingText(line)}`);
      continue;
    }

    if (nextLine === ':') {
      segments.push(`### ${cleanHeadingText(line)}`);
      index += 1;
      continue;
    }

    if (!tocSet.has(normalizedLine) && /^[A-ZÀ-Ỹ0-9]/u.test(line) && line.length <= 48 && nextLine.length >= 40) {
      segments.push(`### ${cleanHeadingText(line)}`);
      continue;
    }

    appendParagraphLine(segments, line);
  }

  const formatted = segments
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/“\s+/g, '“')
    .replace(/\s+”/g, '”')
    .replace(/\bchuyên gia da liễu\b/giu, 'bác sĩ da liễu')
    .trim();

  return formatted;
};

const buildSummary = (content) => {
  const paragraphs = String(content || '')
    .split(/\n{2,}/)
    .map((entry) => entry.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const firstGoodParagraph = paragraphs.find((entry) => entry.length >= 120) || paragraphs[0] || '';
  if (!firstGoodParagraph) return '';
  if (firstGoodParagraph.length <= 220) return capitalizeFirstLetter(firstGoodParagraph);
  const clipped = firstGoodParagraph.slice(0, 217);
  return capitalizeFirstLetter(`${clipped.replace(/\s+\S*$/, '')}...`);
};

const buildMetaDescription = (summary, title) => {
  const base = String(summary || title || '').replace(/\s+/g, ' ').trim();
  if (!base) return '';
  if (base.length <= 155) return base;
  const clipped = base.slice(0, 152).replace(/\s+\S*$/, '');
  return `${clipped}...`;
};

const buildMetaKeywords = (title, categorySlug) => {
  const normalizedTitle = normalizeCompare(title)
    .split(' ')
    .filter((token) => token.length >= 3)
    .slice(0, 6);
  const phrases = [];
  if (title) phrases.push(title);
  if (normalizedTitle.length) phrases.push(normalizedTitle.join(', '));
  if (categorySlug === 'dieu-tri-mun') {
    phrases.push('mụn, điều trị mụn, bác sĩ da liễu');
  } else {
    phrases.push('chăm sóc da, da mụn, kiến thức da liễu');
  }
  return phrases.join(', ');
};

const buildPublishDate = (index) => {
  const date = new Date();
  date.setDate(date.getDate() - index);
  return date.toISOString().slice(0, 10);
};

const manualOverrides = {
  'mun-trung-ca-do-thuoc-cach-nhan-biet-giai-phap-tu-bac-si': {
    summary:
      'Mụn trứng cá do thuốc đôi khi có thể bị nhầm lẫn với các yếu tố gây mụn khác như: thay đổi nội tiết tố, căng thẳng, chế độ ăn uống hoặc sinh hoạt kém khoa học,… Trong bài viết sau, bác sĩ Thế Giới Trị Mụn sẽ giúp bạn nhận diện mụn trứng cá xuất hiện do thuốc và cách xử lý an toàn để hạn chế để lại thâm sẹo.',
    content: `Mụn trứng cá do thuốc đôi khi có thể bị nhầm lẫn với các yếu tố gây mụn khác như: thay đổi nội tiết tố, căng thẳng, chế độ ăn uống hoặc sinh hoạt kém khoa học,… Trong bài viết sau, bác sĩ Thế Giới Trị Mụn sẽ giúp bạn nhận diện mụn trứng cá xuất hiện do thuốc và cách xử lý an toàn để hạn chế để lại thâm sẹo.

Bị nổi mụn trứng cá có thể là một trong những tác dụng phụ của loại thuốc mà bạn đang dùng.

## Thế nào là mụn trứng cá do thuốc?

Mụn trứng cá do dùng thuốc (tiếng Anh: drug-induced acne hay DIA) là một dạng phản ứng phụ trong quá trình sử dụng thuốc. Tình trạng này có thể xảy ra khi thuốc mà bạn sử dụng kích thích phản ứng miễn dịch qua trung gian tế bào, khiến hệ miễn dịch tấn công vào các cấu trúc bình thường của da và gây ra mụn.

Thuốc gây ra DIA có thể là thuốc uống, thuốc bôi ngoài da, hoặc thậm chí là thuốc hít.

Uống kháng sinh bị nổi mụn: Nguyên nhân và cách khắc phục

## Cách nhận biết tình trạng mụn trứng cá do thuốc gây ra

Dấu hiệu đặc trưng để nhận biết mụn trứng cá gây ra bởi thuốc thường là sự xuất hiện đột ngột của mụn sau khi dùng thuốc. Ngoài ra, loại mụn này cũng có thể xuất hiện ở những vị trí ít tiết dầu, bã nhờn như cẳng chân và mu bàn tay. Chi tiết các dấu hiệu nhận biết mụn trứng cá do dùng thuốc gây ra như sau:

### Thời gian xuất hiện

Mụn thường xuất hiện sau thời gian (thường là trong vòng vài tuần sau khi bắt đầu dùng thuốc) và thậm chí sau khi đã ngưng thuốc trong thời gian ngắn. Đôi khi mụn do thuốc cũng có thể khởi phát chậm, có thể mất vài tháng hoặc vài năm.

### Loại mụn

Thường chỉ tạo ra mụn sẩn và mụn mủ (những vết sưng đỏ trên da).

Đôi khi xuất hiện các mụn nước hình chấm ở trung tâm của các nốt sẩn, có thể phát triển thành các mụn mủ nhỏ. Một khía cạnh lâm sàng quan trọng trong chẩn đoán phân biệt mụn trứng cá do thuốc là thực tế là các tổn thương da không có nhân mụn đầu đen nhìn thấy được trước đó.

### Tình trạng mụn sau khi ngừng thuốc

Thường được cải thiện khi ngừng uống hoặc tiếp xúc với thuốc.

### Vị trí

Xuất hiện ở những vùng da tiết nhiều bã nhờn (mặt, ngực, lưng,…) và ở cả những vùng da ít tiết bã nhờn (cẳng chân và mu bàn tay).

### Những biểu hiện khác

Cơ thể gặp các triệu chứng của tình trạng dị ứng khác như ngứa, nổi mề đay…

Mụn trứng cá ở lưng do đâu? Cách trị mụn lưng nhanh, hiệu quả

Mụn trứng cá do thuốc thường xuất hiện sau khi dùng thuốc một cách đột ngột.

## Loại thuốc nào có thể gây ra mụn trứng cá?

Theo cuốn sách “Hiểu mụn để hết mụn” do Phòng khám da liễu Thế Giới Trị Mụn cùng NXB Y học phát hành năm 2020, một số loại thuốc có thể làm tăng nguy cơ xuất hiện mụn trứng cá trong quá trình sử dụng như: Halogens, thuốc tránh thai có chứa Progesterone, thuốc ức chế miễn dịch,… Cụ thể như sau:

- Halogens (Iốt, Brom, Flo và Clo)
- Các steroid đồng hóa (Anabolic Steroid)
- Corticoid đường uống/ đường bôi,…
- Thuốc tránh thai có chứa Progesterone
- Hormone Testosterone
- Thuốc/ thực phẩm chức năng chứa vitamin B6 và B12
- Thuốc điều trị lao, phong, trầm cảm, ung thư
- Thuốc ức chế thụ thể yếu tố tăng trưởng biểu bì (Cetuximab, Gefitinib và Erlotinib) và Interferon-Beta, Cyclosporin A

Trị mụn bằng thuốc tránh thai: Cách dùng và tác dụng phụ

## Mụn trứng cá do thuốc có nguy hiểm không?

Mụn trứng cá do dùng thuốc thường không đe dọa tính mạng, nhưng nếu không được phát hiện và xử lý kịp thời, tình trạng có thể trở nên nghiêm trọng. Một số loại thuốc chỉ gây mụn như tác dụng phụ tạm thời và sẽ cải thiện khi ngừng sử dụng.

Tuy nhiên, ở một số trường hợp, chẳng hạn như lạm dụng thuốc bôi chứa Corticoid, mụn có thể bùng phát mạnh và dễ dẫn đến “nghiện” corticoid bôi tại chỗ. Tình trạng này có các dấu hiệu như ban đỏ, mụn đơn dạng, teo da, giãn mạch,… thường xuất hiện 2-4 tuần sau khi ngừng kem; điều trị kéo dài, tốn kém và có thể để lại di chứng vĩnh viễn.

Mụn trứng cá do tác dụng phụ của thuốc vẫn có nguy cơ để lại sẹo, thâm nếu không được điều trị đúng cách.

## Phân biệt mụn trứng cá do thuốc và mụn trứng cá thông thường

Để phân biệt 2 loại mụn này cần dựa vào các yếu tố (liệt kê ngắn). Chi tiết từng yếu tố như sau:

### Tiền sử sử dụng thuốc

- Mụn trứng cá thường: Có thể xuất hiện ở những người không sử dụng bất kỳ loại thuốc nào.
- Mụn trứng cá do thuốc: Thường xảy ra sau khi dùng thuốc.

### Độ tuổi khởi phát mụn

- Mụn trứng cá thường: Thường xuất hiện trong độ tuổi dậy thì.
- Mụn trứng cá do thuốc: Có thể xảy ra ở mọi lứa tuổi và thường bắt đầu đột ngột.

### Vị trí mụn xuất hiện trên cơ thể

- Mụn trứng cá thường: Xuất hiện ở những vùng da tiết nhiều bã nhờn: mặt, ngực, lưng,…
- Mụn trứng cá do thuốc: Xuất hiện ở những vùng da tiết nhiều bã nhờn: mặt, ngực, lưng,…) và ở cả những vùng da ít tiết bã nhờn: cẳng chân và mu bàn tay.

### Loại mụn

- Mụn trứng cá thường: Mụn đầu trắng, mụn đầu đen, sẩn, mụn mủ, nốt sần và mụn nang.
- Mụn trứng cá do thuốc: Thường chỉ tạo ra sẩn và mụn mủ.

## Phương pháp điều trị mụn trứng cá do thuốc gây ra

Trường hợp nghi ngờ bản thân bị nổi mụn trứng cá do tác dụng phụ của thuốc, bạn hãy ngưng thuốc theo hướng dẫn của bác sĩ, kết hợp với các biện pháp chăm sóc da khoa học tại nhà và nên đến gặp bác sĩ càng sớm càng tốt. Cụ thể cách xử lý mụn trứng cá gây ra bởi thuốc như sau:

### Nguyên tắc quan trọng nhất: Ngưng sử dụng thuốc theo hướng dẫn của bác sĩ

Khi mụn trứng cá đột ngột xuất hiện trong quá trình dùng thuốc, bạn hãy liên hệ với bác sĩ để được hướng dẫn cách ngưng thuốc đúng cách. Tránh việc tự ý ngưng thuốc vì có thể làm ảnh hưởng đến quá trình điều trị bệnh.

### Thực hiện các biện pháp chăm sóc da hỗ trợ giảm mụn tại nhà

Bạn hãy giữ gìn vệ sinh sạch sẽ, nhất là ở những vùng da đang nổi mụn. Hạn chế trang điểm, cố gắng đi ngủ sớm, uống đủ nước,… để tránh tình trạng mụn trầm trọng hơn. Ngoài ra, bạn cũng nên hạn chế tiêu thụ các loại thực phẩm có thể khiến mụn bùng phát như: đồ ăn cay nóng, thực phẩm nhiều dầu mỡ, bánh kẹo,…

Cách Chăm Sóc Da Mụn Hiệu Quả, Phục Hồi Nhanh Từ Bác Sĩ Da Liễu

### Khi nào cần thăm khám Bác sĩ Da liễu?

Nguyên nhân hình thành mụn trứng cá vô cùng phức tạp. Chính vì thế ngay khi xuất hiện mụn, bạn nên đến gặp bác sĩ da liễu để được thăm khám, qua đó xác định nguyên nhân gây mụn để có giải pháp điều trị phù hợp. Đặc biệt, bạn nên đem theo toa thuốc hoặc vỏ hộp thuốc đang sử dụng để bác sĩ da liễu có thể xác định chính xác hơn tác nhân gây mụn.

Tại Thế Giới Trị Mụn, bên cạnh khai thác tiền sử bệnh lý và thói quen hàng ngày, bác sĩ còn ứng dụng các thiết bị hiện đại để kiểm tra tình trạng của của khách hàng. Hơn hết, bác sĩ Thế Giới Trị Mụn vô cùng tâm lý, luôn sẵn sàng trao đổi với khách hàng để có được hướng giải quyết tốt nhất. Qua đó giúp khách hàng tiết kiệm tối đa chi phí, thời gian và công sức điều trị mụn trứng cá.

Tại Thế Giới Trị Mụn, các bác sĩ sẽ thăm khám kỹ lưỡng để xác định nguyên nhân và các yếu tố gây ra mụn để xây dựng phác đồ điều trị phù hợp.

Nếu bạn cũng đang gặp tình trạng bị nổi mụn trứng cá sau khi dùng thuốc, hãy liên hệ với Thế Giới Trị Mụn để được tư vấn về phác đồ điều trị hoặc đặt lịch hẹn khám ngay hôm nay.

## Làm sao để hạn chế nguy cơ nổi mụn trứng cá do thuốc?

Để ngăn ngừa tình trạng mụn trứng cá do sử dụng thuốc, bạn nên thông báo tiền sử dị ứng thuốc (nếu có) với bác sĩ, không tự ý sử dụng thuốc, theo dõi da và cơ thể trong suốt quá trình dùng thuốc,… Chi tiết từng giải pháp như sau:

### Thông báo tiền sử dị ứng hoặc từng bị mụn do thuốc trước đây

Thông báo với bác sĩ điều trị về tiền sử dị ứng thuốc của bản thân hoặc nếu trước đây đã từng bị mụn. Đồng thời, bạn cũng nên hỏi bác sĩ về các tác dụng phụ có thể xảy ra trong quá trình dùng thuốc.

### Không tự ý dùng thuốc, tự kê toa hoặc dùng theo toa thuốc của người khác

Cơ địa, tình trạng sức khỏe, tiền sử bệnh lý,… của mỗi người đều khác nhau. Vì thế bạn không được tự ý dùng thuốc để đảm bảo an toàn cũng như hạn chế nguy cơ bị mụn trứng cá.

### Theo dõi và điều trị kịp thời

Trong suốt quá trình dùng thuốc, bạn hãy theo dõi kỹ các phản ứng của cơ thể, bao gồm cả làn da. Nhờ đó mà bạn có thể sớm phát hiện những bất thường để thông báo với bác sĩ và được hướng dẫn cách xử lý an toàn.

Uống thuốc trị mụn có tốt không? Cần lưu ý gì?

## Các câu hỏi thường gặp

### Mụn trứng cá do thuốc có thể tự khỏi không?

Trong một số trường hợp, mụn trứng cá có thể tự khỏi sau khi ngưng thuốc. Tuy nhiên một số trường hợp không thể tự khỏi và có thể để lại thâm sẹo gây mất thẩm mỹ. Do đó tốt nhất, hãy đến bác sĩ da liễu để được thăm khám và có được cách xử lý tốt nhất.

### Mụn trứng cá do uống thuốc kéo dài bao lâu?

Mụn trứng cá do dùng thuốc có thể kéo dài vài tuần, vài tháng. Thậm chí nhiều trường hợp mụn trứng cá có thể kéo dài kể cả khi đã ngưng thuốc. Vì thế bạn nên thông báo với bác sĩ đang điều trị bệnh hoặc bác sĩ da liễu về tình trạng mụn của bản thân để được tư vấn cách cải thiện phù hợp thay vì âm thầm chịu đựng.

Điều trị mụn trứng cá bao lâu thì hết? Yếu tố nào ảnh hưởng?

Nổi mụn trứng cá có thể là một trong những tác dụng phụ của loại thuốc mà bạn đang sử dụng. Thế nhưng để xác định trứng cá do thuốc hay xuất phát từ yếu tố khác, bạn cần liên hệ với bác sĩ. Tránh trường hợp áp dụng các mẹo dân gian chưa được kiểm chứng khoa học (chẳng hạn đắp lá lên da) hoặc tự ý bôi thuốc vì có thể khiến mụn trứng cá trầm trọng hơn.

## Xem thêm

- Các loại thuốc trị mụn trứng cá và lưu ý khi sử dụng
- Thuốc uống trị mụn bác sĩ khuyên dùng theo chỉ định
- 10 thuốc trị mụn dạng bôi được Bác sĩ da liễu đánh giá cao 2025`,
  },
};

const categorizeRow = (title, content) => {
  const text = `${title}\n${content}`;
  if (exclusionRules.promo.test(text)) return 'promo';
  if (exclusionRules.brandedTitle.test(title)) return 'brandedTitle';
  if (exclusionRules.productTitle.test(title)) return 'productTitle';
  if (exclusionRules.folkTitle.test(title)) return 'folkTitle';
  return 'keep';
};

const isPublishReady = ({ title, summary, content }) => {
  const text = `${summary}\n${content}`;
  if (/natural skin|xem ngay|tham khảo ngay|cùng tìm hiểu ngay|bài viết để biết|bạn nhé\./i.test(text)) {
    return false;
  }
  if (/^\*\*[^*]{1,15}\*\*\n\n[a-zà-ỹđ]/imu.test(content)) {
    return false;
  }
  if (/^\s*[a-zà-ỹđ]/iu.test(summary)) {
    return false;
  }
  if (/^\s*[a-zà-ỹđ]/iu.test(content) && !/^[a-zà-ỹđ].*[.!?]/iu.test(content.slice(0, 140))) {
    return false;
  }
  if (/\btrong trong\b/i.test(text)) {
    return false;
  }
  return true;
};

const workbook = XLSX.readFile(workbookPath);
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const ensureOutputDir = () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
};

const main = async () => {
  ensureOutputDir();

  const signIn = await supabase.auth.signInWithPassword({
    email: env.E2E_ADMIN_EMAIL,
    password: env.E2E_ADMIN_PASSWORD,
  });

  if (signIn.error || !signIn.data.user) {
    throw new Error(`Không đăng nhập được tài khoản admin import: ${signIn.error?.message || 'unknown error'}`);
  }

  const adminUserId = signIn.data.user.id;

  const [{ data: categories, error: categoryError }, { data: existingPosts, error: existingPostsError }] =
    await Promise.all([
      supabase.from('blog_categories').select('slug,name').order('name'),
      supabase.from('blog_posts').select('slug,title'),
    ]);

  if (categoryError) throw new Error(`Không tải được categories: ${categoryError.message}`);
  if (existingPostsError) throw new Error(`Không tải được danh sách blog hiện có: ${existingPostsError.message}`);

  const categorySlugs = new Set((categories || []).map((category) => category.slug));
  const existingTitleSet = new Set((existingPosts || []).map((post) => normalizeCompare(post.title)));
  const existingSlugSet = new Set((existingPosts || []).map((post) => post.slug));
  const existingTitleToSlug = new Map((existingPosts || []).map((post) => [normalizeCompare(post.title), post.slug]));

  const kept = [];
  const excluded = [];

  for (const [index, row] of rows.entries()) {
    const title = String(row.Title || row.title || '').trim();
    const rawContent = String(row['Cleaned Content'] || row.content || '').trim();
    if (!title || !rawContent) {
      excluded.push({ row: index + 2, title, reason: 'missing-required-fields' });
      continue;
    }

    const exclusionReason = categorizeRow(title, rawContent);
    if (exclusionReason !== 'keep' && !allowedReasons.has(exclusionReason)) {
      excluded.push({ row: index + 2, title, reason: exclusionReason });
      continue;
    }

    const normalizedTitle = normalizeCompare(title);
    const isManualUpdateRow = selectedRows.includes(index + 2);
    if (existingTitleSet.has(normalizedTitle) && !isManualUpdateRow) {
      excluded.push({ row: index + 2, title, reason: 'duplicate-title' });
      continue;
    }

    const content = cleanContent(rawContent);
    const summary = buildSummary(content);
    const categorySlug = classifyCategorySlug(title, content);
    if (!categorySlugs.has(categorySlug)) {
      excluded.push({ row: index + 2, title, reason: `missing-category:${categorySlug}` });
      continue;
    }

    let slug = isManualUpdateRow ? existingTitleToSlug.get(normalizedTitle) || slugify(title) : slugify(title);
    let suffix = 2;
    while (!slug || ((existingSlugSet.has(slug) && (!isManualUpdateRow || existingTitleToSlug.get(normalizedTitle) !== slug)) || kept.some((entry) => entry.slug === slug))) {
      slug = `${slugify(title) || 'bai-viet-moi'}-${suffix}`;
      suffix += 1;
    }

    const override = manualOverrides[slug];
    const finalSummary = override?.summary || summary;
    const finalContent = override?.content || content;

    kept.push({
      source_row: index + 2,
      slug,
      title,
      summary: finalSummary,
      content: finalContent,
      category_slug: categorySlug,
      image_path: '',
      meta_description: buildMetaDescription(finalSummary, title),
      meta_keywords: buildMetaKeywords(title, categorySlug),
      canonical_url: '',
      date: '',
      author_id: adminUserId,
      title_en: '',
      title_ru: '',
      title_cn: '',
      summary_en: '',
      summary_ru: '',
      summary_cn: '',
      content_en: '',
      content_ru: '',
      content_cn: '',
    });
  }

  const publishable = kept.filter((item) => isPublishReady(item));
  const manualBatch = selectedRows.length > 0 ? kept.filter((item) => selectedRows.includes(item.source_row)) : null;
  const sourceBatch = manualBatch ?? publishable;

  const batch = sourceBatch.slice(0, Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT).map((item, index) => ({
    ...item,
    date: buildPublishDate(index),
  }));

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const previewPath = path.join(OUTPUT_DIR, `blog-import-preview-${timestamp}.json`);
  const workbookOutputPath = path.join(OUTPUT_DIR, `blog-import-batch-${timestamp}.xlsx`);
  fs.writeFileSync(
    previewPath,
    JSON.stringify(
      {
        source: workbookPath,
        total_rows: rows.length,
        kept_candidates: kept.length,
        publishable_candidates: publishable.length,
        allowed_reasons: [...allowedReasons],
        manual_selected_rows: selectedRows,
        selected_for_batch: batch.length,
        excluded_count: excluded.length,
        excluded_samples: excluded.slice(0, 80),
        selected_titles: batch.map((entry) => ({
          source_row: entry.source_row,
          title: entry.title,
          slug: entry.slug,
          category_slug: entry.category_slug,
          date: entry.date,
        })),
      },
      null,
      2,
    ),
  );

  const exportSheetRows = batch.map(({ source_row, ...entry }) => entry);
  const exportWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(exportWorkbook, XLSX.utils.json_to_sheet(exportSheetRows), 'Posts');
  XLSX.writeFile(exportWorkbook, workbookOutputPath);

  console.log(
    JSON.stringify(
      {
        apply: shouldApply,
        workbook: workbookPath,
        total_rows: rows.length,
        kept_candidates: kept.length,
        publishable_candidates: publishable.length,
        allowed_reasons: [...allowedReasons],
        manual_selected_rows: selectedRows,
        selected_for_batch: batch.length,
        excluded_count: excluded.length,
        preview_json: previewPath,
        preview_xlsx: workbookOutputPath,
        sample_selected: batch.slice(0, 12).map((entry) => ({
          row: entry.source_row,
          title: entry.title,
          category_slug: entry.category_slug,
          slug: entry.slug,
        })),
      },
      null,
      2,
    ),
  );

  if (!shouldApply) {
    return;
  }

  for (const [index, post] of batch.entries()) {
    const payload = { ...post };
    delete payload.source_row;
    const { error } = await supabase.from('blog_posts').upsert(payload, { onConflict: 'slug' });
    if (error) {
      throw new Error(`Import lỗi ở bài ${index + 1}/${batch.length} (${post.title}): ${error.message}`);
    }
    console.log(`Imported ${index + 1}/${batch.length}: ${post.slug}`);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
