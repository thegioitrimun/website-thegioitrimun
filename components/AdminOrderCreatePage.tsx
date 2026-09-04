import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
    AdminOrderCreateInput,
    AdminOrderWorkflow,
    CheckoutPricingQuote,
    OrderChannel,
    OrderPaymentMethod,
    Product,
    ProductOrder,
} from '../types';
import * as api from '../services/api';
import { useToast } from '../hooks/useToast';
import VietnamAddressFields, { type VietnamAddressValue } from './VietnamAddressFields';
import Spinner from './Spinner';
import {
    ArrowLeftIcon,
    CheckCircleIcon,
    DocumentDuplicateIcon,
    MinusIcon,
    PlusIcon,
    PrinterIcon,
    SearchIcon,
    ShoppingBagIcon,
} from './icons';
import {
    buildOrderShareText,
    formatOrderCurrency,
    getOrderChannelLabel,
    printProductOrder,
} from '../src/orderReceipt';

interface AdminOrderCreatePageProps {
    channel: OrderChannel;
    products: Product[];
    onCancel: () => void;
    onCreated: (order: ProductOrder) => void;
    onOpenDetails: (order: ProductOrder) => void;
}

type SelectedQuantities = Record<number, number>;

const inputClassName = 'mt-1.5 w-full rounded-2xl border-0 bg-background/55 px-4 py-3 text-sm shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] outline-none transition focus:ring-2 focus:ring-primary/45 disabled:cursor-not-allowed disabled:opacity-60';
const sectionClassName = 'rounded-[1.75rem] border border-border/70 bg-card/75 p-5 shadow-[0_24px_60px_-48px_rgba(28,24,18,0.5)] backdrop-blur-xl md:p-6';

