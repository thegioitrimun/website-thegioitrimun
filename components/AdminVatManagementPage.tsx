import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../services/api';
import type {
  PurchaseInvoice,
  SalesInvoice,
  VatCategory,
  VatImportPreview,
  VatInvoiceLine,
  VatPeriod,
} from '../types';
import { useToast } from '../hooks/useToast';
import { useAdminLayoutDispatch } from './AdminLayoutContext';
import {
  CheckCircleIcon,
  DocumentDuplicateIcon,
  FilterIcon,
  LoadingIcon,
  PrinterIcon,
  SearchIcon,
  XCircleIcon,
} from './icons';
import {
  exportVatHtkkXml,
  exportVatWorkbook,
  parseVatWorkbook,
  printVatPdf,
} from '../src/vatExports';

type Tab =
  | 'overview'
  | 'sales'
  | 'purchases'
  | 'periods'
  | 'adjustments'
  | 'rules'
  | 'entity'
  | 'migration';

type Role = 'customer' | 'doctor' | 'accountant' | 'admin' | 'master_admin';

const tabs: Array<{ key: Tab; label: string; hint?: string }> = [
  { key: 'overview', label: 'Tổng quan', hint: 'Chỉ số VAT & trạng thái' },
  { key: 'sales', label: 'Bán ra', hint: 'Hóa đơn đầu ra & bảng kê' },
  { key: 'purchases', label: 'Mua vào', hint: 'Hóa đơn đầu vào & chi phí' },
  { key: 'periods', label: 'Kỳ kê khai', hint: '01/GTGT & 04/GTGT' },
  { key: 'adjustments', label: 'Điều chỉnh', hint: 'Bổ sung & sai lệch' },
  { key: 'rules', label: 'Quy tắc VAT', hint: 'Thuế suất & phân loại' },
  { key: 'entity', label: 'Pháp nhân', hint: 'Hồ sơ doanh nghiệp & MST' },
  { key: 'migration', label: 'Chuyển D1', hint: 'Đối soát 46 bảng D1' },
];

const EXCEL_ICON_URL = 'https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-outputexcel.webp';
const VAT_ICON_URL = 'https://thegioitrimun.vn/r2/assets/admin-icons/1786688261441-dongbocanva.webp';

const money = (value: unknown) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const today = () => new Date().toISOString().slice(0, 10);

// Apple Glass UI Elements
const fieldClass =
  'w-full h-9 rounded-xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.08),0_1px_0_rgba(255,255,255,0.1)] px-3 text-xs sm:text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-primary/50';

const primaryButton =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-xs sm:text-sm font-bold text-primary-foreground shadow-xs backdrop-blur-md transition-all hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 shrink-0';

const secondaryButton =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-background/40 px-3.5 text-xs sm:text-sm font-bold text-foreground shadow-2xs backdrop-blur-md transition-all hover:bg-muted/50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 shrink-0';

const iconButton =
  'flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/40 shadow-2xs backdrop-blur-md transition-all hover:bg-muted/50 active:scale-95 disabled:opacity-50 shrink-0';

const Panel: React.FC<{
  title: string;
  badge?: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}> = ({ title, badge, description, children, action }) => (
  <section className="rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-4 sm:p-6 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        {badge && (
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-primary mb-1">
            {badge}
          </p>
        )}
        <h2 className="text-lg sm:text-xl font-bold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-3xl text-xs sm:text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
    {children}
  </section>
);

const Metric: React.FC<{
  label: string;
  value: string;
  hint?: string;
  alert?: boolean;
}> = ({ label, value, hint, alert }) => (
  <div
    className={`rounded-xl sm:rounded-2xl border p-3.5 sm:p-4 backdrop-blur-xl shadow-2xs transition-all ${
      alert
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-200'
        : 'border-white/60 dark:border-white/10 bg-background/40'
    }`}
  >
    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">
      {label}
    </p>
    <p className="mt-1.5 truncate text-xl sm:text-2xl font-black text-foreground">{value}</p>
    {hint ? (
      <p className="mt-1 text-[11px] sm:text-xs text-muted-foreground leading-snug">{hint}</p>
    ) : null}
  </div>
);

