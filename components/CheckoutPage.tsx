import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useCart } from '../contexts/CartContext';
import type { UserData, ShippingAddress, PaymentSettings, ProductOrder, CheckoutPricingQuote, OrderPaymentMethod } from '../types';
import * as api from '../services/api';
import { useToast } from '../hooks/useToast';
import Spinner from './Spinner';
import SepayPaymentModal from './SepayPaymentModal';
import { useDebounce } from '../hooks/useDebounce';
import BackIconButton from './BackIconButton';
import VietnamAddressFields from './VietnamAddressFields';
import {
  findProvinceByName,
  findWardByName,
  isVietnamProvince2025,
  loadVietnamAdministrativeUnits2025,
} from '../src/vietnamAdministrativeUnits';

interface CheckoutPageProps {
  currentUser: UserData | null;
  onCheckoutSuccess: (createdOrder?: ProductOrder | null) => Promise<void> | void;
  onBack: () => void;
  paymentSettings: PaymentSettings | null;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const SPX_FALLBACK_FEE = 30000;

const CheckoutPage: React.FC<CheckoutPageProps> = ({ currentUser, onCheckoutSuccess, onBack, paymentSettings }) => {
  const { t, i18n } = useTranslation();
  const { cartItems, subtotal, discountAmount, total, appliedDiscount } = useCart();
  const [shippingDetails, setShippingDetails] = useState<ShippingAddress>({
    fullName: '',
    phone: '',
    email: '',
    street: '',
    ward: '',
    district: '',
    province: '',
    notes: ''
  });
  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod>('cod');
  const [shippingMethod, setShippingMethod] = useState('spx');
  const [isLoading, setIsLoading] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<ProductOrder | null>(null);
  const [isSepayEnabled, setIsSepayEnabled] = useState(false);
  const [isSepayConfigLoading, setIsSepayConfigLoading] = useState(true);
  const { addToast } = useToast();

  const [shippingFee, setShippingFee] = useState(0);
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [isCalculatingFee, setIsCalculatingFee] = useState(false);
  const [isGhtkAvailable, setIsGhtkAvailable] = useState(true);
  const [hasNotifiedGhtkFallback, setHasNotifiedGhtkFallback] = useState(false);
  const [pricingQuote, setPricingQuote] = useState<CheckoutPricingQuote | null>(null);
  const [isCalculatingTotals, setIsCalculatingTotals] = useState(false);
  const hasTrackedBeginCheckoutRef = useRef(false);
  const checkoutIdempotencyKeyRef = useRef<string | null>(null);
  const debouncedAddressParts = useDebounce({
    street: shippingDetails.street,
    ward: shippingDetails.ward,
    district: shippingDetails.district,
    province: shippingDetails.province
  }, 500);

  const isGuestCheckout = !currentUser;
  const hasSepayBankDetails = Boolean(
    (paymentSettings?.bank_code || paymentSettings?.bank_bin)
    && paymentSettings?.account_number
    && paymentSettings?.account_holder_name
  );
  const canPayWithSepay = isSepayEnabled && hasSepayBankDetails;
  const finalTotal = useMemo(
    () => pricingQuote?.grand_total ?? (total + shippingFee),
    [pricingQuote, total, shippingFee]
  );
  const totalTaxAmount = useMemo(
    () => (pricingQuote?.tax_amount || 0) + (pricingQuote?.shipping_tax_amount || 0),
    [pricingQuote]
  );

  const getLocalized = (obj: any, field: string): string => {
    if (!obj) return '';
    const lang = i18n.language;
    if (lang !== 'vi') {
      const v = obj[`${field}_${lang}`];
      if (v) return v;
    }
    return obj[field] || '';
  };

  useEffect(() => {
    if (currentUser) {
      setShippingDetails(prev => ({
        ...prev,
        fullName: currentUser.profile.name || '',
        phone: currentUser.profile.phone || '',
        email: currentUser.profile.email || '',
        province: currentUser.profile.address_province || '',
        district: currentUser.profile.address_district || '',
        ward: currentUser.profile.address_ward || '',
        street: currentUser.profile.address_street || '',
      }));
    }
  }, [currentUser]);

  useEffect(() => {
    let cancelled = false;
    setIsSepayConfigLoading(true);
    void api.getSepayPublicConfiguration()
      .then((configuration) => {
        if (!cancelled) setIsSepayEnabled(configuration.enabled);
      })
      .catch((error) => {
        console.warn('Could not load SePay configuration:', error);
        if (!cancelled) setIsSepayEnabled(false);
      })
      .finally(() => {
        if (!cancelled) setIsSepayConfigLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const calculateFee = useCallback(async () => {
    const { street, province, district, ward } = debouncedAddressParts;
    if (shippingMethod === 'ghtk' && province && district && ward && street && cartItems.length > 0) {
      setIsCalculatingFee(true);
      try {
        const result = await api.calculateShippingFee(debouncedAddressParts, cartItems);
        setShippingFee(result.fee);
        setEstimatedDelivery(result.estimated_delivery_time);
        setIsGhtkAvailable(true);
      } catch (error) {
        console.error(error);
        setIsGhtkAvailable(false);
        if (!hasNotifiedGhtkFallback) {
          addToast(t('common.error'), { type: 'error', description: t('checkout.ghtk_fallback_notice') });
          setHasNotifiedGhtkFallback(true);
        }
        setShippingMethod('spx');
        setShippingFee(SPX_FALLBACK_FEE);
        setEstimatedDelivery(t('checkout.estimated_delivery'));
      } finally {
        setIsCalculatingFee(false);
      }
    } else if (shippingMethod === 'spx') {
      setShippingFee(SPX_FALLBACK_FEE);
      setEstimatedDelivery(t('checkout.estimated_delivery'));
      setIsCalculatingFee(false);
    } else {
      setShippingFee(0);
      setEstimatedDelivery('');
    }
  }, [shippingMethod, debouncedAddressParts, cartItems, addToast, hasNotifiedGhtkFallback, t]);

  useEffect(() => {
    calculateFee();
  }, [calculateFee]);

  useEffect(() => {
    if (cartItems.length === 0) {
      setPricingQuote(null);
      setIsCalculatingTotals(false);
      return;
    }

    let cancelled = false;
    setIsCalculatingTotals(true);

    void api.quoteProductOrderTotals({
      subtotal,
      discount_amount: discountAmount,
      shipping_fee: shippingFee,
      shipping_province: shippingDetails.province,
      shipping_district: shippingDetails.district,
      items: cartItems.map(item => ({
        product_id: item.id,
        quantity: item.quantity,
      })),
    }).then((quote) => {
      if (!cancelled) {
        setPricingQuote(quote);
      }
    }).catch((error) => {
      console.warn('Could not fetch checkout pricing quote:', error);
      if (!cancelled) {
        setPricingQuote(null);
      }
    }).finally(() => {
      if (!cancelled) {
        setIsCalculatingTotals(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [cartItems, subtotal, discountAmount, shippingFee, shippingDetails.province, shippingDetails.district]);

  useEffect(() => {
    if (hasTrackedBeginCheckoutRef.current || cartItems.length === 0) return;
    hasTrackedBeginCheckoutRef.current = true;
    void api.trackFunnelEvent(
      'begin_checkout',
      {
        subtotal,
        discount_amount: discountAmount,
        item_count: cartItems.reduce((sum, item) => sum + item.quantity, 0),
        discount_code: appliedDiscount?.code || null,
      },
      currentUser?.profile.id || null
    );
  }, [cartItems, subtotal, discountAmount, appliedDiscount?.code, currentUser?.profile.id]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setShippingDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    let normalizedShippingDetails: ShippingAddress = {
      fullName: shippingDetails.fullName.trim(),
      phone: shippingDetails.phone.trim(),
      email: shippingDetails.email.trim().toLowerCase(),
      street: shippingDetails.street.trim(),
      ward: shippingDetails.ward.trim(),
      district: shippingMethod === 'ghtk' ? shippingDetails.district.trim() : '',
      province: shippingDetails.province.trim(),
      notes: shippingDetails.notes?.trim() || '',
    };
    if (!normalizedShippingDetails.fullName || !normalizedShippingDetails.phone || !normalizedShippingDetails.email || !normalizedShippingDetails.street || !normalizedShippingDetails.ward || !normalizedShippingDetails.province) {
      addToast(t('checkout.fill_info'), { type: 'error' });
      return;
    }
    if (!isVietnamProvince2025(normalizedShippingDetails.province)) {
      addToast(t('checkout.select_current_province'), { type: 'error' });
      return;
    }
    try {
      const administrativeUnits = await loadVietnamAdministrativeUnits2025();
      const province = findProvinceByName(administrativeUnits, normalizedShippingDetails.province);
      const ward = findWardByName(province, normalizedShippingDetails.ward);
      if (!province || !ward) {
        addToast(t('checkout.select_current_ward'), { type: 'error' });
        return;
      }
      normalizedShippingDetails = {
        ...normalizedShippingDetails,
        province: province.name,
        ward: ward.name,
      };
    } catch (error) {
      console.error('Could not validate the current Vietnam address dataset:', error);
      addToast(t('checkout.address_data_error'), { type: 'error' });
      return;
    }
    if (!/^[0-9+\s().-]{8,20}$/.test(normalizedShippingDetails.phone)) {
      addToast(t('checkout.invalid_phone'), { type: 'error' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedShippingDetails.email)) {
      addToast(t('checkout.invalid_email'), { type: 'error' });
      return;
    }
    if (shippingMethod === 'ghtk' && !normalizedShippingDetails.district) {
      addToast(t('checkout.ghtk_requires_district'), { type: 'error' });
      return;
    }
    if (paymentMethod === 'bank_transfer' && !canPayWithSepay) {
      addToast(t('checkout.sepay_unavailable', 'SePay chưa sẵn sàng'), {
        type: 'error',
        description: t('checkout.sepay_unavailable_desc', 'Vui lòng chọn COD hoặc thử lại sau.'),
      });
      return;
    }

    setIsLoading(true);
    try {
      const checkoutIdempotencyKey = checkoutIdempotencyKeyRef.current || api.generateUUID();
      checkoutIdempotencyKeyRef.current = checkoutIdempotencyKey;
      const effectiveShippingMethod = (shippingMethod === 'ghtk' && !isGhtkAvailable) ? 'spx' : shippingMethod;
      const order = await api.createProductOrder({
        user_id: currentUser ? currentUser.profile.id : null,
        total_price: finalTotal,
        status: paymentMethod === 'bank_transfer' ? 'pending' : 'processing',
        payment_method: paymentMethod,
        subtotal_price: pricingQuote?.subtotal ?? subtotal,
        discount_code: appliedDiscount?.code || null,
        discount_amount: pricingQuote?.discount_amount ?? discountAmount,
        customer_name: normalizedShippingDetails.fullName,
        customer_phone: normalizedShippingDetails.phone,
        customer_email: normalizedShippingDetails.email,
        locale: ['vi', 'en', 'ru', 'cn'].includes(i18n.language) ? i18n.language as 'vi' | 'en' | 'ru' | 'cn' : 'vi',
        shipping_street: normalizedShippingDetails.street,
        shipping_ward: normalizedShippingDetails.ward,
        shipping_district: normalizedShippingDetails.district,
        shipping_province: normalizedShippingDetails.province,
        notes: normalizedShippingDetails.notes,
        shipping_provider: effectiveShippingMethod,
        shipping_fee: pricingQuote?.shipping_fee ?? shippingFee,
        estimated_delivery_time: estimatedDelivery,
        checkout_idempotency_key: checkoutIdempotencyKey,
      }, cartItems);

      void api.trackFunnelEvent(
        paymentMethod === 'bank_transfer' ? 'payment_pending' : 'purchase',
        {
          order_id: order.id,
          order_code: order.order_code,
          total_price: order.total_price,
          subtotal_price: order.subtotal_price ?? subtotal,
          discount_code: order.discount_code || appliedDiscount?.code || null,
          discount_amount: order.discount_amount ?? discountAmount,
          shipping_fee: order.shipping_fee ?? shippingFee,
          tax_amount: order.tax_amount ?? pricingQuote?.tax_amount ?? 0,
          shipping_tax_amount: order.shipping_tax_amount ?? pricingQuote?.shipping_tax_amount ?? 0,
          grand_total: order.grand_total ?? order.total_price ?? finalTotal,
          currency: order.currency ?? pricingQuote?.currency ?? 'VND',
          payment_method: paymentMethod,
          shipping_method: effectiveShippingMethod,
        },
        currentUser?.profile.id || null
      );

      if (paymentMethod === 'bank_transfer') {
        if (!order.payment || order.payment.provider !== 'sepay') {
          throw new Error(t('checkout.sepay_session_error', 'Không thể khởi tạo phiên thanh toán SePay.'));
        }
        setCreatedOrder(order);
        setIsQrModalOpen(true);
      } else {
        await onCheckoutSuccess(order);
      }

    } catch (error: any) {
      void api.trackFunnelEvent(
        'checkout_failed',
        {
          reason: error?.message || 'unknown_error',
          payment_method: paymentMethod,
          shipping_method: (shippingMethod === 'ghtk' && !isGhtkAvailable) ? 'spx' : shippingMethod,
        },
        currentUser?.profile.id || null
      );
      addToast(t('checkout.order_failed'), { type: 'error', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSepayPaid = useCallback(async (status: import('../types').SepayPaymentStatus) => {
    if (!createdOrder) return;
    const paidOrder: ProductOrder = {
      ...createdOrder,
      payment_status: 'paid',
      status: status.order_status,
      paid_at: status.paid_at,
    };
    void api.trackFunnelEvent(
      'purchase',
      {
        order_id: paidOrder.id,
        order_code: paidOrder.order_code,
        total_price: paidOrder.total_price,
        subtotal_price: paidOrder.subtotal_price ?? subtotal,
        discount_code: paidOrder.discount_code || appliedDiscount?.code || null,
        discount_amount: paidOrder.discount_amount ?? discountAmount,
        shipping_fee: paidOrder.shipping_fee ?? shippingFee,
        tax_amount: paidOrder.tax_amount ?? pricingQuote?.tax_amount ?? 0,
        shipping_tax_amount: paidOrder.shipping_tax_amount ?? pricingQuote?.shipping_tax_amount ?? 0,
        grand_total: paidOrder.grand_total ?? paidOrder.total_price,
        currency: paidOrder.currency ?? pricingQuote?.currency ?? 'VND',
        payment_method: 'bank_transfer',
        payment_provider: 'sepay',
        shipping_method: paidOrder.shipping_provider || shippingMethod,
      },
      currentUser?.profile.id || null
    );
    setIsQrModalOpen(false);
    addToast(t('payment.paid', 'Thanh toán thành công'), {
      type: 'success',
      description: t('payment.paid_desc', 'SePay đã xác nhận giao dịch của bạn.'),
    });
    await onCheckoutSuccess(paidOrder);
  }, [
    addToast, appliedDiscount?.code, createdOrder, currentUser?.profile.id, discountAmount,
    onCheckoutSuccess, pricingQuote, shippingFee, shippingMethod, subtotal, t,
  ]);

  if (cartItems.length === 0) {
    return (
      <div className="container mx-auto text-center py-20">
        <p>{t('cart.empty')}</p>
        <BackIconButton onClick={onBack} label={t('common.back')} className="mt-4" />
      </div>
    )
  }

  return (
    <>
      <SepayPaymentModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        onPaid={handleSepayPaid}
        order={createdOrder}
      />
      <div className="bg-background text-foreground transition-colors duration-300 animate-scale-in">
        <div className="container mx-auto px-6 py-12">
          <div className="mb-8">
            <BackIconButton onClick={onBack} label={t('checkout.back_to_cart')} className="mb-4" />
            <h1 className="text-4xl md:text-5xl font-bold text-foreground font-heading">{t('checkout.title')}</h1>
            <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-muted-foreground">
              <p className="font-bold text-foreground">{isGuestCheckout ? t('checkout.guest_notice_title') : t('checkout.member_notice_title')}</p>
              <p>{isGuestCheckout ? t('checkout.guest_notice_desc') : t('checkout.member_notice_desc')}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid lg:grid-cols-12 gap-12">
            {/* Shipping Details */}
            <div className="lg:col-span-7 bg-card p-6 rounded-xl border border-border">
              <h2 className="text-xl font-bold mb-4">{t('checkout.shipping_info')}</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-muted-foreground">{t('checkout.full_name')}</label>
                  <input type="text" name="fullName" id="fullName" value={shippingDetails.fullName} onChange={handleChange} required className="mt-1 block w-full rounded-md border-input bg-background shadow-sm focus:border-primary focus:ring-primary" />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-muted-foreground">{t('checkout.phone')}</label>
                  <input type="tel" name="phone" id="phone" value={shippingDetails.phone} onChange={handleChange} required className="mt-1 block w-full rounded-md border-input bg-background shadow-sm focus:border-primary focus:ring-primary" />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-muted-foreground">{t('checkout.email')}</label>
                  <input type="email" name="email" id="email" autoComplete="email" value={shippingDetails.email} onChange={handleChange} required className="mt-1 block w-full rounded-md border-input bg-background shadow-sm focus:border-primary focus:ring-primary" />
                  <p className="mt-1 text-xs text-muted-foreground">{t('checkout.email_notice')}</p>
                </div>
                <VietnamAddressFields
                  value={{
                    province: shippingDetails.province,
                    ward: shippingDetails.ward,
                    street: shippingDetails.street,
                    district: shippingDetails.district,
                  }}
                  onChange={(address) => setShippingDetails((current) => ({ ...current, ...address }))}
                  required
                  showLegacyDistrict={shippingMethod === 'ghtk'}
                />
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-muted-foreground">{t('checkout.notes')}</label>
                  <textarea name="notes" id="notes" value={shippingDetails.notes || ''} onChange={handleChange} rows={2} className="mt-1 block w-full rounded-md border-input bg-background shadow-sm focus:border-primary focus:ring-primary"></textarea>
                </div>
              </div>

              <h2 className="text-xl font-bold mt-8 mb-4">{t('checkout.shipping_method')}</h2>
              <div className="space-y-3">
                <label className="flex items-center p-4 border border-input rounded-lg has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input type="radio" name="shippingMethod" value="spx" checked={shippingMethod === 'spx'} onChange={(e) => setShippingMethod(e.target.value)} className="h-4 w-4 text-primary border-muted-foreground focus:ring-primary" />
                  <div className="ml-3">
                    <span className="font-medium">SPX Express</span>
                    <p className="text-sm text-muted-foreground">{t('checkout.spx_desc')}</p>
                  </div>
                </label>
                <label className={`flex items-center p-4 border border-input rounded-lg has-[:checked]:border-primary has-[:checked]:bg-primary/5 ${!isGhtkAvailable ? 'opacity-60 cursor-not-allowed' : ''}`}>
                  <input
                    type="radio"
                    name="shippingMethod"
                    value="ghtk"
                    checked={shippingMethod === 'ghtk'}
                    onChange={(e) => setShippingMethod(e.target.value)}
                    disabled={!isGhtkAvailable}
                    className="h-4 w-4 text-primary border-muted-foreground focus:ring-primary"
                  />
                  <div className="ml-3">
                    <span className="font-medium">{t('checkout.ghtk_name')}</span>
                    <p className="text-sm text-muted-foreground">{t('checkout.ghtk_desc')}</p>
                    {!isGhtkAvailable && <p className="text-xs text-amber-600">{t('checkout.ghtk_unavailable')}</p>}
                  </div>
                </label>
              </div>

              <h2 className="text-xl font-bold mt-8 mb-4">{t('checkout.payment_method')}</h2>
              <div className="space-y-3">
                <label className="flex items-center p-4 border border-input rounded-lg has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input type="radio" name="paymentMethod" value="cod" checked={paymentMethod === 'cod'} onChange={(e) => setPaymentMethod(e.target.value as OrderPaymentMethod)} className="h-4 w-4 text-primary border-muted-foreground focus:ring-primary" />
                  <span className="ml-3 font-medium">{t('checkout.cod')}</span>
                </label>
                <label className="flex items-center p-4 border border-input rounded-lg has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input type="radio" name="paymentMethod" value="bank_transfer" checked={paymentMethod === 'bank_transfer'} onChange={(e) => setPaymentMethod(e.target.value as OrderPaymentMethod)} disabled={!canPayWithSepay} className="h-4 w-4 text-primary border-muted-foreground focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50" />
                  <span className={`ml-3 font-medium ${canPayWithSepay ? '' : 'text-muted-foreground'}`}>
                    {t('checkout.sepay_transfer', 'SePay – chuyển khoản QR tự động')}
                  </span>
                </label>
                {!canPayWithSepay && (
                  <p className="mt-2 text-xs text-amber-700">
                    {isSepayConfigLoading
                      ? t('checkout.sepay_loading', 'Đang kiểm tra kết nối SePay…')
                      : t('checkout.sepay_unavailable_desc', 'SePay đang tạm ngưng; vui lòng chọn COD.')}
                  </p>
                )}
              </div>

            </div>

            {/* Order Summary */}
            <div className="lg:col-span-5">
              <div className="bg-card p-6 rounded-xl border border-border shadow-lg sticky top-28">
                <h2 className="text-xl font-bold text-foreground mb-4">{t('checkout.your_order')}</h2>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-2 border-b border-border pb-4 mb-4">
                  {cartItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <img src={item.images?.[0]?.image_url} alt={getLocalized(item, 'name')} className="w-12 h-12 rounded-md object-cover" />
                        <div>
                          <p className="font-semibold text-sm">{getLocalized(item, 'name')}</p>
                          <p className="text-xs text-muted-foreground">{t('checkout.qty')}: {item.quantity}</p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold">{formatCurrency(item.price * item.quantity)}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('cart.subtotal')}</span>
                    <span className="font-semibold">{formatCurrency(pricingQuote?.subtotal ?? subtotal)}</span>
                  </div>
                  {appliedDiscount && (
                    <div className="flex justify-between text-green-600 dark:text-green-400">
                      <span className="text-muted-foreground">{t('cart.discount')} ({appliedDiscount.code})</span>
                      <span className="font-semibold">- {formatCurrency(pricingQuote?.discount_amount ?? discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('checkout.tax')}</span>
                    {isCalculatingTotals ? <Spinner className="w-4 h-4" /> : <span className="font-semibold">{formatCurrency(totalTaxAmount)}</span>}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('cart.shipping')}</span>
                    {isCalculatingFee ? <Spinner className="w-4 h-4" /> : <span className="font-semibold">{formatCurrency(pricingQuote?.shipping_fee ?? shippingFee)}</span>}
                  </div>
                  {pricingQuote?.tax_mode === 'inclusive' && (
                    <p className="text-xs text-muted-foreground text-right -mt-2">{t('checkout.tax_included')}</p>
                  )}
                  {estimatedDelivery && <p className="text-xs text-muted-foreground text-right -mt-2">{estimatedDelivery}</p>}
                </div>
                <div className="flex justify-between font-bold text-lg pt-4 border-t border-border">
                  <span>{t('cart.total')}</span>
                  <span className="text-primary">{formatCurrency(finalTotal)}</span>
                </div>
                <button type="submit" disabled={isLoading || isCalculatingFee || isCalculatingTotals} className="mt-6 w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-8 rounded-full transition-all-smooth text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 btn-press disabled:bg-muted">
                  {isLoading ? <Spinner /> : t('checkout.place_order')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default CheckoutPage;
