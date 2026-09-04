import type { OrderChannel, OrderPaymentMethod, OrderPrintFormat, ProductOrder } from '../types';
import { getOrderItemDisplayName } from './orderItemPresentation';

const BRAND_NAME = 'Thế Giới Trị Mụn';

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export const formatOrderCurrency = (amount: number): string =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(amount || 0));

export const getOrderChannelLabel = (order: Pick<ProductOrder, 'order_channel'> | OrderChannel | undefined): string => {
  const channel = typeof order === 'string' ? order : order?.order_channel;
  return channel === 'pos' ? 'POS / Tại quầy' : 'Online';
};

export const getOrderPaymentMethodLabel = (method?: OrderPaymentMethod): string => {
  if (method === 'bank_transfer') return 'Chuyển khoản';
  if (method === 'cash') return 'Tiền mặt';
  return 'COD';
};

const getPaymentStatusLabel = (order: ProductOrder): string => {
  const status = order.payment_status || (order.status === 'completed' ? 'paid' : 'unpaid');
  if (status === 'paid') return 'Đã thanh toán';
  if (status === 'failed') return 'Thanh toán lỗi';
  if (status === 'refunded') return 'Đã hoàn tiền';
  return 'Chưa thanh toán';
};

const getFulfillmentStatusLabel = (order: ProductOrder): string => {
  const status = order.fulfillment_status || order.status;
  if (status === 'processing') return 'Đang xử lý';
  if (status === 'shipped') return 'Đang giao';
  if (status === 'completed') return 'Hoàn tất';
  if (status === 'cancelled') return 'Đã hủy';
  return 'Chờ xử lý';
};

export const formatOrderShippingAddress = (order: ProductOrder): string =>
  [order.shipping_street, order.shipping_ward, order.shipping_district, order.shipping_province]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');

const orderTotals = (order: ProductOrder) => ({
  subtotal: Number(order.subtotal_price || 0),
  discount: Number(order.discount_amount || 0),
  tax: Number(order.tax_amount || 0) + Number(order.shipping_tax_amount || 0),
  shipping: Number(order.shipping_fee || 0),
  total: Number(order.grand_total || order.total_price || 0),
});

export const buildOrderShareText = (order: ProductOrder): string => {
  const totals = orderTotals(order);
  const address = formatOrderShippingAddress(order);
  const itemLines = (order.order_items || []).map((item, index) => {
    const lineTotal = Number(item.price_at_purchase || 0) * Number(item.quantity || 0);
    return `${index + 1}. ${getOrderItemDisplayName(item)} × ${Number(item.quantity || 0)} — ${formatOrderCurrency(lineTotal)}`;
  });
  const lines = [
    BRAND_NAME.toUpperCase(),
    `ĐƠN HÀNG ${order.order_code || order.id}`,
    `Kênh: ${getOrderChannelLabel(order)}`,
    `Ngày tạo: ${new Date(order.created_at).toLocaleString('vi-VN')}`,
    `Khách hàng: ${order.customer_name || 'Khách lẻ'}`,
  ];
  if (order.customer_phone) lines.push(`SĐT: ${order.customer_phone}`);
  if (address) lines.push(`Địa chỉ: ${address}`);
  lines.push('', 'Sản phẩm:', ...(itemLines.length ? itemLines : ['Chưa có sản phẩm']));
  lines.push(
    '',
    `Tạm tính: ${formatOrderCurrency(totals.subtotal)}`,
    `Giảm giá: -${formatOrderCurrency(totals.discount)}`,
    `Thuế/VAT: ${formatOrderCurrency(totals.tax)}`,
    `Phí giao hàng: ${formatOrderCurrency(totals.shipping)}`,
    `TỔNG THANH TOÁN: ${formatOrderCurrency(totals.total)}`,
    `Thanh toán: ${getOrderPaymentMethodLabel(order.payment_method)} • ${getPaymentStatusLabel(order)}`,
    `Trạng thái đơn: ${getFulfillmentStatusLabel(order)}`,
  );
  if (order.notes) lines.push(`Ghi chú: ${order.notes}`);
  return lines.join('\n');
};

