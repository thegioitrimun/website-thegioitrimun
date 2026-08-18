import fs from 'node:fs';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_WORKBOOK_PATH = '/Users/PHUC/Desktop/O2skin/tri-mun-articles-with-content.xlsx';
const DEFAULT_ROWS = [3, 4, 16, 22, 25, 26, 27, 29, 34, 38, 40, 41, 59, 60];
const SUPABASE_URL = 'https://ykcrngqhyinczmvwduox.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Tk-pvnzWINmKS6xe-5aKkA_aWr5DIVc';

const argMap = new Map(
  process.argv.slice(2).map((entry) => {
    const [key, value] = entry.split('=');
    return [key, value ?? 'true'];
  }),
);

const workbookPath = argMap.get('--file') || DEFAULT_WORKBOOK_PATH;
const shouldApply = argMap.has('--apply');
const selectedRows = String(argMap.get('--rows') || DEFAULT_ROWS.join(','))
  .split(',')
  .map((entry) => Number.parseInt(entry.trim(), 10))
  .filter((value) => Number.isFinite(value) && value >= 2);

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

const normalizeCompare = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const slugify = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

const capitalizeFirstLetter = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.charAt(0).toLocaleUpperCase('vi-VN') + text.slice(1);
};

const shouldDropLine = (line) => {
  const text = String(line || '').trim();
  return !text || /^([>.👉]+|\.|:)$/.test(text);
};

const extractToc = (lines) => {
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

const buildHeadingLevels = (tocItems) => {
  const levels = new Map();
  let currentTopLevel = '';

  for (const item of tocItems) {
    const text = String(item || '').trim();
    if (!text) continue;

    let level = 2;
    if (/^\d+\.\s+/.test(text) || /^bước\s+\d+/i.test(text)) {
      level = 3;
    } else if (/câu hỏi thường gặp/i.test(currentTopLevel) && /\?$/.test(text)) {
      level = 3;
    } else if (
      currentTopLevel &&
      /(cách nhận biết|phương pháp điều trị|nên làm gì|làm sao để|cần lưu ý|lợi ích|giải đáp|cách chăm sóc da bị mụn trứng cá đúng cách|9 nguyên nhân|8 cách|5 bước|4 điều|3 nguyên nhân|3 cách|hướng dẫn|mẹo bổ sung)/i.test(
        currentTopLevel,
      ) &&
      text.length <= 110
    ) {
      level = 3;
    }

    if (level === 2) currentTopLevel = text;
    levels.set(normalizeCompare(text), level);
  }

  return levels;
};

const appendParagraphLine = (segments, rawLine) => {
  const line = String(rawLine || '').trim();
  if (!line) return;
  const last = segments[segments.length - 1];

  if (!last || /^(##|###|- )/.test(last)) {
    segments.push(capitalizeFirstLetter(line));
    return;
  }

  if (
    /^[a-zà-ỹđ(,.;:]/iu.test(line) ||
    !/[.!?…:]$/.test(last) ||
    line.length <= 24
  ) {
    segments[segments.length - 1] = `${last} ${line}`.replace(/\s+/g, ' ').trim();
    return;
  }

  segments.push(capitalizeFirstLetter(line));
};

const formatRawContent = (rawContent) => {
  let lines = String(rawContent || '')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !shouldDropLine(line));

  const seeMoreIndex = lines.findIndex((line) => /^xem thêm$/i.test(line));
  if (seeMoreIndex >= 0) {
    lines = lines.slice(0, seeMoreIndex);
  }

  const { introLines, tocItems, bodyLines } = extractToc(lines);
  const tocSet = new Set(tocItems.map((item) => normalizeCompare(item)));
  const headingLevels = buildHeadingLevels(tocItems);
  const segments = [];

  for (const line of introLines) {
    if (/^mục lục$/i.test(line)) continue;
    appendParagraphLine(segments, line);
  }

  for (const line of bodyLines) {
    const normalizedLine = normalizeCompare(line);
    if (tocSet.has(normalizedLine)) {
      const level = headingLevels.get(normalizedLine) || 2;
      segments.push(`${level === 2 ? '##' : '###'} ${line.replace(/\s+/g, ' ').trim()}`);
      continue;
    }

    if (/^xem thêm$/i.test(line)) {
      break;
    }

    appendParagraphLine(segments, line);
  }

  return segments
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
};

const env = parseEnvFile('.env');
const workbook = XLSX.readFile(workbookPath);
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const main = async () => {
  const signIn = await supabase.auth.signInWithPassword({
    email: env.E2E_ADMIN_EMAIL,
    password: env.E2E_ADMIN_PASSWORD,
  });

  if (signIn.error || !signIn.data.user) {
    throw new Error(signIn.error?.message || 'Không đăng nhập được tài khoản admin');
  }

  const results = [];

  for (const rowNumber of selectedRows) {
    const sourceRow = rows[rowNumber - 2];
    if (!sourceRow) continue;

    const title = String(sourceRow.Title || '').trim();
    const slug = slugify(title);
    const formattedContent = formatRawContent(String(sourceRow['Cleaned Content'] || ''));

    results.push({
      row: rowNumber,
      title,
      slug,
      h2: (formattedContent.match(/^## /gm) || []).length,
      h3: (formattedContent.match(/^### /gm) || []).length,
      preview: formattedContent.split('\n').slice(0, 18).join('\n'),
    });

    if (!shouldApply) continue;

    const { error } = await supabase.from('blog_posts').update({ content: formattedContent }).eq('slug', slug);
    if (error) {
      throw new Error(`Không update được bài ${slug}: ${error.message}`);
    }
  }

  console.log(JSON.stringify({ apply: shouldApply, rows: selectedRows, results }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
