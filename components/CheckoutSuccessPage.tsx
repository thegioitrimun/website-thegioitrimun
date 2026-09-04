import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ProductOrder } from '../types';
import { CheckIcon, ReceiptIcon, ShoppingBagIcon } from './icons';

interface CheckoutSuccessPageProps {
  order: ProductOrder | null;
  onContinueShopping: () => void;
  onBackToHome: () => void;
  onLookupOrders: () => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const CheckoutSuccessPage: React.FC<CheckoutSuccessPageProps> = ({ order, onContinueShopping, onBackToHome, onLookupOrders }) => {
  const { t } = useTranslation();
  const orderTotal = order?.grand_total ?? order?.total_price ?? 0;
  const paymentMethod = order?.payment_method === 'bank_transfer'
    ? t('checkout.sepay_transfer', 'SePay – chuyển khoản QR tự động')
    : t('checkout.cod');
  const shippingAddress = order
    ? [order.shipping_street, order.shipping_ward, order.shipping_district, order.shipping_province]
        .filter(Boolean)
        .join(', ')
    : '';

  return (
    <div className="bg-background text-foreground transition-colors duration-300">
      <div className="container mx-auto px-6 py-16 md:py-24">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-[32px] border border-border bg-card shadow-[0_30px_80px_-55px_rgba(20,28,38,0.35)]">
          <div className="bg-primary/8 px-6 py-10 text-center md:px-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <CheckIcon className="h-9 w-9" />
            </div>
            <p className="mt-6 text-xs font-black uppercase tracking-[0.28em] text-primary">
              {t('checkout.success_kicker')}
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-foreground md:text-5xl">
              {order ? t('checkout.success_title') : t('checkout.success_generic_title')}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
              {order ? t('checkout.success_desc') : t('checkout.success_generic_desc')}
            </p>
          </div>

          {order ? (
            <div className="space-y-4 px-6 py-8 md:px-10">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-background p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{t('orders.order_code')}</p>
                  <p className="mt-2 text-xl font-black text-foreground">{order.order_code || order.id}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{t('cart.total')}</p>
                  <p className="mt-2 text-xl font-black text-primary">{formatCurrency(orderTotal)}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{t('checkout.customer_snapshot')}</p>
                <div className="mt-3 space-y-2 text-sm leading-6 text-foreground">
                  <p><span className="font-bold">{t('checkout.full_name')}:</span> {order.customer_name}</p>
                  <p><span className="font-bold">{t('checkout.phone')}:</span> {order.customer_phone}</p>
                  <p><span className="font-bold">{t('orders.payment_method')}:</span> {paymentMethod}</p>
                  {shippingAddress ? <p><span className="font-bold">{t('orders.shipping_address')}:</span> {shippingAddress}</p> : null}
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-border px-6 py-6 md:flex-row md:px-10">
            <button
              type="button"
              onClick={onContinueShopping}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground transition-all hover:-translate-y-0.5 hover:bg-primary/90 btn-press"
            >
              <ShoppingBagIcon className="h-5 w-5" />
              {t('checkout.continue_shopping')}
            </button>
            <button
              type="button"
              onClick={onLookupOrders}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background px-6 py-3 font-bold text-foreground transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary btn-press"
            >
              <ReceiptIcon className="h-5 w-5" />
              {t('orders.lookup_short_cta')}
            </button>
            <button
              type="button"
              onClick={onBackToHome}
              className="inline-flex flex-1 items-center justify-center rounded-full border border-border bg-background px-6 py-3 font-bold text-foreground transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary btn-press"
            >
              {t('checkout.back_home')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutSuccessPage;
