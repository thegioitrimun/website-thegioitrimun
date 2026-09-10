import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ProductOrder,
  ProductOrderItem,
  View,
  GhtkTrackingEvent,
  OrderFulfillmentStatus,
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderPaymentLog,
  OrderRefundLog,
  OrderStatusHistory,
} from '../types';
import { ReceiptIcon, TruckIcon, ChevronDownIcon, DocumentDuplicateIcon } from './icons';
import AnimatedSection from './AnimatedSection';
import * as api from '../services/api';
import Spinner from './Spinner';
import BackIconButton from './BackIconButton';
import { getOrderItemDisplayName } from '../src/orderItemPresentation';
import { printProductOrder } from '../src/orderReceipt';

interface OrderHistoryPageProps {
  orders: ProductOrder[];
  onNavigate: (view: View) => void;
  onBack: () => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const getOrderFulfillmentStatus = (order: ProductOrder): OrderFulfillmentStatus => {
  if (order.fulfillment_status) return order.fulfillment_status;
  if (order.status === 'processing') return 'processing';
  if (order.status === 'shipped') return 'shipped';
  if (order.status === 'completed') return 'completed';
  if (order.status === 'cancelled') return 'cancelled';
  if (order.status === 'refunded') return 'completed';
  return 'pending';
};

const getOrderPaymentStatus = (order: ProductOrder): OrderPaymentStatus => {
  if (order.payment_status) return order.payment_status;
  if (order.status === 'completed') return 'paid';
  if (order.status === 'refunded') return 'refunded';
  return 'unpaid';
};

const getOrderPaymentMethod = (order: ProductOrder): OrderPaymentMethod => {
  if (order.payment_method === 'bank_transfer') return 'bank_transfer';
  if (order.payment_method === 'cash') return 'cash';
  return 'cod';
};

const getFulfillmentStatusStyles = (status: OrderFulfillmentStatus) => {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20';
    case 'shipped':
      return 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/20';
    case 'cancelled':
      return 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/20';
    case 'processing':
      return 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20';
    case 'pending':
    default:
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20';
  }
};

const getPaymentStatusStyles = (status: OrderPaymentStatus) => {
  switch (status) {
    case 'paid':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20';
    case 'failed':
      return 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/20';
    case 'refunded':
      return 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/20';
    case 'unpaid':
    default:
      return 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border border-zinc-500/20';
  }
};