const StatusPill: React.FC<{
  children: React.ReactNode;
  ok?: boolean;
  warning?: boolean;
}> = ({ children, ok, warning }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-colors ${
      ok
        ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
        : warning
        ? 'border border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300'
        : 'border border-border/50 bg-muted/50 text-muted-foreground'
    }`}
  >
    <span
      className={`h-1.5 w-1.5 rounded-full ${
        ok ? 'bg-emerald-500' : warning ? 'bg-amber-500' : 'bg-muted-foreground/60'
      }`}
    />
    <span>{children}</span>
  </span>
);

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-2xl border border-dashed border-border/60 bg-background/20 backdrop-blur-sm p-8 text-center text-xs sm:text-sm text-muted-foreground">
    {children}
  </div>
);

const initialLine = (): VatInvoiceLine => ({
  description: '',
  unit: '',
  quantity: 1,
  unit_price: 0,
  vat_category_code: 'VAT_10',
  price_mode: 'inclusive',
});

const InvoiceForm: React.FC<{
  type: 'sales' | 'purchase';
  categories: VatCategory[];
  busy: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}> = ({ type, categories, busy, onSave }) => {
  const [form, setForm] = useState<Record<string, any>>({
    invoice_date: today(),
    invoice_series: '',
    invoice_number: '',
    price_mode: 'inclusive',
    payment_method: '',
    supplier_name: '',
    supplier_tax_code: '',
    buyer_name: '',
    buyer_tax_code: '',
    discount_amount: 0,
  });
  const [line, setLine] = useState<VatInvoiceLine>(initialLine);
  const update = (key: string, value: unknown) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (status: 'draft' | 'issued') => {
    await onSave({
      ...form,
      source_type: 'manual',
      status,
      reconciliation_status: status === 'issued' ? 'verified' : 'candidate',
      lines: [line],
      idempotency_key: crypto.randomUUID(),
    });
    setForm((current) => ({
      ...current,
      invoice_number: '',
      supplier_name: '',
      buyer_name: '',
      discount_amount: 0,
    }));
    setLine(initialLine());
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {type === 'purchase' ? (
          <>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
                Nhà cung cấp *
              </label>
              <input
                className={fieldClass}
                placeholder="Tên nhà cung cấp..."
                value={form.supplier_name}
                onChange={(e) => update('supplier_name', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
                MST nhà cung cấp
              </label>
              <input
                className={fieldClass}
                placeholder="Mã số thuế..."
                value={form.supplier_tax_code}
                onChange={(e) => update('supplier_tax_code', e.target.value)}
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
                Người mua
              </label>
              <input
                className={fieldClass}
                placeholder="Tên khách hàng / công ty..."
                value={form.buyer_name}
                onChange={(e) => update('buyer_name', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
                MST người mua
              </label>
              <input
                className={fieldClass}
                placeholder="Mã số thuế..."
                value={form.buyer_tax_code}
                onChange={(e) => update('buyer_tax_code', e.target.value)}
              />
            </div>
          </>
        )}
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
            Ngày lập hóa đơn
          </label>
          <input
            className={fieldClass}
            type="date"
            value={form.invoice_date}
            onChange={(e) => update('invoice_date', e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
            Ký hiệu hóa đơn
          </label>
          <input
            className={fieldClass}
            placeholder="VD: 1C24TAA"
            value={form.invoice_series}
            onChange={(e) => update('invoice_series', e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
            Số hóa đơn
          </label>
          <input
            className={fieldClass}
            placeholder="VD: 0000123"
            value={form.invoice_number}
            onChange={(e) => update('invoice_number', e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
            Phương thức thanh toán
          </label>
          <select
            className={fieldClass}
            value={form.payment_method}
            onChange={(e) => update('payment_method', e.target.value)}
          >
            <option value="">Chưa xác định</option>
            <option value="cash">Tiền mặt</option>
            <option value="bank_transfer">Chuyển khoản</option>
            <option value="card">Thẻ</option>
            <option value="offset">Bù trừ</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-white/60 dark:border-white/10 bg-background/40 backdrop-blur-xl p-3 sm:p-4">
        <p className="mb-2 text-xs font-bold text-foreground">Dòng hàng hóa / dịch vụ</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_0.6fr_1fr_1.2fr]">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
              Mô tả hàng hóa / dịch vụ *
            </label>
            <input
              className={fieldClass}
              placeholder="VD: Serum chấm mụn La Roche-Posay..."
              value={line.description}
              onChange={(e) => setLine({ ...line, description: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
              Số lượng
            </label>
            <input
              className={fieldClass}
              type="number"
              min="1"
              value={line.quantity}
              onChange={(e) => setLine({ ...line, quantity: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
              Đơn giá (VND)
            </label>
            <input
              className={fieldClass}
              type="number"
              min="0"
              step="1000"
              value={line.unit_price}
              onChange={(e) => setLine({ ...line, unit_price: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
              Nhóm thuế suất VAT
            </label>
            <select
              className={fieldClass}
              value={line.vat_category_code}
              onChange={(e) => setLine({ ...line, vat_category_code: e.target.value })}
            >
              {categories
                .filter((category) => category.is_active)
                .map((category) => (
                  <option key={category.id} value={category.code}>
                    {category.name} ({category.rate_bps / 100}%)
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <button
          type="button"
          disabled={busy || !line.description}
          className={secondaryButton}
          onClick={() => void submit('draft')}
        >
          Lưu nháp
        </button>
        <button
          type="button"
          disabled={busy || !line.description || !form.invoice_number}
          className={primaryButton}
          onClick={() => void submit('issued')}
        >
          Phát hành & đưa vào sổ
        </button>
      </div>
    </div>
  );
};

const ImportBox: React.FC<{
  type: 'sales' | 'purchase';
  busy: boolean;
  onDone: () => Promise<void>;
}> = ({ type, busy, onDone }) => {
  const { addToast } = useToast();
  const [preview, setPreview] = useState<VatImportPreview | null>(null);
  const [working, setWorking] = useState(false);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setWorking(true);
    try {
      const parsed = await parseVatWorkbook(file, type);
      const result = await api.previewVatImport({
        import_type: type,
        file_name: parsed.fileName,
        file_sha256: parsed.fileSha256,
        idempotency_key: `${parsed.fileSha256}:${type}`,
        rows: parsed.rows,
      });
      setPreview(result);
    } catch (error: any) {
      addToast(error?.message || 'Không thể đọc file Excel.', { type: 'error' });
    } finally {
      setWorking(false);
    }
  };

  const commit = async () => {
    if (!preview) return;
    setWorking(true);
    try {
      const result = await api.commitVatImport(preview.id);
      addToast(`Đã nhập ${result.committed} hóa đơn.`, { type: 'success' });
      setPreview(null);
      await onDone();
    } catch (error: any) {
      addToast(error?.message || 'Không thể commit file.', { type: 'error' });
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-background/30 backdrop-blur-xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground">
            Nhập Excel {type === 'sales' ? 'hóa đơn bán ra' : 'hóa đơn mua vào'}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tối đa 5 MB; tắt công thức; kiểm tra lỗi theo từng dòng; commit nguyên tử tối đa 100 hóa đơn.
          </p>
        </div>
        <label className={`${secondaryButton} cursor-pointer`}>
          <img src={EXCEL_ICON_URL} alt="Excel" className="h-4 w-4 object-contain" />
          <span>{working ? 'Đang đọc...' : 'Chọn file Excel'}</span>
          <input
            className="hidden"
            type="file"
            accept=".xlsx,.xls"
            disabled={busy || working}
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
        </label>
      </div>

      {preview ? (
        <div className="mt-4 rounded-xl border border-white/60 dark:border-white/10 bg-background/50 backdrop-blur-xl p-4 text-xs sm:text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/20 pb-3">
            <p>
              <strong>{preview.rowCount}</strong> dòng • <strong>{preview.validCount}</strong> hợp lệ •{' '}
              <strong className={preview.issues.length ? 'text-destructive' : 'text-foreground'}>
                {preview.issues.length}
              </strong>{' '}
              vấn đề
            </p>
            <button
              type="button"
              className={primaryButton}
              disabled={
                working ||
                preview.issues.some((issue) => issue.severity === 'error') ||
                preview.rowCount > 100
              }
              onClick={() => void commit()}
            >
              Xác nhận commit ({preview.validCount})
            </button>
          </div>
          {preview.issues.length ? (
            <ul className="mt-3 max-h-44 space-y-1 overflow-auto text-xs text-destructive">
              {preview.issues.slice(0, 100).map((issue, index) => (
                <li key={`${issue.rowNumber}-${issue.fieldName}-${index}`}>
                  Dòng {issue.rowNumber}, {issue.fieldName}: {issue.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Không phát hiện lỗi định dạng. Toàn bộ dòng đều sẵn sàng nhập vào sổ.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
};

// Invoice Table with Desktop Table + Mobile Glass Cards
const InvoiceTable: React.FC<{
  type: 'sales' | 'purchase';
  rows: Array<SalesInvoice | PurchaseInvoice>;
  onRefresh?: () => void;
}> = ({ type, rows, onRefresh }) => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'issued' | 'draft'>('all');

  const filtered = useMemo(() => {
    let result = rows;
    if (statusFilter !== 'all') {
      result = result.filter((row) => row.status === statusFilter);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter((row) => {
        const p = row as PurchaseInvoice;
        const s = row as SalesInvoice;
        const partner = (type === 'purchase' ? p.supplier_name : s.buyer_name) || '';
        const series = row.invoice_series || '';
        const num = row.invoice_number || '';
        return (
          partner.toLowerCase().includes(q) ||
          series.toLowerCase().includes(q) ||
          num.toLowerCase().includes(q)
        );
      });
    }
    return result;
  }, [rows, statusFilter, query, type]);

  if (!rows.length) {
    return <Empty>Chưa có hóa đơn {type === 'sales' ? 'bán ra' : 'mua vào'}.</Empty>;
  }

  return (
    <div className="space-y-3">
      {/* Sub-toolbar: Search + Status filter */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo số HĐ, ký hiệu, đối tác..."
            className="w-full h-9 rounded-xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.08)] pl-8 pr-3 text-xs outline-none focus:ring-1 focus:ring-primary/50"
          />
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
              statusFilter === 'all'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'border border-border/60 bg-background/40 text-muted-foreground hover:bg-muted'
            }`}
          >
            Tất cả ({rows.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('issued')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
              statusFilter === 'issued'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'border border-border/60 bg-background/40 text-muted-foreground hover:bg-muted'
            }`}
          >
            Đã phát hành ({rows.filter((r) => r.status === 'issued').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('draft')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
              statusFilter === 'draft'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'border border-border/60 bg-background/40 text-muted-foreground hover:bg-muted'
            }`}
          >
            Nháp ({rows.filter((r) => r.status === 'draft').length})
          </button>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-white/60 dark:border-white/10 bg-background/30 backdrop-blur-xl">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="border-b border-border/50 bg-background/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3.5 py-2.5">Ngày</th>
              <th className="px-3.5 py-2.5">Số / ký hiệu</th>
              <th className="px-3.5 py-2.5">Đối tác</th>
              <th className="px-3.5 py-2.5 text-right">Chưa thuế</th>
              <th className="px-3.5 py-2.5 text-right">VAT</th>
              <th className="px-3.5 py-2.5 text-right">Tổng tiền</th>
              <th className="px-3.5 py-2.5 text-center">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {filtered.map((row) => {
              const purchase = row as PurchaseInvoice;
              const sales = row as SalesInvoice;
              const partner =
                type === 'purchase'
                  ? purchase.supplier_name
                  : sales.buyer_name || sales.source_type;
              return (
                <tr key={row.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-3.5 py-2.5 font-medium whitespace-nowrap">{row.invoice_date}</td>
                  <td className="px-3.5 py-2.5 whitespace-nowrap font-semibold">
                    <span>{row.invoice_series || '—'}</span>
                    <span className="text-muted-foreground mx-1">/</span>
                    <span className="text-foreground">{row.invoice_number || 'Ứng viên'}</span>
                  </td>
                  <td className="px-3.5 py-2.5 max-w-[200px] truncate" title={partner}>
                    {partner || '—'}
                  </td>
                  <td className="px-3.5 py-2.5 text-right whitespace-nowrap">{money(row.net_amount)}</td>
                  <td className="px-3.5 py-2.5 text-right whitespace-nowrap text-primary">{money(row.vat_amount)}</td>
                  <td className="px-3.5 py-2.5 text-right whitespace-nowrap font-bold text-foreground">
                    {money(row.gross_amount)}
                  </td>
                  <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                    <StatusPill
                      ok={row.status === 'issued'}
                      warning={type === 'purchase' && purchase.non_cash_payment_warning}
                    >
                      {row.status === 'issued' ? 'Đã phát hành' : 'Bản nháp'}
                      {type === 'purchase' && purchase.non_cash_payment_warning
                        ? ' • Cảnh báo TT'
                        : ''}
                    </StatusPill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Glass Card View */}
      <div className="md:hidden space-y-2.5">
        {filtered.map((row) => {
          const purchase = row as PurchaseInvoice;
          const sales = row as SalesInvoice;
          const partner =
            type === 'purchase' ? purchase.supplier_name : sales.buyer_name || sales.source_type;
          return (
            <div
              key={row.id}
              className="rounded-xl border border-white/60 dark:border-white/10 bg-background/40 backdrop-blur-xl p-3.5 shadow-2xs space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-foreground">
                    {row.invoice_series ? `${row.invoice_series} / ` : ''}
                    {row.invoice_number || 'Ứng viên'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{row.invoice_date}</p>
                </div>
                <StatusPill
                  ok={row.status === 'issued'}
                  warning={type === 'purchase' && purchase.non_cash_payment_warning}
                >
                  {row.status === 'issued' ? 'Phát hành' : 'Nháp'}
                </StatusPill>
              </div>

              {partner && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Đối tác: </span>
                  <span className="font-medium text-foreground">{partner}</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-border/20 text-xs">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Chưa thuế</p>
                  <p className="font-medium">{money(row.net_amount)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">VAT</p>
                  <p className="font-medium text-primary">{money(row.vat_amount)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-muted-foreground">Tổng</p>
                  <p className="font-bold text-foreground">{money(row.gross_amount)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AdminVatManagementPage: React.FC<{ currentRole: Role }> = ({ currentRole }) => {
  const { addToast } = useToast();
  const setLayout = useAdminLayoutDispatch();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [data, setData] = useState<api.VatBootstrapResponse | null>(null);
  const [sales, setSales] = useState<SalesInvoice[]>([]);
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const isMaster = currentRole === 'master_admin';

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [bootstrap, salesResult, purchaseResult, adjustmentRows] = await Promise.all([
          api.getVatBootstrap(),
          api.listVatSalesInvoices(),
          api.listVatPurchaseInvoices(),
          api.listVatAdjustments(),
        ]);
        setData(bootstrap);
        setSales(salesResult.data);
        setPurchases(purchaseResult.data);
        setAdjustments(adjustmentRows);
      } catch (error: any) {
        addToast(error?.message || 'Không thể tải dữ liệu VAT.', { type: 'error' });
      } finally {
        setLoading(false);
      }
    },
    [addToast]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Synchronize sidebar layout and mobile task tabs with AdminWorkspaceLayout
  useEffect(() => {
    setLayout({
      eyebrow: 'D1 • VAT LEDGER',
      title: 'Kế toán VAT',
      icon: (
        <img
          src={VAT_ICON_URL}
          alt="VAT"
          className="h-8 w-8 object-contain"
        />
      ),
      description: 'Bảng kê đầu ra/đầu vào, kỳ 01/GTGT hoặc 04/GTGT và bộ hồ sơ đối soát bất biến.',
      insights: data
        ? [
            {
              label: 'Phương pháp',
              value: data.entity.default_method === 'direct_04' ? '04/GTGT' : '01/GTGT',
              hint: data.entity.filing_cycle === 'monthly' ? 'Kỳ tháng' : 'Kỳ quý',
            },
            {
              label: 'Go-live',
              value: data.entity.go_live_date || 'Chưa bật',
              hint: data.entity.is_active ? 'Đã kích hoạt' : 'Chờ bật',
            },
            {
              label: 'D1 Parity',
              value: `${data.migration.sourceTables.verified}/${data.migration.sourceTables.expected}`,
              hint: `${data.migration.d1Orders} đơn D1 bảo vệ`,
            },
          ]
        : [],
      taskItems: tabs.map((tab) => ({
        key: tab.key,
        label: tab.label,
        hint: tab.hint,
        onClick: () => setActiveTab(tab.key),
      })),
      activeTaskKey: activeTab,
    });
    return () => setLayout({});
  }, [activeTab, data, setLayout]);

  const execute = async (task: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await task();
      addToast(message, { type: 'success' });
      await load(true);
    } catch (error: any) {
      addToast(error?.message || 'Thao tác thất bại.', { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const currentPeriod = useMemo(
    () => data?.periods.find((period) => !period.parent_period_id) || data?.periods[0],
    [data]
  );

  const periodAction = (
    period: VatPeriod,
    action: 'rebuild' | 'submit-review' | 'lock' | 'filed' | 'amend'
  ) => execute(() => api.runVatPeriodAction(period.id, action), 'Đã cập nhật kỳ kê khai.');

  const exportPeriod = async (period: VatPeriod, format: 'xlsx' | 'pdf' | 'xml') => {
    setBusy(true);
    try {
      const payload = await api.getVatExportData(period.id);
      const result =
        format === 'xlsx'
          ? await exportVatWorkbook(payload)
          : format === 'pdf'
          ? printVatPdf(payload)
          : exportVatHtkkXml(payload);
      addToast(result.message || `Đã tạo ${result.fileName}.`, {
        type: result.status === 'generated' ? 'success' : 'info',
      });
    } catch (error: any) {
      addToast(error?.message || 'Không thể xuất hồ sơ.', { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-4 -mx-3 sm:mx-0 p-3 sm:p-0" aria-busy="true">
        <div className="h-16 animate-pulse rounded-2xl border border-white/60 bg-card/40 backdrop-blur-xl mx-1 sm:mx-0" />
        <div className="h-80 animate-pulse rounded-2xl sm:rounded-[1.75rem] border border-white/60 bg-card/40 backdrop-blur-2xl mx-1 sm:mx-0" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl sm:rounded-[1.75rem] border border-destructive/30 bg-card/85 backdrop-blur-2xl p-6 sm:p-8 text-center shadow-lg -mx-3 sm:mx-0 mx-1 sm:mx-0">
        <XCircleIcon className="mx-auto mb-3 h-10 w-10 text-destructive" />
        <h2 className="text-xl font-bold text-foreground">Không thể tải hồ sơ VAT</h2>
        <p className="mt-2 text-sm text-muted-foreground">Vui lòng kiểm tra quyền truy cập hoặc kết nối D1.</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-xs backdrop-blur-md transition-all hover:bg-primary/90 active:scale-95"
        >
          Thử tải lại
        </button>
      </div>
    );
  }

  // Preset Pills Counts
  const tabCounts: Record<Tab, number | null> = {
    overview: null,
    sales: sales.length,
    purchases: purchases.length,
    periods: data.periods.length,
    adjustments: adjustments.length,
    rules: data.categories.length,
    entity: null,
    migration: data.migration.openIssues > 0 ? data.migration.openIssues : null,
  };

  const renderOverview = () => (
    <div className="space-y-4">
      {/* 4 Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <Metric
          label="VAT đầu ra"
          value={money(currentPeriod?.output_vat_amount || data.summary.sales.vat_amount)}
          hint={`${data.summary.sales.count} hóa đơn đã phát hành`}
        />
        <Metric
          label="VAT đầu vào khấu trừ"
          value={money(
            currentPeriod?.deductible_input_vat_amount || data.summary.purchases.deductible_vat_amount
          )}
          hint={`${data.summary.purchases.count} hóa đơn mua vào`}
        />
        <Metric
          label="Thuế phải nộp"
          value={money(currentPeriod?.tax_payable_amount || 0)}
          hint={currentPeriod?.period_key ? `Kỳ ${currentPeriod.period_key}` : 'Chưa mở kỳ'}
        />
        <Metric
          label="Cảnh báo đối soát"
          value={String(data.summary.warnings.salesCandidates + data.summary.warnings.nonCashPayment)}
          alert={data.summary.warnings.salesCandidates + data.summary.warnings.nonCashPayment > 0}
          hint={`${data.summary.warnings.salesCandidates} ứng viên • ${data.summary.warnings.nonCashPayment} TT tiền mặt`}
        />
      </div>

      {/* Readiness Status Panel */}
      <Panel
        badge="SẴN SÀNG KÊ KHAI & ĐỐI SOÁT"
        title="Trạng thái hồ sơ thuế & D1"
        description="VAT chỉ ghi nhận từ mốc go-live. Toàn bộ lịch sử trước đó được giữ nguyên làm số liệu đối soát mở đầu, không tính hồi tố."
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Metric
            label="Pháp nhân & MST"
            value={data.entity.is_active ? 'Đã kích hoạt' : 'Chưa kích hoạt'}
            hint={data.entity.tax_code ? `MST: ${data.entity.tax_code}` : 'Chưa nhập MST'}
            alert={!data.entity.is_active}
          />
          <Metric
            label="Phân loại chờ duyệt"
            value={String(
              data.pendingClassifications.products.length +
                data.pendingClassifications.services.length
            )}
            hint={`${data.pendingClassifications.products.length} SP • ${data.pendingClassifications.services.length} DV`}
            alert={
              data.pendingClassifications.products.length +
                data.pendingClassifications.services.length >
              0
            }
          />
          <Metric
            label="Chuẩn HTKK XML"
            value={
              data.safeguards.xmlStatus === 'pending_sample'
                ? 'Chờ file mẫu'
                : data.entity.htkk_version
            }
            hint="Excel/PDF dùng ngay; XML fail-closed cho đến khi khớp mẫu"
            alert={data.safeguards.xmlStatus === 'pending_sample'}
          />
        </div>
      </Panel>
    </div>
  );

  const renderInvoices = (type: 'sales' | 'purchase') => (
    <div className="space-y-4">
      <Panel
        badge={type === 'sales' ? 'HÓA ĐƠN ĐẦU RA' : 'HÓA ĐƠN ĐẦU VÀO'}
        title={type === 'sales' ? 'Thêm hóa đơn bán ra' : 'Thêm hóa đơn mua vào'}
        description="Tiền tệ quy đổi số nguyên VND; VAT tính chi tiết theo dòng; chiết khấu phân bổ chuẩn largest remainder."
      >
        <InvoiceForm
          type={type}
          categories={data.categories}
          busy={busy}
          onSave={(payload) =>
            execute(
              () =>
                type === 'sales'
                  ? api.saveVatSalesInvoice(payload)
                  : api.saveVatPurchaseInvoice(payload),
              'Đã lưu hóa đơn VAT thành công.'
            )
          }
        />
      </Panel>

      <Panel
        badge="IMPORT DỮ LIỆU EXCEL"
        title="Nhập hàng loạt từ Excel"
        description="Hệ thống tự động preview lỗi trước khi commit nguyên tử. File không được chứa công thức động."
      >
        <ImportBox type={type} busy={busy} onDone={() => load(true)} />
      </Panel>

      <Panel
        badge="BẢNG KÊ CHI TIẾT"
        title={type === 'sales' ? 'Bảng kê hóa đơn bán ra' : 'Bảng kê hóa đơn mua vào'}
        action={
          <button
            type="button"
            className={secondaryButton}
            onClick={() => void load(true)}
            title="Tải lại bảng kê"
          >
            Làm mới
          </button>
        }
      >
        <InvoiceTable
          type={type}
          rows={type === 'sales' ? sales : purchases}
          onRefresh={() => void load(true)}
        />
      </Panel>
    </div>
  );

  const renderPeriods = () => (
    <div className="space-y-4">
      <Panel
        badge="QUẢN LÝ KỲ THUẾ"
        title="Mở kỳ kê khai mới"
        description="Phương pháp tính thuế (01/GTGT hoặc 04/GTGT) và chu kỳ sẽ được snapshot bất biến tại thời điểm mở kỳ."
        action={
          <button
            type="button"
            disabled={busy || !data.entity.go_live_date}
            className={primaryButton}
            onClick={() => {
              const now = new Date();
              const number =
                data.entity.filing_cycle === 'monthly'
                  ? now.getMonth() + 1
                  : Math.floor(now.getMonth() / 3) + 1;
              void execute(
                () =>
                  api.createVatPeriod({
                    year: now.getFullYear(),
                    period_number: number,
                    method: data.entity.default_method,
                  }),
                'Đã mở kỳ kê khai hiện tại.'
              );
            }}
          >
            Mở kỳ hiện tại
          </button>
        }
      >
        <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-muted-foreground">
          <span>
            Chu kỳ kê khai:{' '}
            <strong className="text-foreground">
              {data.entity.filing_cycle === 'monthly' ? 'Theo tháng' : 'Theo quý'}
            </strong>
          </span>
          <span>•</span>
          <span>
            Ngày go-live:{' '}
            <strong className="text-foreground">
              {data.entity.go_live_date || 'Chưa cấu hình'}
            </strong>
          </span>
          <span>•</span>
          <span>
            Phương pháp mặc định:{' '}
            <strong className="text-foreground">
              {data.entity.default_method === 'direct_04' ? '04/GTGT' : '01/GTGT'}
            </strong>
          </span>
        </div>
      </Panel>

      <Panel badge="DANH SÁCH KỲ" title="Lịch sử các kỳ kê khai thuế">
        <div className="space-y-3">
          {data.periods.length ? (
            data.periods.map((period) => (
              <div
                key={period.id}
                className="rounded-2xl border border-white/60 dark:border-white/10 bg-background/40 backdrop-blur-xl p-4 sm:p-5 shadow-2xs space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-base sm:text-lg font-black text-foreground">
                        Kỳ {period.period_key}
                      </p>
                      {period.parent_period_id && (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                          Bổ sung
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {period.starts_on} → {period.ends_on} •{' '}
                      {period.method === 'direct_04' ? '04/GTGT (Trực tiếp)' : '01/GTGT (Khấu trừ)'}
                    </p>
                  </div>
                  <StatusPill
                    ok={period.status === 'filed'}
                    warning={period.reconciliation_issue_count > 0}
                  >
                    {period.status === 'filed'
                      ? 'Đã nộp thuế'
                      : period.status === 'locked'
                      ? 'Đã khóa kỳ'
                      : period.status === 'in_review'
                      ? 'Đang duyệt'
                      : 'Bản nháp'}
                    {period.reconciliation_issue_count > 0
                      ? ` • ${period.reconciliation_issue_count} cảnh báo`
                      : ''}
                  </StatusPill>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Metric label="VAT đầu ra" value={money(period.output_vat_amount)} />
                  <Metric label="VAT khấu trừ" value={money(period.deductible_input_vat_amount)} />
                  <Metric label="Thuế phải nộp" value={money(period.tax_payable_amount)} />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/20">
                  {['draft', 'in_review'].includes(period.status) ? (
                    <button
                      type="button"
                      className={secondaryButton}
                      disabled={busy}
                      onClick={() => void periodAction(period, 'rebuild')}
                    >
                      Đối soát lại
                    </button>
                  ) : null}
                  {period.status === 'draft' ? (
                    <button
                      type="button"
                      className={primaryButton}
                      disabled={busy}
                      onClick={() => void periodAction(period, 'submit-review')}
                    >
                      Gửi duyệt
                    </button>
                  ) : null}
                  {period.status === 'in_review' && isMaster ? (
                    <button
                      type="button"
                      className={primaryButton}
                      disabled={busy}
                      onClick={() => void periodAction(period, 'lock')}
                    >
                      Khóa kỳ
                    </button>
                  ) : null}
                  {period.status === 'locked' && isMaster ? (
                    <button
                      type="button"
                      className={primaryButton}
                      disabled={busy}
                      onClick={() => void periodAction(period, 'filed')}
                    >
                      Đánh dấu đã nộp
                    </button>
                  ) : null}
                  {['locked', 'filed', 'amended'].includes(period.status) ? (
                    <>
                      <button
                        type="button"
                        className={secondaryButton}
                        disabled={busy}
                        onClick={() => void exportPeriod(period, 'xlsx')}
                        title="Xuất bảng kê Excel"
                      >
                        <img src={EXCEL_ICON_URL} alt="Excel" className="h-4 w-4 object-contain" />
                        <span>Xuất Excel</span>
                      </button>
                      <button
                        type="button"
                        className={secondaryButton}
                        disabled={busy}
                        onClick={() => void exportPeriod(period, 'pdf')}
                      >
                        <PrinterIcon className="h-4 w-4" />
                        <span>In PDF</span>
                      </button>
                      <button
                        type="button"
                        className={secondaryButton}
                        disabled={busy}
                        onClick={() => void exportPeriod(period, 'xml')}
                      >
                        <span>XML HTKK</span>
                      </button>
                      {isMaster ? (
                        <button
                          type="button"
                          className={secondaryButton}
                          disabled={busy}
                          onClick={() => void periodAction(period, 'amend')}
                        >
                          Lập tờ khai bổ sung
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <Empty>Chưa có kỳ kê khai nào được tạo.</Empty>
          )}
        </div>
      </Panel>
    </div>
  );

  const renderAdjustments = () => (
    <Panel
      badge="BỔ SUNG & ĐIỀU CHỈNH"
      title="Điều chỉnh số liệu kỳ thuế"
      description="Chỉ cho phép thêm điều chỉnh vào các kỳ chưa khóa. Master Admin có thẩm quyền duyệt áp dụng ngay vào sổ đối soát."
    >
      <AdjustmentForm
        periods={data.periods.filter((period) => ['draft', 'in_review'].includes(period.status))}
        isMaster={isMaster}
        busy={busy}
        onSave={(payload) => execute(() => api.saveVatAdjustment(payload as any), 'Đã lưu điều chỉnh.')}
      />
      <div className="mt-5 space-y-2">
        {adjustments.length ? (
          adjustments.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/60 dark:border-white/10 bg-background/40 backdrop-blur-xl p-3.5 text-xs sm:text-sm shadow-2xs"
            >
              <div>
                <span className="font-bold text-foreground">{item.adjustment_type}</span>
                <span className="text-muted-foreground mx-1.5">•</span>
                <span className="text-muted-foreground">{item.reason}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">{money(item.amount)}</span>
                <StatusPill ok={item.status === 'approved'}>{item.status}</StatusPill>
              </div>
            </div>
          ))
        ) : (
          <Empty>Chưa có khoản điều chỉnh nào.</Empty>
        )}
      </div>
    </Panel>
  );

  const renderRules = () => (
    <div className="space-y-4">
      <Panel
        badge="DANH MỤC THUẾ SUẤT"
        title="Bảng thuế suất GTGT chuẩn"
        description="Thuế suất 8% chỉ áp dụng cho nhóm hàng hóa/dịch vụ đủ điều kiện theo nghị định trong thời gian hiệu lực; không tự động hạ đồng loạt hàng 10%."
      >
        <div className="overflow-x-auto rounded-xl border border-white/60 dark:border-white/10 bg-background/30 backdrop-blur-xl">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-border/50 bg-background/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Mã</th>
                <th className="p-3">Tên nhóm</th>
                <th className="p-3">Thuế suất</th>
                <th className="p-3">Thời gian hiệu lực</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3">Căn cứ pháp lý</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {data.categories.map((category) => (
                <tr key={category.id} className="transition-colors hover:bg-muted/30">
                  <td className="p-3 font-mono font-bold text-foreground">{category.code}</td>
                  <td className="p-3 font-semibold">{category.name}</td>
                  <td className="p-3 font-bold text-primary">{category.rate_bps / 100}%</td>
                  <td className="p-3 whitespace-nowrap text-muted-foreground">
                    {category.effective_from || '—'} → {category.effective_to || '—'}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <StatusPill ok={Boolean(category.approved_at)}>
                      {category.approved_at ? 'Đã duyệt' : 'Chờ duyệt'}
                    </StatusPill>
                  </td>
                  <td className="max-w-xs p-3 text-xs text-muted-foreground leading-relaxed">
                    {category.legal_basis}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <ClassificationPanel data={data} isMaster={isMaster} busy={busy} onDone={() => load(true)} />
      <DirectRatePanel data={data} isMaster={isMaster} busy={busy} onDone={() => load(true)} />
    </div>
  );

  const renderEntity = () => (
    <EntityPanel
      data={data}
      isMaster={isMaster}
      busy={busy}
      onSave={(payload) => execute(() => api.saveVatTaxEntity(payload), 'Đã lưu hồ sơ pháp nhân.')}
    />
  );

  const renderMigration = () => (
    <Panel
      badge="D1 CUTOVER GATE"
      title="Đối chiếu chuyển dứt điểm sang Cloudflare D1"
      description={`Cutover dứt điểm chỉ đạt khi hoàn thành đủ 46 bảng + 3 view thay thế, zero conflict và bảo vệ nguyên vẹn tối thiểu ${data.migration.protectedD1MinimumOrders} đơn D1.`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Metric
          label="Bảng nguồn"
          value={`${data.migration.sourceTables.verified}/${data.migration.sourceTables.expected}`}
          alert={data.migration.sourceTables.verified !== data.migration.sourceTables.expected}
        />
        <Metric
          label="View thay thế"
          value={`${data.migration.sourceViews.verified}/${data.migration.sourceViews.expected}`}
          alert={data.migration.sourceViews.verified !== data.migration.sourceViews.expected}
        />
        <Metric
          label="Đơn hàng D1"
          value={String(data.migration.d1Orders)}
          hint={`Bảo vệ tối thiểu: ${data.migration.protectedD1MinimumOrders}`}
          alert={data.migration.d1Orders < data.migration.protectedD1MinimumOrders}
        />
        <Metric
          label="Conflict mở"
          value={String(data.migration.rows.conflicts + data.migration.openIssues)}
          alert={data.migration.rows.conflicts + data.migration.openIssues > 0}
        />
      </div>

      <div
        className={`mt-4 flex items-center gap-3 rounded-2xl border p-4 backdrop-blur-xl ${
          data.migration.cutoverReady
            ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-950 dark:text-emerald-200'
            : 'border-amber-500/30 bg-amber-500/15 text-amber-950 dark:text-amber-200'
        }`}
      >
        {data.migration.cutoverReady ? (
          <CheckCircleIcon className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <XCircleIcon className="h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" />
        )}
        <div className="text-xs sm:text-sm">
          <strong>
            {data.migration.cutoverReady
              ? 'Đạt tiêu chuẩn Cutover Gate'
              : 'Chưa đạt Cutover Gate'}
          </strong>
          <p className="mt-0.5 opacity-90">
            {data.migration.cutoverReady
              ? 'Toàn bộ 46 bảng và 3 view đã được đồng bộ chuẩn hóa. Hệ thống sẵn sàng ngắt hoàn toàn nguồn cũ.'
              : 'Runtime tiếp tục giữ cơ chế fail-closed và không được thu hồi rollback source cho đến khi resolve xong issues.'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {data.migration.additionalTables.map((item) => (
          <div
            key={item.table}
            className="rounded-xl border border-white/60 dark:border-white/10 bg-background/40 backdrop-blur-xl p-3 text-xs sm:text-sm shadow-2xs"
          >
            <p className="font-mono text-xs text-muted-foreground">{item.table}</p>
            <p className="mt-1 font-black text-foreground">{item.count.toLocaleString('vi-VN')} dòng</p>
          </div>
        ))}
      </div>
    </Panel>
  );

  return (
    <div className="space-y-4 -mx-3 sm:mx-0 p-3 sm:p-0">
      {/* Top Glass Toolbar Card (Apple Glass Standard) */}
      <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 sm:p-4 mx-1 sm:mx-0">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Preset Pills Row */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const count = tabCounts[tab.key];
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'border border-border/60 bg-background/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span>{tab.label}</span>
                  {count !== null && count !== undefined && count > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                        isActive
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={busy || loading}
              className={iconButton}
              title="Làm mới dữ liệu VAT"
            >
              {loading ? (
                <LoadingIcon className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <img
                  src={VAT_ICON_URL}
                  alt="Làm mới"
                  className="h-4 w-4 object-contain"
                />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'overview'
        ? renderOverview()
        : activeTab === 'sales'
        ? renderInvoices('sales')
        : activeTab === 'purchases'
        ? renderInvoices('purchase')
        : activeTab === 'periods'
        ? renderPeriods()
        : activeTab === 'adjustments'
        ? renderAdjustments()
        : activeTab === 'rules'
        ? renderRules()
        : activeTab === 'entity'
        ? renderEntity()
        : renderMigration()}
    </div>
  );
};

const AdjustmentForm: React.FC<{
  periods: VatPeriod[];
  isMaster: boolean;
  busy: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}> = ({ periods, isMaster, busy, onSave }) => {
  const [periodId, setPeriodId] = useState('');
  const [type, setType] = useState('output_increase');
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!periodId && periods[0]) setPeriodId(periods[0].id);
  }, [periodId, periods]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
          Kỳ kê khai
        </label>
        <select className={fieldClass} value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
          {periods.map((period) => (
            <option key={period.id} value={period.id}>
              Kỳ {period.period_key}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
          Loại điều chỉnh
        </label>
        <select className={fieldClass} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="output_increase">Tăng đầu ra</option>
          <option value="output_decrease">Giảm đầu ra</option>
          <option value="input_increase">Tăng đầu vào</option>
          <option value="input_decrease">Giảm đầu vào</option>
          <option value="credit_carry">Chuyển khấu trừ</option>
          <option value="other">Khác</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
          Số tiền (VND)
        </label>
        <input
          className={fieldClass}
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
          Lý do giải trình *
        </label>
        <input
          className={fieldClass}
          placeholder="Lý do bắt buộc..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
        <button
          type="button"
          className={primaryButton}
          disabled={busy || !periodId || !reason}
          onClick={() =>
            void onSave({
              period_id: periodId,
              adjustment_type: type,
              amount,
              reason,
              approve: isMaster,
            })
          }
        >
          Lưu khoản điều chỉnh
        </button>
      </div>
    </div>
  );
};

const EntityPanel: React.FC<{
  data: api.VatBootstrapResponse;
  isMaster: boolean;
  busy: boolean;
  onSave: (payload: Partial<api.VatTaxEntity>) => Promise<void>;
}> = ({ data, isMaster, busy, onSave }) => {
  const [form, setForm] = useState<api.VatTaxEntity>(data.entity);
  useEffect(() => setForm(data.entity), [data.entity]);
  const set = (key: keyof api.VatTaxEntity, value: any) => setForm({ ...form, [key]: value });

  return (
    <Panel
      badge="HỒ SƠ DOANH NGHIỆP"
      title="Hồ sơ pháp nhân thuế"
      description="Chỉ Master Admin mới có quyền sửa đổi và bật mốc go-live. Khi kích hoạt, tất cả phân loại hàng hóa liên quan phải được duyệt."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
            Tên pháp nhân
          </label>
          <input
            className={fieldClass}
            disabled={!isMaster}
            value={form.legal_name}
            onChange={(e) => set('legal_name', e.target.value)}
            placeholder="Tên doanh nghiệp..."
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
            Mã số thuế (MST)
          </label>
          <input
            className={fieldClass}
            disabled={!isMaster}
            value={form.tax_code || ''}
            onChange={(e) => set('tax_code', e.target.value)}
            placeholder="Mã số thuế..."
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
            Địa chỉ trụ sở
          </label>
          <input
            className={fieldClass}
            disabled={!isMaster}
            value={form.address || ''}
            onChange={(e) => set('address', e.target.value)}
            placeholder="Địa chỉ đăng ký kinh doanh..."
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
            Cơ quan thuế quản lý
          </label>
          <input
            className={fieldClass}
            disabled={!isMaster}
            value={form.tax_authority || ''}
            onChange={(e) => set('tax_authority', e.target.value)}
            placeholder="Cục thuế / Chi cục thuế..."
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
            Phương pháp tính thuế mặc định
          </label>
          <select
            className={fieldClass}
            disabled={!isMaster}
            value={form.default_method}
            onChange={(e) => set('default_method', e.target.value)}
          >
            <option value="deduction_01">01/GTGT • Phương pháp khấu trừ</option>
            <option value="direct_04">04/GTGT • Trực tiếp trên doanh thu</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
            Chu kỳ kê khai
          </label>
          <select
            className={fieldClass}
            disabled={!isMaster}
            value={form.filing_cycle}
            onChange={(e) => set('filing_cycle', e.target.value)}
          >
            <option value="monthly">Theo từng tháng</option>
            <option value="quarterly">Theo từng quý</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
            Ngày bắt đầu tính thuế (Go-live)
          </label>
          <input
            className={fieldClass}
            disabled={!isMaster}
            type="date"
            value={form.go_live_date || ''}
            onChange={(e) => set('go_live_date', e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
            Phiên bản HTKK tương thích
          </label>
          <input
            className={fieldClass}
            disabled={!isMaster}
            value={form.htkk_version}
            onChange={(e) => set('htkk_version', e.target.value)}
            placeholder="Phiên bản HTKK hoặc pending_sample..."
          />
        </div>
      </div>

      {isMaster ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/60 dark:border-white/10 bg-background/40 backdrop-blur-xl p-4 shadow-2xs">
          <label className="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(form.is_active)}
              onChange={(e) => set('is_active', e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span>Kích hoạt tự động ghi nhận sổ VAT từ ngày go-live</span>
          </label>
          <button
            type="button"
            className={primaryButton}
            disabled={busy}
            onClick={() => void onSave(form)}
          >
            Lưu hồ sơ pháp nhân
          </button>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          Tài khoản kế toán chỉ được xem cấu hình; Master Admin mới có quyền cập nhật.
        </p>
      )}
    </Panel>
  );
};

const ClassificationPanel: React.FC<{
  data: api.VatBootstrapResponse;
  isMaster: boolean;
  busy: boolean;
  onDone: () => Promise<void>;
}> = ({ data, isMaster, busy, onDone }) => {
  const { addToast } = useToast();
  const [code, setCode] = useState('VAT_10');

  const approve = async (type: 'products' | 'services') => {
    const ids = data.pendingClassifications[type].map((item) => item.id);
    if (!ids.length) return;
    try {
      await api.approveVatClassifications({
        resource_type: type,
        ids,
        vat_category_code: code,
      });
      addToast(`Đã duyệt phân loại ${ids.length} ${type}.`, { type: 'success' });
      await onDone();
    } catch (error: any) {
      addToast(error?.message || 'Không thể duyệt phân loại.', { type: 'error' });
    }
  };

  return (
    <Panel
      badge="PHÂN LOẠI THUẾ HÀNG HÓA"
      title="Duyệt phân loại sản phẩm & dịch vụ"
      description="Chỉ áp dụng hàng loạt khi sản phẩm thuộc cùng nhóm thuế suất; các mặt hàng đặc thù cần được phân loại riêng."
    >
      <div className="flex flex-wrap items-center gap-3">
        <select
          className={`${fieldClass} max-w-xs`}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        >
          {data.categories
            .filter((category) => category.is_active)
            .map((category) => (
              <option key={category.id} value={category.code}>
                {category.name} ({category.rate_bps / 100}%)
              </option>
            ))}
        </select>
        <button
          type="button"
          className={secondaryButton}
          disabled={!isMaster || busy || !data.pendingClassifications.products.length}
          onClick={() => void approve('products')}
        >
          Duyệt {data.pendingClassifications.products.length} sản phẩm
        </button>
        <button
          type="button"
          className={secondaryButton}
          disabled={!isMaster || busy || !data.pendingClassifications.services.length}
          onClick={() => void approve('services')}
        >
          Duyệt {data.pendingClassifications.services.length} dịch vụ
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-white/60 dark:border-white/10 bg-background/40 backdrop-blur-xl p-3.5 shadow-2xs">
          <p className="text-xs font-bold text-foreground">
            Sản phẩm chờ duyệt ({data.pendingClassifications.products.length})
          </p>
          <ul className="mt-2 max-h-44 space-y-1 overflow-auto text-xs text-muted-foreground">
            {data.pendingClassifications.products.slice(0, 30).map((item) => (
              <li key={item.id} className="py-0.5">
                #{item.id} <strong className="text-foreground">{item.name}</strong> • gợi ý:{' '}
                {item.vat_category_code || 'chưa có'}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-white/60 dark:border-white/10 bg-background/40 backdrop-blur-xl p-3.5 shadow-2xs">
          <p className="text-xs font-bold text-foreground">
            Dịch vụ chờ duyệt ({data.pendingClassifications.services.length})
          </p>
          <ul className="mt-2 max-h-44 space-y-1 overflow-auto text-xs text-muted-foreground">
            {data.pendingClassifications.services.slice(0, 30).map((item) => (
              <li key={item.id} className="py-0.5">
                #{item.id} <strong className="text-foreground">{item.name}</strong> • gợi ý:{' '}
                {item.vat_category_code || 'chưa có'}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
};

const DirectRatePanel: React.FC<{
  data: api.VatBootstrapResponse;
  isMaster: boolean;
  busy: boolean;
  onDone: () => Promise<void>;
}> = ({ data, isMaster, busy, onDone }) => {
  const { addToast } = useToast();
  const [rates, setRates] = useState<Record<string, number>>(() =>
    Object.fromEntries(data.directRates.map((row) => [row.revenue_category, row.rate_bps]))
  );

  const approve = async () => {
    try {
      await api.approveVatDirectRates(rates);
      addToast('Đã duyệt tỷ lệ 04/GTGT.', { type: 'success' });
      await onDone();
    } catch (error: any) {
      addToast(error?.message || 'Không thể duyệt tỷ lệ.', { type: 'error' });
    }
  };

  return (
    <Panel
      badge="PHƯƠNG PHÁP 04/GTGT"
      title="Tỷ lệ trực tiếp trên doanh thu"
      description="Mặc định luật định: Hàng hóa 1%, Dịch vụ 5%, Sản xuất/vận tải/dịch vụ gắn hàng hóa 3%, Hoạt động khác 2%; Master Admin xác nhận trước khi chốt."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {data.directRates.map((row) => (
          <label
            key={row.id}
            className="block rounded-xl border border-white/60 dark:border-white/10 bg-background/40 backdrop-blur-xl p-3.5 text-xs font-bold shadow-2xs"
          >
            <span className="text-foreground">{row.revenue_category}</span>
            <input
              className={`${fieldClass} mt-2`}
              type="number"
              min="0"
              max="10000"
              value={rates[row.revenue_category] ?? row.rate_bps}
              onChange={(e) =>
                setRates({ ...rates, [row.revenue_category]: Number(e.target.value) })
              }
            />
            <span className="mt-1.5 block text-[11px] text-muted-foreground">
              {(rates[row.revenue_category] ?? row.rate_bps) / 100}% (
              {rates[row.revenue_category] ?? row.rate_bps} bps) •{' '}
              {row.approved_at ? 'Đã duyệt' : 'Chờ duyệt'}
            </span>
          </label>
        ))}
      </div>
      {isMaster ? (
        <div className="mt-4 flex justify-end">
          <button type="button" className={primaryButton} disabled={busy} onClick={() => void approve()}>
            Xác nhận tỷ lệ doanh thu
          </button>
        </div>
      ) : null}
    </Panel>
  );
};

export default AdminVatManagementPage;
