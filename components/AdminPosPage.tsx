import React, { useEffect, useState } from 'react';
import type { ApprovalRequest, CareTask, CashShift, InventoryMovement, PosCartBody, PosOrderDraft, ProductOrder } from '../types';
import { clearPosCache, posGet } from '../services/pos';
import { useResource, useMutation } from '../services/posHooks';
import { printProductOrder } from '../src/orderReceipt';
import { useAdminLayoutDispatch } from './AdminLayoutContext';
import { ShoppingBagIcon } from './icons';
import PosControls, { PosAssignment } from './PosControls';
import PosInventoryDocuments from './PosInventoryDocuments';
import PosReports from './PosReports';
import PosOpeningReceivables from './PosOpeningReceivables';
import PosShiftOperations from './PosShiftOperations';
import './admin-pos.css';

type Session = { user_id: string; manager: boolean; roles: string[]; capabilities: { sell: boolean; care: boolean; warehouse: boolean; manage: boolean }; settings: { deployment_enabled: boolean; transactions_enabled: number; opening_approved_at?: string; opening_reference?: string } };
type CatalogItem = { id: number; name: string; sku: string; barcode?: string; price: number; vat_rate: number; stock_quantity: number; pos_reserved_quantity: number };
type Customer = { id: string; name: string; phone?: string; email?: string; version: number; assigned_to?: string };
type Page<T> = { items: T[]; has_more?: boolean };
type Quote = { pricing_fingerprint: string; quote: { subtotal: number; discount_amount: number; tax_amount: number; shipping_tax_amount: number; shipping_fee: number; grand_total: number; tax_mode: string } };
type Section = 'sell' | 'orders' | 'customers' | 'shifts' | 'inventory' | 'care' | 'approvals' | 'reports' | 'settings' | 'opening';
const money = (value?: number) => `${new Intl.NumberFormat('vi-VN').format(value || 0)}đ`;
const dateTime = (value?: string) => value ? new Date(value).toLocaleString('vi-VN') : '—';
const stageLabel: Record<string, string> = { confirmed: 'Đã xác nhận', packed: 'Đã đóng gói', issued: 'Đã xuất hàng', cancelled: 'Đã hủy' };
const methodLabel: Record<string, string> = { cash: 'Tiền mặt', bank_transfer: 'Chuyển khoản', cod: 'COD' };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="pos-field"><span>{label}</span>{React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<{ 'aria-label'?: string }>, { 'aria-label': label }) : children}</label>;
}
function Notice({ children, className = '' }: { children?: React.ReactNode; className?: string }) { return children ? <div className={`pos-notice ${className}`.trim()} role="alert">{children}</div> : null; }
function Empty({ children }: { children: React.ReactNode }) { return <p className="pos-empty">{children}</p>; }
function Pager({ offset, setOffset, more }: { offset: number; setOffset: (n: number) => void; more: boolean }) {
  return <div className="pos-pager"><button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 30))}>Trang trước</button><span>Trang {offset / 30 + 1}</span><button disabled={!more} onClick={() => setOffset(offset + 30)}>Trang sau</button></div>;
}