const normalizeMoneyInput = (value: string): number => {
    const numeric = Number(String(value || '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
};

const copyText = async (text: string) => {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Trình duyệt không cho phép sao chép tự động.');
};

const AdminOrderCreatePage: React.FC<AdminOrderCreatePageProps> = ({
    channel,
    products,
    onCancel,
    onCreated,
    onOpenDetails,
}) => {
    const { addToast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedQuantities, setSelectedQuantities] = useState<SelectedQuantities>({});
    const [customerName, setCustomerName] = useState(channel === 'pos' ? 'Khách lẻ' : '');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [address, setAddress] = useState<VietnamAddressValue>({ province: '', ward: '', district: '', street: '' });
    const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod>(channel === 'pos' ? 'cash' : 'cod');
    const [workflow, setWorkflow] = useState<AdminOrderWorkflow>('paid_completed');
    const [discountInput, setDiscountInput] = useState('0');
    const [shippingFeeInput, setShippingFeeInput] = useState('0');
    const [shippingProvider, setShippingProvider] = useState('manual');
    const [notes, setNotes] = useState('');
    const [quote, setQuote] = useState<CheckoutPricingQuote | null>(null);
    const [quoteError, setQuoteError] = useState('');
    const [isQuoting, setIsQuoting] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [createdOrder, setCreatedOrder] = useState<ProductOrder | null>(null);
    const idempotencyKeyRef = useRef(api.generateUUID());

    const eligibleProducts = useMemo(
        () => products.filter((product) => (
            !product.archived_at
            && Number(product.stock_quantity || 0) > 0
            && (channel === 'pos' || product.is_published)
        )),
        [channel, products],
    );

    const productById = useMemo(
        () => new Map(products.map((product) => [product.id, product])),
        [products],
    );

    const searchResults = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const results = query
            ? eligibleProducts.filter((product) => (
                product.name.toLowerCase().includes(query)
                || String(product.sku || '').toLowerCase().includes(query)
            ))
            : eligibleProducts;
        return results.slice(0, 12);
    }, [eligibleProducts, searchQuery]);

    const selectedItems = useMemo(
        () => Object.entries(selectedQuantities)
            .map(([productId, quantity]) => ({ productId: Number(productId), quantity: Number(quantity) }))
            .filter((item) => item.quantity > 0 && productById.has(item.productId)),
        [productById, selectedQuantities],
    );

    const catalogSubtotal = useMemo(
        () => selectedItems.reduce((sum, item) => sum + Number(productById.get(item.productId)?.price || 0) * item.quantity, 0),
        [productById, selectedItems],
    );

    const discountAmount = normalizeMoneyInput(discountInput);
    const shippingFee = channel === 'online' ? normalizeMoneyInput(shippingFeeInput) : 0;

    useEffect(() => {
        if (selectedItems.length === 0) {
            setQuote(null);
            setQuoteError('');
            setIsQuoting(false);
            return;
        }

        let cancelled = false;
        setIsQuoting(true);
        const timer = window.setTimeout(() => {
            void api.quoteAdminProductOrderTotals({
                channel,
                items: selectedItems,
                discountAmount,
                shippingFee,
                shippingProvince: channel === 'online' ? address.province : '',
                shippingDistrict: channel === 'online' ? address.district : '',
            })
                .then((nextQuote) => {
                    if (cancelled) return;
                    setQuote(nextQuote);
                    setQuoteError('');
                })
                .catch((error: any) => {
                    if (cancelled) return;
                    setQuote(null);
                    setQuoteError(error?.message || 'Không thể tính tổng tiền.');
                })
                .finally(() => {
                    if (!cancelled) setIsQuoting(false);
                });
        }, 280);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [address.district, address.province, channel, discountAmount, selectedItems, shippingFee]);

    const setProductQuantity = (product: Product, nextQuantity: number) => {
        const stock = Math.max(0, Number(product.stock_quantity || 0));
        const safeQuantity = Math.min(Math.max(0, nextQuantity), stock);
        setSelectedQuantities((current) => {
            if (safeQuantity === 0) {
                const { [product.id]: _removed, ...rest } = current;
                return rest;
            }
            return { ...current, [product.id]: safeQuantity };
        });
    };

    const validateForm = (): string | null => {
        if (selectedItems.length === 0) return 'Hãy thêm ít nhất một sản phẩm.';
        if (discountAmount > catalogSubtotal) return 'Giảm giá không được vượt quá tạm tính.';
        if (quoteError || !quote) return quoteError || 'Đang chờ máy chủ xác nhận tổng tiền.';
        if (channel === 'online') {
            if (!customerName.trim()) return 'Tên khách hàng là bắt buộc với đơn Online.';
            if (!customerPhone.trim()) return 'Số điện thoại là bắt buộc với đơn Online.';
            if (!address.province.trim() || !address.ward.trim() || !address.street.trim()) {
                return 'Đơn Online cần đủ tỉnh/thành, phường/xã và địa chỉ.';
            }
            if (paymentMethod !== 'cod' && paymentMethod !== 'bank_transfer') return 'Phương thức thanh toán Online không hợp lệ.';
        } else if (paymentMethod !== 'cash' && paymentMethod !== 'bank_transfer') {
            return 'Phương thức thanh toán POS không hợp lệ.';
        }
        return null;
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (isSubmitting) return;
        const validationError = validateForm();
        if (validationError) {
            addToast('Chưa thể tạo đơn', { type: 'error', description: validationError });
            return;
        }

        const payload: AdminOrderCreateInput = {
            channel,
            idempotencyKey: idempotencyKeyRef.current,
            items: selectedItems,
            customerName: customerName.trim() || (channel === 'pos' ? 'Khách lẻ' : ''),
            customerPhone: customerPhone.trim(),
            customerEmail: customerEmail.trim(),
            shippingStreet: channel === 'online' ? address.street.trim() : '',
            shippingWard: channel === 'online' ? address.ward.trim() : '',
            shippingDistrict: channel === 'online' ? String(address.district || '').trim() : '',
            shippingProvince: channel === 'online' ? address.province.trim() : '',
            shippingProvider: channel === 'online' ? shippingProvider.trim() : '',
            shippingFee,
            paymentMethod,
            workflow: channel === 'pos' ? workflow : undefined,
            discountAmount,
            notes: notes.trim(),
        };

        setIsSubmitting(true);
        try {
            const order = await api.createAdminProductOrder(payload);
            setCreatedOrder(order);
            onCreated(order);
            addToast(`Đã tạo đơn ${order.order_code || order.id}.`, { type: 'success' });
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error: any) {
            addToast('Tạo đơn thất bại', { type: 'error', description: error?.message || 'Vui lòng thử lại.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopy = async (order: ProductOrder) => {
        try {
            await copyText(buildOrderShareText(order));
            addToast('Đã sao chép nội dung gửi Zalo.', { type: 'success' });
        } catch (error: any) {
            addToast('Không thể sao chép', { type: 'error', description: error?.message });
        }
    };

    const handlePrint = (order: ProductOrder, format: 'a4' | 'receipt80') => {
        if (!printProductOrder(order, format)) {
            addToast('Không mở được cửa sổ in', { type: 'error', description: 'Hãy cho phép pop-up cho trang quản trị rồi thử lại.' });
        }
    };

    const resetForAnotherOrder = () => {
        setSelectedQuantities({});
        setCustomerName(channel === 'pos' ? 'Khách lẻ' : '');
        setCustomerPhone('');
        setCustomerEmail('');
        setAddress({ province: '', ward: '', district: '', street: '' });
        setPaymentMethod(channel === 'pos' ? 'cash' : 'cod');
        setWorkflow('paid_completed');
        setDiscountInput('0');
        setShippingFeeInput('0');
        setShippingProvider('manual');
        setNotes('');
        setCreatedOrder(null);
        idempotencyKeyRef.current = api.generateUUID();
    };

    if (createdOrder) {
        return (
            <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-10">
                <div className="overflow-hidden rounded-[2rem] border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-card to-card p-6 shadow-[0_30px_80px_-48px_rgba(5,150,105,0.7)] md:p-10">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-600 text-white shadow-lg">
                        <CheckCircleIcon className="h-9 w-9" />
                    </div>
                    <p className="mt-7 text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Tạo đơn thành công</p>
                    <h2 className="mt-2 text-3xl font-black tracking-tight text-foreground md:text-4xl">{createdOrder.order_code || createdOrder.id}</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                        Đơn {getOrderChannelLabel(createdOrder.order_channel)} đã được lưu, trừ tồn kho và sẵn sàng để in hoặc sao chép gửi khách qua Zalo.
                    </p>
                    {channel === 'pos' && !createdOrder.customer_phone ? (
                        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                            Đơn không có số điện thoại nên chỉ lưu nội bộ; hệ thống không xếp hàng đồng bộ khách/đơn sang Pancake.
                        </p>
                    ) : null}
                    <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <button type="button" onClick={() => handlePrint(createdOrder, 'a4')} className="admin-glass-button justify-center"><PrinterIcon className="h-4 w-4" /> In A4</button>
                        <button type="button" onClick={() => handlePrint(createdOrder, 'receipt80')} className="admin-glass-button justify-center"><PrinterIcon className="h-4 w-4" /> In 80mm</button>
                        <button type="button" onClick={() => void handleCopy(createdOrder)} className="admin-glass-button justify-center"><DocumentDuplicateIcon className="h-4 w-4" /> Sao chép gửi Zalo</button>
                        <button type="button" onClick={() => onOpenDetails(createdOrder)} className="admin-glass-button justify-center"><ShoppingBagIcon className="h-4 w-4" /> Mở chi tiết</button>
                        <button type="button" onClick={resetForAnotherOrder} className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-lg transition hover:-translate-y-0.5 hover:bg-primary/90">Tạo đơn mới</button>
                        <button type="button" onClick={onCancel} className="rounded-2xl px-5 py-3 text-sm font-semibold text-muted-foreground transition hover:bg-background/60">Về danh sách</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="mx-auto w-full max-w-[1500px] px-4 py-5 md:px-6 md:py-8">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <button type="button" onClick={onCancel} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary">
                        <ArrowLeftIcon className="h-4 w-4" /> Về danh sách đơn
                    </button>
                    <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-primary">{getOrderChannelLabel(channel)}</p>
                    <h2 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Tạo đơn {channel === 'pos' ? 'POS' : 'online'}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        Giá và VAT được máy chủ lấy từ catalog. Đơn chỉ được lưu khi toàn bộ tồn kho còn hợp lệ.
                    </p>
                </div>
                <div className="inline-flex w-fit rounded-2xl border border-border bg-background/60 p-1 text-xs font-bold">
                    <span className={`rounded-xl px-3 py-2 ${channel === 'online' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>ONLINE</span>
                    <span className={`rounded-xl px-3 py-2 ${channel === 'pos' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>POS</span>
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
                <div className="space-y-6">
                    <section className={sectionClassName}>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">01 · Sản phẩm</p>
                                <h3 className="mt-1 text-xl font-black">Chọn hàng từ catalog</h3>
                            </div>
                            <p className="text-xs text-muted-foreground">{channel === 'pos' ? 'Có thể chọn cả sản phẩm đang ẩn website.' : 'Chỉ sản phẩm đang hiển thị.'}</p>
                        </div>
                        <div className="relative mt-5">
                            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className={`${inputClassName} mt-0 pl-12`} placeholder="Tìm theo tên hoặc SKU…" />
                        </div>
                        <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                            {searchResults.map((product) => {
                                const quantity = selectedQuantities[product.id] || 0;
                                return (
                                    <div key={product.id} className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/45 p-3 sm:flex-row sm:items-center">
                                        <div className="flex min-w-0 flex-1 items-center gap-3">
                                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">
                                                {product.images?.[0]?.image_url ? <img src={product.images[0].image_url} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-bold">{product.name}</p>
                                                <p className="mt-1 text-xs text-muted-foreground">{product.sku || `ID ${product.id}`} · Tồn {product.stock_quantity} · {formatOrderCurrency(product.price)}</p>
                                                {!product.is_published && <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Ẩn website</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-end gap-2">
                                            {quantity > 0 ? (
                                                <>
                                                    <button type="button" onClick={() => setProductQuantity(product, quantity - 1)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted hover:bg-muted/70" aria-label={`Giảm ${product.name}`}><MinusIcon className="h-4 w-4" /></button>
                                                    <input type="number" min="1" max={product.stock_quantity} value={quantity} onChange={(event) => setProductQuantity(product, Number(event.target.value))} className="h-9 w-16 rounded-xl border border-border bg-background text-center text-sm font-bold" aria-label={`Số lượng ${product.name}`} />
                                                </>
                                            ) : null}
                                            <button type="button" onClick={() => setProductQuantity(product, quantity + 1)} disabled={quantity >= product.stock_quantity} className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40" aria-label={`Thêm ${product.name}`}><PlusIcon className="h-4 w-4" /></button>
                                        </div>
                                    </div>
                                );
                            })}
                            {searchResults.length === 0 ? <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">Không tìm thấy sản phẩm còn tồn phù hợp.</p> : null}
                        </div>
                    </section>

                    <section className={sectionClassName}>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">02 · Khách hàng</p>
                        <h3 className="mt-1 text-xl font-black">Thông tin liên hệ</h3>
                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                            <label className="text-sm font-semibold">Tên khách hàng{channel === 'online' ? ' *' : ''}<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} required={channel === 'online'} className={inputClassName} placeholder={channel === 'pos' ? 'Khách lẻ' : 'Nguyễn Văn A'} /></label>
                            <label className="text-sm font-semibold">Số điện thoại{channel === 'online' ? ' *' : ''}<input type="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} required={channel === 'online'} className={inputClassName} placeholder="090…" /></label>
                            <label className="text-sm font-semibold md:col-span-2">Email (không bắt buộc)<input type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} className={inputClassName} placeholder="khachhang@example.com" /></label>
                        </div>
                        {channel === 'pos' && !customerPhone.trim() ? <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-800">Không có SĐT: đơn vẫn tạo được nhưng chỉ lưu nội bộ, không tạo job đồng bộ khách/đơn Pancake.</p> : null}
                    </section>

                    {channel === 'online' ? (
                        <section className={sectionClassName}>
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">03 · Giao hàng</p>
                            <h3 className="mt-1 text-xl font-black">Địa chỉ và vận chuyển</h3>
                            <div className="mt-5"><VietnamAddressFields value={address} onChange={setAddress} required inputClassName={inputClassName} /></div>
                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <label className="text-sm font-semibold">Đơn vị giao hàng<select value={shippingProvider} onChange={(event) => setShippingProvider(event.target.value)} className={inputClassName}><option value="manual">Thủ công / khác</option><option value="ghtk">GHTK</option><option value="spx">SPX</option></select></label>
                                <label className="text-sm font-semibold">Phí giao hàng<input type="number" min="0" step="1000" value={shippingFeeInput} onChange={(event) => setShippingFeeInput(event.target.value)} className={inputClassName} /></label>
                            </div>
                        </section>
                    ) : null}

                    <section className={sectionClassName}>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">{channel === 'online' ? '04' : '03'} · Hoàn tất</p>
                        <h3 className="mt-1 text-xl font-black">Thanh toán và ghi chú</h3>
                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                            <label className="text-sm font-semibold">Phương thức thanh toán<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as OrderPaymentMethod)} className={inputClassName}>{channel === 'online' ? <><option value="cod">COD</option><option value="bank_transfer">Chuyển khoản</option></> : <><option value="cash">Tiền mặt</option><option value="bank_transfer">Chuyển khoản</option></>}</select></label>
                            <label className="text-sm font-semibold">Giảm giá toàn đơn<input type="number" min="0" max={catalogSubtotal} step="1000" value={discountInput} onChange={(event) => setDiscountInput(event.target.value)} className={inputClassName} /></label>
                            {channel === 'pos' ? <label className="text-sm font-semibold md:col-span-2">Trạng thái khi tạo<select value={workflow} onChange={(event) => setWorkflow(event.target.value as AdminOrderWorkflow)} className={inputClassName}><option value="paid_completed">Đã thanh toán · Hoàn thành (mặc định)</option><option value="unpaid_processing">Chưa thanh toán · Đang xử lý</option></select></label> : null}
                            <label className="text-sm font-semibold md:col-span-2">Ghi chú<textarea value={notes} onChange={(event) => setNotes(event.target.value)} className={`${inputClassName} min-h-28 resize-y`} placeholder="Thông tin cần nhắc khi giao hoặc trao đổi với khách…" /></label>
                        </div>
                    </section>
                </div>

                <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
                    <section className="rounded-[1.8rem] border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-[0_28px_70px_-42px_rgba(34,100,89,0.55)] md:p-6">
                        <div className="flex items-center justify-between gap-3">
                            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Tóm tắt đơn</p><h3 className="mt-1 text-xl font-black">{selectedItems.reduce((sum, item) => sum + item.quantity, 0)} sản phẩm</h3></div>
                            {isQuoting ? <Spinner className="h-5 w-5" /> : null}
                        </div>
                        <div className="mt-5 max-h-64 space-y-3 overflow-y-auto pr-1">
                            {selectedItems.map((item) => {
                                const product = productById.get(item.productId)!;
                                return <div key={item.productId} className="flex justify-between gap-3 text-sm"><span className="min-w-0 truncate">{product.name} × {item.quantity}</span><span className="shrink-0 font-semibold">{formatOrderCurrency(product.price * item.quantity)}</span></div>;
                            })}
                            {selectedItems.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Chưa có sản phẩm.</p> : null}
                        </div>
                        <div className="mt-5 space-y-3 border-t border-border pt-5 text-sm">
                            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Tạm tính</span><span className="font-semibold">{formatOrderCurrency(quote?.subtotal ?? catalogSubtotal)}</span></div>
                            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Giảm giá</span><span className="font-semibold">- {formatOrderCurrency(quote?.discount_amount ?? discountAmount)}</span></div>
                            <div className="flex justify-between gap-3"><span className="text-muted-foreground">VAT</span><span className="font-semibold">{formatOrderCurrency((quote?.tax_amount || 0) + (quote?.shipping_tax_amount || 0))}</span></div>
                            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Phí giao hàng</span><span className="font-semibold">{formatOrderCurrency(quote?.shipping_fee ?? shippingFee)}</span></div>
                            <div className="flex justify-between gap-4 border-t border-border pt-4 text-lg font-black"><span>Tổng tiền</span><span>{formatOrderCurrency(quote?.grand_total ?? Math.max(catalogSubtotal - discountAmount + shippingFee, 0))}</span></div>
                        </div>
                        {quoteError ? <p role="alert" className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{quoteError}</p> : null}
                        <button type="submit" disabled={isSubmitting || isQuoting || selectedItems.length === 0 || Boolean(quoteError)} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-lg transition hover:-translate-y-0.5 hover:bg-primary/90 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50">
                            {isSubmitting ? <><Spinner className="h-4 w-4" /> Đang tạo đơn…</> : `Tạo đơn ${channel === 'pos' ? 'POS' : 'online'}`}
                        </button>
                        <p className="mt-3 text-center text-[11px] leading-5 text-muted-foreground">Nút được khóa trong lúc gửi; Idempotency-Key bảo vệ thao tác nhấn lặp.</p>
                    </section>
                </aside>
            </div>
        </form>
    );
};

export default AdminOrderCreatePage;
