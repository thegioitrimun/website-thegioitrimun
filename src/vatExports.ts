import type { VatExportResult, VatImportPreview, VatPeriod, VatReturnVersion } from '../types';
import {
  SAFE_WORKBOOK_READ_OPTIONS,
  assertWorkbookRowLimit,
  validateWorkbookImportFile,
} from './workbookImportSecurity';

type VatExportPayload = {
  period: VatPeriod;
  returnVersion: VatReturnVersion & { snapshot: Record<string, any> };
  acceptance: { xlsx: string; pdf: string; xml: string; canImportToHtkk: boolean };
};

const loadXlsx = () => import('xlsx');
const dangerousFormula = /^[=+\-@]/;

const safeCell = (value: unknown): string | number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value ?? '').trim();
  return dangerousFormula.test(text) ? `'${text}` : text;
};

const currency = (value: unknown): string => new Intl.NumberFormat('vi-VN').format(Number(value || 0));
const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const escapeXml = escapeHtml;

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function setSheetPresentation(sheet: any, columnWidths: number[]): void {
  sheet['!cols'] = columnWidths.map((wch) => ({ wch }));
  sheet['!autofilter'] = sheet['!ref'] ? { ref: sheet['!ref'] } : undefined;
  sheet['!freeze'] = { xSplit: 0, ySplit: 1 };
}

function appendTotals(XLSX: any, sheet: any, rowCount: number, numericColumns: string[]): void {
  const totalRow = rowCount + 2;
  sheet[`A${totalRow}`] = { t: 's', v: 'TỔNG' };
  for (const column of numericColumns) {
    sheet[`${column}${totalRow}`] = { t: 'n', f: `SUM(${column}2:${column}${rowCount + 1})` };
  }
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  range.e.r = Math.max(range.e.r, totalRow - 1);
  sheet['!ref'] = XLSX.utils.encode_range(range);
}