const emptyCart = (): PosCartBody => ({ items: [], delivery_method: 'pickup', paymentMethod: 'cash', customerName: '', customerPhone: '', customerEmail: '' });
function Sell({ session, active, openOrder }: { session: Session; active: boolean; openOrder: (id: string) => void }) {
  const [search, setSearch] = useState(''); const [debounced, setDebounced] = useState(''); const [offset, setOffset] = useState(0);
  const catalog = useResource<Page<CatalogItem>>(active ? `catalog?q=${encodeURIComponent(debounced)}&offset=${offset}` : null);
  const drafts = useResource<Page<PosOrderDraft>>(active ? 'drafts' : null);
  const shifts = useResource<Page<CashShift>>(active ? 'shifts?state=open' : null);
  const [cart, setCart] = useState<PosCartBody>(emptyCart);
  const [draft, setDraft] = useState<{ id: string; version: number }>();
  const [label, setLabel] = useState('Giỏ mới'); const [dirty, setDirty] = useState(false);
  const [quote, setQuote] = useState<Quote>(); const [approval, setApproval] = useState('');
  const [cash, setCash] = useState(''); const [tendered, setTendered] = useState(''); const [shiftId, setShiftId] = useState('');
  const [customerSearch, setCustomerSearch] = useState(''); const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const mutation = useMutation();
  useEffect(() => { const timer = setTimeout(() => { setDebounced(search); setOffset(0); }, 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  function change(next: PosCartBody) { setCart(next); setDirty(true); setQuote(undefined); setApproval(''); }
  function add(item: CatalogItem) {
    const existing = cart.items.find((row) => row.productId === item.id);
    change({ ...cart, items: existing ? cart.items.map((row) => row.productId === item.id ? { ...row, quantity: row.quantity + 1 } : row)
      : [...cart.items, { productId: item.id, name: item.name, price: item.price, quantity: 1 }] });
  }
  async function scan(event: React.FormEvent) {
    event.preventDefault();
    try {
      const data = await posGet<Page<CatalogItem>>(`catalog?exact=1&q=${encodeURIComponent(search.trim())}`, true);
      if (data.items.length > 1) { mutation.setError('Mã khớp nhiều sản phẩm. Chọn đúng hàng bên dưới.'); return; }
      const match = data.items.find((p) => p.barcode === search || p.sku === search);
      if (!match) { mutation.setError('Không tìm thấy mã chính xác. Chọn sản phẩm bên dưới.'); return; }
      add(match); setSearch('');
    } catch (e) { mutation.setError((e as Error).message); }
  }
  async function saveAndQuote() {
    const saved = await mutation.run<{ id: string; version: number }>(draft ? `drafts/${draft.id}` : 'drafts', { label, body: cart, ...(draft ? { version: draft.version } : {}) });
    if (!saved) return;
    setDraft(saved); setDirty(false); drafts.refresh();
    if (cart.items.length) {
      const quoted = await mutation.run<Quote>(`drafts/${saved.id}/quote`, { version: saved.version });
      if (quoted) setQuote(quoted);
    }
  }
  async function confirm() {
    if (!draft || !quote || dirty) return;
    const result = await mutation.run<{ order_id: string }>(`drafts/${draft.id}/confirm`, {
      version: draft.version, pricing_fingerprint: quote.pricing_fingerprint, ...(approval ? { approval_id: approval } : {}),
      payments: Number(cash) > 0 ? [{ method: 'cash', amount: Number(cash), tendered_amount: Number(tendered || cash), shift_id: shiftId }] : [],
    });
    if (!result) return;
    setCart(emptyCart()); setDraft(undefined); setQuote(undefined); setCash(''); setTendered(''); setApproval(''); setDirty(false);
    clearPosCache('catalog'); clearPosCache('orders'); drafts.refresh(); shifts.refresh(); openOrder(result.order_id);
  }
  function switchDraft(next?: PosOrderDraft) {
    if (dirty && !window.confirm('Giỏ đang có thay đổi chưa lưu. Bỏ thay đổi để chuyển giỏ?')) return;
    setCart(next?.body || emptyCart()); setDraft(next ? { id: next.id, version: next.version } : undefined); setLabel(next?.label || 'Giỏ mới');
    setDirty(false); setQuote(undefined); setApproval(''); setCash(''); setTendered('');
  }
  const canConfirm = session.settings.deployment_enabled && session.settings.transactions_enabled && quote && !dirty;
  return <div hidden={!active}>
    <Notice>{mutation.error || catalog.error || drafts.error}</Notice>
    <fieldset disabled={mutation.busy} className="pos-fieldset">
      <div className="pos-drafts"><button onClick={() => switchDraft()}>＋ Giỏ mới</button>{drafts.data?.items.map((d) => <button key={d.id} className={draft?.id === d.id ? 'selected' : ''} onClick={() => switchDraft(d)}>{d.label}</button>)}</div>
      <div className="pos-sale-grid">
        <section className="pos-panel">
          <form onSubmit={scan} className="pos-search">
            <div className="relative flex-1">
              <input
                aria-label="Tìm hoặc quét sản phẩm"
                placeholder="Quét mã vạch · tên sản phẩm · SKU"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
                className="w-full h-9 rounded-xl border border-border/70 bg-background/30 backdrop-blur-xl pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground/70 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
              />
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Xóa tìm kiếm"
                  className="absolute right-2 top-2 p-0.5 rounded-full text-muted-foreground hover:text-foreground !min-h-0 !border-0 !bg-transparent"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button type="submit" className="pos-primary h-9 px-3.5 rounded-xl text-xs font-bold whitespace-nowrap">Thêm mã</button>
          </form>
          <p className="pos-muted">Máy quét USB/Bluetooth: đặt con trỏ tại ô tìm kiếm, quét và Enter. Tồn hiển thị là tồn khả dụng.</p>
          {catalog.loading && <p role="status">Đang tìm sản phẩm…</p>}
          <div className="pos-products">{catalog.data?.items.map((p) => <button key={p.id} disabled={p.stock_quantity < 1} onClick={() => add(p)} className="pos-product">
            <span className="pos-sku">{p.sku || `#${p.id}`}</span><strong>{p.name}</strong><span>{money(p.price)}</span><small>Còn {p.stock_quantity} · Giữ {p.pos_reserved_quantity}</small>
          </button>)}</div>
          {catalog.data && !catalog.data.items.length && <Empty>Không tìm thấy sản phẩm.</Empty>}
          <Pager offset={offset} setOffset={setOffset} more={Boolean(catalog.data?.has_more)} />
        </section>
        <section className="pos-panel pos-cart">
          <div className="pos-section-heading"><h2>Đơn bán tại quầy</h2><span className="pos-badge">{dirty ? 'Chưa lưu' : draft ? `Nháp v${draft.version}` : 'Giỏ mới'}</span></div>
          <Field label="Tên giỏ"><input value={label} onChange={(e) => { setLabel(e.target.value); setDirty(true); }} /></Field>
          {!cart.items.length && <Empty>Chọn sản phẩm để bắt đầu. Giỏ nháp chưa giữ hàng.</Empty>}
          <div className="pos-cart-lines">{cart.items.map((item) => <div key={item.productId} className="pos-cart-line"><div><strong>{item.name || `#${item.productId}`}</strong><small>{money(item.unit_price ?? item.price)}</small></div>
            <input type="number" min="1" max="99" aria-label={`Số lượng ${item.name}`} value={item.quantity} onChange={(e) => change({ ...cart, items: cart.items.map((row) => row.productId === item.productId ? { ...row, quantity: Number(e.target.value) } : row) })} />
            <button aria-label={`Bỏ ${item.name}`} onClick={() => change({ ...cart, items: cart.items.filter((row) => row.productId !== item.productId) })}>×</button>
          </div>)}</div>
          <div className="pos-segment" role="group" aria-label="Cách nhận hàng"><button className={cart.delivery_method === 'pickup' ? 'selected' : ''} onClick={() => change({ ...cart, delivery_method: 'pickup', paymentMethod: 'cash' })}>Tại quầy · 0đ</button><button className={cart.delivery_method === 'delivery' ? 'selected' : ''} onClick={() => change({ ...cart, delivery_method: 'delivery', paymentMethod: 'cod' })}>Giao hàng · 30.000đ</button></div>
          <div className="pos-inline"><input aria-label="Tìm khách theo SĐT" placeholder="Tìm khách theo SĐT" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} /><button onClick={async () => { try { setCustomerResults((await posGet<Page<Customer>>(`customers?q=${encodeURIComponent(customerSearch)}`, true)).items); } catch (e) { mutation.setError((e as Error).message); } }}>Tìm khách</button></div>
          {customerResults.map((c) => <button key={c.id} className="pos-customer-choice" onClick={() => { change({ ...cart, customer_id: c.id, customerName: c.name, customerPhone: c.phone, customerEmail: c.email }); setCustomerResults([]); }}>{c.name} · {c.phone}</button>)}
          {cart.customer_id && <button className="pos-link" onClick={() => change({ ...cart, customer_id: undefined })}>Bỏ liên kết khách đã chọn</button>}
          <div className="pos-fields"><Field label="Khách hàng"><input disabled={Boolean(cart.customer_id)} placeholder="Khách lẻ" value={cart.customerName || ''} onChange={(e) => change({ ...cart, customerName: e.target.value })} /></Field><Field label="Số điện thoại"><input disabled={Boolean(cart.customer_id)} value={cart.customerPhone || ''} onChange={(e) => change({ ...cart, customerPhone: e.target.value })} inputMode="tel" /></Field><Field label="Email nhận đơn"><input disabled={Boolean(cart.customer_id)} type="email" value={cart.customerEmail || ''} onChange={(e) => change({ ...cart, customerEmail: e.target.value })} /></Field></div>
          {cart.delivery_method === 'delivery' && <div className="pos-fields"><Field label="Số nhà, đường"><input value={cart.shippingStreet || ''} onChange={(e) => change({ ...cart, shippingStreet: e.target.value })} /></Field><Field label="Phường/xã"><input value={cart.shippingWard || ''} onChange={(e) => change({ ...cart, shippingWard: e.target.value })} /></Field><Field label="Tỉnh/thành"><input value={cart.shippingProvince || ''} onChange={(e) => change({ ...cart, shippingProvince: e.target.value })} /></Field></div>}
          <details><summary>Sửa giá / giảm giá / công nợ — cần quản lý duyệt</summary><div className="pos-fields">
            {cart.items.map((item) => <Field key={item.productId} label={`Đơn giá ${item.name || item.productId}`}><input type="number" min="0" value={item.unit_price ?? item.price ?? ''} onChange={(e) => change({ ...cart, items: cart.items.map((row) => row.productId === item.productId ? { ...row, unit_price: Number(e.target.value) } : row) })} /></Field>)}
            <Field label="Giảm giá (đ)"><input type="number" min="0" value={cart.discountAmount || ''} onChange={(e) => change({ ...cart, discountAmount: Number(e.target.value) })} /></Field><Field label="Hạn trả nợ"><input type="date" value={cart.credit_due_at || ''} onChange={(e) => change({ ...cart, credit_due_at: e.target.value || undefined })} /></Field></div></details>
          <button className="pos-secondary" onClick={saveAndQuote}>{mutation.busy ? 'Đang lưu…' : 'Lưu nháp & tính tổng trên máy chủ'}</button>
          {quote && !dirty && <><div className="pos-totals"><span>Tạm tính <b>{money(quote.quote.subtotal)}</b></span><span>Giảm giá <b>−{money(quote.quote.discount_amount)}</b></span><span>VAT {quote.quote.tax_mode === 'inclusive' ? '(đã trong giá)' : ''}<b>{money(quote.quote.tax_amount + quote.quote.shipping_tax_amount)}</b></span><span>Vận chuyển <b>{money(quote.quote.shipping_fee)}</b></span><span className="pos-grand">Tổng thanh toán <b>{money(quote.quote.grand_total)}</b></span></div>
            {(cart.discountAmount > 0 || cart.credit_due_at || cart.items.some((i) => i.unit_price != null && i.unit_price !== i.price)) && <><button onClick={async () => { const approvalResult = await mutation.run<{ id: string }>('approvals', { kind: 'sale_override', target_id: draft.id, target_version: draft.version, reason: 'Duyệt giá/giảm giá/công nợ của giỏ POS', content: { draft_id: draft.id, version: draft.version, pricing_fingerprint: quote.pricing_fingerprint, credit_due_at: cart.credit_due_at || null } }); if (approvalResult) setApproval(approvalResult.id); }}>Gửi quản lý duyệt</button><Field label="Mã phiếu duyệt"><input value={approval} onChange={(e) => setApproval(e.target.value)} /></Field></>}
            <Field label="Phương thức dự kiến"><select value={cart.paymentMethod} onChange={(e) => change({ ...cart, paymentMethod: e.target.value as PosCartBody['paymentMethod'] })}><option value="cash">Tiền mặt</option><option value="bank_transfer">SePay (QR sau xác nhận)</option>{cart.delivery_method === 'delivery' && <option value="cod">COD</option>}</select></Field>
            <div className="pos-fields"><Field label="Thu tiền mặt ngay (đ)"><input type="number" min="0" value={cash} onChange={(e) => setCash(e.target.value)} placeholder="0 — thu sau / đặt cọc" /></Field><Field label="Tiền khách đưa (đ)"><input type="number" min="0" value={tendered} onChange={(e) => setTendered(e.target.value)} /></Field></div>
            {Number(cash) > 0 && <><Field label="Ca thu ngân"><select value={shiftId} onChange={(e) => setShiftId(e.target.value)}><option value="">Chọn ca đang mở</option>{shifts.data?.items.filter((s) => s.status === 'open').map((s) => <option value={s.id} key={s.id}>{s.register_name}</option>)}</select></Field><p>Tiền thừa: <strong>{money(Math.max(0, Number(tendered || cash) - Number(cash)))}</strong></p></>}
            <button className="pos-primary" disabled={!canConfirm} onClick={confirm}>Xác nhận đơn & giữ hàng</button><p className="pos-muted">Chưa gọi hãng vận chuyển. Giao hàng phải qua bước đóng gói.</p>
          </>}
        </section>
      </div>
    </fieldset>
  </div>;
}

function OrderDetail({ id, session, onClose, onChanged }: { id: string; session: Session; onClose: () => void; onChanged: () => void }) {
  const resource = useResource<{ order: ProductOrder }>(`orders/${encodeURIComponent(id)}`);
  const shifts = useResource<Page<CashShift>>(session.capabilities.sell ? 'shifts?state=open' : null);
  const labels = useResource<Page<{ id: string; tracking_code: string; active: number }>>(`orders/${encodeURIComponent(id)}/labels`);
  const mutation = useMutation(); const order = resource.data?.order;
  const [amount, setAmount] = useState(''); const [tendered, setTendered] = useState(''); const [shiftId, setShiftId] = useState('');
  const [method, setMethod] = useState('cash'); const [reference, setReference] = useState(''); const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState('cash');
  const [pack, setPack] = useState({ weight_grams: 0, length_cm: 0, width_cm: 0, height_cm: 0 });
  const [qr, setQr] = useState<{ qr_url: string; amount: number; reference: string }>(); const [approvalId, setApprovalId] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  async function act(action: string, extra: Record<string, unknown> = {}) {
    const result = await mutation.run<{ payment?: { qr_url: string; amount: number; reference: string } }>(`orders/${id}/${action}`, { version: order.revision, ...extra });
    if (result) { resource.refresh(); clearPosCache('orders'); onChanged(); if (result.payment) setQr(result.payment); }
  }
  return <section className="pos-panel pos-order-detail"><div className="pos-section-heading"><h2>{order?.order_code || 'Chi tiết đơn'}</h2><button onClick={onClose}>Đóng</button></div>
    <Notice>{resource.error || mutation.error}</Notice>{!order ? <p>Đang tải đơn…</p> : <fieldset disabled={mutation.busy} className="pos-fieldset">
      <p><span className="pos-badge">{stageLabel[order.pos_stage]}</span> · {order.delivery_method === 'pickup' ? 'Nhận tại quầy' : 'Giao hàng'} · Phiên bản {order.revision}</p>
      <p>{order.customer_name} · {order.customer_phone || 'Khách lẻ không SĐT'}</p><p className="pos-muted">Đồng bộ Pancake: {order.pancake_sync?.sync_status || 'Đang chờ liên kết'}{order.pancake_sync?.pancake_entity_id ? ` · ID ${order.pancake_sync.pancake_entity_id}` : ''}</p>
      {order.issues?.some((issue) => issue.source === 'pancake_payment_contract') && <Notice>Đổi trả, hoàn tiền và COD hãng chuyển về được giữ đúng sổ D1. Phần đồng bộ này đang chờ xác minh contract Pancake; không chuyển chúng thành tiền mặt/chuyển khoản của khách.</Notice>}
      {session.manager && <PosAssignment path={`orders/${id}`} version={order.revision} current={order.assigned_to} onChanged={() => { resource.refresh(); onChanged(); }} />}
      <ul className="pos-item-list">{order.order_items?.map((item) => <li key={item.id}>{item.product_name}<strong>× {item.quantity}</strong></li>)}</ul>
      {order.payment_summary && <div className="pos-totals"><span>Tổng đơn <b>{money(order.payment_summary.total)}</b></span><span>Đã thu <b>{money(order.payment_summary.received)}</b></span><span>Đã hoàn <b>{money(order.payment_summary.refunded)}</b></span><span className="pos-grand">Còn phải thu <b>{money(order.payment_summary.remaining)}</b></span>{order.payment_summary.overpaid > 0 && <Notice>Thu thừa {money(order.payment_summary.overpaid)} — chờ đối soát, không tự hoàn.</Notice>}</div>}
      {order.issues?.length > 0 && <Notice>{order.issues.length} sai lệch Pancake cần đối soát: {order.issues.map((i) => JSON.parse(i.fields_json).join(', ')).join('; ')}</Notice>}
      {session.manager && order.issues?.length > 0 && <details><summary>Quản lý xử lý sai lệch</summary><p>Giữ nguyên số liệu website. Chỉ xác nhận sau khi đã kiểm tra và sửa sai lệch trên POS Pancake nếu cần.</p><Field label="Kết quả đối soát"><textarea value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} /></Field>{order.issues.map((issue) => <button key={issue.id} disabled={!resolutionNote.trim()} onClick={() => act('reconcile', { issue_id: issue.id, note: resolutionNote, keep_website_snapshot: true })}>Xác nhận đã xử lý: {JSON.parse(issue.fields_json).join(', ')}</button>)}</details>}
      <div className="pos-actions"><button onClick={resource.refresh}>Làm mới đơn</button>{session.capabilities.sell && <><button onClick={() => printProductOrder(order, 'receipt80')}>In 80mm</button><button onClick={() => printProductOrder(order, 'a4')}>In A4</button></>}</div>
      {session.capabilities.sell && order.pos_stage !== 'cancelled' && <details open><summary>Thu tiền / đặt cọc / công nợ</summary><div className="pos-fields">
        <Field label="Số tiền ghi nhận (đ)"><input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field><Field label="Phương thức"><select value={method} onChange={(e) => setMethod(e.target.value)}><option value="cash">Tiền mặt</option>{session.manager && <><option value="bank_transfer">Ngân hàng — quản lý đối soát</option><option value="cod">COD hãng đã chuyển về</option></>}</select></Field>
        {method === 'cash' ? <><Field label="Ca thu ngân"><select value={shiftId} onChange={(e) => setShiftId(e.target.value)}><option value="">Chọn ca</option>{shifts.data?.items.filter((s) => s.status === 'open').map((s) => <option key={s.id} value={s.id}>{s.register_name}</option>)}</select></Field><Field label="Khách đưa (đ)"><input type="number" value={tendered} onChange={(e) => setTendered(e.target.value)} /></Field></> : <Field label="Mã biên nhận thực tế"><input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>}
      </div><div className="pos-actions"><button className="pos-primary" onClick={() => act('payments', { method, amount: Number(amount), tendered_amount: Number(tendered || amount), shift_id: shiftId, provider_ref: reference })}>Ghi biên nhận thu tiền</button><button onClick={() => act('payment-session')}>Mở QR SePay số còn lại</button></div>
      {qr && <div className="pos-qr"><img src={qr.qr_url} alt="QR thanh toán SePay" /><p>{money(qr.amount)} · {qr.reference}</p><p className="pos-muted">Sau khi khách chuyển, bấm làm mới để xác nhận giao dịch. Không đánh dấu đã thu theo ảnh chụp.</p></div>}</details>}
      {order.delivery_method === 'delivery' && <details open><summary>Đóng gói & giao vận</summary><p>{[order.shipping_street, order.shipping_ward, order.shipping_province].filter(Boolean).join(', ')}</p>
        <p>Mã vận đơn: <strong>{order.shipping_code || 'Chưa có'}</strong> · Hành trình: {order.fulfillment_status || 'Chưa có'}</p>
        <div className="pos-actions">{labels.data?.items.map((label) => <a key={label.id} href={`/api/admin/pos/orders/${encodeURIComponent(id)}/labels/${encodeURIComponent(label.id)}`} target="_blank" rel="noopener noreferrer">Tải nhãn A5 · {label.tracking_code}{label.active ? '' : ' (lịch sử)'}</a>)}<button onClick={labels.refresh}>Kiểm tra nhãn</button></div>
        <p className="pos-muted">Tạo/hủy SPX tại Pancake bằng mã đơn trên. Website chưa có contract API tạo/hủy vận đơn; không tự gọi hãng.</p>
        {session.capabilities.warehouse && order.pos_stage === 'confirmed' && <><div className="pos-fields">{([['weight_grams', 'Cân nặng (g)'], ['length_cm', 'Dài (cm)'], ['width_cm', 'Rộng (cm)'], ['height_cm', 'Cao (cm)']] as const).map(([key, label]) => <Field key={key} label={label}><input type="number" min="1" value={pack[key] || ''} onChange={(e) => setPack({ ...pack, [key]: Number(e.target.value) })} /></Field>)}</div><button onClick={() => act('pack', pack)}>Xác nhận đã đóng gói</button></>}
      </details>}
      {['confirmed', 'packed'].includes(order.pos_stage) && <div className="pos-actions">{(session.capabilities.warehouse || session.capabilities.sell) && <button className="pos-primary" onClick={() => act('issue')}>Xác nhận đã bàn giao hàng</button>}{session.capabilities.sell && <><input aria-label="Lý do hủy" placeholder="Lý do hủy" value={reason} onChange={(e) => setReason(e.target.value)} /><button onClick={() => act('cancel', { reason })}>Hủy & giải phóng hàng</button></>}</div>}
      {session.manager && <details><summary>Hoàn tiền — quản lý duyệt và xác nhận đã chi</summary><p className="pos-muted">Không tự chuyển khoản; hoàn tiền không tự nhập lại tồn.</p>
        <div className="pos-fields"><Field label="Phương thức chi hoàn"><select value={refundMethod} onChange={(e) => { setRefundMethod(e.target.value); setApprovalId(''); }}><option value="cash">Tiền mặt</option><option value="bank_transfer">Chuyển khoản đã thực hiện</option></select></Field>
          {refundMethod === 'cash' ? <Field label="Ca chi hoàn"><select value={shiftId} onChange={(e) => setShiftId(e.target.value)}><option value="">Chọn ca đang mở</option>{shifts.data?.items.filter((s) => s.status === 'open').map((s) => <option key={s.id} value={s.id}>{s.register_name}</option>)}</select></Field> : <Field label="Mã giao dịch chi hoàn"><input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>}
          <Field label="Số tiền hoàn (đ)"><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field><Field label="Lý do hoàn"><input value={reason} onChange={(e) => setReason(e.target.value)} /></Field><Field label="Mã phiếu duyệt"><input value={approvalId} onChange={(e) => setApprovalId(e.target.value)} /></Field></div><button onClick={async () => { const result = await mutation.run<{ id: string }>('approvals', { kind: 'refund', target_id: id, target_version: order.revision, reason, content: { amount: Number(amount), method: refundMethod, reason } }); if (result) setApprovalId(result.id); }}>Lập yêu cầu hoàn</button><button onClick={() => { if (window.confirm('Xác nhận bạn đã chi tiền thực tế cho khách? Hệ thống chỉ ghi sổ.')) void act('refunds', { method: refundMethod, amount: Number(amount), shift_id: shiftId, provider_ref: reference, approval_id: approvalId, reason, confirmed_paid_out: true }); }}>Xác nhận đã chi hoàn</button></details>}
      {order.receipts && <><h3>Biên nhận bất biến</h3>{order.receipts.map((r) => <div className="pos-row" key={r.id}><span>{dateTime(r.created_at)} · {methodLabel[r.method]}<small>{r.id}</small></span><strong>{r.kind === 'refund' ? '−' : '+'}{money(r.amount)}</strong></div>)}</>}
      <p className="pos-muted">Phiếu bán hàng không thay thế hóa đơn điện tử.</p>
    </fieldset>}
    {order?.pos_stage === 'issued' && (session.capabilities.sell || session.capabilities.warehouse) && <ReturnPanel order={order} onChanged={() => { resource.refresh(); onChanged(); }} />}
  </section>;
}

function ReturnPanel({ order, onChanged }: { order: ProductOrder; onChanged: () => void }) {
  const [quantities, setQuantities] = useState<Record<string, string>>({}); const [reason, setReason] = useState('');
  const [restock, setRestock] = useState(false); const [checked, setChecked] = useState(false); const [approval, setApproval] = useState('');
  const mutation = useMutation();
  const items = Object.entries(quantities).filter(([, q]) => Number(q) > 0).map(([order_item_id, q]) => ({ order_item_id, quantity: Number(q) })).sort((a, b) => a.order_item_id.localeCompare(b.order_item_id));
  const content = { items, restock, reason };
  return <details><summary>Đổi trả theo sản phẩm</summary><Notice>{mutation.error}</Notice><fieldset disabled={mutation.busy} className="pos-fieldset">
    {order.order_items?.map((item) => <Field key={item.id} label={`${item.product_name} — đã mua ${item.quantity}`}><input type="number" min="0" max={item.quantity} value={quantities[item.id] || ''} onChange={(e) => { setQuantities({ ...quantities, [item.id]: e.target.value }); setApproval(''); }} /></Field>)}
    <Field label="Lý do đổi trả"><input value={reason} onChange={(e) => { setReason(e.target.value); setApproval(''); }} /></Field>
    <label className="pos-check"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />Đã nhận và kiểm tra hàng thực tế</label>
    <label className="pos-check"><input type="checkbox" checked={restock} onChange={(e) => { setRestock(e.target.checked); setApproval(''); }} />Hàng đạt yêu cầu, nhập lại tồn bán được</label>
    <button onClick={async () => { const result = await mutation.run<{ id: string }>('approvals', { kind: 'return', target_id: order.id, target_version: order.revision, reason, content }); if (result) setApproval(result.id); }}>Gửi quản lý duyệt trả hàng</button>
    <Field label="Mã phiếu duyệt"><input value={approval} onChange={(e) => setApproval(e.target.value)} /></Field>
    <button disabled={!checked} onClick={async () => { if (await mutation.run(`orders/${order.id}/returns`, { version: order.revision, ...content, approval_id: approval, received_and_checked: checked })) { onChanged(); setQuantities({}); setApproval(''); } }}>Ghi nhận hàng trả đã duyệt</button>
    <p className="pos-muted">Giá trị trả dựa trên giá/VAT lúc bán. Chứng từ chờ kế toán kiểm tra; không sửa hóa đơn VAT đã phát hành và không tự chi tiền hoàn.</p>
  </fieldset></details>;
}

function Orders({ session, selected, select }: { session: Session; selected?: string; select: (id?: string) => void }) {
  const [search, setSearch] = useState(''); const [query, setQuery] = useState(''); const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState({ stage: '', payment: '', delivery: '', employee: '', sync: '' });
  const staff = useResource<Page<{ id: string; display_name: string }>>('staff');
  const resource = useResource<Page<ProductOrder>>(`orders?q=${encodeURIComponent(query)}&offset=${offset}&${new URLSearchParams(filters)}`);
  const filterOptions = { stage: [['confirmed', 'Đã xác nhận'], ['packed', 'Đã đóng gói'], ['issued', 'Đã xuất hàng'], ['cancelled', 'Đã hủy']], payment: [['unpaid', 'Chưa thu đủ'], ['partial', 'Đã thu một phần'], ['paid', 'Đã thu đủ'], ['refunded', 'Đã hoàn toàn bộ']], delivery: [['pickup', 'Nhận tại quầy'], ['delivery', 'Giao hàng']], sync: [['issues', 'Có sai lệch mở']], employee: staff.data?.items.map((s) => [s.id, s.display_name || s.id]) || [] };
  return <div className={selected ? 'pos-detail-grid' : ''}><section className="pos-panel"><div className="pos-section-heading"><h2>Đơn hàng POS</h2><button onClick={resource.refresh}>Làm mới</button></div>
    <form className="pos-search" onSubmit={(e) => { e.preventDefault(); setQuery(search); setOffset(0); }}>
      <div className="relative flex-1">
        <input
          placeholder="Mã đơn hoặc số điện thoại..."
          aria-label="Tìm đơn"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-9 rounded-xl border border-border/70 bg-background/30 backdrop-blur-xl pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground/70 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
        />
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Xóa tìm kiếm"
            className="absolute right-2 top-2 p-0.5 rounded-full text-muted-foreground hover:text-foreground !min-h-0 !border-0 !bg-transparent"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <button type="submit" className="pos-primary h-9 px-3.5 rounded-xl text-xs font-bold whitespace-nowrap">Tìm</button>
    </form>
    <Notice>{resource.error}</Notice>
    <div className="pos-fields">{Object.entries(filterOptions).filter(([key]) => key !== 'employee' || session.capabilities.sell || session.capabilities.warehouse).map(([key, options]) => <Field key={key} label={{ stage: 'Trạng thái đơn', payment: 'Thanh toán', delivery: 'Cách nhận', sync: 'Đối soát', employee: 'Nhân viên' }[key]}><select value={filters[key]} onChange={(e) => { setFilters((old) => ({ ...old, [key]: e.target.value })); setOffset(0); }}><option value="">Tất cả</option>{options.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>)}</div>
    {resource.data?.items.map((o) => <button key={o.id} className="pos-order-row" onClick={() => select(o.id)}><span><strong>{o.order_code}</strong><small>{o.customer_name} · {dateTime(o.created_at)}</small></span><span>{stageLabel[o.pos_stage]}<small>{o.payment_summary ? `Còn thu ${money(o.payment_summary.remaining)}` : o.fulfillment_status}</small></span></button>)}
    {resource.data && !resource.data.items.length && <Empty>Chưa có đơn POS mới. Không nhập lại đơn lịch sử.</Empty>}<Pager offset={offset} setOffset={setOffset} more={Boolean(resource.data?.has_more)} />
    </section>{selected && <OrderDetail key={selected} id={selected} session={session} onClose={() => select(undefined)} onChanged={resource.refresh} />}</div>;
}

function Shifts({ manager }: { manager: boolean }) {
  const [offset, setOffset] = useState(0);
  const resource = useResource<Page<CashShift>>(`shifts?offset=${offset}`); const mutation = useMutation();
  const [register, setRegister] = useState('Quầy 1'); const [opening, setOpening] = useState('');
  return <section className="pos-panel"><div className="pos-section-heading"><h2>Ca thu ngân</h2><button onClick={resource.refresh}>Làm mới</button></div><Notice>{resource.error || mutation.error}</Notice><fieldset disabled={mutation.busy} className="pos-fieldset"><form className="pos-inline" onSubmit={async (e) => { e.preventDefault(); if (await mutation.run('shifts', { register_name: register, opening_amount: Number(opening) })) resource.refresh(); }}><Field label="Quầy"><input value={register} onChange={(e) => setRegister(e.target.value)} required /></Field><Field label="Tiền mặt đầu ca (đ)"><input type="number" min="0" value={opening} onChange={(e) => setOpening(e.target.value)} required /></Field><button className="pos-primary">Mở ca</button></form>
    <p className="pos-muted">Tiền khách đưa trừ tiền thừa mới là thực thu. Ngân hàng/COD không cộng vào tiền mặt cuối ca.</p>
    {resource.data?.items.map((s) => <div key={s.id} className="pos-shift"><h3>{s.register_name} <span className="pos-badge">{s.status === 'open' ? 'Đang mở' : 'Đã khóa'}</span></h3><p>{dateTime(s.opened_at)} · Đầu ca {money(s.opening_amount)} · Dự kiến {money(s.expected_now)}</p><PosShiftOperations shift={s} manager={manager} onChanged={resource.refresh} /></div>)}
  </fieldset><Pager offset={offset} setOffset={setOffset} more={Boolean(resource.data?.has_more)} /></section>;
}

function Customers({ session }: { session: Session }) {
  const [offset, setOffset] = useState(0);
  const [orderOffset, setOrderOffset] = useState(0);
  const [query, setQuery] = useState(''); const [search, setSearch] = useState(''); const resource = useResource<Page<Customer>>(`customers?q=${encodeURIComponent(query)}&offset=${offset}`);
  const mutation = useMutation(); const [form, setForm] = useState({ name: '', phone: '', email: '' }); const [selected, setSelected] = useState<string>();
  const detail = useResource<{ customer: Customer; orders: ProductOrder[]; has_more: boolean }>(selected ? `customers/${selected}?offset=${orderOffset}` : null);
  return <section className="pos-panel"><h2>Khách thương mại</h2><p className="pos-muted">Tách biệt hồ sơ bệnh án. Khách trùng SĐT cần chọn đúng hồ sơ; không tự gộp.</p><Notice>{resource.error || mutation.error || detail.error}</Notice>
    <form className="pos-search" onSubmit={(e) => { e.preventDefault(); setQuery(search); setOffset(0); }}>
      <div className="relative flex-1">
        <input
          placeholder="Tên hoặc số điện thoại..."
          aria-label="Tìm khách"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-9 rounded-xl border border-border/70 bg-background/30 backdrop-blur-xl pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground/70 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
        />
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Xóa tìm kiếm"
            className="absolute right-2 top-2 p-0.5 rounded-full text-muted-foreground hover:text-foreground !min-h-0 !border-0 !bg-transparent"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <button type="submit" className="pos-primary h-9 px-3.5 rounded-xl text-xs font-bold whitespace-nowrap">Tìm</button>
    </form>
    <details><summary>Thêm khách mới</summary><form className="pos-fields" onSubmit={async (e) => { e.preventDefault(); if (await mutation.run('customers', form)) { setForm({ name: '', phone: '', email: '' }); resource.refresh(); } }}>{(['name', 'phone', 'email'] as const).map((key) => <Field key={key} label={{ name: 'Tên khách', phone: 'Số điện thoại', email: 'Email' }[key]}><input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required={key === 'name'} /></Field>)}<button disabled={mutation.busy}>Lưu khách</button></form></details>
    {resource.data?.items.map((c) => <button key={c.id} className="pos-order-row" onClick={() => { setSelected(c.id); setOrderOffset(0); }}><strong>{c.name}</strong><span>{c.phone || 'Chưa có SĐT'}</span></button>)}
    {detail.data && selected && <div className="pos-subpanel"><h3>{detail.data.customer.name}</h3><p>Mã khách: {selected}</p>
      {session.manager && <PosAssignment key={selected} path={`customers/${selected}`} version={detail.data.customer.version} current={detail.data.customer.assigned_to} onChanged={detail.refresh} />}
      {detail.data.orders.map((o) => <p key={o.id}>{o.order_code} · Tổng {money(o.grand_total)} · Còn thu {money(o.payment_summary?.remaining)}</p>)}{!detail.data.orders.length && <Empty>Chưa có lịch sử mua trong POS mới.</Empty>}<Pager offset={orderOffset} setOffset={setOrderOffset} more={detail.data.has_more} /></div>}
  <Pager offset={offset} setOffset={setOffset} more={Boolean(resource.data?.has_more)} /></section>;
}

function Care() {
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState('open'); const [customerSearch, setCustomerSearch] = useState(''); const [customerQuery, setCustomerQuery] = useState('');
  const [customerOffset, setCustomerOffset] = useState(0); const [selectedCustomer, setSelectedCustomer] = useState<Customer>();
  useEffect(() => { const timer = setTimeout(() => { setCustomerQuery(customerSearch.trim()); setCustomerOffset(0); }, 300); return () => clearTimeout(timer); }, [customerSearch]);
  const resource = useResource<Page<CareTask>>(`care?state=${state}&offset=${offset}`); const mutation = useMutation();
  const customers = useResource<Page<Customer>>(`customers?q=${encodeURIComponent(customerQuery)}&offset=${customerOffset}`); const [form, setForm] = useState({ customer_id: '', title: '', due_at: '', note: '' });
  const options = [...(selectedCustomer && !customers.data?.items.some((c) => c.id === selectedCustomer.id) ? [selectedCustomer] : []), ...(customers.data?.items || [])];
  return <section className="pos-panel"><div className="pos-section-heading"><h2>Chăm sóc & nhắc việc</h2><button onClick={resource.refresh}>Làm mới</button></div><Notice>{resource.error || mutation.error || customers.error}</Notice>
    <Field label="Tìm khách cho nhắc việc"><input placeholder="Tên hoặc SĐT khách phụ trách" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} /></Field><Pager offset={customerOffset} setOffset={setCustomerOffset} more={Boolean(customers.data?.has_more)} />
    <form className="pos-fields" onSubmit={async (e) => { e.preventDefault(); if (await mutation.run('care', { ...form, due_at: new Date(form.due_at).toISOString() })) { resource.refresh(); setForm({ ...form, title: '', note: '' }); } }}><Field label="Khách phụ trách"><select value={form.customer_id} onChange={(e) => { setForm({ ...form, customer_id: e.target.value }); setSelectedCustomer(options.find((c) => c.id === e.target.value)); }} required><option value="">Chọn khách</option>{options.map((c) => <option value={c.id} key={c.id}>{c.name} · {c.phone}</option>)}</select></Field><Field label="Việc cần làm"><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field><Field label="Đến hạn"><input type="datetime-local" required value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} /></Field><Field label="Ghi chú"><textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field><button disabled={mutation.busy}>Tạo nhắc việc</button></form>
    <Field label="Trạng thái nhắc việc"><select value={state} onChange={(e) => { setState(e.target.value); setOffset(0); }}><option value="open">Chờ làm</option><option value="done">Đã hoàn thành</option><option value="cancelled">Đã hủy</option></select></Field>
    {resource.data?.items.map((task) => <div className="pos-row" key={task.id}><div><strong>{task.title}</strong><small>{task.customer_name} · {dateTime(task.due_at)} {task.status === 'open' && Date.parse(task.due_at) < Date.now() ? '· Quá hạn' : ''}</small><p>{task.note}</p></div>{task.status === 'open' && <button disabled={mutation.busy} onClick={async () => { if (await mutation.run(`care/${task.id}`, { version: task.version, status: 'done', note: task.note })) resource.refresh(); }}>Hoàn thành</button>}</div>)}
  <Pager offset={offset} setOffset={setOffset} more={Boolean(resource.data?.has_more)} /></section>;
}

