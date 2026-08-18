export const MAX_WORKBOOK_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_WORKBOOK_IMPORT_ROWS = 5_000;

const ALLOWED_WORKBOOK_EXTENSIONS = new Set(['xlsx', 'xls']);
const ALLOWED_WORKBOOK_MIME_TYPES = new Set([
  '',
  'application/octet-stream',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const hasBytes = (bytes: Uint8Array, expected: number[]) =>
  expected.every((value, index) => bytes[index] === value);

export async function validateWorkbookImportFile(file: File): Promise<void> {
  if (file.size <= 0) throw new Error('Tệp Excel đang trống.');
  if (file.size > MAX_WORKBOOK_IMPORT_BYTES) {
    throw new Error('Tệp Excel vượt quá giới hạn 5 MB.');
  }

  const extension = file.name.toLowerCase().split('.').pop() || '';
  if (!ALLOWED_WORKBOOK_EXTENSIONS.has(extension)) {
    throw new Error('Chỉ chấp nhận tệp .xlsx hoặc .xls.');
  }

  const mimeType = String(file.type || '').toLowerCase();
  if (!ALLOWED_WORKBOOK_MIME_TYPES.has(mimeType)) {
    throw new Error('Loại tệp Excel không hợp lệ.');
  }

  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const isXlsx = hasBytes(header, [0x50, 0x4b, 0x03, 0x04]);
  const isXls = hasBytes(header, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  if ((extension === 'xlsx' && !isXlsx) || (extension === 'xls' && !isXls)) {
    throw new Error('Nội dung tệp không khớp với định dạng Excel.');
  }
}

export function assertWorkbookRowLimit(rows: unknown[]): void {
  if (rows.length > MAX_WORKBOOK_IMPORT_ROWS) {
    throw new Error(`Tệp Excel vượt quá giới hạn ${MAX_WORKBOOK_IMPORT_ROWS.toLocaleString('vi-VN')} dòng.`);
  }
}

export const SAFE_WORKBOOK_READ_OPTIONS = {
  cellFormula: false,
  cellHTML: false,
  cellNF: false,
  cellStyles: false,
  dense: true,
  sheetRows: MAX_WORKBOOK_IMPORT_ROWS + 1,
} as const;