export async function exportVatWorkbook(payload: VatExportPayload): Promise<VatExportResult> {
  const XLSX = await loadXlsx();
  const snapshot = payload.returnVersion.snapshot || {};
  const period = payload.period;
  const workbook = XLSX.utils.book_new();
  const summaryRows = [
    ['CHỈ TIÊU', 'GIÁ TRỊ (VND)'],
    ['Kỳ kê khai', period.period_key],
    ['Phương pháp', period.method === 'direct_04' ? '04/GTGT - Trực tiếp trên doanh thu' : '01/GTGT - Khấu trừ'],
    ['VAT đầu ra', Number(period.output_vat_amount || 0)],
    ['VAT đầu vào', Number(period.input_vat_amount || 0)],
    ['VAT đầu vào được khấu trừ', Number(period.deductible_input_vat_amount || 0)],
    ['Điều chỉnh', Number(period.adjustment_amount || 0)],
    ['Khấu trừ chuyển đầu kỳ', Number(period.opening_credit_amount || 0)],
    ['Thuế phải nộp', Number(period.tax_payable_amount || 0)],
    ['Khấu trừ chuyển kỳ sau', Number(period.closing_credit_amount || 0)],
    ['Doanh thu trực tiếp', Number(period.direct_revenue_amount || 0)],
    ['Thuế trực tiếp', Number(period.direct_tax_amount || 0)],
    ['Hash bản kê khai', payload.returnVersion.snapshot_hash],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  setSheetPresentation(summarySheet, [38, 34]);
  for (let row = 4; row <= 12; row += 1) if (summarySheet[`B${row}`]) summarySheet[`B${row}`].z = '#,##0';
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Tổng hợp chỉ tiêu');

  const salesRows = (snapshot.salesLines || []).map((line: any) => ({
    'Ngày hóa đơn': safeCell(line.invoice_date), 'Ký hiệu': safeCell(line.invoice_series),
    'Số hóa đơn': safeCell(line.invoice_number), 'Người mua': safeCell(line.buyer_name),
    'MST người mua': safeCell(line.buyer_tax_code), 'Hàng hóa/dịch vụ': safeCell(line.description),
    'Thuế suất (bps)': Number(line.rate_bps || 0), 'Tiền chưa thuế': Number(line.net_amount || 0),
    'Tiền VAT': Number(line.vat_amount || 0), 'Tổng thanh toán': Number(line.gross_amount || 0),
  }));
  const salesSheet = XLSX.utils.json_to_sheet(salesRows.length ? salesRows : [{ 'Ghi chú': 'Không có dữ liệu' }]);
  setSheetPresentation(salesSheet, [14, 14, 16, 28, 18, 45, 16, 20, 18, 20]);
  if (salesRows.length) appendTotals(XLSX, salesSheet, salesRows.length, ['H', 'I', 'J']);
  XLSX.utils.book_append_sheet(workbook, salesSheet, 'Bán ra');

  const purchaseRows = (snapshot.purchaseLines || []).map((line: any) => ({
    'Ngày hóa đơn': safeCell(line.invoice_date), 'Ký hiệu': safeCell(line.invoice_series),
    'Số hóa đơn': safeCell(line.invoice_number), 'Nhà cung cấp': safeCell(line.supplier_name),
    'MST nhà cung cấp': safeCell(line.supplier_tax_code), 'Hàng hóa/dịch vụ': safeCell(line.description),
    'Thuế suất (bps)': Number(line.rate_bps || 0), 'Tiền chưa thuế': Number(line.net_amount || 0),
    'Tiền VAT': Number(line.vat_amount || 0), 'VAT được khấu trừ': Number(line.deductible_vat_amount || 0),
    'Tổng thanh toán': Number(line.gross_amount || 0),
    'Cảnh báo thanh toán': line.non_cash_payment_warning ? 'CẦN KIỂM TRA' : '',
  }));
  const purchaseSheet = XLSX.utils.json_to_sheet(purchaseRows.length ? purchaseRows : [{ 'Ghi chú': 'Không có dữ liệu' }]);
  setSheetPresentation(purchaseSheet, [14, 14, 16, 30, 18, 45, 16, 20, 18, 22, 20, 24]);
  if (purchaseRows.length) appendTotals(XLSX, purchaseSheet, purchaseRows.length, ['H', 'I', 'J', 'K']);
  XLSX.utils.book_append_sheet(workbook, purchaseSheet, 'Mua vào');

  const reducedRows = salesRows.filter((_row: any, index: number) => Number(snapshot.salesLines?.[index]?.rate_bps) === 800);
  const reducedSheet = XLSX.utils.json_to_sheet(reducedRows.length ? reducedRows : [{ 'Ghi chú': 'Không có dòng thuế suất 8%' }]);
  setSheetPresentation(reducedSheet, [14, 14, 16, 28, 18, 45, 16, 20, 18, 20]);
  if (reducedRows.length) appendTotals(XLSX, reducedSheet, reducedRows.length, ['H', 'I', 'J']);
  XLSX.utils.book_append_sheet(workbook, reducedSheet, 'Phụ lục giảm 8%');

  const adjustmentRows = (snapshot.adjustments || []).map((row: any) => ({
    'Loại điều chỉnh': safeCell(row.adjustment_type), 'Số tiền': Number(row.amount || 0),
    'Lý do': safeCell(row.reason), 'Căn cứ': safeCell(row.legal_basis), 'Trạng thái': safeCell(row.status),
  }));
  const adjustmentSheet = XLSX.utils.json_to_sheet(adjustmentRows.length ? adjustmentRows : [{ 'Ghi chú': 'Không có điều chỉnh' }]);
  setSheetPresentation(adjustmentSheet, [24, 20, 48, 48, 16]);
  if (adjustmentRows.length) appendTotals(XLSX, adjustmentSheet, adjustmentRows.length, ['B']);
  XLSX.utils.book_append_sheet(workbook, adjustmentSheet, 'Điều chỉnh');

  const issueSheet = XLSX.utils.aoa_to_sheet([
    ['KIỂM TRA / ĐỐI SOÁT', 'KẾT QUẢ'],
    ['Số cảnh báo còn lại khi khóa', Number(snapshot.reconciliationIssueCount || 0)],
    ['XML HTKK', snapshot.xmlAcceptance?.status || payload.acceptance.xml],
    ['Ghi chú XML', snapshot.xmlAcceptance?.message || ''],
  ]);
  setSheetPresentation(issueSheet, [38, 90]);
  XLSX.utils.book_append_sheet(workbook, issueSheet, 'Lỗi và đối soát');

  const auditSheet = XLSX.utils.aoa_to_sheet([
    ['THUỘC TÍNH', 'GIÁ TRỊ'], ['Version', payload.returnVersion.version_number],
    ['Mẫu tờ khai', payload.returnVersion.return_form], ['Phiên bản HTKK', payload.returnVersion.htkk_version],
    ['Hash SHA-256 snapshot', payload.returnVersion.snapshot_hash], ['Trạng thái', payload.returnVersion.status],
    ['Ngày xuất', new Date().toISOString()],
  ]);
  setSheetPresentation(auditSheet, [32, 90]);
  XLSX.utils.book_append_sheet(workbook, auditSheet, 'Audit');

  const fileName = `VAT-${period.period_key}-${payload.returnVersion.return_form.replace('/', '-')}-v${payload.returnVersion.version_number}.xlsx`;
  XLSX.writeFile(workbook, fileName, { compression: true });
  return { fileName, format: 'xlsx', status: 'generated' };
}

const headerAliases: Record<string, string> = {
  'loai hoa don': 'import_type', 'nhà cung cấp': 'supplier_name', 'nha cung cap': 'supplier_name',
  'mst nhà cung cấp': 'supplier_tax_code', 'mst nha cung cap': 'supplier_tax_code',
  'người mua': 'buyer_name', 'nguoi mua': 'buyer_name', 'mst người mua': 'buyer_tax_code',
  'mst nguoi mua': 'buyer_tax_code', 'ký hiệu': 'invoice_series', 'ky hieu': 'invoice_series',
  'số hóa đơn': 'invoice_number', 'so hoa don': 'invoice_number', 'ngày hóa đơn': 'invoice_date',
  'ngay hoa don': 'invoice_date', 'mô tả': 'description', 'mo ta': 'description', 'số lượng': 'quantity',
  'so luong': 'quantity', 'đơn giá': 'unit_price', 'don gia': 'unit_price', 'giảm giá': 'discount_amount',
  'giam gia': 'discount_amount', 'mã vat': 'vat_category_code', 'ma vat': 'vat_category_code',
  'giá gồm thuế': 'price_mode', 'phương thức thanh toán': 'payment_method',
};

const normalizedHeader = (value: unknown): string => {
  const text = String(value ?? '').trim().toLowerCase();
  return headerAliases[text] || text.replace(/\s+/g, '_');
};

export async function parseVatWorkbook(file: File, importType: 'sales' | 'purchase'): Promise<{
  fileName: string; fileSha256: string; rows: Record<string, unknown>[];
}> {
  await validateWorkbookImportFile(file);
  const bytes = await file.arrayBuffer();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const fileSha256 = [...digest].map((value) => value.toString(16).padStart(2, '0')).join('');
  const XLSX = await loadXlsx();
  const workbook = XLSX.read(bytes, { type: 'array', ...SAFE_WORKBOOK_READ_OPTIONS });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error('Workbook không có sheet dữ liệu.');
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, raw: true, defval: '' });
  if (matrix.length < 2) throw new Error('Sheet dữ liệu không có dòng hóa đơn.');
  const headers = (matrix[0] || []).map(normalizedHeader);
  const rows = matrix.slice(1).filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim())).map((row) => {
    const result: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      const value = (row as unknown[])[index];
      if (typeof value === 'string' && dangerousFormula.test(value.trim())) {
        throw new Error(`Phát hiện ô có công thức/nguy cơ thực thi tại cột ${header}.`);
      }
      result[header] = value;
    });
    result.import_type = importType;
    if (!result.quantity) result.quantity = 1;
    if (!result.price_mode) result.price_mode = 'inclusive';
    return result;
  });
  assertWorkbookRowLimit(rows);
  return { fileName: file.name, fileSha256, rows };
}