function Approvals({ session }: { session: Session }) {
  const [offset, setOffset] = useState(0);
  const resource = useResource<Page<ApprovalRequest>>(`approvals?offset=${offset}`); const mutation = useMutation();
  return <section className="pos-panel"><div className="pos-section-heading"><h2>Phê duyệt nghiệp vụ</h2><button onClick={resource.refresh}>Làm mới</button></div><Notice>{resource.error || mutation.error}</Notice><p className="pos-muted">Mỗi phiếu dùng một lần, đúng nội dung và phiên bản; hết hạn sau 60 phút.</p>
    {resource.data?.items.map((a) => <article key={a.id} className="pos-approval"><div className="pos-section-heading"><h3>{{ opening_receivable: 'Công nợ đầu kỳ', opening_receivable_void: 'Đảo số dư đầu kỳ', inventory_document: 'Phiếu kho nhiều sản phẩm', return: 'Trả hàng', sale_override: 'Giá bán / công nợ', refund: 'Hoàn tiền', inventory: 'Chứng từ kho' }[a.kind] || a.kind}</h3><span className="pos-badge">{a.status}</span></div><p>{a.reason}</p><small>Mã: {a.id} · Phiên bản {a.target_version} · Hết hạn {dateTime(a.expires_at)}</small><dl>{Object.entries(a.content || {}).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')}</dd></div>)}</dl>{a.display && 'inventory' in a.display && <pre className="pos-approval-json">{JSON.stringify(a.display.inventory, null, 2)}</pre>}{a.display?.opening_receivable && <div className="pos-subpanel"><p>{a.display.opening_receivable.customer_name} · {a.display.opening_receivable.customer_phone}</p><p>Chứng từ: {a.display.opening_receivable.source_reference}</p><p>Số nợ: <strong>{money(a.display.opening_receivable.amount)}</strong> · Ngày số dư: {a.display.opening_receivable.as_of_date} · Đến hạn: {a.display.opening_receivable.due_date}</p><p>{a.display.opening_receivable.note}</p></div>}{a.display?.quote && <div className="pos-subpanel">{a.display.items?.map((item, index) => <p key={index}>{item.name} × {item.quantity}: {money(item.catalog_price)} → {money(item.selling_price)}</p>)}<p>Giảm giá: {money(a.display.quote.discount_amount)} · VAT: {money(a.display.quote.tax_amount)} · Tổng duyệt: <strong>{money(a.display.quote.grand_total)}</strong></p>{a.display.credit_due_at && <p>Hạn công nợ: {a.display.credit_due_at}</p>}</div>}{session.manager && a.status === 'pending' && <div className="pos-actions"><button disabled={mutation.busy} onClick={async () => { if (await mutation.run(`approvals/${a.id}`, { decision: 'approved' })) resource.refresh(); }}>Duyệt nội dung này</button><button disabled={mutation.busy} onClick={async () => { if (await mutation.run(`approvals/${a.id}`, { decision: 'rejected' })) resource.refresh(); }}>Từ chối</button></div>}</article>)}
    {resource.data && !resource.data.items.length && <Empty>Chưa có yêu cầu phê duyệt.</Empty>}
  <Pager offset={offset} setOffset={setOffset} more={Boolean(resource.data?.has_more)} /></section>;
}

function Inventory() {
  const [offset, setOffset] = useState(0);
  const resource = useResource<Page<InventoryMovement>>(`inventory?offset=${offset}`); const mutation = useMutation();
  const [form, setForm] = useState({ product_id: '', quantity: '', expected_available: '', kind: 'receive', reason: '', approval_id: '' });
  const content = () => ({ product_id: Number(form.product_id), quantity: Number(form.quantity), expected_available: Number(form.expected_available), kind: form.kind, reason: form.reason });
  return <section className="pos-panel"><h2>Phiếu kho</h2><p className="pos-muted">Phiếu đã ghi sổ không được sửa. Kiểm kê dùng chênh lệch với tồn khả dụng, không cộng phần đã giữ lần nữa.</p><Notice>{resource.error || mutation.error}</Notice><fieldset className="pos-fieldset" disabled={mutation.busy}><div className="pos-fields"><Field label="ID sản phẩm"><input type="number" min="1" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value, approval_id: '' })} /></Field><Field label="Loại phiếu"><select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value, approval_id: '' })}><option value="receive">Nhập hàng</option><option value="adjust">Điều chỉnh / kiểm kê</option></select></Field><Field label="Số lượng (+ nhập / − xuất)"><input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value, approval_id: '' })} /></Field><Field label="Tồn khả dụng trước khi ghi"><input type="number" min="0" value={form.expected_available} onChange={(e) => setForm({ ...form, expected_available: e.target.value, approval_id: '' })} /></Field><Field label="Lý do / số chứng từ"><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value, approval_id: '' })} /></Field><Field label="Mã phiếu phê duyệt"><input value={form.approval_id} onChange={(e) => setForm({ ...form, approval_id: e.target.value })} /></Field></div><div className="pos-actions"><button onClick={async () => { const result = await mutation.run<{ id: string }>('approvals', { kind: 'inventory', target_id: form.product_id, target_version: Number(form.expected_available), content: content(), reason: form.reason }); if (result) setForm({ ...form, approval_id: result.id }); }}>Gửi quản lý duyệt</button><button className="pos-primary" onClick={async () => { if (await mutation.run('inventory', { ...content(), approval_id: form.approval_id })) { resource.refresh(); setForm({ ...form, approval_id: '' }); } }}>Ghi sổ phiếu đã duyệt</button></div></fieldset>
    <h3>Lịch sử biến động</h3>{resource.data?.items.map((m) => <div className="pos-row" key={m.id}><span>{m.product_name}<small>{m.kind} · {m.reason} · {dateTime(m.created_at)}</small></span><strong>{m.quantity}</strong></div>)}
  <Pager offset={offset} setOffset={setOffset} more={Boolean(resource.data?.has_more)} /></section>;
}