const OrderHistoryPage: React.FC<OrderHistoryPageProps> = ({ orders, onNavigate, onBack }) => {
  const { t, i18n } = useTranslation();

  const getLocalized = (obj: any, field: string): string => {
    if (!obj) return '';
    const lang = i18n.language;
    if (lang !== 'vi') {
      const v = obj[`${field}_${lang}`];
      if (v) return v;
    }
    return obj[field] || '';
  };

  const getOrderItemName = (item: ProductOrderItem): string => {
    const localizedName = getLocalized(item.product, 'name');
    return getOrderItemDisplayName({ ...item, product: { ...item.product, name: localizedName || item.product?.name } });
  };

  const getOrderItemImage = (item: ProductOrderItem): string =>
    String(item.product?.main_image_url || item.resolved_product_image_path || item.product_image_path || '').trim();

  const formatShippingAddress = (order: ProductOrder): string =>
    [order.shipping_street, order.shipping_ward, order.shipping_district, order.shipping_province]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join(', ');

  const getDateLocale = () => {
    switch (i18n.language) {
      case 'en':
        return 'en-US';
      case 'ru':
        return 'ru-RU';
      case 'cn':
        return 'zh-CN';
      default:
        return 'vi-VN';
    }
  };

  const getStatusText = (status: ProductOrder['status']) => {
    switch (status) {
      case 'completed':
        return t('orders.status_completed');
      case 'shipped':
        return t('orders.status_shipped');
      case 'cancelled':
        return t('orders.status_cancelled');
      case 'refunded':
        return t('orders.status_refunded');
      case 'processing':
        return t('orders.status_processing');
      case 'pending':
      default:
        return t('orders.status_pending');
    }
  };

  const getFulfillmentStatusText = (status: OrderFulfillmentStatus) => {
    switch (status) {
      case 'processing':
        return t('orders.status_processing');
      case 'shipped':
        return t('orders.status_shipped');
      case 'completed':
        return t('orders.status_completed');
      case 'cancelled':
        return t('orders.status_cancelled');
      case 'pending':
      default:
        return t('orders.status_pending');
    }
  };

  const getPaymentStatusText = (status: OrderPaymentStatus) => {
    if (status === 'paid') return t('orders.payment_status_paid');
    if (status === 'failed') return t('orders.payment_status_failed');
    if (status === 'refunded') return t('orders.payment_status_refunded');
    return t('orders.payment_status_unpaid');
  };

  const getPaymentMethodText = (method: OrderPaymentMethod) => {
    if (method === 'bank_transfer') return t('orders.payment_method_bank_transfer');
    if (method === 'cash') return t('orders.payment_method_cash', 'Tiền mặt');
    return t('orders.payment_method_cod');
  };

  const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(getDateLocale());
  };

  const OrderCard: React.FC<{ order: ProductOrder }> = ({ order }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [trackingHistory, setTrackingHistory] = useState<GhtkTrackingEvent[]>([]);
    const [statusHistory, setStatusHistory] = useState<OrderStatusHistory[]>([]);
    const [paymentLogs, setPaymentLogs] = useState<OrderPaymentLog[]>([]);
    const [refundLogs, setRefundLogs] = useState<OrderRefundLog[]>([]);
    const [lifecycleError, setLifecycleError] = useState<string | null>(null);
    const [isLoadingTracking, setIsLoadingTracking] = useState(false);
    const [isLoadingLifecycle, setIsLoadingLifecycle] = useState(false);

    const subtotal = Number(order.subtotal_price || 0);
    const discount = Number(order.discount_amount || 0);
    const shipping = Number(order.shipping_fee || 0);
    const taxAmount = Number(order.tax_amount || 0) + Number(order.shipping_tax_amount || 0);
    const totalAmount = Number(order.grand_total || order.total_price || 0);

    const fulfillmentStatus = getOrderFulfillmentStatus(order);
    const paymentStatus = getOrderPaymentStatus(order);
    const paymentMethod = getOrderPaymentMethod(order);
    const canRequestReview = fulfillmentStatus === 'completed' && paymentStatus === 'paid';

    const resolvedRefundLogs = refundLogs.length > 0 ? refundLogs : (order.refund_logs || []);
    const refundedAmount = resolvedRefundLogs
      .filter((refund) => refund.status === 'completed')
      .reduce((sum, refund) => sum + Number(refund.amount || 0), 0);

    const getTrackingUrl = (currentOrder: ProductOrder): string | null => {
      if (!currentOrder.shipping_provider || !currentOrder.shipping_code) return null;
      const provider = currentOrder.shipping_provider.toLowerCase();
      const code = currentOrder.shipping_code;
      if (provider === 'spx') return `https://spx.vn/detail/${code}`;
      if (provider === 'ghtk') return `https://i.ghtk.vn/${code}`;
      return null;
    };

    const handleToggleExpand = async () => {
      const newIsExpanded = !isExpanded;
      setIsExpanded(newIsExpanded);

      if (!newIsExpanded) return;

      if (statusHistory.length === 0 && paymentLogs.length === 0 && refundLogs.length === 0) {
        setIsLoadingLifecycle(true);
        setLifecycleError(null);
        try {
          const logs = await api.getOrderLifecycleLogs(order.id);
          setStatusHistory(logs.statusHistory);
          setPaymentLogs(logs.paymentLogs);
          setRefundLogs(logs.refundLogs);
        } catch (error) {
          console.error('Failed to fetch lifecycle logs:', error);
          setLifecycleError(t('orders.lifecycle_load_failed'));
        } finally {
          setIsLoadingLifecycle(false);
        }
      }

      if (order.shipping_provider?.toLowerCase() === 'ghtk' && order.ghtk_label && trackingHistory.length === 0) {
        setIsLoadingTracking(true);
        try {
          const history = await api.getGhtkOrderStatus(order.id);
          setTrackingHistory(history);
        } catch (error) {
          console.error('Failed to fetch GHTK status:', error);
        } finally {
          setIsLoadingTracking(false);
        }
      }
    };

    const handleDownloadInvoice = () => {
      if (!printProductOrder(order, 'a4')) alert(t('orders.invoice_popup_blocked'));
    };

    const handleNavigateToReview = (productIdOrSlug: number | string) => {
      onNavigate({ page: 'productDetail', id: productIdOrSlug, focusReview: true });
    };

    const trackingUrl = getTrackingUrl(order);

    return (
      <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0 overflow-hidden transition-all">
        {/* Card Header */}
        <div className="p-3.5 sm:p-5 bg-muted/25 border-b border-border/40 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">{t('orders.order_code')}:</span>
              <span className="font-mono font-bold text-sm sm:text-base text-primary tracking-wide">#{order.order_code}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(order.created_at).toLocaleDateString(getDateLocale(), { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-md ${getFulfillmentStatusStyles(fulfillmentStatus)}`}>
              {getFulfillmentStatusText(fulfillmentStatus)}
            </span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-md ${getPaymentStatusStyles(paymentStatus)}`}>
              {getPaymentStatusText(paymentStatus)}
            </span>
            <div className="text-right pl-2 border-l border-border/40">
              <span className="block text-[10px] uppercase font-bold text-muted-foreground">{t('cart.total')}</span>
              <span className="font-bold text-base sm:text-lg text-foreground">{formatCurrency(totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-3.5 sm:p-5 space-y-4">
          {/* Order Items */}
          <div className="space-y-2.5">
            {order.order_items?.map(item => (
              <div key={item.id} className="flex items-center gap-3 sm:gap-4 p-2.5 rounded-xl bg-background/30 border border-white/40 dark:border-white/5 backdrop-blur-sm">
                {getOrderItemImage(item) ? (
                  <img
                    src={getOrderItemImage(item)}
                    alt={getOrderItemName(item)}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-white/50 dark:border-white/10 shadow-xs shrink-0"
                  />
                ) : (
                  <div aria-hidden="true" className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-xl border bg-muted text-[10px] text-muted-foreground">
                    SP
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-xs sm:text-sm text-foreground line-clamp-2">{getOrderItemName(item)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{t('checkout.qty')}: <strong className="text-foreground">{item.quantity}</strong></span>
                    <span>•</span>
                    <span>{t('orders.price')}: <strong className="text-foreground">{formatCurrency(item.price_at_purchase)}</strong></span>
                  </div>
                  {canRequestReview && (
                    <button
                      type="button"
                      onClick={() => handleNavigateToReview(item.product?.slug || item.product_id)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1 text-xs font-semibold transition-colors"
                    >
                      {t('orders.review_product', 'Viết đánh giá')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Shipping Info */}
          {order.shipping_provider && order.shipping_code && (
            <div className="rounded-2xl border border-white/60 bg-background/40 backdrop-blur-md p-3 sm:p-4 dark:border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <TruckIcon className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs font-bold uppercase text-muted-foreground">{t('orders.shipping_info')}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-foreground">
                    {t('orders.carrier')}: <span className="uppercase font-bold">{order.shipping_provider}</span> — {t('orders.tracking_code')}: <span className="font-mono font-bold text-primary">{order.shipping_code}</span>
                  </p>
                  {order.ghtk_status_text && <p className="text-xs font-semibold text-sky-600 dark:text-sky-400">{order.ghtk_status_text}</p>}
                </div>
                {trackingUrl && (
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl bg-primary/10 hover:bg-primary/20 text-primary text-xs sm:text-sm font-semibold px-3 py-1.5 transition-colors btn-press"
                  >
                    <TruckIcon className="w-4 h-4" />
                    <span>{t('orders.track')}</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Price Breakdown & Delivery Address */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {/* Delivery Details */}
            <div className="rounded-2xl border border-white/50 bg-background/30 backdrop-blur-md p-3 sm:p-4 space-y-2 dark:border-white/10 text-xs sm:text-sm">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('orders.shipping_address')}</p>
                <p className="font-semibold text-foreground mt-0.5">{formatShippingAddress(order)}</p>
                {order.notes && <p className="text-xs text-muted-foreground mt-1 italic">{t('checkout.notes')}: {order.notes}</p>}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('orders.payment_method')}</p>
                  <p className="font-semibold text-foreground mt-0.5">{getPaymentMethodText(paymentMethod)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('orders.payment_status')}</p>
                  <p className="font-semibold text-foreground mt-0.5">{getPaymentStatusText(paymentStatus)}</p>
                </div>
              </div>
            </div>

            {/* Price Calculations */}
            <div className="rounded-2xl border border-white/50 bg-background/30 backdrop-blur-md p-3 sm:p-4 space-y-1.5 dark:border-white/10 text-xs sm:text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t('cart.subtotal')}</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
              {discount > 0 && <div className="flex justify-between text-emerald-600 dark:text-emerald-400"><span className="text-muted-foreground">{t('cart.discount')}</span><span>-{formatCurrency(discount)}</span></div>}
              {taxAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t('checkout.tax', 'Thuế')}</span><span className="font-medium">{formatCurrency(taxAmount)}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">{t('cart.shipping')}</span><span className="font-medium">{formatCurrency(shipping)}</span></div>
              <div className="flex justify-between font-bold pt-2 border-t border-border/40 text-sm sm:text-base text-foreground">
                <span>{t('cart.total')}</span>
                <span className="text-primary">{formatCurrency(totalAmount)}</span>
              </div>
              {refundedAmount > 0 && (
                <div className="flex justify-between text-orange-600 dark:text-orange-400 font-semibold pt-1 border-t border-border/40 text-xs">
                  <span>{t('orders.refunded_amount')}</span>
                  <span>-{formatCurrency(refundedAmount)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-border/40">
            <button
              type="button"
              onClick={handleDownloadInvoice}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-white/60 bg-background/40 hover:bg-background/70 backdrop-blur-xl px-4 py-2 text-xs sm:text-sm font-semibold text-foreground transition-all btn-press dark:border-white/10"
            >
              <DocumentDuplicateIcon className="w-4 h-4" />
              <span>{t('orders.download_invoice')}</span>
            </button>
            <button
              type="button"
              onClick={() => void handleToggleExpand()}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border-0 bg-primary/10 hover:bg-primary/20 text-primary backdrop-blur-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all btn-press"
            >
              <span>{isExpanded ? t('orders.hide_details') : t('orders.view_details')}</span>
              <ChevronDownIcon className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Expanded Lifecycle & Tracking History */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[1600px]' : 'max-h-0'}`}>
          <div className="bg-muted/15 p-3.5 sm:p-5 border-t border-border/40 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {/* Timeline */}
              <div className="rounded-2xl border border-white/60 bg-card/90 p-3.5 sm:p-4 backdrop-blur-xl dark:border-white/10">
                <h5 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-muted-foreground mb-3">{t('orders.lifecycle_timeline')}</h5>
                {isLoadingLifecycle ? (
                  <div className="flex justify-center py-4"><Spinner className="w-5 h-5 text-primary" /></div>
                ) : lifecycleError ? (
                  <p className="text-xs text-rose-600">{lifecycleError}</p>
                ) : statusHistory.length === 0 ? (
                  <div className="text-xs space-y-1">
                    <p className="text-muted-foreground">{t('orders.timeline_not_available')}</p>
                    <p className="font-semibold">{getStatusText(order.status)}</p>
                    <p className="text-muted-foreground">{formatDateTime(order.created_at)}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {statusHistory.map((entry) => (
                      <div key={entry.id} className="border-l-2 border-primary/40 pl-3 py-0.5">
                        <p className="font-semibold text-xs sm:text-sm">{getFulfillmentStatusText(entry.to_status)}</p>
                        <p className="text-[11px] text-muted-foreground">{formatDateTime(entry.created_at)}</p>
                        {entry.note && <p className="text-xs text-muted-foreground mt-0.5">{entry.note}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Logs */}
              <div className="rounded-2xl border border-white/60 bg-card/90 p-3.5 sm:p-4 backdrop-blur-xl dark:border-white/10">
                <h5 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-muted-foreground mb-3">{t('orders.payment_logs')}</h5>
                {isLoadingLifecycle ? (
                  <div className="flex justify-center py-4"><Spinner className="w-5 h-5 text-primary" /></div>
                ) : paymentLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('orders.payment_logs_empty')}</p>
                ) : (
                  <div className="space-y-3">
                    {paymentLogs.map((payment) => (
                      <div key={payment.id} className="border-l-2 border-emerald-500/40 pl-3 py-0.5">
                        <p className="font-semibold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">{formatCurrency(payment.amount)}</p>
                        <p className="text-[11px] text-muted-foreground">{getPaymentMethodText(payment.method)} — {getPaymentStatusText(payment.status)}</p>
                        <p className="text-[11px] text-muted-foreground">{formatDateTime(payment.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {/* Refund Logs */}
              <div className="rounded-2xl border border-white/60 bg-card/90 p-3.5 sm:p-4 backdrop-blur-xl dark:border-white/10">
                <h5 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-muted-foreground mb-3">{t('orders.refund_logs')}</h5>
                {isLoadingLifecycle ? (
                  <div className="flex justify-center py-4"><Spinner className="w-5 h-5 text-primary" /></div>
                ) : resolvedRefundLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('orders.refund_logs_empty')}</p>
                ) : (
                  <div className="space-y-3">
                    {resolvedRefundLogs.map((refund) => (
                      <div key={refund.id} className="border-l-2 border-orange-500/40 pl-3 py-0.5">
                        <p className="font-semibold text-xs sm:text-sm text-orange-600 dark:text-orange-400">{formatCurrency(refund.amount)}</p>
                        <p className="text-xs text-muted-foreground">{refund.reason || t('orders.refund_no_reason')}</p>
                        <p className="text-[11px] text-muted-foreground">{formatDateTime(refund.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Shipping Timeline */}
              <div className="rounded-2xl border border-white/60 bg-card/90 p-3.5 sm:p-4 backdrop-blur-xl dark:border-white/10">
                <h5 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-muted-foreground mb-3">{t('orders.shipping_timeline')}</h5>
                {order.shipping_provider?.toLowerCase() !== 'ghtk' ? (
                  <p className="text-xs text-muted-foreground">{t('orders.tracking_not_supported')}</p>
                ) : isLoadingTracking ? (
                  <div className="flex justify-center py-4"><Spinner className="w-5 h-5 text-primary" /></div>
                ) : trackingHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('orders.tracking_not_available')}</p>
                ) : (
                  <div className="relative border-l-2 border-primary/30 ml-2 pl-4 space-y-4">
                    {trackingHistory.map((event, i) => (
                      <div key={`${event.timestamp}-${i}`} className="relative text-xs">
                        <div className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ring-2 ring-card ${i === 0 ? 'bg-primary' : 'bg-muted-foreground'}`}></div>
                        <p className="text-[11px] text-muted-foreground">{event.timestamp}</p>
                        <p className={`font-semibold ${i === 0 ? 'text-primary' : 'text-foreground'}`}>{event.status}</p>
                        <p className="text-muted-foreground">{event.location}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Page Top Header */}
        <AnimatedSection>
          <div className="rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-3.5 sm:p-5 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4">
              <BackIconButton onClick={onBack} label={t('common.back')} />
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-inner">
                <ReceiptIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground font-heading tracking-tight">{t('orders.title')}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1">{t('orders.subtitle')}</p>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* Orders List */}
        <div className="space-y-4">
          {orders.length > 0 ? (
            orders.map((order, index) => (
              <AnimatedSection key={order.id} stagger={index * 50}>
                <OrderCard order={order} />
              </AnimatedSection>
            ))
          ) : (
            <AnimatedSection>
              <div className="text-center py-16 rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-6 mx-1 sm:mx-0">
                <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-inner mb-4">
                  <ReceiptIcon className="w-8 h-8" />
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-foreground">{t('orders.empty')}</h2>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">{t('orders.empty_desc')}</p>
                <button
                  onClick={() => onNavigate({ page: 'products' })}
                  className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border-0 bg-primary hover:bg-primary/90 text-primary-foreground backdrop-blur-xl px-6 py-2.5 text-sm font-semibold shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 btn-press"
                >
                  {t('orders.shop_now')}
                </button>
              </div>
            </AnimatedSection>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderHistoryPage;