export const buildOrderPrintHtml = (order: ProductOrder, format: OrderPrintFormat): string => {
  const totals = orderTotals(order);
  const address = formatOrderShippingAddress(order);
  const compact = format === 'receipt80';
  const rows = (order.order_items || []).map((item) => {
    const quantity = Number(item.quantity || 0);
    const price = Number(item.price_at_purchase || 0);
    return `<tr><td>${escapeHtml(getOrderItemDisplayName(item))}</td><td class="qty">${quantity}</td><td class="money">${escapeHtml(formatOrderCurrency(price * quantity))}</td></tr>`;
  }).join('');
  const customerRows = [
    `<p><strong>Khách:</strong> ${escapeHtml(order.customer_name || 'Khách lẻ')}</p>`,
    order.customer_phone ? `<p><strong>SĐT:</strong> ${escapeHtml(order.customer_phone)}</p>` : '',
    address ? `<p><strong>Địa chỉ:</strong> ${escapeHtml(address)}</p>` : '',
  ].filter(Boolean).join('');

  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Đơn hàng ${escapeHtml(order.order_code || order.id)}</title>
<style>
@page { size: ${compact ? '80mm auto' : 'A4'}; margin: ${compact ? '4mm' : '14mm'}; }
* { box-sizing: border-box; } body { color:#111827; font-family:Arial,sans-serif; margin:0 auto; width:${compact ? '72mm' : '100%'}; font-size:${compact ? '11px' : '13px'}; }
h1 { font-size:${compact ? '15px' : '22px'}; margin:4px 0; text-align:center; } .brand { font-weight:800; letter-spacing:.08em; text-align:center; text-transform:uppercase; }
.meta { border-bottom:1px dashed #9ca3af; border-top:1px dashed #9ca3af; margin:10px 0; padding:8px 0; } .meta p { margin:3px 0; }
table { border-collapse:collapse; width:100%; } th,td { border-bottom:1px solid #d1d5db; padding:${compact ? '5px 2px' : '8px 6px'}; text-align:left; vertical-align:top; }
.qty { text-align:center; width:42px; } .money { text-align:right; white-space:nowrap; } .totals { margin-left:auto; margin-top:10px; width:${compact ? '100%' : '360px'}; }
.totals td { border:0; padding:3px 0; } .total td { border-top:1px solid #111827; font-size:${compact ? '13px' : '15px'}; font-weight:800; padding-top:7px; }
.notes { border-top:1px dashed #9ca3af; margin-top:10px; padding-top:8px; } .hint { color:#6b7280; margin-top:14px; text-align:center; }
</style></head><body>
<div class="brand">${escapeHtml(BRAND_NAME)}</div><h1>${compact ? 'PHIẾU BÁN HÀNG' : 'HÓA ĐƠN / ĐƠN HÀNG'}</h1>
<div class="meta"><p><strong>Mã đơn:</strong> ${escapeHtml(order.order_code || order.id)}</p><p><strong>Kênh:</strong> ${escapeHtml(getOrderChannelLabel(order))}</p><p><strong>Ngày:</strong> ${escapeHtml(new Date(order.created_at).toLocaleString('vi-VN'))}</p>${customerRows}</div>
<table><thead><tr><th>Sản phẩm</th><th class="qty">SL</th><th class="money">Thành tiền</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Chưa có sản phẩm</td></tr>'}</tbody></table>
<table class="totals"><tbody><tr><td>Tạm tính</td><td class="money">${escapeHtml(formatOrderCurrency(totals.subtotal))}</td></tr><tr><td>Giảm giá</td><td class="money">-${escapeHtml(formatOrderCurrency(totals.discount))}</td></tr><tr><td>Thuế/VAT</td><td class="money">${escapeHtml(formatOrderCurrency(totals.tax))}</td></tr><tr><td>Phí giao hàng</td><td class="money">${escapeHtml(formatOrderCurrency(totals.shipping))}</td></tr><tr class="total"><td>Tổng thanh toán</td><td class="money">${escapeHtml(formatOrderCurrency(totals.total))}</td></tr></tbody></table>
<div class="notes"><p><strong>Thanh toán:</strong> ${escapeHtml(getOrderPaymentMethodLabel(order.payment_method))} • ${escapeHtml(getPaymentStatusLabel(order))}</p>${order.notes ? `<p><strong>Ghi chú:</strong> ${escapeHtml(order.notes)}</p>` : ''}</div>
<p class="hint">Cảm ơn quý khách!</p></body></html>`;
};

export const printProductOrder = (order: ProductOrder, format: OrderPrintFormat): boolean => {
  if (typeof window === 'undefined') return false;
  const printWindow = window.open('', '_blank', format === 'receipt80' ? 'width=420,height=760' : 'width=960,height=760');
  if (!printWindow) return false;
  printWindow.document.write(buildOrderPrintHtml(order, format));
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
  return true;
};