export default function AdminPosPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { clearPosCache(); setMounted(true); return () => clearPosCache(); }, []);
  return <div className="pos-workspace">{mounted && <PosWorkspace />}</div>;
}
// Mount after authorization resolves so the workspace hook order stays stable.
function PosSidebar({ tabs, active, setTab }: {
  tabs: Array<[Section, string, boolean]>;
  active: Section;
  setTab: (section: Section) => void;
}) {
  const setSidebarConfig = useAdminLayoutDispatch();
  useEffect(() => {
    setSidebarConfig({
      title: 'Quầy bán hàng POS',
      eyebrow: 'VẬN HÀNH CỬA HÀNG',
      description: 'Bán hàng tại quầy, quản lý đơn hàng POS, ca thu ngân, kho và công nợ.',
      icon: <ShoppingBagIcon className="w-8 h-8" />,
      taskItems: tabs.filter(([, , allowed]) => allowed).map(([key, label]) => ({
        key, label, onClick: () => setTab(key),
      })),
      activeTaskKey: active,
    });
  }, [setSidebarConfig, tabs, active, setTab]);
  return null;
}

function PosWorkspace() {
  const session = useResource<Session>('session');
  const [tab, setTab] = useState<Section>(() => new URLSearchParams(location.search).has('order') ? 'orders' : 'sell');
  const [selected, setSelected] = useState<string>(() => new URLSearchParams(location.search).get('order') || undefined);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (session.error) return (
    <section className="pos-panel text-center max-w-xl mx-auto my-12">
      <h1 className="text-xl font-bold">Quầy bán hàng</h1>
      <Notice>{session.error}</Notice>
      <p className="text-sm text-muted-foreground mt-2">Master admin cấp vai trò thu ngân, chăm sóc, kho hoặc quản lý. Quyền admin thông thường không tự mở POS.</p>
      <button className="pos-primary mt-4" onClick={session.refresh}>Thử lại</button>
    </section>
  );

  if (!session.data) return (
    <div className="pos-panel flex items-center justify-center min-h-[300px]" role="status">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm font-semibold text-muted-foreground">Đang kiểm tra quyền POS…</p>
      </div>
    </div>
  );

  const s = session.data;
  const tabs: Array<[Section, string, boolean]> = [
    ['sell', 'Bán hàng', s.capabilities.sell],
    ['orders', 'Đơn hàng', true],
    ['customers', 'Khách hàng', s.capabilities.care],
    ['shifts', 'Ca thu ngân', s.capabilities.sell],
    ['inventory', 'Kho', s.capabilities.warehouse],
    ['opening', 'Công nợ đầu kỳ', s.capabilities.care],
    ['care', 'Chăm sóc', s.capabilities.care],
    ['approvals', 'Phê duyệt', true],
    ['reports', 'Báo cáo', s.manager],
    ['settings', 'Thiết lập', s.roles.includes('master_admin')],
  ];
  const active = tabs.some(([key, , allowed]) => key === tab && allowed) ? tab : 'orders';

  return (
    <div className="space-y-4 sm:space-y-5 bg-transparent border-0 shadow-none p-0 -mx-1 sm:mx-0">
      <PosSidebar tabs={tabs} active={active} setTab={setTab} />
      {/* Top Header & Navigation Card */}
      <div className="hidden lg:block rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3.5 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Thế Giới Trị Mụn · Vận hành cửa hàng
            </p>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
              Quầy bán hàng POS
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all ${
                online
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 animate-pulse'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span>{online ? 'Đang kết nối' : 'Mất mạng · chưa thể chốt'}</span>
            </span>
          </div>
        </div>

        {/* Preset Pills Tabs Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-3 pb-1 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {tabs.filter(([, , allowed]) => allowed).map(([key, label]) => {
            const isActive = active === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-xs font-bold scale-[1.02]'
                    : 'border border-border/60 bg-background/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {(!s.settings.deployment_enabled || !s.settings.transactions_enabled) && (
        <Notice className="hidden lg:block">
          POS chưa mở giao dịch thật. Cần kiểm thử, duyệt biên bản số dư đầu kỳ và bật công tắc triển khai. Bạn vẫn có thể chuẩn bị giỏ nháp.
        </Notice>
      )}
      {!online && (
        <Notice>
          Nội dung đang nhập được giữ trong màn hình. Chưa xác nhận đơn hoặc thanh toán khi mất mạng; không đóng tab nếu chưa lưu.
        </Notice>
      )}

      {s.capabilities.sell && (
        <Sell session={s} active={active === 'sell'} openOrder={(id) => { setSelected(id); setTab('orders'); }} />
      )}
      {active === 'orders' && <Orders session={s} selected={selected} select={setSelected} />}
      {active === 'shifts' && <Shifts manager={s.manager} />}
      {active === 'customers' && <Customers session={s} />}
      {active === 'care' && <Care />}
      {active === 'approvals' && <Approvals session={s} />}
      {active === 'inventory' && (
        <div className="space-y-4">
          <PosInventoryDocuments />
          <Inventory />
        </div>
      )}
      {active === 'reports' && <PosReports />}
      {active === 'opening' && (
        <PosOpeningReceivables manager={s.manager} canCollect={s.capabilities.sell} approved={Boolean(s.settings.opening_approved_at)} />
      )}
      {active === 'settings' && (
        <PosControls
          openingReference={s.settings.opening_reference}
          approvedAt={s.settings.opening_approved_at}
          enabled={Boolean(s.settings.transactions_enabled)}
          deploymentEnabled={s.settings.deployment_enabled}
          onChanged={session.refresh}
        />
      )}
    </div>
  );
}
