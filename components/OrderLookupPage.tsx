import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderFulfillmentStatus, OrderPaymentMethod, OrderPaymentStatus, ProductOrder, ProductOrderItem } from '../types';
import * as api from '../services/api';
import Spinner from './Spinner';
import { ReceiptIcon, SearchIcon, ShoppingBagIcon, TruckIcon } from './icons';
import { getOrderItemDisplayName } from '../src/orderItemPresentation';

interface OrderLookupPageProps {
  onBackToHome: () => void;
  onGoToProducts: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

const normalizePhone = (value: string) => value.replace(/\D/g, '');

const maskPhone = (value: string) => {
  const digits = normalizePhone(value);
  if (digits.length <= 6) return value;
  return `${digits.slice(0, 3)}••••${digits.slice(-3)}`;
};

const getOrderFulfillmentStatus = (order: ProductOrder): OrderFulfillmentStatus => {
  if (order.fulfillment_status) return order.fulfillment_status;
  if (order.status === 'processing') return 'processing';
  if (order.status === 'shipped') return 'shipped';
  if (order.status === 'completed') return 'completed';
  if (order.status === 'cancelled') return 'cancelled';
  return 'pending';
};

const getOrderPaymentStatus = (order: ProductOrder): OrderPaymentStatus => {
  if (order.payment_status) return order.payment_status;
  if (order.status === 'completed') return 'paid';
  if (order.status === 'refunded') return 'refunded';
  return 'unpaid';
};

const getOrderPaymentMethod = (order: ProductOrder): OrderPaymentMethod =>
  order.payment_method === 'bank_transfer' ? 'bank_transfer' : 'cod';

const OrderLookupPage: React.FC<OrderLookupPageProps> = ({ onBackToHome, onGoToProducts }) => {
  const { t, i18n } = useTranslation();
  const [orderCode, setOrderCode] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const dateLocale = useMemo(() => {
    if (i18n.language === 'en') return 'en-US';
    if (i18n.language === 'ru') return 'ru-RU';
    if (i18n.language === 'cn') return 'zh-CN';
    return 'vi-VN';
  }, [i18n.language]);

  const getLocalizedProductName = (item: ProductOrderItem) => {
    const product = item.product;
    const lang = i18n.language;
    const localizedName = lang !== 'vi' && product?.[`name_${lang}`]
      ? product[`name_${lang}`]
      : product?.name;
    return getOrderItemDisplayName({ ...item, product: { ...product, name: localizedName || product?.name } });
  };

  const getOrderItemImage = (item: ProductOrderItem): string =>
    String(item.product?.main_image_url || item.resolved_product_image_path || item.product_image_path || '').trim();

  const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(dateLocale);
  };

  const getFulfillmentStatusText = (status: OrderFulfillmentStatus) => {
    if (status === 'processing') return t('orders.status_processing');
    if (status === 'shipped') return t('orders.status_shipped');
    if (status === 'completed') return t('orders.status_completed');
    if (status === 'cancelled') return t('orders.status_cancelled');
    return t('orders.status_pending');
  };

  const getPaymentStatusText = (status: OrderPaymentStatus) => {
    if (status === 'paid') return t('orders.payment_status_paid');
    if (status === 'failed') return t('orders.payment_status_failed');
    if (status === 'refunded') return t('orders.payment_status_refunded');
    return t('orders.payment_status_unpaid');
  };

  const getPaymentMethodText = (method: OrderPaymentMethod) => {
    if (method === 'bank_transfer') return t('orders.payment_method_bank_transfer');
    return t('orders.payment_method_cod');
  };

  const resetOtpState = () => {
    setOtp('');
    setOtpRequested(false);
    setNotice(null);
    setError(null);
    setOrders([]);
    setHasSearched(false);
  };