export function buildVatPrintHtml(payload: VatExportPayload): string {
  const snapshot = payload.returnVersion.snapshot || {};
  const period = payload.period;
  const groups = new Map<number, { net: number; vat: number; gross: number }>();
  for (const line of snapshot.salesLines || []) {
    const rate = Number(line.rate_bps || 0);
    const group = groups.get(rate) || { net: 0, vat: 0, gross: 0 };
    group.net += Number(line.net_amount || 0); group.vat += Number(line.vat_amount || 0); group.gross += Number(line.gross_amount || 0);
    groups.set(rate, group);
  }
  const groupRows = [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([rate, row]) =>
    `<tr><td>${rate / 100}%</td><td>${currency(row.net)}</td><td>${currency(row.vat)}</td><td>${currency(row.gross)}</td></tr>`).join('');
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>VAT ${escapeHtml(period.period_key)}</title><style>
    @page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,"DejaVu Sans",sans-serif;color:#111827;font-size:12px}
    h1{text-align:center;font-size:20px;margin:4px 0}.sub{text-align:center;color:#4b5563}.box{border:1px solid #9ca3af;padding:10px;margin:14px 0}
    table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #9ca3af;padding:7px;text-align:right}th:first-child,td:first-child{text-align:left}
    .sign{display:grid;grid-template-columns:1fr 1fr;gap:80px;margin-top:48px;text-align:center}.muted{color:#6b7280}
    </style></head><body><h1>TỜ KÊ KHAI ${escapeHtml(payload.returnVersion.return_form)}</h1>
    <p class="sub">Kỳ ${escapeHtml(period.period_key)} • Phiên bản ${payload.returnVersion.version_number}</p>
    <div class="box"><strong>${escapeHtml(snapshot.entity?.legal_name || '')}</strong><br>MST: ${escapeHtml(snapshot.entity?.tax_code || '')}<br>
    Địa chỉ: ${escapeHtml(snapshot.entity?.address || '')}<br>Cơ quan thuế: ${escapeHtml(snapshot.entity?.tax_authority || '')}</div>
    <table><thead><tr><th>Chỉ tiêu</th><th>Giá trị (VND)</th></tr></thead><tbody>
    <tr><td>VAT đầu ra</td><td>${currency(period.output_vat_amount)}</td></tr><tr><td>VAT đầu vào được khấu trừ</td><td>${currency(period.deductible_input_vat_amount)}</td></tr>
    <tr><td>Điều chỉnh</td><td>${currency(period.adjustment_amount)}</td></tr><tr><td><strong>Thuế phải nộp</strong></td><td><strong>${currency(period.tax_payable_amount)}</strong></td></tr>
    <tr><td>Khấu trừ chuyển kỳ sau</td><td>${currency(period.closing_credit_amount)}</td></tr></tbody></table>
    <h2>Bảng theo thuế suất</h2><table><thead><tr><th>Thuế suất</th><th>Chưa thuế</th><th>VAT</th><th>Tổng</th></tr></thead><tbody>${groupRows || '<tr><td colspan="4">Không có dữ liệu</td></tr>'}</tbody></table>
    <p class="muted">Kiểm tra chéo: cảnh báo còn lại ${Number(snapshot.reconciliationIssueCount || 0)} • Hash ${escapeHtml(payload.returnVersion.snapshot_hash)}</p>
    <div class="sign"><div>Người lập biểu<br><br><br>(Ký, ghi rõ họ tên)</div><div>Người đại diện pháp luật<br><br><br>(Ký, ghi rõ họ tên và đóng dấu)</div></div>
    </body></html>`;
}

export function printVatPdf(payload: VatExportPayload): VatExportResult {
  const fileName = `VAT-${payload.period.period_key}-${payload.returnVersion.return_form.replace('/', '-')}.pdf`;
  const printWindow = window.open('', '_blank', 'width=1050,height=800');
  if (!printWindow) return { fileName, format: 'pdf', status: 'blocked', message: 'Trình duyệt đã chặn cửa sổ in.' };
  printWindow.document.write(buildVatPrintHtml(payload));
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
  return { fileName, format: 'pdf', status: 'generated', message: 'Chọn “Lưu thành PDF” trong hộp thoại in.' };
}

function buildHtkkXml(payload: VatExportPayload): string {
  const snapshot = payload.returnVersion.snapshot || {};
  const period = payload.period;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<GTGT schemaVersion="${escapeXml(payload.returnVersion.htkk_version)}" form="${escapeXml(payload.returnVersion.return_form)}">
  <Taxpayer><Name>${escapeXml(snapshot.entity?.legal_name)}</Name><TaxCode>${escapeXml(snapshot.entity?.tax_code)}</TaxCode></Taxpayer>
  <Period key="${escapeXml(period.period_key)}" from="${escapeXml(period.starts_on)}" to="${escapeXml(period.ends_on)}"/>
  <Indicators><OutputVat>${Number(period.output_vat_amount || 0)}</OutputVat><DeductibleInputVat>${Number(period.deductible_input_vat_amount || 0)}</DeductibleInputVat><Adjustment>${Number(period.adjustment_amount || 0)}</Adjustment><Payable>${Number(period.tax_payable_amount || 0)}</Payable><ClosingCredit>${Number(period.closing_credit_amount || 0)}</ClosingCredit></Indicators>
  <Audit snapshotHash="${escapeXml(payload.returnVersion.snapshot_hash)}" version="${payload.returnVersion.version_number}"/>
</GTGT>`;
}

export function exportVatHtkkXml(payload: VatExportPayload): VatExportResult {
  const fileName = `VAT-${payload.period.period_key}-${payload.returnVersion.return_form.replace('/', '-')}.xml`;
  if (!payload.acceptance.canImportToHtkk || payload.returnVersion.xml_validation_status !== 'htkk_valid') {
    return {
      fileName, format: 'xml', status: 'pending_sample',
      message: 'Chưa xuất XML nhập HTKK: cần file mẫu đã khử dữ liệu nhạy cảm của đúng phiên bản 01/GTGT và 04/GTGT để xác nhận adapter và round-trip.',
    };
  }
  const xml = buildHtkkXml(payload);
  const parsed = new DOMParser().parseFromString(xml, 'application/xml');
  if (parsed.querySelector('parsererror')) return { fileName, format: 'xml', status: 'blocked', message: 'XML không vượt qua kiểm tra round-trip nội bộ.' };
  const payable = Number(parsed.querySelector('Payable')?.textContent || NaN);
  if (payable !== Number(payload.period.tax_payable_amount || 0)) {
    return { fileName, format: 'xml', status: 'blocked', message: 'Chỉ tiêu XML không khớp snapshot kỳ.' };
  }
  downloadBlob(new Blob([xml], { type: 'application/xml;charset=utf-8' }), fileName);
  return { fileName, format: 'xml', status: 'generated' };
}

export type { VatExportPayload, VatImportPreview };
