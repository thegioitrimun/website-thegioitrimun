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
      return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
    case 'shipped':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
    case 'cancelled':
      return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
    case 'processing':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300';
    case 'pending':
    default:
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
  }
};

const getPaymentStatusStyles = (status: OrderPaymentStatus) => {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
    case 'failed':
      return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
    case 'refunded':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300';
    case 'unpaid':
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
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
      <div className="bg-card text-card-foreground rounded-xl shadow-lg border border-border transition-all-smooth overflow-hidden">
        <div className="p-6 bg-muted/30 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <div>
            <p className="text-sm text-muted-foreground">{t('orders.order_code')}</p>
            <p className="font-bold text-lg font-mono text-primary">{order.order_code}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('orders.order_date')}</p>
            <p className="font-semibold">{new Date(order.created_at).toLocaleDateString(getDateLocale())}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('cart.total')}</p>
            <p className="font-bold text-lg">{formatCurrency(totalAmount)}</p>
            {taxAmount > 0 && <p className="text-xs text-muted-foreground">{t('orders.tax', 'Thuế')}: {formatCurrency(taxAmount)}</p>}
          </div>
          <div className="flex flex-wrap sm:flex-col gap-2 sm:items-end">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getFulfillmentStatusStyles(fulfillmentStatus)}`}>
              {getFulfillmentStatusText(fulfillmentStatus)}
            </span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getPaymentStatusStyles(paymentStatus)}`}>
              {getPaymentStatusText(paymentStatus)}
            </span>
          </div>
        </div>
        <div className="p-6">
          <h4 className="font-semibold mb-3">{t('orders.products')}</h4>
          <div className="space-y-3">
            {order.order_items?.map(item => (
              <div key={item.id} className="flex items-center gap-4">
                {getOrderItemImage(item) ? (
                  <img src={getOrderItemImage(item)} alt={getOrderItemName(item)} className="w-16 h-16 rounded-md object-cover border" />
                ) : (
                  <div aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">80 × 80</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{getOrderItemName(item)}</p>
                  <p className="text-sm text-muted-foreground">{t('checkout.qty')}: {item.quantity}</p>
                  <p className="text-sm text-muted-foreground">{t('orders.price')}: {formatCurrency(item.price_at_purchase)}</p>
                  {canRequestReview && (
                    <button
                      type="button"
                      onClick={() => handleNavigateToReview(item.product?.slug || item.product_id)}
                      className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                    >
                      {t('orders.review_product', 'Viết đánh giá')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {order.shipping_provider && order.shipping_code && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold mb-1">{t('orders.shipping_info')}</h4>
                  <p className="text-sm">{t('orders.carrier')}: <span className="uppercase font-semibold">{order.shipping_provider}</span></p>
                  <p className="text-sm">{t('orders.tracking_code')}: <span className="font-semibold text-primary">{order.shipping_code}</span></p>
                  {order.ghtk_status_text && <p className="text-sm font-semibold text-blue-600">{order.ghtk_status_text}</p>}
                </div>
                {trackingUrl && (
                  <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-primary/10 text-primary text-sm font-bold py-2 px-3 rounded-lg hover:bg-primary/20 transition-colors btn-press">
                    <TruckIcon className="w-5 h-5" />
                    <span>{t('orders.track')}</span>
                  </a>
                )}
              </div>
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-border space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{t('cart.subtotal')}</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t('cart.discount')}</span><span>- {formatCurrency(discount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t('checkout.tax', 'Thuế')}</span><span>{formatCurrency(taxAmount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t('cart.shipping')}</span><span>{formatCurrency(shipping)}</span></div>
            <div className="flex justify-between font-bold pt-1 border-t border-border"><span>{t('cart.total')}</span><span>{formatCurrency(totalAmount)}</span></div>
            {refundedAmount > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>{t('orders.refunded_amount')}</span>
                <span>- {formatCurrency(refundedAmount)}</span>
              </div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">{t('orders.payment_method')}</p>
              <p className="font-semibold">{getPaymentMethodText(paymentMethod)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('orders.payment_status')}</p>
              <p className="font-semibold">{getPaymentStatusText(paymentStatus)}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-muted-foreground">{t('orders.shipping_address')}</p>
              <p className="font-semibold">{formatShippingAddress(order)}</p>
              {order.notes && <p className="text-xs text-muted-foreground mt-1">{t('checkout.notes')}: {order.notes}</p>}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 justify-end">
            <button
              onClick={handleDownloadInvoice}
              className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground text-sm font-bold py-2 px-3 rounded-lg hover:bg-secondary/90 transition-colors btn-press"
            >
              <DocumentDuplicateIcon className="w-4 h-4" />
              <span>{t('orders.download_invoice')}</span>
            </button>
            <button
              onClick={() => void handleToggleExpand()}
              className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-bold py-2 px-3 rounded-lg hover:bg-primary/20 transition-colors btn-press"
            >
              <span>{isExpanded ? t('orders.hide_details') : t('orders.view_details')}</span>
              <ChevronDownIcon className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[1400px]' : 'max-h-0'}`}>
          <div className="bg-muted/30 p-4 border-t border-border space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-card rounded-lg border border-border p-4">
                <h5 className="font-semibold mb-3">{t('orders.lifecycle_timeline')}</h5>
                {isLoadingLifecycle ? (
                  <div className="flex justify-center py-4"><Spinner /></div>
                ) : lifecycleError ? (
                  <p className="text-sm text-red-600">{lifecycleError}</p>
                ) : statusHistory.length === 0 ? (
                  <div className="text-sm space-y-1">
                    <p className="text-muted-foreground">{t('orders.timeline_not_available')}</p>
                    <p className="font-semibold">{getStatusText(order.status)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(order.created_at)}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {statusHistory.map((entry) => (
                      <div key={entry.id} className="border-l-2 border-primary/30 pl-3">
                        <p className="font-semibold">{getFulfillmentStatusText(entry.to_status)}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(entry.created_at)}</p>
                        {entry.note && <p className="text-xs text-muted-foreground mt-1">{entry.note}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-card rounded-lg border border-border p-4">
                <h5 className="font-semibold mb-3">{t('orders.payment_logs')}</h5>
                {isLoadingLifecycle ? (
                  <div className="flex justify-center py-4"><Spinner /></div>
                ) : paymentLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('orders.payment_logs_empty')}</p>
                ) : (
                  <div className="space-y-3">
                    {paymentLogs.map((payment) => (
                      <div key={payment.id} className="border-l-2 border-emerald-500/30 pl-3">
                        <p className="font-semibold">{formatCurrency(payment.amount)}</p>
                        <p className="text-xs text-muted-foreground">{getPaymentMethodText(payment.method)} - {getPaymentStatusText(payment.status)}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(payment.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-card rounded-lg border border-border p-4">
                <h5 className="font-semibold mb-3">{t('orders.refund_logs')}</h5>
                {isLoadingLifecycle ? (
                  <div className="flex justify-center py-4"><Spinner /></div>
                ) : resolvedRefundLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('orders.refund_logs_empty')}</p>
                ) : (
                  <div className="space-y-3">
                    {resolvedRefundLogs.map((refund) => (
                      <div key={refund.id} className="border-l-2 border-orange-500/30 pl-3">
                        <p className="font-semibold">{formatCurrency(refund.amount)}</p>
                        <p className="text-xs text-muted-foreground">{refund.reason || t('orders.refund_no_reason')}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(refund.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-card rounded-lg border border-border p-4">
                <h5 className="font-semibold mb-3">{t('orders.shipping_timeline')}</h5>
                {order.shipping_provider?.toLowerCase() !== 'ghtk' ? (
                  <p className="text-sm text-muted-foreground">{t('orders.tracking_not_supported')}</p>
                ) : isLoadingTracking ? (
                  <div className="flex justify-center py-4"><Spinner /></div>
                ) : trackingHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('orders.tracking_not_available')}</p>
                ) : (
                  <div className="relative border-l-2 border-primary/20 ml-4 pl-8 space-y-6">
                    {trackingHistory.map((event, i) => (
                      <div key={`${event.timestamp}-${i}`} className="relative">
                        <div className={`absolute -left-[38px] top-1 w-4 h-4 rounded-full border-4 border-card ${i === 0 ? 'bg-primary' : 'bg-muted-foreground'}`}></div>
                        <p className="text-xs text-muted-foreground">{event.timestamp}</p>
                        <p className={`font-semibold ${i === 0 ? 'text-primary' : 'text-foreground'}`}>{event.status}</p>
                        <p className="text-sm text-muted-foreground">{event.location}</p>
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
    <div className="bg-background text-foreground transition-colors duration-300 animate-scale-in">
      <div className="container mx-auto px-6 py-12">
        <AnimatedSection className="mb-12">
          <BackIconButton onClick={onBack} label={t('common.back')} className="mb-4" />
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <ReceiptIcon className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground font-heading">{t('orders.title')}</h1>
              <p className="text-lg text-muted-foreground mt-1">{t('orders.subtitle')}</p>
            </div>
          </div>
        </AnimatedSection>

        <div className="space-y-8">
          {orders.length > 0 ? (
            orders.map((order, index) => (
              <AnimatedSection key={order.id} stagger={index * 100}>
                <OrderCard order={order} />
              </AnimatedSection>
            ))
          ) : (
            <AnimatedSection>
              <div className="text-center py-16 bg-card rounded-xl border border-border">
                <ReceiptIcon className="w-16 h-16 mx-auto text-muted-foreground/50" />
                <h2 className="mt-4 text-xl font-semibold text-muted-foreground">{t('orders.empty')}</h2>
                <p className="mt-2 text-muted-foreground">{t('orders.empty_desc')}</p>
                <button onClick={() => onNavigate({ page: 'products' })} className="mt-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-6 rounded-full transition-all-smooth text-base shadow-md hover:shadow-lg transform hover:-translate-y-1 btn-press">
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