  const requestOtp = async () => {
    const result = await api.requestGuestProductOrderOtp(orderCode.trim(), phone);
    setOtpRequested(true);
    setOtp('');
    setOrders([]);
    setHasSearched(false);
    setNotice(t(result.channel === 'email' ? 'orders.lookup_otp_sent_email' : 'orders.lookup_otp_sent'));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const digits = normalizePhone(phone);
    const normalizedOrderCode = orderCode.trim();
    if (normalizedOrderCode.length < 5 || digits.length < 8) {
      setError(t('orders.lookup_invalid_credentials'));
      setOrders([]);
      setHasSearched(false);
      return;
    }

    if (otpRequested && !/^\d{6}$/.test(otp.trim())) {
      setError(t('orders.lookup_invalid_otp'));
      setOrders([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setNotice(null);
    try {
      if (!otpRequested) {
        await requestOtp();
        return;
      }
      setHasSearched(true);
      const result = await api.lookupGuestProductOrder(normalizedOrderCode, phone, otp);
      setOrders(result);
    } catch (err: any) {
      console.error('Failed to lookup guest orders:', err);
      setOrders([]);
      setError(err?.message || t('orders.lookup_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setIsLoading(true);
    setError(null);
    setNotice(null);
    try {
      await requestOtp();
    } catch (err: any) {
      setError(err?.message || t('orders.lookup_otp_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-background text-foreground transition-colors duration-300">
      <div className="container mx-auto px-4 py-14 md:px-6 md:py-20">
        <div className="mx-auto max-w-6xl">
          <section className="overflow-hidden rounded-[36px] border border-border bg-card shadow-[0_34px_90px_-62px_rgba(20,28,38,0.4)]">
            <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="bg-primary/8 p-6 md:p-10 lg:p-12">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-primary">
                  {t('orders.lookup_kicker')}
                </p>
                <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-foreground md:text-6xl">
                  {t('orders.lookup_title')}
                </h1>
                <p className="mt-5 max-w-xl text-base leading-8 text-muted-foreground">
                  {t('orders.lookup_subtitle')}
                </p>
                <div className="mt-8 rounded-[26px] border border-border/80 bg-background/80 p-5 text-sm leading-7 text-muted-foreground">
                  <div className="flex items-start gap-3">
                    <ReceiptIcon className="mt-1 h-5 w-5 shrink-0 text-primary" />
                    <p>{t('orders.lookup_privacy_note')}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-10 lg:p-12">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <label className="block text-sm font-bold text-foreground" htmlFor="order-lookup-code">
                    {t('orders.lookup_order_code_label')}
                  </label>
                  <div className="relative">
                    <ReceiptIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="order-lookup-code"
                      type="text"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      value={orderCode}
                      onChange={(event) => {
                        setOrderCode(event.target.value);
                        resetOtpState();
                      }}
                      placeholder={t('orders.lookup_order_code_placeholder')}
                      className="h-14 w-full rounded-full border border-border bg-background pl-12 pr-5 text-base font-semibold uppercase text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    />
                  </div>
                  <label className="block text-sm font-bold text-foreground" htmlFor="order-lookup-phone">
                    {t('orders.lookup_phone_label')}
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="relative flex-1">
                      <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <input
                        id="order-lookup-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(event) => {
                          setPhone(event.target.value);
                          resetOtpState();
                        }}
                        placeholder={t('orders.lookup_phone_placeholder')}
                        className="h-14 w-full rounded-full border border-border bg-background pl-12 pr-5 text-base font-semibold text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </div>
                  </div>
                  {otpRequested ? (
                    <div className="space-y-3 rounded-[24px] border border-primary/20 bg-primary/5 p-4">
                      <label className="block text-sm font-bold text-foreground" htmlFor="order-lookup-otp">
                        {t('orders.lookup_otp_label')}
                      </label>
                      <input
                        id="order-lookup-otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={otp}
                        onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder={t('orders.lookup_otp_placeholder')}
                        className="h-14 w-full rounded-full border border-border bg-background px-5 text-center text-xl font-bold tracking-[0.28em] text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={isLoading}
                        className="text-sm font-bold text-primary underline-offset-4 hover:underline disabled:opacity-60"
                      >
                        {t('orders.lookup_otp_resend')}
                      </button>
                    </div>
                  ) : null}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary px-7 font-bold text-primary-foreground transition-all hover:-translate-y-0.5 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 btn-press sm:w-auto"
                  >
                    {isLoading ? <Spinner className="h-5 w-5 animate-spin" /> : <SearchIcon className="h-5 w-5" />}
                    {isLoading
                      ? t('orders.lookup_loading')
                      : otpRequested
                        ? t('orders.lookup_otp_verify')
                        : t('orders.lookup_otp_request')}
                  </button>
                </form>

                {notice ? (
                  <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                    {notice}
                  </div>
                ) : null}

                {error ? (
                  <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
                    {error}
                  </div>
                ) : null}

                {hasSearched && !isLoading && !error && orders.length === 0 ? (
                  <div className="mt-8 rounded-[28px] border border-border bg-background p-7 text-center">
                    <ReceiptIcon className="mx-auto h-10 w-10 text-muted-foreground" />
                    <h2 className="mt-4 text-2xl font-black tracking-[-0.03em] text-foreground">{t('orders.lookup_empty')}</h2>
                    <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground">{t('orders.lookup_empty_desc')}</p>
                    <button
                      type="button"
                      onClick={onGoToProducts}
                      className="mt-6 inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-bold text-foreground transition hover:border-primary/40 hover:text-primary"
                    >
                      <ShoppingBagIcon className="h-5 w-5" />
                      {t('orders.shop_now')}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {orders.length > 0 ? (
            <section className="mt-8 space-y-5">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">
                    {t('orders.lookup_found_count', { count: orders.length })}
                  </p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-foreground md:text-4xl">
                    {t('orders.lookup_results_title')}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onBackToHome}
                  className="inline-flex items-center justify-center rounded-full border border-border bg-card px-5 py-3 text-sm font-bold text-foreground transition hover:border-primary/40 hover:text-primary"
                >
                  {t('checkout.back_home')}
                </button>
              </div>

              {orders.map((order) => {
                const fulfillmentStatus = getOrderFulfillmentStatus(order);
                const paymentStatus = getOrderPaymentStatus(order);
                const paymentMethod = getOrderPaymentMethod(order);
                const total = Number(order.grand_total || order.total_price || 0);
                const region = [order.shipping_ward, order.shipping_district, order.shipping_province].filter(Boolean).join(', ');

                return (
                  <article key={order.id} className="overflow-hidden rounded-[30px] border border-border bg-card shadow-[0_24px_70px_-55px_rgba(20,28,38,0.32)]">
                    <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="p-5 md:p-7">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                              {t('orders.order_code')}
                            </p>
                            <h3 className="mt-2 text-2xl font-black tracking-[-0.03em] text-foreground">
                              {order.order_code || order.id}
                            </h3>
                            <p className="mt-2 text-sm text-muted-foreground">{formatDateTime(order.created_at)}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-black text-primary">
                              {getFulfillmentStatusText(fulfillmentStatus)}
                            </span>
                            <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-black text-muted-foreground">
                              {getPaymentStatusText(paymentStatus)}
                            </span>
                          </div>
                        </div>

                        <div className="mt-6 space-y-3">
                          {(order.order_items || []).map((item) => {
                            const itemTotal = Number(item.price_at_purchase || 0) * Number(item.quantity || 0);
                            return (
                              <div key={item.id} className="flex gap-3 rounded-2xl border border-border bg-background p-3">
                                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-muted">
                                  {getOrderItemImage(item) ? (
                                    <img
                                      src={getOrderItemImage(item)}
                                      alt={getLocalizedProductName(item)}
                                      loading="lazy"
                                      decoding="async"
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                      <ShoppingBagIcon className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="line-clamp-2 text-sm font-black text-foreground">{getLocalizedProductName(item)}</p>
                                  <p className="mt-1 text-xs font-semibold text-muted-foreground">
                                    {t('checkout.qty')}: {item.quantity} · {formatCurrency(Number(item.price_at_purchase || 0))}
                                  </p>
                                </div>
                                <p className="shrink-0 text-sm font-black text-foreground">{formatCurrency(itemTotal)}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <aside className="border-t border-border bg-background/70 p-5 md:p-7 lg:border-l lg:border-t-0">
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{t('orders.lookup_order_total')}</p>
                            <p className="mt-2 text-3xl font-black text-primary">{formatCurrency(total)}</p>
                          </div>
                          <div className="rounded-2xl border border-border bg-card p-4 text-sm leading-7">
                            <p><span className="font-bold">{t('orders.lookup_customer')}:</span> {order.customer_name}</p>
                            <p><span className="font-bold">{t('checkout.phone')}:</span> {maskPhone(order.customer_phone)}</p>
                            <p><span className="font-bold">{t('orders.payment_method')}:</span> {getPaymentMethodText(paymentMethod)}</p>
                            {region ? <p><span className="font-bold">{t('orders.lookup_shipping_region')}:</span> {region}</p> : null}
                          </div>
                          {(order.shipping_provider || order.shipping_code || order.ghtk_status_text || order.estimated_delivery_time) ? (
                            <div className="rounded-2xl border border-border bg-card p-4">
                              <div className="flex items-center gap-2 text-sm font-black text-foreground">
                                <TruckIcon className="h-5 w-5 text-primary" />
                                {t('orders.shipping_info')}
                              </div>
                              <div className="mt-3 space-y-1 text-sm leading-6 text-muted-foreground">
                                {order.shipping_provider ? <p>{t('orders.carrier')}: {order.shipping_provider.toUpperCase()}</p> : null}
                                {order.shipping_code ? <p>{t('orders.tracking_code')}: {order.shipping_code}</p> : null}
                                {order.ghtk_status_text ? <p>{order.ghtk_status_text}</p> : null}
                                {order.estimated_delivery_time ? <p>{order.estimated_delivery_time}</p> : null}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </aside>
                    </div>
                  </article>
                );
              })}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default OrderLookupPage;
