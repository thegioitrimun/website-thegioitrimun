import React, { useState, useEffect, useMemo, useRef } from 'react';
import type {
    AdminNavigationView,
    AdminPharmacyOrderPreset,
    AdminPharmacyProductFilter,
    AdminPharmacySection,
    Product,
    ProductCategory,
    ProductImage,
    ProductOrder,
    GhtkPickAddress,
    GhtkPickAddressDetail,
    ProductBrand,
    ProductContentReviewRecord,
    DiscountCode,
    OrderFulfillmentStatus,
    OrderPaymentStatus,
    OrderPaymentMethod,
    OrderStatusHistory,
    OrderPaymentLog,
    OrderRefundLog,
    TaxProfile,
    TaxRate
} from '../types';
import { ShoppingBagIcon, PlusCircleIcon, PencilIcon, TrashIcon, CheckCircleIcon, XCircleIcon, PrinterIcon, CloseIcon, DocumentDuplicateIcon, CogIcon, WrenchScrewdriverIcon, EyeIcon, EyeOffIcon, StarIcon, UserIcon, ReceiptIcon, TruckIcon } from './icons';
import AnimatedSection from './AnimatedSection';
import ProductEditorForm from './ProductEditorForm';
import { AdminWorkspaceTabs } from './AdminWorkspaceLayout';
import { useAdminLayoutDispatch } from './AdminLayoutContext';
import { AdminMobileCard, AdminMobileList, AdminMobileMeta } from './AdminResponsivePrimitives';
import AdminShell from './AdminShell';
import CollapsibleSidebar from './CollapsibleSidebar';
import { ImageDropzone } from './ImageDropzone';
import * as api from '../services/api';
import { useToast } from '../hooks/useToast';
import Spinner from './Spinner';
import Pagination from './Pagination';
import { useTranslation } from 'react-i18next';
import { getBrandDescriptionSnippet, normalizeBrandMatchKey } from '../src/brandUtils';
import { auditProductContent, resolveProductContentReview } from '../src/productContentReview';
import {
    assertWorkbookRowLimit,
    SAFE_WORKBOOK_READ_OPTIONS,
    validateWorkbookImportFile,
} from '../src/workbookImportSecurity';
import { getOrderItemDisplayName } from '../src/orderItemPresentation';



interface AdminPharmacyManagementPageProps {
    products: Product[];
    categories: ProductCategory[];
    brands: ProductBrand[];
    productOrders: ProductOrder[];
    initialSection?: AdminPharmacySection;
    initialAction?: 'new-product' | 'order-detail';
    initialOrderId?: string;
    initialOrderPreset?: AdminPharmacyOrderPreset;
    initialProductFilter?: AdminPharmacyProductFilter;
    onUpdateOrders: React.Dispatch<React.SetStateAction<ProductOrder[]>>;
    onSaveProduct: (product: Partial<Product>, imagesToDelete: ProductImage[]) => Promise<Product>;
    onBulkUpdateProducts: (updates: Partial<Product>[]) => Promise<void>;
    onDeleteProduct: (productId: number) => void;
    onBulkDeleteProducts: (productIds: number[]) => Promise<{ deletedCount: number; archivedCount: number }>;
    onSaveCategory: (category: Partial<ProductCategory>) => void;
    onDeleteCategory: (id: number) => void;
    onSaveBrand: (brand: Partial<ProductBrand>, imageFile: File | null) => Promise<void>;
    onDeleteBrand: (id: number, logoPath?: string) => void;
    onNavigate: (page: AdminNavigationView) => void;
    onBack: () => void;
}

type AdminView = 'list' | 'edit-product';
type ActiveTab = AdminPharmacySection;
type InventoryFilter = AdminPharmacyProductFilter;
type BulkActionType = 'publish' | 'unpublish' | 'feature' | 'unfeature' | 'set_category' | 'set_brand' | 'adjust_stock' | 'set_low_threshold' | 'set_vat_rate' | 'delete';
type DiscountFormState = {
    code: string;
    type: 'percentage' | 'fixed_amount';
    value: string;
    min_purchase_amount: string;
    max_discount_amount: string;
    usage_limit: string;
    usage_limit_per_user: string;
    starts_at: string;
    ends_at: string;
    description: string;
    is_active: boolean;
};
type ProductQuickDraft = {
    sku: string;
    price: string;
    vat_rate: string;
    stock_quantity: string;
    low_stock_threshold: string;
    expiry_date: string;
};
type TaxProfileFormState = {
    code: string;
    name: string;
    tax_mode: TaxProfile['tax_mode'];
    default_rate: string;
    applies_to_shipping: boolean;
    currency: string;
    is_active: boolean;
    is_default: boolean;
    starts_at: string;
    ends_at: string;
};
type TaxRateFormState = {
    tax_profile_id: string;
    province: string;
    district: string;
    rate: string;
    applies_to_shipping: 'inherit' | 'true' | 'false';
    currency: string;
    priority: string;
    is_active: boolean;
    starts_at: string;
    ends_at: string;
};
type OrderStatusFilter = 'all' | OrderFulfillmentStatus;
type OrderPaymentFilter = 'all' | OrderPaymentStatus;
type OrderShippingFilter = 'all' | 'ghtk' | 'manual' | 'none';
const ITEMS_PER_PAGE = 30;
const loadXLSX = () => import('xlsx');
const DEFAULT_PRODUCT_VAT_RATE = 0.1;
const adminActionButtonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-4 py-3 text-sm font-semibold text-foreground transition-all hover:bg-background/50 hover:text-primary hover:shadow-md disabled:opacity-50';
const adminPrimaryActionButtonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border-0 bg-primary/80 backdrop-blur-xl px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const formatOrderRecordedAt = (value?: string | null) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
};

const formatShortDate = (value?: string | null) => {
    if (!value) return 'Chưa có HSD';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(date);
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
    return order.payment_method === 'bank_transfer' ? 'bank_transfer' : 'cod';
};

const getOrderGrandTotal = (order: ProductOrder): number => Number(order.grand_total || order.total_price || 0);

const getOrderTaxTotal = (order: ProductOrder): number => Number(order.tax_amount || 0) + Number(order.shipping_tax_amount || 0);

const getOrderGrossBeforeTax = (order: ProductOrder): number => Math.max(getOrderGrandTotal(order) - getOrderTaxTotal(order), 0);

const getOrderRefundedAmount = (order: ProductOrder): number => {
    const refundLogs = Array.isArray(order.refund_logs) ? order.refund_logs : [];
    return refundLogs.reduce((sum, refund) => {
        if (refund.status === 'failed' || refund.status === 'pending') return sum;
        return sum + Number(refund.amount || 0);
    }, 0);
};

const getPaymentStatusLabel = (status: OrderPaymentStatus, t: any) => {
    if (status === 'paid') return t('admin.payment_status_paid');
    if (status === 'failed') return t('admin.payment_status_failed');
    if (status === 'refunded') return t('admin.payment_status_refunded');
    return t('admin.payment_status_unpaid');
};

const getPaymentMethodLabel = (method: OrderPaymentMethod, t: any) => {
    return method === 'bank_transfer' ? t('admin.payment_method_bank_transfer') : t('admin.payment_method_cod');
};

const getFulfillmentStatusLabel = (status: OrderFulfillmentStatus, t: any) => {
    if (status === 'processing') return t('admin.order_status_processing');
    if (status === 'shipped') return t('admin.order_status_shipped');
    if (status === 'completed') return t('admin.order_status_completed');
    if (status === 'cancelled') return t('admin.order_status_cancelled');
    return t('admin.order_status_pending');
};

const getOrderItemCount = (order: ProductOrder): number =>
    Array.isArray(order.order_items)
        ? order.order_items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
        : 0;

const getShippingTypeLabel = (shippingType: OrderShippingFilter): string => {
    if (shippingType === 'ghtk') return 'GHTK';
    if (shippingType === 'manual') return 'Nhà vận chuyển khác';
    if (shippingType === 'none') return 'Chưa có vận chuyển';
    return 'Tất cả vận chuyển';
};

const getShippingTypeTone = (shippingType: OrderShippingFilter): string => {
    if (shippingType === 'ghtk') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (shippingType === 'manual') return 'border-sky-200 bg-sky-50 text-sky-700';
    if (shippingType === 'none') return 'border-border bg-background text-muted-foreground';
    return 'border-border bg-background text-foreground';
};

const getFulfillmentTone = (status: OrderFulfillmentStatus): string => {
    if (status === 'processing') return 'border-amber-200 bg-amber-50 text-amber-700';
    if (status === 'shipped') return 'border-sky-200 bg-sky-50 text-sky-700';
    if (status === 'completed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (status === 'cancelled') return 'border-rose-200 bg-rose-50 text-rose-700';
    return 'border-border bg-background text-muted-foreground';
};

const getPaymentTone = (status: OrderPaymentStatus): string => {
    if (status === 'paid') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (status === 'failed') return 'border-rose-200 bg-rose-50 text-rose-700';
    if (status === 'refunded') return 'border-orange-200 bg-orange-50 text-orange-700';
    return 'border-border bg-background text-muted-foreground';
};

const StatusChip: React.FC<{ label: string; tone: string }> = ({ label, tone }) => (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{label}</span>
);

const getAllowedTransitionTargets = (status: OrderFulfillmentStatus): OrderFulfillmentStatus[] => {
    if (status === 'pending') return ['pending', 'processing', 'cancelled'];
    if (status === 'processing') return ['processing', 'shipped', 'cancelled'];
    if (status === 'shipped') return ['shipped', 'completed', 'cancelled'];
    if (status === 'completed') return ['completed'];
    return ['cancelled'];
};

const toDatetimeLocalInput = (value?: string | null): string => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const createEmptyDiscountForm = (): DiscountFormState => ({
    code: '',
    type: 'percentage',
    value: '',
    min_purchase_amount: '0',
    max_discount_amount: '',
    usage_limit: '',
    usage_limit_per_user: '',
    starts_at: '',
    ends_at: '',
    description: '',
    is_active: true,
});

const createEmptyTaxProfileForm = (): TaxProfileFormState => ({
    code: '',
    name: '',
    tax_mode: 'exclusive',
    default_rate: '10',
    applies_to_shipping: false,
    currency: 'VND',
    is_active: true,
    is_default: false,
    starts_at: '',
    ends_at: '',
});

const createEmptyTaxRateForm = (): TaxRateFormState => ({
    tax_profile_id: '',
    province: '',
    district: '',
    rate: '10',
    applies_to_shipping: 'inherit',
    currency: '',
    priority: '0',
    is_active: true,
    starts_at: '',
    ends_at: '',
});

const rateToPercentInput = (value?: number | null): string => {
    const numeric = Number(value ?? DEFAULT_PRODUCT_VAT_RATE);
    if (!Number.isFinite(numeric)) return '10';
    const percent = Math.round(numeric * 10000) / 100;
    return String(percent).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
};

const MAX_ORDER_ITEM_PREVIEW_IMAGES = 4;

const getProductAvatarLabel = (name?: string): string => {
    const normalized = String(name || '').trim();
    if (!normalized) return 'SP';
    const words = normalized.split(/\s+/).filter(Boolean);
    return words.slice(0, 2).map((word) => word.charAt(0)).join('').toUpperCase();
};

interface OrderRowProps {
    order: ProductOrder;
    onUpdate: (id: string, updates: Partial<ProductOrder>) => void;
    isSelected: boolean;
    onToggleSelect: (orderId: string) => void;
    onViewDetails: (order: ProductOrder) => void;
    rowIndex?: number;
}

const OrderRow: React.FC<OrderRowProps> = ({ order, onUpdate, isSelected, onToggleSelect, onViewDetails, rowIndex = 0 }) => {
    const { t } = useTranslation();
    const [status, setStatus] = useState<OrderFulfillmentStatus>(getOrderFulfillmentStatus(order));
    const [shippingCode, setShippingCode] = useState(order.shipping_code || '');
    const [isSaving, setIsSaving] = useState(false);
    const [isCreatingShipment, setIsCreatingShipment] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const { addToast } = useToast();
    const fulfillmentStatus = getOrderFulfillmentStatus(order);
    const paymentStatus = getOrderPaymentStatus(order);
    const paymentMethod = getOrderPaymentMethod(order);
    const shippingType: OrderShippingFilter = order.shipping_provider?.toLowerCase() === 'ghtk'
        ? 'ghtk'
        : order.shipping_code
            ? 'manual'
            : 'none';
    const allowedStatusTargets = useMemo(
        () => getAllowedTransitionTargets(fulfillmentStatus),
        [fulfillmentStatus]
    );
    const itemCount = getOrderItemCount(order);
    const orderTotal = getOrderGrandTotal(order);
    const orderTax = getOrderTaxTotal(order);
    const orderDiscount = Number(order.discount_amount || 0);
    const orderItemPreviewImages = useMemo(
        () =>
            (order.order_items || []).map((item, index) => {
                const quantity = Math.max(1, Number(item.quantity || 1));
                const productName = getOrderItemDisplayName(item);
                const imageUrl = item.product?.main_image_url || item.product?.images?.[0]?.image_url || '';
                const rawStockQuantity = item.product?.stock_quantity;
                const hasStockQuantity = rawStockQuantity !== null
                    && rawStockQuantity !== undefined
                    && String(rawStockQuantity).trim() !== '';
                const parsedStockQuantity = hasStockQuantity ? Number(rawStockQuantity) : null;
                const stockQuantity = parsedStockQuantity !== null && Number.isFinite(parsedStockQuantity)
                    ? parsedStockQuantity
                    : null;
                const stockStatus = stockQuantity === null
                    ? 'unknown'
                    : stockQuantity > 0
                        ? 'in_stock'
                        : 'out_of_stock';
                return {
                    id: `${item.id}-${index}`,
                    productName,
                    imageUrl,
                    quantity,
                    stockQuantity,
                    stockStatus,
                    monogram: getProductAvatarLabel(productName),
                };
            }),
        [order.order_items]
    );
    const visibleOrderItemPreviewImages = orderItemPreviewImages.slice(0, MAX_ORDER_ITEM_PREVIEW_IMAGES);
    const hiddenOrderItemPreviewCount = Math.max(0, orderItemPreviewImages.length - visibleOrderItemPreviewImages.length);

    useEffect(() => {
        setStatus(getOrderFulfillmentStatus(order));
        setShippingCode(order.shipping_code || '');
    }, [order.status, order.fulfillment_status, order.shipping_code]);

    const handleUpdate = async () => {
        setIsSaving(true);
        try {
            let hasChanged = false;
            let mergedUpdates: Partial<ProductOrder> = {};

            if (status !== fulfillmentStatus) {
                const transitionedOrder = await api.transitionOrderStatus(order.id, status, 'Admin cập nhật trạng thái đơn hàng');
                mergedUpdates = { ...mergedUpdates, ...transitionedOrder };
                hasChanged = true;
            }

            if (order.shipping_provider?.toLowerCase() !== 'ghtk' && shippingCode !== (order.shipping_code || '')) {
                const updatedShippingOrder = await api.updateProductOrder(order.id, { shipping_code: shippingCode });
                mergedUpdates = { ...mergedUpdates, ...updatedShippingOrder };
                hasChanged = true;
            }

            if (!hasChanged) {
                addToast('Không có thay đổi để lưu.', { type: 'success' });
                return;
            }

            addToast(`Đã cập nhật đơn hàng ${order.order_code}`, { type: 'success' });
            onUpdate(order.id, mergedUpdates);
        } catch (error: any) {
            addToast('Lỗi cập nhật', { type: 'error', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreateGhtkShipment = async () => {
        setIsCreatingShipment(true);
        try {
            const updatedOrder = await api.createGhtkShipment(order.id);
            onUpdate(order.id, updatedOrder);
            addToast('Đã gửi yêu cầu tạo vận đơn GHTK', { type: 'success', description: 'Hệ thống đang xử lý ở chế độ nền.' });
        } catch (error: any) {
            addToast('Lỗi tạo vận đơn', { type: 'error', description: error.message });
        } finally {
            setIsCreatingShipment(false);
        }
    }

    const handlePrintLabel = async () => {
        setIsPrinting(true);
        try {
            await api.printGhtkLabel(order.id);
        } catch (error: any) {
            addToast('Lỗi in nhãn', { type: 'error', description: error.message });
        } finally {
            setIsPrinting(false);
        }
    };

    const handleCancelShipment = async () => {
        if (!window.confirm(`Bạn có chắc muốn hủy vận đơn GHTK cho đơn hàng ${order.order_code}? Hành động này không thể hoàn tác.`)) {
            return;
        }
        setIsCancelling(true);
        try {
            const updatedOrder = await api.cancelGhtkShipment(order.id);
            onUpdate(order.id, updatedOrder);
            addToast('Đã gửi yêu cầu hủy vận đơn GHTK', { type: 'success', description: 'Hệ thống đang xử lý ở chế độ nền.' });
        } catch (error: any) {
            addToast('Lỗi hủy vận đơn', { type: 'error', description: error.message });
        } finally {
            setIsCancelling(false);
        }
    };

    const isNearTop = rowIndex < 3;

    return (
        <tr className="border-b border-border last:border-0 align-top transition-colors hover:bg-muted/20 relative hover:z-40">
            <td className="px-3 py-4 text-center align-top">
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(order.id)}
                    className="h-4 w-4 rounded border-input"
                    aria-label={`Chọn đơn ${order.order_code || order.id}`}
                />
            </td>
            <td className="px-4 py-4 align-top">
                <div className="space-y-2">
                    <button
                        type="button"
                        onClick={() => onViewDetails(order)}
                        className="font-mono text-sm font-semibold text-primary transition-colors hover:text-primary/80 hover:underline"
                    >
                        #{order.order_code?.slice(-4)}
                    </button>
                    <div className="text-xs leading-5 text-muted-foreground">
                        <p>{new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(order.created_at)).replace(',', '')}</p>
                        {order.shipping_code ? <p className="font-medium text-foreground/80">Mã vận đơn: {order.shipping_code}</p> : null}
                    </div>
                </div>
            </td>
            <td className="px-4 py-4 align-top relative">
                {visibleOrderItemPreviewImages.length > 0 ? (
                    <div
                        className="flex items-center"
                        aria-label={`${itemCount} sản phẩm trong đơn`}
                    >
                        <div className="flex -space-x-3">
                            {visibleOrderItemPreviewImages.map((item) => (
                                <div key={item.id} className="group relative hover:z-50 cursor-pointer">
                                    <div
                                        className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-card bg-muted text-[11px] font-bold text-foreground shadow-sm transition-transform group-hover:scale-105"
                                    >
                                        {item.imageUrl ? (
                                            <img
                                                src={item.imageUrl}
                                                alt={item.productName}
                                                className="h-full w-full object-cover"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <span>{item.monogram}</span>
                                        )}
                                    </div>
                                    <div className={`absolute left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col w-60 overflow-hidden rounded-2xl bg-zinc-950/95 p-3 text-white shadow-2xl backdrop-blur-md z-[9999] pointer-events-none transition-all duration-200 border border-white/15 ${isNearTop ? 'top-full mt-2.5' : 'bottom-full mb-2.5'}`}>
                                        {item.imageUrl ? (
                                            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted/30">
                                                <img
                                                    src={item.imageUrl}
                                                    alt={item.productName}
                                                    className="h-full w-full object-cover rounded-xl"
                                                    loading="eager"
                                                />
                                            </div>
                                        ) : null}
                                        <div className={item.imageUrl ? 'mt-2.5 space-y-1 text-left' : 'space-y-1 text-left'}>
                                            <p className="text-xs font-bold leading-snug line-clamp-2 text-white">{item.productName}</p>
                                            <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[11px] text-zinc-300">
                                                <span>SL mua: <strong className="text-white">{item.quantity}</strong></span>
                                                {item.stockStatus === 'in_stock' ? (
                                                    <span className="font-semibold text-emerald-400">Còn hàng ({item.stockQuantity})</span>
                                                ) : item.stockStatus === 'out_of_stock' ? (
                                                    <span className="font-semibold text-rose-400">Hết hàng</span>
                                                ) : (
                                                    <span className="font-semibold text-amber-300">Chưa có kho</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${isNearTop ? 'bottom-full -mb-0.5 border-b-zinc-950/95' : 'top-full -mt-0.5 border-t-zinc-950/95'}`}></div>
                                    </div>
                                </div>
                            ))}
                            {hiddenOrderItemPreviewCount > 0 ? (
                                <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-card bg-primary/10 text-[11px] font-bold text-primary shadow-sm z-0">
                                    +{hiddenOrderItemPreviewCount}
                                </div>
                            ) : null}
                        </div>
                    </div>
                ) : (
                    <StatusChip label={`${itemCount} SP`} tone="border-border bg-background text-muted-foreground" />
                )}
            </td>
            <td className="px-4 py-4 align-top">
                <div className="space-y-1.5">
                    <p className="font-semibold">{order.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                    <p className="text-xs text-muted-foreground">{[order.shipping_ward, order.shipping_district, order.shipping_province].filter(Boolean).join(', ')}</p>
                </div>
            </td>
            <td className="px-4 py-4 align-top">
                <div className="space-y-1.5">
                    <p className="font-semibold">{formatCurrency(orderTotal)}</p>
                    {orderDiscount > 0 && <p className="text-xs text-green-600">Giảm: {formatCurrency(orderDiscount)}</p>}
                    {orderTax > 0 && <p className="text-xs text-muted-foreground">Thuế: {formatCurrency(orderTax)}</p>}
                </div>
            </td>
            <td className="px-4 py-4 align-top w-[140px]">
                <div className="w-fit">
                    <select 
                        value={status} 
                        onChange={e => setStatus(e.target.value as OrderFulfillmentStatus)} 
                        className={`w-full rounded-xl border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider outline-none focus:ring-2 focus:ring-primary/20 transition-colors ${getFulfillmentTone(status)}`}
                    >
                        {allowedStatusTargets.includes('pending') && <option value="pending">{t('admin.order_status_pending')}</option>}
                        {allowedStatusTargets.includes('processing') && <option value="processing">{t('admin.order_status_processing')}</option>}
                        {allowedStatusTargets.includes('shipped') && <option value="shipped">{t('admin.order_status_shipped')}</option>}
                        {allowedStatusTargets.includes('completed') && <option value="completed">{t('admin.order_status_completed')}</option>}
                        {allowedStatusTargets.includes('cancelled') && <option value="cancelled">{t('admin.order_status_cancelled')}</option>}
                    </select>
                </div>
            </td>
            <td className="px-4 py-4 align-top">
                <div className="flex flex-row flex-wrap items-center justify-end gap-1.5">
                    <div className="relative group inline-flex">
                        <button
                            type="button"
                            onClick={() => onViewDetails(order)}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-foreground transition-all hover:scale-110 hover:border-primary hover:text-primary active:scale-95"
                            aria-label="Chi tiết đơn hàng"
                        >
                            <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="Chi tiết" className="w-5 h-5 object-contain inline-block" />
                        </button>
                        <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                            Chi tiết
                        </span>
                    </div>
                    <div className="relative group inline-flex">
                        <button
                            type="button"
                            onClick={handleUpdate}
                            disabled={isSaving || isCreatingShipment || isCancelling}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:scale-110 hover:bg-primary/90 active:scale-95 disabled:bg-muted disabled:scale-100"
                            aria-label={t('common.save', 'Lưu thay đổi')}
                        >
                            {isSaving ? <Spinner className="w-4 h-4" /> : <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-save.webp" alt="Lưu" className="w-5 h-5 object-contain inline-block" />}
                        </button>
                        <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                            Lưu đơn
                        </span>
                    </div>
                    {order.shipping_provider?.toLowerCase() === 'ghtk' && order.ghtk_label && (
                        <>
                            <div className="relative group inline-flex">
                                <button
                                    type="button"
                                    onClick={handlePrintLabel}
                                    disabled={isPrinting}
                                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-secondary-foreground transition-all hover:scale-110 hover:bg-secondary/80 active:scale-95 disabled:bg-muted disabled:scale-100"
                                    aria-label="In nhãn GHTK"
                                >
                                    {isPrinting ? <Spinner className="w-4 h-4" /> : <PrinterIcon className="h-4 w-4" />}
                                </button>
                                <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                    In nhãn
                                </span>
                            </div>
                            {fulfillmentStatus === 'processing' && (
                                <div className="relative group inline-flex">
                                    <button
                                        type="button"
                                        onClick={handleCancelShipment}
                                        disabled={isCancelling}
                                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10 text-destructive transition-all hover:scale-110 hover:bg-destructive/20 active:scale-95 disabled:bg-muted disabled:scale-100"
                                        aria-label="Hủy vận đơn GHTK"
                                    >
                                        {isCancelling ? <Spinner className="w-4 h-4" /> : <XCircleIcon className="h-4 w-4" />}
                                    </button>
                                    <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                        Hủy vận đơn
                                    </span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </td>
        </tr>
    );
};


const AdminPharmacyManagementPage: React.FC<AdminPharmacyManagementPageProps> = (props) => {
    const { products, categories, brands, productOrders, initialSection, initialAction, initialOrderId, initialOrderPreset, initialProductFilter, onUpdateOrders, onSaveProduct, onBulkUpdateProducts, onDeleteProduct, onBulkDeleteProducts, onSaveCategory, onDeleteCategory, onSaveBrand, onDeleteBrand, onNavigate, onBack } = props;
    const { t } = useTranslation();
    const useD1Api = String(import.meta.env.VITE_DATA_BACKEND || '').toLowerCase() === 'd1';
    const ghtkWebhookSampleUrl = `${window.location.origin}/api/webhooks/ghtk`;
    const [activeTab, setActiveTab] = useState<ActiveTab>(initialSection || 'products');
    const [view, setView] = useState<AdminView>('list');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const setSidebarConfig = useAdminLayoutDispatch();
    const { addToast } = useToast();

    const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>(initialProductFilter || 'all');
    const [searchQuery, setSearchQuery] = useState('');
    const [productSortColumn, setProductSortColumn] = useState<'id' | 'name' | 'price' | 'status'>('id');
    const [productSortDirection, setProductSortDirection] = useState<'asc' | 'desc'>('desc');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
    const [selectedBrand, setSelectedBrand] = useState<string>('all');
    const [quickDrafts, setQuickDrafts] = useState<Record<number, ProductQuickDraft>>({});
    const [savingQuickProductId, setSavingQuickProductId] = useState<number | null>(null);
    const [syncingPancakeProductId, setSyncingPancakeProductId] = useState<number | null>(null);
    const [isSyncingPancakeProducts, setIsSyncingPancakeProducts] = useState(false);
    const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
    const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
    const [bulkAction, setBulkAction] = useState<BulkActionType>('publish');
    const [bulkCategoryId, setBulkCategoryId] = useState<string>('all');
    const [bulkBrandName, setBulkBrandName] = useState<string>('all');
    const [bulkNumericValue, setBulkNumericValue] = useState<string>('');
    const [isApplyingBulkAction, setIsApplyingBulkAction] = useState(false);
    const [openMobileMenuProductId, setOpenMobileMenuProductId] = useState<number | null>(null);

    useEffect(() => {
        if (!openMobileMenuProductId) return;
        const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target?.closest('[data-mobile-action-menu]')) {
                setOpenMobileMenuProductId(null);
            }
        };
        document.addEventListener('click', handleOutsideClick);
        document.addEventListener('touchstart', handleOutsideClick);
        return () => {
            document.removeEventListener('click', handleOutsideClick);
            document.removeEventListener('touchstart', handleOutsideClick);
        };
    }, [openMobileMenuProductId]);

    const [isImporting, setIsImporting] = useState(false);
    const productFileInputRef = useRef<HTMLInputElement>(null);
    const categoryFileInputRef = useRef<HTMLInputElement>(null);

    const [productsCurrentPage, setProductsCurrentPage] = useState(1);
    const [productContentReviewsById, setProductContentReviewsById] = useState<Record<number, ProductContentReviewRecord>>({});
    const [isLoadingProductContentReviews, setIsLoadingProductContentReviews] = useState(false);
    const [ordersCurrentPage, setOrdersCurrentPage] = useState(1);
    const [orderSearchQuery, setOrderSearchQuery] = useState('');
    const [orderOpsPreset, setOrderOpsPreset] = useState<AdminPharmacyOrderPreset>(initialOrderPreset || 'all');
    const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatusFilter>('all');
    const [orderPaymentFilter, setOrderPaymentFilter] = useState<OrderPaymentFilter>('all');
    const [orderShippingFilter, setOrderShippingFilter] = useState<OrderShippingFilter>('all');
    const [orderDateFrom, setOrderDateFrom] = useState('');
    const [orderDateTo, setOrderDateTo] = useState('');
    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
    const [bulkOrderStatus, setBulkOrderStatus] = useState<OrderFulfillmentStatus>('processing');
    const [isApplyingOrderBulkStatus, setIsApplyingOrderBulkStatus] = useState(false);
    const [isExportingOrders, setIsExportingOrders] = useState(false);
    const [selectedOrderDetail, setSelectedOrderDetail] = useState<ProductOrder | null>(
        initialOrderId ? productOrders.find(o => String(o.id) === initialOrderId) || null : null
    );

    useEffect(() => {
        if (initialAction === 'order-detail' && initialOrderId) {
            const order = productOrders.find(o => String(o.id) === initialOrderId);
            if (order) setSelectedOrderDetail(order);
        } else {
            setSelectedOrderDetail(null);
        }
    }, [initialAction, initialOrderId, productOrders]);
    const [orderStatusHistory, setOrderStatusHistory] = useState<OrderStatusHistory[]>([]);
    const [orderPaymentLogs, setOrderPaymentLogs] = useState<OrderPaymentLog[]>([]);
    const [orderRefundLogs, setOrderRefundLogs] = useState<OrderRefundLog[]>([]);
    const [isLoadingOrderLifecycle, setIsLoadingOrderLifecycle] = useState(false);
    const [refundAmount, setRefundAmount] = useState('');
    const [refundReason, setRefundReason] = useState('');
    const [refundRestock, setRefundRestock] = useState(false);
    const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);

    // State for category management
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategorySlug, setNewCategorySlug] = useState('');
    const [newCategoryIsFeatured, setNewCategoryIsFeatured] = useState(false);
    const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
    const [editCategoryName, setEditCategoryName] = useState('');
    const [editCategorySlug, setEditCategorySlug] = useState('');
    const [isCategoryFormVisible, setIsCategoryFormVisible] = useState(false);

    // State for brand management
    const [newBrandName, setNewBrandName] = useState('');
    const [newBrandSlug, setNewBrandSlug] = useState('');
    const [newBrandDescription, setNewBrandDescription] = useState('');
    const [newBrandImage, setNewBrandImage] = useState<File | null>(null);
    const [brandSearchQuery, setBrandSearchQuery] = useState('');
    const [isSavingBrand, setIsSavingBrand] = useState(false);
    const [editingBrandId, setEditingBrandId] = useState<number | null>(null);
    const [editBrandName, setEditBrandName] = useState('');
    const [editBrandSlug, setEditBrandSlug] = useState('');
    const [editBrandDescription, setEditBrandDescription] = useState('');
    const [editBrandImage, setEditBrandImage] = useState<File | null>(null);
    const [isSavingEditBrand, setIsSavingEditBrand] = useState(false);
    const [isBrandFormVisible, setIsBrandFormVisible] = useState(false);

    // State for GHTK pick addresses
    const [pickAddresses, setPickAddresses] = useState<GhtkPickAddress[]>([]);
    const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
    const [ghtkConnectionStatus, setGhtkConnectionStatus] = useState<'unknown' | 'ready' | 'missing_token' | 'error'>('unknown');
    const [selectedAddressDetail, setSelectedAddressDetail] = useState<GhtkPickAddressDetail | null>(null);
    const [isLoadingAddressDetail, setIsLoadingAddressDetail] = useState(false);

    const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
    const [isLoadingDiscountCodes, setIsLoadingDiscountCodes] = useState(false);
    const [isSavingDiscountCode, setIsSavingDiscountCode] = useState(false);
    const [deletingDiscountId, setDeletingDiscountId] = useState<string | null>(null);
    const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null);
    const [discountForm, setDiscountForm] = useState<DiscountFormState>(createEmptyDiscountForm());
    const [taxProfiles, setTaxProfiles] = useState<TaxProfile[]>([]);
    const [isLoadingTaxSettings, setIsLoadingTaxSettings] = useState(false);
    const [isSavingTaxProfile, setIsSavingTaxProfile] = useState(false);
    const [isSavingTaxRate, setIsSavingTaxRate] = useState(false);
    const [editingTaxProfileId, setEditingTaxProfileId] = useState<string | null>(null);
    const [editingTaxRateId, setEditingTaxRateId] = useState<string | null>(null);
    const [deletingTaxProfileId, setDeletingTaxProfileId] = useState<string | null>(null);
    const [deletingTaxRateId, setDeletingTaxRateId] = useState<string | null>(null);
    const [taxProfileForm, setTaxProfileForm] = useState<TaxProfileFormState>(createEmptyTaxProfileForm());
    const [taxRateForm, setTaxRateForm] = useState<TaxRateFormState>(createEmptyTaxRateForm());
    const lastHandledInitialActionRef = useRef<'new-product' | null>(null);

    const closeProductEditor = () => {
        setSelectedProduct(null);
        setView('list');
    };

    const openProductEditor = (product: Product | null) => {
        setSelectedProduct(product);
        setView('edit-product');
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleEditProduct = (product: Product) => {
        openProductEditor(product);
    };

    const handleAddNewProduct = () => {
        openProductEditor(null);
    };

    const handleSaveProductForm = async (product: Partial<Product>, imagesToDelete: ProductImage[]) => {
        const savedProduct = await onSaveProduct(product, imagesToDelete);
        setSelectedProduct(savedProduct);
        setView('edit-product');
        return savedProduct;
    };

    useEffect(() => {
        setActiveTab(initialSection || 'products');
        setView('list');
        setSelectedProduct(null);
    }, [initialSection]);

    useEffect(() => {
        setInventoryFilter(initialProductFilter || 'all');
        setProductsCurrentPage(1);
        setSelectedProductIds([]);
    }, [initialProductFilter]);

    useEffect(() => {
        const preset = initialOrderPreset || 'all';
        setOrderOpsPreset(preset);
        setOrderSearchQuery('');
        setOrderDateFrom('');
        setOrderDateTo('');
        setSelectedOrderIds([]);
        setSelectedOrderDetail(null);

        if (preset === 'shipping_handover') {
            setOrderStatusFilter('all');
            setOrderPaymentFilter('all');
            setOrderShippingFilter('none');
            return;
        }

        if (preset === 'bank_transfer_followup') {
            setOrderStatusFilter('all');
            setOrderPaymentFilter('unpaid');
            setOrderShippingFilter('all');
            return;
        }

        if (preset === 'today_watch') {
            const today = new Date().toISOString().slice(0, 10);
            setOrderStatusFilter('all');
            setOrderPaymentFilter('all');
            setOrderShippingFilter('all');
            setOrderDateFrom(today);
            setOrderDateTo(today);
            return;
        }

        setOrderStatusFilter('all');
        setOrderPaymentFilter('all');
        setOrderShippingFilter('all');
    }, [initialOrderPreset]);

    useEffect(() => {
        if (initialAction === 'new-product' && lastHandledInitialActionRef.current !== initialAction) {
            lastHandledInitialActionRef.current = initialAction;
            setActiveTab('products');
            handleAddNewProduct();
            return;
        }

        if (!initialAction) {
            lastHandledInitialActionRef.current = null;
        }
    }, [initialAction]);

    useEffect(() => {
        if (activeTab === 'discounts' && discountCodes.length === 0 && !isLoadingDiscountCodes) void loadDiscountCodes();
        if (activeTab === 'taxes' && taxProfiles.length === 0 && !isLoadingTaxSettings) void loadTaxSettings();
    }, [activeTab, discountCodes.length, isLoadingDiscountCodes, taxProfiles.length, isLoadingTaxSettings]);

    const resetTaxProfileForm = () => {
        setEditingTaxProfileId(null);
        setTaxProfileForm(createEmptyTaxProfileForm());
    };

    const resetTaxRateForm = (preferredProfileId?: string) => {
        setEditingTaxRateId(null);
        setTaxRateForm({
            ...createEmptyTaxRateForm(),
            tax_profile_id: preferredProfileId || taxProfiles.find(profile => profile.is_default)?.id || taxProfiles[0]?.id || '',
        });
    };

    const handleAddNewCategory = (e: React.FormEvent) => {
        e.preventDefault();
        if (newCategoryName && newCategorySlug) {
            onSaveCategory({ name: newCategoryName, slug: newCategorySlug, is_featured: newCategoryIsFeatured });
            setNewCategoryName('');
            setNewCategorySlug('');
            setNewCategoryIsFeatured(false);
            setIsCategoryFormVisible(false);
        }
    }

    const handleStartEditCategory = (cat: ProductCategory) => {
        setEditingCategoryId(cat.id);
        setEditCategoryName(cat.name);
        setEditCategorySlug(cat.slug);
    };

    const handleSaveEditCategory = () => {
        if (editingCategoryId && editCategoryName && editCategorySlug) {
            const originalCat = categories.find(c => c.id === editingCategoryId);
            onSaveCategory({ ...originalCat, id: editingCategoryId, name: editCategoryName, slug: editCategorySlug });
            setEditingCategoryId(null);
        }
    };

    const handleCancelEditCategory = () => {
        setEditingCategoryId(null);
    };

    const handleAddNewBrand = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newBrandName && newBrandSlug) {
            setIsSavingBrand(true);
            try {
                await onSaveBrand({ name: newBrandName, slug: newBrandSlug, description: newBrandDescription.trim() || undefined }, newBrandImage);
                setNewBrandName('');
                setNewBrandSlug('');
                setNewBrandDescription('');
                setNewBrandImage(null);
                setIsBrandFormVisible(false);
            } catch (e: any) {
                addToast('Lưu thương hiệu thất bại', {
                    type: 'error',
                    description: e?.message || 'Không thể thêm thương hiệu mới.',
                });
            }
            finally { setIsSavingBrand(false); }
        }
    }

    const handleStartEditBrand = (brand: ProductBrand) => {
        setEditingBrandId(brand.id);
        setEditBrandName(brand.name);
        setEditBrandSlug(brand.slug);
        setEditBrandDescription(brand.description || '');
        setEditBrandImage(null);
        setIsBrandFormVisible(true);
    };

    const handleSaveEditBrand = async () => {
        if (editingBrandId && editBrandName && editBrandSlug) {
            setIsSavingEditBrand(true);
            try {
                const existingBrand = brands.find(b => b.id === editingBrandId);
                await onSaveBrand(
                    {
                        id: editingBrandId,
                        name: editBrandName,
                        slug: editBrandSlug,
                        description: editBrandDescription.trim() || undefined,
                        logo_path: existingBrand?.logo_path,
                    },
                    editBrandImage
                );
                setEditingBrandId(null);
                setEditBrandDescription('');
                setEditBrandImage(null);
                setIsBrandFormVisible(false);
            } catch (e: any) {
                addToast('Cập nhật thương hiệu thất bại', {
                    type: 'error',
                    description: e?.message || 'Không thể cập nhật logo thương hiệu.',
                });
            }
            finally { setIsSavingEditBrand(false); }
        }
    };

    const handleCancelEditBrand = () => {
        setEditingBrandId(null);
        setEditBrandDescription('');
        setEditBrandImage(null);
        setIsBrandFormVisible(false);
    };

    const handleDeleteBrandConfirm = (brand: ProductBrand) => {
        const linkedCount = brandMetrics.get(normalizeBrandMatchKey(brand.name))?.total || 0;
        const warning = linkedCount > 0
            ? `Thương hiệu "${brand.name}" đang được dùng ở ${linkedCount} sản phẩm. Bạn vẫn muốn xóa?`
            : `Bạn có chắc muốn xóa thương hiệu "${brand.name}"?`;

        if (!window.confirm(warning)) return;
        onDeleteBrand(brand.id, brand.logo_path);
    };

    const newBrandPreviewUrl = useMemo(
        () => (newBrandImage ? URL.createObjectURL(newBrandImage) : null),
        [newBrandImage]
    );

    const editBrandPreviewUrl = useMemo(
        () => (editBrandImage ? URL.createObjectURL(editBrandImage) : null),
        [editBrandImage]
    );

    useEffect(() => {
        return () => {
            if (newBrandPreviewUrl) URL.revokeObjectURL(newBrandPreviewUrl);
        };
    }, [newBrandPreviewUrl]);

    useEffect(() => {
        return () => {
            if (editBrandPreviewUrl) URL.revokeObjectURL(editBrandPreviewUrl);
        };
    }, [editBrandPreviewUrl]);

    const handleUpdateOrderInState = (orderId: string, updates: Partial<ProductOrder>) => {
        onUpdateOrders(prevOrders =>
            prevOrders.map(order =>
                order.id === orderId ? { ...order, ...updates } : order
            )
        );
        setSelectedOrderDetail(prev => (
            prev && prev.id === orderId ? { ...prev, ...updates } : prev
        ));
    };

    const getShippingType = (order: ProductOrder): OrderShippingFilter => {
        const provider = (order.shipping_provider || '').trim().toLowerCase();
        if (!provider) return 'none';
        if (provider === 'ghtk') return 'ghtk';
        return 'manual';
    };

    useEffect(() => {
        if (!selectedOrderDetail) {
            setOrderStatusHistory([]);
            setOrderPaymentLogs([]);
            setOrderRefundLogs([]);
            setIsLoadingOrderLifecycle(false);
            setRefundAmount('');
            setRefundReason('');
            setRefundRestock(false);
            return;
        }

        let cancelled = false;
        setIsLoadingOrderLifecycle(true);
        setRefundReason('');
        setRefundRestock(false);
        setRefundAmount(String(Number(selectedOrderDetail.grand_total || selectedOrderDetail.total_price || 0)));

        void api.getOrderLifecycleLogs(selectedOrderDetail.id)
            .then((logs) => {
                if (cancelled) return;
                setOrderStatusHistory(logs.statusHistory);
                setOrderPaymentLogs(logs.paymentLogs);
                setOrderRefundLogs(logs.refundLogs);
            })
            .catch((error: any) => {
                if (cancelled) return;
                addToast('Không thể tải lịch sử đơn hàng', { type: 'error', description: error.message });
                setOrderStatusHistory([]);
                setOrderPaymentLogs([]);
                setOrderRefundLogs([]);
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoadingOrderLifecycle(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [selectedOrderDetail?.id]);

    const handleCreateRefund = async () => {
        if (!selectedOrderDetail) return;

        const amount = Number(refundAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            addToast('Số tiền hoàn không hợp lệ.', { type: 'error' });
            return;
        }

        setIsSubmittingRefund(true);
        try {
            const updatedOrder = await api.createOrderRefund({
                orderId: selectedOrderDetail.id,
                amount,
                reason: refundReason.trim() || undefined,
                restock: refundRestock,
            });

            handleUpdateOrderInState(updatedOrder.id, updatedOrder);

            const logs = await api.getOrderLifecycleLogs(updatedOrder.id);
            setOrderStatusHistory(logs.statusHistory);
            setOrderPaymentLogs(logs.paymentLogs);
            setOrderRefundLogs(logs.refundLogs);
            handleUpdateOrderInState(updatedOrder.id, {
                ...updatedOrder,
                status_history: logs.statusHistory,
                payment_logs: logs.paymentLogs,
                refund_logs: logs.refundLogs,
            });

            addToast('Tạo hoàn tiền thành công.', { type: 'success' });
        } catch (error: any) {
            addToast('Không thể tạo hoàn tiền', { type: 'error', description: error.message });
        } finally {
            setIsSubmittingRefund(false);
        }
    };

    const filteredOrders = useMemo(() => {
        let result = [...productOrders];

        if (orderOpsPreset !== 'all') {
            result = result.filter((order) => {
                const createdAt = new Date(order.created_at);
                const ageHours = Number.isNaN(createdAt.getTime()) ? 0 : (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
                const fulfillmentStatus = getOrderFulfillmentStatus(order);
                const paymentStatus = getOrderPaymentStatus(order);
                const paymentMethod = getOrderPaymentMethod(order);
                const shippingType = getShippingType(order);
                const refundLogs = Array.isArray(order.refund_logs) ? order.refund_logs : [];

                switch (orderOpsPreset) {
                    case 'priority_queue':
                        return (fulfillmentStatus === 'pending' && ageHours >= 6) || (fulfillmentStatus === 'processing' && ageHours >= 12);
                    case 'shipping_handover':
                        return (fulfillmentStatus === 'processing' || fulfillmentStatus === 'shipped') && (shippingType === 'none' || !String(order.shipping_code || '').trim());
                    case 'bank_transfer_followup':
                        return paymentMethod === 'bank_transfer' && (paymentStatus === 'unpaid' || paymentStatus === 'failed');
                    case 'refund_attention':
                        return paymentStatus === 'refunded' || refundLogs.some((refund) => refund.status === 'pending');
                    case 'today_watch':
                        return new Date(order.created_at).toDateString() === new Date().toDateString();
                    default:
                        return true;
                }
            });
        }

        if (orderSearchQuery.trim()) {
            const query = orderSearchQuery.trim().toLowerCase();
            result = result.filter(order =>
                (order.order_code || '').toLowerCase().includes(query) ||
                (order.customer_name || '').toLowerCase().includes(query) ||
                (order.customer_phone || '').toLowerCase().includes(query) ||
                (order.shipping_code || '').toLowerCase().includes(query)
            );
        }

        if (orderStatusFilter !== 'all') {
            result = result.filter(order => getOrderFulfillmentStatus(order) === orderStatusFilter);
        }

        if (orderPaymentFilter !== 'all') {
            result = result.filter(order => getOrderPaymentStatus(order) === orderPaymentFilter);
        }

        if (orderShippingFilter !== 'all') {
            result = result.filter(order => getShippingType(order) === orderShippingFilter);
        }

        if (orderDateFrom) {
            const startDate = new Date(orderDateFrom);
            startDate.setHours(0, 0, 0, 0);
            result = result.filter(order => {
                const created = new Date(order.created_at);
                return !Number.isNaN(created.getTime()) && created >= startDate;
            });
        }

        if (orderDateTo) {
            const endDate = new Date(orderDateTo);
            endDate.setHours(23, 59, 59, 999);
            result = result.filter(order => {
                const created = new Date(order.created_at);
                return !Number.isNaN(created.getTime()) && created <= endDate;
            });
        }

        return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [productOrders, orderOpsPreset, orderSearchQuery, orderStatusFilter, orderPaymentFilter, orderShippingFilter, orderDateFrom, orderDateTo]);

    const orderWorkspaceQueues = useMemo(() => {
        const priorityQueue = productOrders
            .filter((order) => {
                const createdAt = new Date(order.created_at);
                const ageHours = Number.isNaN(createdAt.getTime()) ? 0 : (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
                const fulfillmentStatus = getOrderFulfillmentStatus(order);
                return (fulfillmentStatus === 'pending' && ageHours >= 6) || (fulfillmentStatus === 'processing' && ageHours >= 12);
            })
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        const shippingHandover = productOrders
            .filter((order) => {
                const fulfillmentStatus = getOrderFulfillmentStatus(order);
                return (fulfillmentStatus === 'processing' || fulfillmentStatus === 'shipped') && (getShippingType(order) === 'none' || !String(order.shipping_code || '').trim());
            })
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        const bankTransferFollowup = productOrders
            .filter((order) => getOrderPaymentMethod(order) === 'bank_transfer' && (getOrderPaymentStatus(order) === 'unpaid' || getOrderPaymentStatus(order) === 'failed'))
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        const refundAttention = productOrders
            .filter((order) => {
                const refundLogs = Array.isArray(order.refund_logs) ? order.refund_logs : [];
                return getOrderPaymentStatus(order) === 'refunded' || refundLogs.some((refund) => refund.status === 'pending');
            })
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const todayWatch = productOrders
            .filter((order) => new Date(order.created_at).toDateString() === new Date().toDateString())
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return { priorityQueue, shippingHandover, bankTransferFollowup, refundAttention, todayWatch };
    }, [productOrders]);

    const orderStats = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const totalRevenue = filteredOrders.reduce((sum, order) => sum + getOrderGrandTotal(order), 0);
        const completedRevenue = filteredOrders
            .filter(order => getOrderFulfillmentStatus(order) === 'completed')
            .reduce((sum, order) => sum + getOrderGrandTotal(order), 0);
        const discountTotal = filteredOrders.reduce((sum, order) => sum + Number(order.discount_amount || 0), 0);
        const taxPayable = filteredOrders.reduce((sum, order) => sum + getOrderTaxTotal(order), 0);
        const refundedAmount = filteredOrders.reduce((sum, order) => sum + getOrderRefundedAmount(order), 0);
        const grossBeforeTax = filteredOrders.reduce((sum, order) => sum + getOrderGrossBeforeTax(order), 0);
        const netRevenue = Math.max(grossBeforeTax - refundedAmount, 0);

        const todayOrders = filteredOrders.filter(order => new Date(order.created_at) >= todayStart).length;
        const monthOrders = filteredOrders.filter(order => new Date(order.created_at) >= monthStart).length;

        const statusCounts = {
            pending: filteredOrders.filter(order => getOrderFulfillmentStatus(order) === 'pending').length,
            processing: filteredOrders.filter(order => getOrderFulfillmentStatus(order) === 'processing').length,
            shipped: filteredOrders.filter(order => getOrderFulfillmentStatus(order) === 'shipped').length,
            completed: filteredOrders.filter(order => getOrderFulfillmentStatus(order) === 'completed').length,
            cancelled: filteredOrders.filter(order => getOrderFulfillmentStatus(order) === 'cancelled').length,
            refunded: filteredOrders.filter(order => getOrderPaymentStatus(order) === 'refunded').length,
        };

        return {
            totalOrders: filteredOrders.length,
            totalRevenue,
            completedRevenue,
            discountTotal,
            taxPayable,
            refundedAmount,
            grossBeforeTax,
            netRevenue,
            todayOrders,
            monthOrders,
            statusCounts,
        };
    }, [filteredOrders]);

    const activeOrderFilterCount = useMemo(() => {
        return [
            orderOpsPreset !== 'all',
            orderSearchQuery.trim() !== '',
            orderStatusFilter !== 'all',
            orderPaymentFilter !== 'all',
            orderShippingFilter !== 'all',
            orderDateFrom !== '',
            orderDateTo !== '',
        ].filter(Boolean).length;
    }, [orderOpsPreset, orderSearchQuery, orderStatusFilter, orderPaymentFilter, orderShippingFilter, orderDateFrom, orderDateTo]);

    const orderPresetLabel = useMemo(() => {
        switch (orderOpsPreset) {
            case 'priority_queue': return 'Ưu tiên ngay';
            case 'shipping_handover': return 'Thiếu vận đơn';
            case 'bank_transfer_followup': return 'Bank transfer chưa chốt';
            case 'refund_attention': return 'Refund cần rà';
            case 'today_watch': return 'Đơn trong ngày';
            default: return 'Tất cả đơn';
        }
    }, [orderOpsPreset]);

    const applyOrderPreset = (preset: AdminPharmacyOrderPreset) => {
        setOrderOpsPreset(preset);
        setOrderSearchQuery('');
        setOrderDateFrom('');
        setOrderDateTo('');
        setSelectedOrderIds([]);
        setSelectedOrderDetail(null);
        setOrdersCurrentPage(1);

        if (preset === 'priority_queue') {
            setOrderStatusFilter('all');
            setOrderPaymentFilter('all');
            setOrderShippingFilter('all');
            return;
        }

        if (preset === 'shipping_handover') {
            setOrderStatusFilter('all');
            setOrderPaymentFilter('all');
            setOrderShippingFilter('none');
            return;
        }

        if (preset === 'bank_transfer_followup') {
            setOrderStatusFilter('all');
            setOrderPaymentFilter('unpaid');
            setOrderShippingFilter('all');
            return;
        }

        if (preset === 'refund_attention') {
            setOrderStatusFilter('all');
            setOrderPaymentFilter('all');
            setOrderShippingFilter('all');
            return;
        }

        if (preset === 'today_watch') {
            const today = new Date().toISOString().slice(0, 10);
            setOrderStatusFilter('all');
            setOrderPaymentFilter('all');
            setOrderShippingFilter('all');
            setOrderDateFrom(today);
            setOrderDateTo(today);
            return;
        }

        setOrderStatusFilter('all');
        setOrderPaymentFilter('all');
        setOrderShippingFilter('all');
    };

    const navigateToOrderPreset = (preset: AdminPharmacyOrderPreset) => {
        applyOrderPreset(preset);
        onNavigate({
            page: 'adminPharmacyManagement',
            section: 'orders',
            ...(preset !== 'all' ? { orderPreset: preset } : {}),
        });
    };

    const navigateToProductFilter = (filter: AdminPharmacyProductFilter) => {
        setInventoryFilter(filter);
        setProductsCurrentPage(1);
        setSelectedProductIds([]);
        onNavigate({
            page: 'adminPharmacyManagement',
            section: 'products',
            ...(filter !== 'all' ? { productFilter: filter } : {}),
        });
    };

    const toggleOrderSelection = (orderId: string) => {
        setSelectedOrderIds(prev => (
            prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
        ));
    };

    const toggleSelectOrders = (orderIds: string[], checked: boolean) => {
        if (checked) {
            setSelectedOrderIds(prev => Array.from(new Set([...prev, ...orderIds])));
            return;
        }
        setSelectedOrderIds(prev => prev.filter(id => !orderIds.includes(id)));
    };

    const handleBulkUpdateOrderStatus = async (orders: ProductOrder[]) => {
        if (!orders.length) {
            addToast('Bạn chưa chọn đơn hàng nào.', { type: 'error' });
            return;
        }

        setIsApplyingOrderBulkStatus(true);
        try {
            const updatedMap = new Map<string, ProductOrder>();
            const eligibleOrders = orders.filter(order => {
                const currentStatus = getOrderFulfillmentStatus(order);
                return currentStatus !== bulkOrderStatus && getAllowedTransitionTargets(currentStatus).includes(bulkOrderStatus);
            });

            if (!eligibleOrders.length) {
                addToast('Không có đơn nào hợp lệ để chuyển trạng thái đã chọn.', { type: 'error' });
                return;
            }
            for (const order of eligibleOrders) {
                const updated = await api.transitionOrderStatus(order.id, bulkOrderStatus, 'Admin cập nhật trạng thái hàng loạt');
                updatedMap.set(order.id, updated);
            }

            onUpdateOrders(prev =>
                prev.map(order => {
                    const updated = updatedMap.get(order.id);
                    return updated ? { ...order, ...updated } : order;
                })
            );

            setSelectedOrderIds([]);
            addToast(`Đã cập nhật trạng thái ${eligibleOrders.length} đơn hàng.`, { type: 'success' });
        } catch (error: any) {
            addToast('Không thể cập nhật trạng thái hàng loạt', { type: 'error', description: error.message });
        } finally {
            setIsApplyingOrderBulkStatus(false);
        }
    };

    const handleExportOrders = async (orders: ProductOrder[]) => {
        if (!orders.length) {
            addToast('Không có đơn hàng để xuất.', { type: 'error' });
            return;
        }

        setIsExportingOrders(true);
        try {
            const rows = orders.map(order => {
                const taxTotal = getOrderTaxTotal(order);
                const grossBeforeTax = getOrderGrossBeforeTax(order);
                const refundedAmount = getOrderRefundedAmount(order);
                const netRevenue = Math.max(grossBeforeTax - refundedAmount, 0);
                return {
                    order_code: order.order_code,
                    created_at: order.created_at,
                    status: order.status,
                    fulfillment_status: getOrderFulfillmentStatus(order),
                    payment_status: getOrderPaymentStatus(order),
                    payment_method: getOrderPaymentMethod(order),
                    customer_name: order.customer_name,
                    customer_phone: order.customer_phone,
                    shipping_provider: order.shipping_provider || '',
                    shipping_code: order.shipping_code || '',
                    shipping_fee: order.shipping_fee || 0,
                    shipping_tax_amount: order.shipping_tax_amount || 0,
                    subtotal_price: order.subtotal_price || 0,
                    discount_code: order.discount_code || '',
                    discount_amount: order.discount_amount || 0,
                    tax_amount: order.tax_amount || 0,
                    tax_total: taxTotal,
                    tax_rate: order.tax_rate || 0,
                    tax_mode: order.tax_mode || 'exclusive',
                    total_price: order.total_price || 0,
                    grand_total: getOrderGrandTotal(order),
                    gross_before_tax: grossBeforeTax,
                    refunded_amount: refundedAmount,
                    net_revenue: netRevenue,
                    item_count: order.order_items?.length || 0,
                    shipping_address: `${order.shipping_street}, ${order.shipping_ward}, ${order.shipping_district}, ${order.shipping_province}`,
                    notes: order.notes || '',
                };
            });

            await handleExport(rows, `Natural_Skin_Orders_${new Date().toISOString().slice(0, 10)}.xlsx`, 'Orders');
            addToast('Đã xuất danh sách đơn hàng.', { type: 'success' });
        } catch (error: any) {
            addToast('Không thể xuất danh sách đơn hàng', { type: 'error', description: error.message });
        } finally {
            setIsExportingOrders(false);
        }
    };

    const handleFetchPickAddresses = async () => {
        setIsLoadingAddresses(true);
        try {
            const addresses = await api.getGhtkPickAddresses();
            setPickAddresses(addresses);
            setGhtkConnectionStatus('ready');
        } catch (error: any) {
            const message = String(error?.message || '');
            if (/GHTK_TOKEN|Missing environment variables/i.test(message)) {
                setGhtkConnectionStatus('missing_token');
            } else {
                setGhtkConnectionStatus('error');
            }
            setPickAddresses([]);
            addToast('Lỗi tải địa chỉ', { type: 'error', description: error.message });
        } finally {
            setIsLoadingAddresses(false);
        }
    };

    const handleViewAddressDetail = async (address: GhtkPickAddress) => {
        setSelectedAddressDetail(address as GhtkPickAddressDetail);
        setIsLoadingAddressDetail(true);
        try {
            const detail = await api.getGhtkPickAddressDetail(address.pick_address_id);
            setSelectedAddressDetail(detail);
        } catch (error: any) {
            addToast('Lỗi', { type: 'error', description: error.message });
            setSelectedAddressDetail(null);
        } finally {
            setIsLoadingAddressDetail(false);
        }
    };

    const resetDiscountForm = () => {
        setEditingDiscountId(null);
        setDiscountForm(createEmptyDiscountForm());
    };

    const loadDiscountCodes = async () => {
        setIsLoadingDiscountCodes(true);
        try {
            const rows = await api.getDiscountCodesAdmin();
            setDiscountCodes(rows);
        } catch (error: any) {
            addToast('Lỗi tải mã giảm giá', { type: 'error', description: error.message });
        } finally {
            setIsLoadingDiscountCodes(false);
        }
    };

    const handleStartEditDiscount = (discount: DiscountCode) => {
        if (!discount.id) return;
        setEditingDiscountId(discount.id);
        setDiscountForm({
            code: discount.code || '',
            type: discount.type || 'percentage',
            value: discount.value != null ? String(discount.value) : '',
            min_purchase_amount: discount.min_purchase_amount != null ? String(discount.min_purchase_amount) : '0',
            max_discount_amount: discount.max_discount_amount != null ? String(discount.max_discount_amount) : '',
            usage_limit: discount.usage_limit != null ? String(discount.usage_limit) : '',
            usage_limit_per_user: discount.usage_limit_per_user != null ? String(discount.usage_limit_per_user) : '',
            starts_at: toDatetimeLocalInput(discount.starts_at),
            ends_at: toDatetimeLocalInput(discount.ends_at),
            description: discount.description || '',
            is_active: discount.is_active ?? true,
        });
    };

    const parseOptionalNumberField = (
        value: string,
        fieldLabel: string,
        options: { allowZero?: boolean; integer?: boolean } = {}
    ): number | null => {
        const trimmed = value.trim();
        if (!trimmed) return null;

        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed)) {
            throw new Error(`${fieldLabel} không hợp lệ.`);
        }

        const allowZero = options.allowZero ?? true;
        if ((allowZero && parsed < 0) || (!allowZero && parsed <= 0)) {
            throw new Error(`${fieldLabel} phải ${allowZero ? 'lớn hơn hoặc bằng 0' : 'lớn hơn 0'}.`);
        }

        if (options.integer && !Number.isInteger(parsed)) {
            throw new Error(`${fieldLabel} phải là số nguyên.`);
        }

        return parsed;
    };

    const handleSaveDiscountCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSavingDiscountCode) return;

        const isEditing = Boolean(editingDiscountId);

        try {
            const code = discountForm.code.trim().toUpperCase();
            if (!code) {
                throw new Error('Vui lòng nhập mã giảm giá.');
            }

            const parsedValue = parseOptionalNumberField(discountForm.value, 'Giá trị giảm', { allowZero: false });
            if (parsedValue == null) {
                throw new Error('Vui lòng nhập giá trị giảm.');
            }

            if (discountForm.type === 'percentage' && parsedValue > 100) {
                throw new Error('Mã giảm theo phần trăm không được vượt quá 100%.');
            }

            const minPurchaseAmount = parseOptionalNumberField(discountForm.min_purchase_amount, 'Đơn tối thiểu', { allowZero: true }) ?? 0;
            const maxDiscountAmount = parseOptionalNumberField(discountForm.max_discount_amount, 'Giảm tối đa', { allowZero: false });
            const usageLimit = parseOptionalNumberField(discountForm.usage_limit, 'Giới hạn tổng lượt', { allowZero: false, integer: true });
            const usageLimitPerUser = parseOptionalNumberField(discountForm.usage_limit_per_user, 'Giới hạn mỗi khách', { allowZero: false, integer: true });

            const startsAtDate = discountForm.starts_at ? new Date(discountForm.starts_at) : null;
            const endsAtDate = discountForm.ends_at ? new Date(discountForm.ends_at) : null;

            if (startsAtDate && Number.isNaN(startsAtDate.getTime())) {
                throw new Error('Thời gian bắt đầu không hợp lệ.');
            }
            if (endsAtDate && Number.isNaN(endsAtDate.getTime())) {
                throw new Error('Thời gian kết thúc không hợp lệ.');
            }
            if (startsAtDate && endsAtDate && endsAtDate < startsAtDate) {
                throw new Error('Thời gian kết thúc phải sau thời gian bắt đầu.');
            }

            setIsSavingDiscountCode(true);
            const saved = await api.saveDiscountCodeAdmin({
                id: editingDiscountId || undefined,
                code,
                type: discountForm.type,
                value: parsedValue,
                min_purchase_amount: minPurchaseAmount,
                max_discount_amount: discountForm.type === 'percentage' ? maxDiscountAmount ?? undefined : undefined,
                usage_limit: usageLimit,
                usage_limit_per_user: usageLimitPerUser,
                starts_at: startsAtDate ? startsAtDate.toISOString() : null,
                ends_at: endsAtDate ? endsAtDate.toISOString() : null,
                description: discountForm.description.trim() || null,
                is_active: discountForm.is_active,
            });

            setDiscountCodes(prev => {
                if (saved.id && prev.some(item => item.id === saved.id)) {
                    return prev.map(item => item.id === saved.id ? saved : item);
                }
                return [saved, ...prev];
            });

            addToast(isEditing ? 'Đã cập nhật mã giảm giá.' : 'Đã tạo mã giảm giá.', { type: 'success' });
            resetDiscountForm();
        } catch (error: any) {
            addToast('Không thể lưu mã giảm giá', { type: 'error', description: error.message });
        } finally {
            setIsSavingDiscountCode(false);
        }
    };

    const handleDeleteDiscountCode = async (discount: DiscountCode) => {
        if (!discount.id) return;
        if (!window.confirm(`Bạn có chắc muốn xóa mã ${discount.code}?`)) return;

        setDeletingDiscountId(discount.id);
        try {
            await api.deleteDiscountCodeAdmin(discount.id);
            setDiscountCodes(prev => prev.filter(item => item.id !== discount.id));
            if (editingDiscountId === discount.id) {
                resetDiscountForm();
            }
            addToast('Đã xóa mã giảm giá.', { type: 'success' });
        } catch (error: any) {
            addToast('Không thể xóa mã giảm giá', { type: 'error', description: error.message });
        } finally {
            setDeletingDiscountId(null);
        }
    };

    const loadTaxSettings = async () => {
        setIsLoadingTaxSettings(true);
        try {
            const rows = await api.getTaxProfilesAdmin();
            setTaxProfiles(rows);
            setTaxRateForm(prev => ({
                ...prev,
                tax_profile_id: prev.tax_profile_id || rows.find(profile => profile.is_default)?.id || rows[0]?.id || '',
            }));
        } catch (error: any) {
            addToast('Không thể tải cấu hình thuế', { type: 'error', description: error.message });
        } finally {
            setIsLoadingTaxSettings(false);
        }
    };

    const handleStartEditTaxProfile = (profile: TaxProfile) => {
        setEditingTaxProfileId(profile.id || null);
        setTaxProfileForm({
            code: profile.code,
            name: profile.name,
            tax_mode: profile.tax_mode,
            default_rate: rateToPercentInput(profile.default_rate),
            applies_to_shipping: Boolean(profile.applies_to_shipping),
            currency: profile.currency || 'VND',
            is_active: profile.is_active,
            is_default: profile.is_default,
            starts_at: toDatetimeLocalInput(profile.starts_at),
            ends_at: toDatetimeLocalInput(profile.ends_at),
        });
    };

    const handleSaveTaxProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSavingTaxProfile) return;

        try {
            setIsSavingTaxProfile(true);
            const defaultRatePercent = parseNumberOrThrow(taxProfileForm.default_rate, 'Thuế mặc định', { min: 0 });
            if (defaultRatePercent > 100) {
                throw new Error('Thuế mặc định không được lớn hơn 100%.');
            }

            await api.saveTaxProfileAdmin({
                id: editingTaxProfileId || undefined,
                code: taxProfileForm.code,
                name: taxProfileForm.name,
                tax_mode: taxProfileForm.tax_mode,
                default_rate: defaultRatePercent / 100,
                applies_to_shipping: taxProfileForm.applies_to_shipping,
                currency: taxProfileForm.currency || 'VND',
                is_active: taxProfileForm.is_active,
                is_default: taxProfileForm.is_default,
                starts_at: taxProfileForm.starts_at || null,
                ends_at: taxProfileForm.ends_at || null,
            });
            await loadTaxSettings();
            resetTaxProfileForm();
            addToast(editingTaxProfileId ? 'Đã cập nhật hồ sơ thuế.' : 'Đã tạo hồ sơ thuế.', { type: 'success' });
        } catch (error: any) {
            addToast('Không thể lưu hồ sơ thuế', { type: 'error', description: error.message });
        } finally {
            setIsSavingTaxProfile(false);
        }
    };

    const handleDeleteTaxProfile = async (profile: TaxProfile) => {
        if (!profile.id) return;
        if (!window.confirm(`Bạn có chắc muốn xóa hồ sơ thuế ${profile.code}?`)) return;

        setDeletingTaxProfileId(profile.id);
        try {
            await api.deleteTaxProfileAdmin(profile.id);
            await loadTaxSettings();
            if (editingTaxProfileId === profile.id) {
                resetTaxProfileForm();
            }
            if (taxRateForm.tax_profile_id === profile.id) {
                resetTaxRateForm();
            }
            addToast('Đã xóa hồ sơ thuế.', { type: 'success' });
        } catch (error: any) {
            addToast('Không thể xóa hồ sơ thuế', { type: 'error', description: error.message });
        } finally {
            setDeletingTaxProfileId(null);
        }
    };

    const handleStartEditTaxRate = (rate: TaxRate) => {
        setEditingTaxRateId(rate.id || null);
        setTaxRateForm({
            tax_profile_id: rate.tax_profile_id,
            province: rate.province || '',
            district: rate.district || '',
            rate: rateToPercentInput(rate.rate),
            applies_to_shipping: rate.applies_to_shipping == null ? 'inherit' : (rate.applies_to_shipping ? 'true' : 'false'),
            currency: rate.currency || '',
            priority: String(rate.priority ?? 0),
            is_active: rate.is_active,
            starts_at: toDatetimeLocalInput(rate.starts_at),
            ends_at: toDatetimeLocalInput(rate.ends_at),
        });
    };

    const handleSaveTaxRate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSavingTaxRate) return;

        try {
            setIsSavingTaxRate(true);
            const ratePercent = parseNumberOrThrow(taxRateForm.rate, 'Mức thuế', { min: 0 });
            if (ratePercent > 100) {
                throw new Error('Mức thuế không được lớn hơn 100%.');
            }

            await api.saveTaxRateAdmin({
                id: editingTaxRateId || undefined,
                tax_profile_id: taxRateForm.tax_profile_id,
                province: taxRateForm.province || null,
                district: taxRateForm.district || null,
                rate: ratePercent / 100,
                applies_to_shipping: taxRateForm.applies_to_shipping === 'inherit'
                    ? null
                    : taxRateForm.applies_to_shipping === 'true',
                currency: taxRateForm.currency || null,
                priority: parseNumberOrThrow(taxRateForm.priority, 'Độ ưu tiên', { integer: true }),
                is_active: taxRateForm.is_active,
                starts_at: taxRateForm.starts_at || null,
                ends_at: taxRateForm.ends_at || null,
            });
            const preferredProfileId = taxRateForm.tax_profile_id;
            await loadTaxSettings();
            resetTaxRateForm(preferredProfileId);
            addToast(editingTaxRateId ? 'Đã cập nhật mức thuế.' : 'Đã tạo mức thuế.', { type: 'success' });
        } catch (error: any) {
            addToast('Không thể lưu mức thuế', { type: 'error', description: error.message });
        } finally {
            setIsSavingTaxRate(false);
        }
    };

    const handleDeleteTaxRate = async (rate: TaxRate) => {
        if (!rate.id) return;
        if (!window.confirm('Bạn có chắc muốn xóa mức thuế này?')) return;

        setDeletingTaxRateId(rate.id);
        try {
            await api.deleteTaxRateAdmin(rate.id);
            await loadTaxSettings();
            if (editingTaxRateId === rate.id) {
                resetTaxRateForm(rate.tax_profile_id);
            }
            addToast('Đã xóa mức thuế.', { type: 'success' });
        } catch (error: any) {
            addToast('Không thể xóa mức thuế', { type: 'error', description: error.message });
        } finally {
            setDeletingTaxRateId(null);
        }
    };

    const createQuickDraftFromProduct = (product: Product): ProductQuickDraft => ({
        sku: product.sku || '',
        price: String(product.price ?? 0),
        vat_rate: rateToPercentInput(product.vat_rate),
        stock_quantity: String(product.stock_quantity ?? 0),
        low_stock_threshold: String(product.low_stock_threshold ?? 5),
        expiry_date: product.expiry_date || '',
    });

    const getQuickDraft = (product: Product): ProductQuickDraft => {
        return quickDrafts[product.id] || createQuickDraftFromProduct(product);
    };

    const updateQuickDraftField = (product: Product, field: keyof ProductQuickDraft, value: string) => {
        setQuickDrafts(prev => ({
            ...prev,
            [product.id]: {
                ...(prev[product.id] || createQuickDraftFromProduct(product)),
                [field]: value,
            }
        }));
    };

    const resetQuickDraft = (productId: number) => {
        setQuickDrafts(prev => {
            const next = { ...prev };
            delete next[productId];
            return next;
        });
    };

    const parseNumberOrThrow = (value: string, field: string, options: { integer?: boolean; min?: number } = {}) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            throw new Error(`${field} không hợp lệ.`);
        }
        if (options.integer && !Number.isInteger(parsed)) {
            throw new Error(`${field} phải là số nguyên.`);
        }
        if (options.min != null && parsed < options.min) {
            throw new Error(`${field} phải lớn hơn hoặc bằng ${options.min}.`);
        }
        return parsed;
    };

    const getProductFlags = (product: Product) => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        let isExpired = false;
        let isNearExpiry = false;

        if (product.expiry_date) {
            const expiryDate = new Date(product.expiry_date);
            if (!Number.isNaN(expiryDate.getTime())) {
                const thirtyDaysFromNow = new Date(now);
                thirtyDaysFromNow.setDate(now.getDate() + 30);
                if (expiryDate < now) isExpired = true;
                else if (expiryDate <= thirtyDaysFromNow) isNearExpiry = true;
            }
        }

        const lowStockThreshold = product.low_stock_threshold ?? 5;
        const isOutOfStock = product.stock_quantity <= 0 || isExpired;
        const isLowStock = !isOutOfStock && product.stock_quantity <= lowStockThreshold;
        const isHidden = !product.is_published;
        const hasNoSku = !(product.sku && product.sku.trim());

        return { isExpired, isNearExpiry, isOutOfStock, isLowStock, isHidden, hasNoSku };
    };

    const isQuickDraftDirty = (product: Product): boolean => {
        const draft = quickDrafts[product.id];
        if (!draft) return false;
        return (
            draft.sku !== (product.sku || '') ||
            Number(draft.price) !== Number(product.price) ||
            Number(draft.vat_rate) !== Number(rateToPercentInput(product.vat_rate)) ||
            Number(draft.stock_quantity) !== Number(product.stock_quantity) ||
            Number(draft.low_stock_threshold) !== Number(product.low_stock_threshold ?? 5) ||
            draft.expiry_date !== (product.expiry_date || '')
        );
    };

    const handleSaveQuickDraft = async (product: Product) => {
        const draft = getQuickDraft(product);
        if (!isQuickDraftDirty(product)) {
            resetQuickDraft(product.id);
            return;
        }

        try {
            const price = parseNumberOrThrow(draft.price, 'Giá bán', { min: 0 });
            const vatRatePercent = parseNumberOrThrow(draft.vat_rate, 'VAT', { min: 0 });
            if (vatRatePercent > 100) {
                throw new Error('VAT không được lớn hơn 100%.');
            }
            const stock = parseNumberOrThrow(draft.stock_quantity, 'Tồn kho', { integer: true, min: 0 });
            const lowStockThreshold = parseNumberOrThrow(draft.low_stock_threshold, 'Ngưỡng tồn thấp', { integer: true, min: 0 });

            const sku = draft.sku.trim();
            if (sku) {
                const duplicatedSku = products.find(
                    p => p.id !== product.id && (p.sku || '').trim().toLowerCase() === sku.toLowerCase()
                );
                if (duplicatedSku) {
                    throw new Error(`SKU "${sku}" đã tồn tại ở sản phẩm #${duplicatedSku.id}.`);
                }
            }

            if (draft.expiry_date) {
                const expiryDate = new Date(draft.expiry_date);
                if (Number.isNaN(expiryDate.getTime())) {
                    throw new Error('Hạn dùng không hợp lệ.');
                }
            }

            setSavingQuickProductId(product.id);
            const updatePayload: any = {
                id: product.id,
                sku: sku || null,
                price,
                vat_rate: vatRatePercent / 100,
                stock_quantity: stock,
                low_stock_threshold: lowStockThreshold,
                expiry_date: draft.expiry_date || null,
            };
            await onBulkUpdateProducts([updatePayload]);
            resetQuickDraft(product.id);
            addToast(`Đã lưu nhanh sản phẩm #${product.id}`, { type: 'success' });
        } catch (error: any) {
            addToast('Không thể lưu nhanh sản phẩm', { type: 'error', description: error.message });
        } finally {
            setSavingQuickProductId(null);
        }
    };

    const handleSyncProductToPancake = async (product: Product) => {
        if (syncingPancakeProductId === product.id) return;

        try {
            setSyncingPancakeProductId(product.id);
            const result = await api.syncProductToPancake(product.id);
            const queuedNow = Number(result.dispatch?.queued || 0);
            addToast('Đã đồng bộ sản phẩm', {
                type: 'success',
                description: queuedNow > 0
                    ? `${product.name} đã được đưa vào Pancake Queue và đang được xử lý.`
                    : `${product.name} đã được đưa vào hàng đợi đồng bộ Pancake.`,
            });
        } catch (error: any) {
            addToast('Không thể đồng bộ sản phẩm', {
                type: 'error',
                description: error?.message || 'Vui lòng thử lại sau.',
            });
        } finally {
            setSyncingPancakeProductId(null);
        }
    };

    const handleSyncProductsToPancake = async () => {
        if (isSyncingPancakeProducts) return;

        const selectedIds = selectedProductIds.length > 0 ? selectedProductIds : undefined;
        try {
            setIsSyncingPancakeProducts(true);
            const result = await api.syncProductsToPancake(selectedIds);
            const queuedCount = Number(result.queued || 0);
            if (queuedCount === 0) {
                addToast('Không có sản phẩm để đồng bộ', {
                    type: 'error',
                    description: selectedIds
                        ? 'Danh sách sản phẩm đã chọn không còn sản phẩm hợp lệ.'
                        : 'Không tìm thấy sản phẩm đang hoạt động trên website.',
                });
                return;
            }

            addToast('Đã đồng bộ sản phẩm', {
                type: 'success',
                description: selectedIds
                    ? `Đã đưa ${queuedCount} sản phẩm đã chọn vào Pancake Queue.`
                    : `Đã đưa ${queuedCount} sản phẩm đang hoạt động vào Pancake Queue.`,
            });
        } catch (error: any) {
            addToast('Không thể đồng bộ sản phẩm', {
                type: 'error',
                description: error?.message || 'Vui lòng thử lại sau.',
            });
        } finally {
            setIsSyncingPancakeProducts(false);
        }
    };

    const toggleProductSelection = (productId: number) => {
        setSelectedProductIds(prev => (
            prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
        ));
    };

    const toggleSelectProducts = (productIds: number[], checked: boolean) => {
        if (checked) {
            setSelectedProductIds(prev => Array.from(new Set([...prev, ...productIds])));
            return;
        }
        setSelectedProductIds(prev => prev.filter(id => !productIds.includes(id)));
    };

    const handleApplyBulkAction = async (selectedProducts: Product[]) => {
        if (!selectedProducts.length) {
            addToast('Bạn chưa chọn sản phẩm nào.', { type: 'error' });
            return;
        }

        try {
            setIsApplyingBulkAction(true);
            if (bulkAction === 'delete') {
                if (!window.confirm(`Bạn có chắc muốn xóa ${selectedProducts.length} sản phẩm đã chọn?`)) {
                    return;
                }
                const summary = await onBulkDeleteProducts(selectedProducts.map(p => p.id));
                setSelectedProductIds([]);
                addToast('Đã xử lý sản phẩm đã chọn.', {
                    type: 'success',
                    description: summary.archivedCount > 0
                        ? `${summary.deletedCount} sản phẩm đã xóa. ${summary.archivedCount} sản phẩm từng có đơn hàng đã chuyển sang lưu trữ.`
                        : `${summary.deletedCount} sản phẩm đã xóa.`,
                });
                return;
            }

            let updates: Partial<Product>[] = [];
            switch (bulkAction) {
                case 'publish': {
                    updates = selectedProducts.map(p => ({ id: p.id, is_published: true }));
                    break;
                }
                case 'unpublish':
                    updates = selectedProducts.map(p => ({ id: p.id, is_published: false }));
                    break;
                case 'feature':
                    updates = selectedProducts.map(p => ({ id: p.id, is_featured: true }));
                    break;
                case 'unfeature':
                    updates = selectedProducts.map(p => ({ id: p.id, is_featured: false }));
                    break;
                case 'set_category': {
                    if (bulkCategoryId === 'all') throw new Error('Vui lòng chọn chuyên mục để áp dụng.');
                    const categoryId = Number(bulkCategoryId);
                    updates = selectedProducts.map(p => ({ id: p.id, category_id: categoryId }));
                    break;
                }
                case 'set_brand': {
                    if (bulkBrandName === 'all') throw new Error('Vui lòng chọn thương hiệu để áp dụng.');
                    updates = selectedProducts.map(p => ({ id: p.id, brand: bulkBrandName === '__none__' ? '' : bulkBrandName }));
                    break;
                }
                case 'adjust_stock': {
                    const delta = parseNumberOrThrow(bulkNumericValue, 'Số lượng cộng/trừ', { integer: true });
                    if (delta === 0) throw new Error('Giá trị cộng/trừ không được bằng 0.');
                    updates = selectedProducts.map(p => ({ id: p.id, stock_quantity: Math.max(0, p.stock_quantity + delta) }));
                    break;
                }
                case 'set_low_threshold': {
                    const threshold = parseNumberOrThrow(bulkNumericValue, 'Ngưỡng tồn thấp', { integer: true, min: 0 });
                    updates = selectedProducts.map(p => ({ id: p.id, low_stock_threshold: threshold }));
                    break;
                }
                case 'set_vat_rate': {
                    const vatRatePercent = parseNumberOrThrow(bulkNumericValue, 'VAT', { min: 0 });
                    if (vatRatePercent > 100) throw new Error('VAT không được lớn hơn 100%.');
                    updates = selectedProducts.map(p => ({ id: p.id, vat_rate: vatRatePercent / 100 }));
                    break;
                }
                default:
                    break;
            }

            if (!updates.length) {
                throw new Error('Không có thay đổi nào để áp dụng.');
            }

            await onBulkUpdateProducts(updates);
            setSelectedProductIds([]);
            setBulkNumericValue('');
            addToast(`Đã áp dụng thao tác cho ${updates.length} sản phẩm.`, { type: 'success' });
        } catch (error: any) {
            addToast('Không thể áp dụng thao tác hàng loạt', { type: 'error', description: error.message });
        } finally {
            setIsApplyingBulkAction(false);
        }
    };

    const getInventoryStatusInfo = (product: Product): { text: string; color: string; isExpired: boolean; isNearExpiry: boolean } => {
        const { isExpired, isNearExpiry, isOutOfStock, isLowStock } = getProductFlags(product);
        if (isExpired) return { text: t('admin.expired_status'), color: 'bg-red-500', isExpired, isNearExpiry };
        if (isOutOfStock) return { text: t('admin.out_of_stock_status'), color: 'bg-red-500', isExpired, isNearExpiry };
        if (isLowStock) return { text: t('admin.low_stock_status'), color: 'bg-yellow-500', isExpired, isNearExpiry };
        if (isNearExpiry) return { text: t('admin.near_expiry_status'), color: 'bg-yellow-500', isExpired, isNearExpiry };

        return { text: t('admin.in_stock_status'), color: 'bg-green-500', isExpired, isNearExpiry };
    };

    const getInventoryTone = (statusInfo: ReturnType<typeof getInventoryStatusInfo>): string => {
        if (statusInfo.color === 'bg-red-500') return 'border-rose-200 bg-rose-50 text-rose-700';
        if (statusInfo.color === 'bg-yellow-500') return 'border-amber-200 bg-amber-50 text-amber-700';
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    };

    const filteredProducts = useMemo(() => {
        let result = products;

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(p =>
                p.name.toLowerCase().includes(query) ||
                (p.sku && p.sku.toLowerCase().includes(query)) ||
                (p.brand && p.brand.toLowerCase().includes(query))
            );
        }

        if (selectedCategoryId !== 'all') {
            const catId = parseInt(selectedCategoryId, 10);
            result = result.filter(p => p.category_id === catId);
        }

        if (selectedBrand !== 'all') {
            result = result.filter(p => p.brand === selectedBrand);
        }

        if (inventoryFilter !== 'all') {
            result = result.filter(p => {
                const flags = getProductFlags(p);
                switch (inventoryFilter) {
                    case 'in_stock': return !flags.isOutOfStock && !flags.isLowStock && !flags.isNearExpiry;
                    case 'low_stock': return flags.isLowStock;
                    case 'out_of_stock': return flags.isOutOfStock;
                    case 'hidden': return flags.isHidden;
                    case 'featured': return Boolean(p.is_featured);
                    case 'near_expiry': return flags.isNearExpiry && !flags.isExpired;
                    case 'no_sku': return flags.hasNoSku;
                    default: return true;
                }
            });
        }
        // Sắp xếp sản phẩm
        return [...result].sort((a, b) => {
            let valA: any = a.id;
            let valB: any = b.id;
            
            if (productSortColumn === 'name') {
                valA = a.name.toLowerCase();
                valB = b.name.toLowerCase();
            } else if (productSortColumn === 'price') {
                valA = Number(a.price || 0);
                valB = Number(b.price || 0);
            } else if (productSortColumn === 'status') {
                const statusA = getInventoryStatusInfo(a).text;
                const statusB = getInventoryStatusInfo(b).text;
                valA = statusA.toLowerCase();
                valB = statusB.toLowerCase();
            }

            if (valA < valB) return productSortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return productSortDirection === 'asc' ? 1 : -1;
            
            // Nếu bằng nhau thì sort thêm bằng id cho ổn định
            return b.id - a.id;
        });
    }, [products, inventoryFilter, searchQuery, selectedCategoryId, selectedBrand, productSortColumn, productSortDirection]);

    const totalProductPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
    const currentProducts = useMemo(
        () =>
            filteredProducts.slice(
                (productsCurrentPage - 1) * ITEMS_PER_PAGE,
                productsCurrentPage * ITEMS_PER_PAGE,
            ),
        [filteredProducts, productsCurrentPage],
    );
    const currentProductIds = useMemo(() => currentProducts.map((product) => product.id), [currentProducts]);

    useEffect(() => {
        let isCancelled = false;
        if (!currentProductIds.length) {
            setProductContentReviewsById({});
            setIsLoadingProductContentReviews(false);
            return undefined;
        }

        setIsLoadingProductContentReviews(true);
        void api.getAdminProductContentReviews(currentProductIds)
            .then((records) => {
                if (isCancelled) return;
                const nextMap = records.reduce<Record<number, ProductContentReviewRecord>>((acc, record) => {
                    acc[record.product_id] = record;
                    return acc;
                }, {});
                setProductContentReviewsById(nextMap);
            })
            .catch((error) => {
                if (isCancelled) return;
                console.warn('Could not load product content review queue:', error);
                setProductContentReviewsById({});
            })
            .finally(() => {
                if (!isCancelled) setIsLoadingProductContentReviews(false);
            });

        return () => {
            isCancelled = true;
        };
    }, [currentProductIds]);

    const categoryNameById = useMemo(
        () => new Map(categories.map((category) => [category.id, category.name])),
        [categories]
    );

    const getEffectiveContentReviewForProduct = (product: Product) => {
        const audit = auditProductContent(product);
        return resolveProductContentReview(productContentReviewsById[product.id], audit);
    };

    const editorProductSequence = useMemo(() => {
        const defaultSequence = [...products].sort((a, b) => b.id - a.id);
        if (!selectedProduct?.id) return defaultSequence;
        return filteredProducts.some((product) => product.id === selectedProduct.id) ? filteredProducts : defaultSequence;
    }, [filteredProducts, products, selectedProduct?.id]);

    const selectedProductIndex = useMemo(() => {
        if (!selectedProduct?.id) return -1;
        return editorProductSequence.findIndex((product) => product.id === selectedProduct.id);
    }, [editorProductSequence, selectedProduct?.id]);

    const previousProduct = selectedProductIndex > 0 ? editorProductSequence[selectedProductIndex - 1] : null;
    const nextProduct = selectedProductIndex >= 0 && selectedProductIndex < editorProductSequence.length - 1
        ? editorProductSequence[selectedProductIndex + 1]
        : null;

    const productPositionLabel = selectedProductIndex >= 0
        ? `Sản phẩm ${selectedProductIndex + 1} / ${editorProductSequence.length} trong danh sách hiện tại`
        : null;

    const brandMetrics = useMemo(() => {
        const counts = new Map<string, { total: number; published: number }>();
        for (const product of products) {
            const brandName = String(product.brand || '').trim();
            const brandKey = normalizeBrandMatchKey(brandName);
            if (!brandKey) continue;
            const current = counts.get(brandKey) || { total: 0, published: 0 };
            current.total += 1;
            if (product.is_published) current.published += 1;
            counts.set(brandKey, current);
        }
        return counts;
    }, [products]);

    const filteredBrands = useMemo(() => {
        const query = brandSearchQuery.trim().toLowerCase();
        const rows = brands.map((brand) => {
            const metric = brandMetrics.get(normalizeBrandMatchKey(brand.name)) || { total: 0, published: 0 };
            return {
                ...brand,
                productCount: metric.total,
                publishedProductCount: metric.published,
                descriptionSnippet: getBrandDescriptionSnippet(brand.description, 170),
            };
        });

        if (!query) {
            return rows;
        }

        return rows.filter((brand) =>
            brand.name.toLowerCase().includes(query) ||
            brand.slug.toLowerCase().includes(query) ||
            String(brand.description || '').toLowerCase().includes(query)
        );
    }, [brands, brandMetrics, brandSearchQuery]);

    const brandSummary = useMemo(() => ({
        totalBrands: brands.length,
        brandsWithLogo: brands.filter((brand) => Boolean(brand.logo_url || brand.logo_path)).length,
        brandsWithDescription: brands.filter((brand) => Boolean(String(brand.description || '').trim())).length,
        linkedProducts: products.filter((product) => Boolean(String(product.brand || '').trim())).length,
        emptyBrands: brands.filter((brand) => (brandMetrics.get(normalizeBrandMatchKey(brand.name))?.total || 0) === 0).length,
    }), [brands, products, brandMetrics]);

    const editingBrand = useMemo(
        () => brands.find((brand) => brand.id === editingBrandId) || null,
        [brands, editingBrandId]
    );

    const allTaxRates = useMemo(
        () =>
            taxProfiles
                .flatMap(profile => (profile.rates || []).map(rate => ({
                    ...rate,
                    profile_code: profile.code,
                    profile_name: profile.name,
                })))
                .sort((a, b) => {
                    if (a.profile_code !== b.profile_code) return a.profile_code.localeCompare(b.profile_code);
                    if (Number(b.priority || 0) !== Number(a.priority || 0)) return Number(b.priority || 0) - Number(a.priority || 0);
                    return (a.province || '').localeCompare(b.province || '');
                }),
        [taxProfiles]
    );

    useEffect(() => {
        setProductsCurrentPage(1);
    }, [inventoryFilter, searchQuery, selectedCategoryId, selectedBrand]);

    useEffect(() => {
        setSelectedProductIds(prev => prev.filter(id => products.some(product => product.id === id)));
    }, [products]);

    useEffect(() => {
        if (view !== 'edit-product' || !selectedProduct?.id) return;
        const latestSelectedProduct = products.find((product) => product.id === selectedProduct.id);
        if (!latestSelectedProduct) {
            closeProductEditor();
            return;
        }
        if (latestSelectedProduct !== selectedProduct) {
            setSelectedProduct(latestSelectedProduct);
        }
    }, [products, selectedProduct, view]);

    useEffect(() => {
        setOrdersCurrentPage(1);
    }, [orderSearchQuery, orderStatusFilter, orderPaymentFilter, orderShippingFilter, orderDateFrom, orderDateTo]);

    useEffect(() => {
        setSelectedOrderIds(prev => prev.filter(id => productOrders.some(order => order.id === id)));
    }, [productOrders]);

    // --- IMPORT/EXPORT HANDLERS ---
    const handleExport = async (data: any[], fileName: string, sheetName: string) => {
        const XLSX = await loadXLSX();
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, fileName);
    };

    const handleExportProducts = async () => {
        const dataToExport = products.map(p => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            description: p.description,
            long_description_json: JSON.stringify(p.long_description),
            price: p.price,
            vat_rate_percent: Number(rateToPercentInput(p.vat_rate ?? DEFAULT_PRODUCT_VAT_RATE)),
            stock_quantity: p.stock_quantity,
            category_name: categories.find(c => c.id === p.category_id)?.name || '',
            sku: p.sku,
            expiry_date: p.expiry_date,
            low_stock_threshold: p.low_stock_threshold,
            usage_instructions: p.usage_instructions,
            ingredients: p.ingredients,
            is_published: p.is_published,
            key_benefits: (p.key_benefits || []).join('; '),
            skin_types: (p.skin_types || []).join('; '),
            volume: p.volume,
            texture: p.texture,
            origin: p.origin,
            precautions: p.precautions,
            image_paths: (p.images || []).map(img => img.image_path).join('; '),
            brand: p.brand || ''
        }));
        await handleExport(dataToExport, "Natural_Skin_Products_Export.xlsx", "Products");
    };

    const handleDownloadProductTemplate = async () => {
        const template = [{
            id: "(Để trống cho sản phẩm mới, điền ID để cập nhật)",
            name: "Tên sản phẩm (Bắt buộc)",
            slug: "slug-san-pham (Để trống sẽ tự tạo)",
            description: "Mô tả ngắn",
            long_description_json: '[{"type":"text", "content":"Nội dung mô tả chi tiết"}]',
            price: 100000,
            vat_rate_percent: 10,
            stock_quantity: 10,
            category_name: "Tên chuyên mục (phải tồn tại)",
            sku: "MA-SP-01",
            expiry_date: "YYYY-MM-DD",
            low_stock_threshold: 5,
            usage_instructions: "Hướng dẫn sử dụng",
            ingredients: "Thành phần",
            is_published: true,
            key_benefits: "Lợi ích 1; Lợi ích 2",
            skin_types: "Da dầu; Da mụn",
            volume: "50ml",
            texture: "Gel",
            origin: "Pháp",
            precautions: "Lưu ý khi dùng",
            image_paths: "products/path-1.webp; products/path-2.webp",
            brand: "Tên thương hiệu"
        }];
        await handleExport(template, "Natural_Skin_Product_Template.xlsx", "Template");
    };

    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>, type: 'product' | 'category') => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        addToast('Đang xử lý tệp...', { type: 'info' });

        try {
            await validateWorkbookImportFile(file);
            const data = await file.arrayBuffer();
            const XLSX = await loadXLSX();
            const workbook = XLSX.read(data, SAFE_WORKBOOK_READ_OPTIONS);
            const sheetName = workbook.SheetNames[0];
            if (!sheetName) throw new Error('Tệp Excel không có trang tính.');
            const worksheet = workbook.Sheets[sheetName];
            const json: any[] = XLSX.utils.sheet_to_json(worksheet);
            assertWorkbookRowLimit(json);

            if (type === 'product') {
                await processProductImport(json);
            } else {
                await processCategoryImport(json);
            }
        } catch (error: any) {
            addToast('Nhập thất bại', { type: 'error', description: error.message });
        } finally {
            setIsImporting(false);
            // Reset file input
            if (productFileInputRef.current) productFileInputRef.current.value = '';
            if (categoryFileInputRef.current) categoryFileInputRef.current.value = '';
        }
    };

    const processProductImport = async (rows: any[]) => {
        if (rows.length === 0) {
            addToast('Tệp import không có dữ liệu.', { type: 'error' });
            return;
        }

        const parseVatRateFromRow = (row: any): number => {
            if (row.vat_rate_percent !== undefined && row.vat_rate_percent !== null && String(row.vat_rate_percent).trim() !== '') {
                const percent = Number(row.vat_rate_percent);
                if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
                    throw new Error('VAT (%) phải nằm trong khoảng 0-100.');
                }
                return percent / 100;
            }

            if (row.vat_rate !== undefined && row.vat_rate !== null && String(row.vat_rate).trim() !== '') {
                const rawRate = Number(row.vat_rate);
                if (!Number.isFinite(rawRate) || rawRate < 0) {
                    throw new Error('VAT không hợp lệ.');
                }
                if (rawRate > 1 && rawRate <= 100) {
                    return rawRate / 100;
                }
                if (rawRate > 1) {
                    throw new Error('VAT không được lớn hơn 100%.');
                }
                return rawRate;
            }

            return DEFAULT_PRODUCT_VAT_RATE;
        };

        const validationErrors: string[] = [];
        const seenSkus = new Map<string, number>();
        const seenSlugs = new Map<string, number>();
        const existingSkuOwner = new Map<string, number>();
        const existingSlugOwner = new Map<string, number>();

        for (const product of products) {
            if (product.sku?.trim()) existingSkuOwner.set(product.sku.trim().toLowerCase(), product.id);
            if (product.slug?.trim()) existingSlugOwner.set(product.slug.trim().toLowerCase(), product.id);
        }

        for (const [index, row] of rows.entries()) {
            const line = index + 2;
            const rowId = row.id != null && row.id !== '' ? Number(row.id) : undefined;
            const name = String(row.name || '').trim();
            const slug = String(row.slug || generateSlug(name)).trim().toLowerCase();
            const sku = String(row.sku || '').trim().toLowerCase();
            const categoryName = String(row.category_name || '').trim();

            if (!name) validationErrors.push(`Dòng ${line}: Thiếu tên sản phẩm.`);
            if (!slug) validationErrors.push(`Dòng ${line}: Thiếu slug hợp lệ.`);
            if (!categoryName) validationErrors.push(`Dòng ${line}: Thiếu chuyên mục.`);

            const categoryExists = categories.some(c => c.name.toLowerCase() === categoryName.toLowerCase());
            if (categoryName && !categoryExists) {
                validationErrors.push(`Dòng ${line}: Chuyên mục '${categoryName}' không tồn tại.`);
            }

            const price = Number(row.price);
            if (!Number.isFinite(price) || price < 0) {
                validationErrors.push(`Dòng ${line}: Giá bán không hợp lệ.`);
            }

            try {
                parseVatRateFromRow(row);
            } catch (error: any) {
                validationErrors.push(`Dòng ${line}: ${error.message}`);
            }

            const stockQuantity = Number(row.stock_quantity);
            if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
                validationErrors.push(`Dòng ${line}: Tồn kho phải là số nguyên >= 0.`);
            }

            if (row.low_stock_threshold !== undefined && row.low_stock_threshold !== null && row.low_stock_threshold !== '') {
                const lowStockThreshold = Number(row.low_stock_threshold);
                if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0) {
                    validationErrors.push(`Dòng ${line}: Ngưỡng tồn thấp phải là số nguyên >= 0.`);
                }
            }

            if (row.expiry_date) {
                const expiryDate = new Date(row.expiry_date);
                if (Number.isNaN(expiryDate.getTime())) {
                    validationErrors.push(`Dòng ${line}: Hạn dùng không hợp lệ (định dạng YYYY-MM-DD).`);
                }
            }

            if (sku) {
                const existingSkuLine = seenSkus.get(sku);
                if (existingSkuLine) {
                    validationErrors.push(`Dòng ${line}: SKU trùng với dòng ${existingSkuLine}.`);
                } else {
                    seenSkus.set(sku, line);
                }
                const ownerId = existingSkuOwner.get(sku);
                if (ownerId && ownerId !== rowId) {
                    validationErrors.push(`Dòng ${line}: SKU đã tồn tại ở sản phẩm #${ownerId}.`);
                }
            }

            const existingSlugLine = seenSlugs.get(slug);
            if (existingSlugLine) {
                validationErrors.push(`Dòng ${line}: Slug trùng với dòng ${existingSlugLine}.`);
            } else {
                seenSlugs.set(slug, line);
            }

            const slugOwnerId = existingSlugOwner.get(slug);
            if (slugOwnerId && slugOwnerId !== rowId) {
                validationErrors.push(`Dòng ${line}: Slug đã tồn tại ở sản phẩm #${slugOwnerId}.`);
            }

            if (row.long_description_json) {
                try {
                    JSON.parse(row.long_description_json);
                } catch {
                    validationErrors.push(`Dòng ${line}: long_description_json không đúng JSON.`);
                }
            }
        }

        if (validationErrors.length > 0) {
            addToast('Import bị chặn do dữ liệu không hợp lệ', {
                type: 'error',
                description: validationErrors.slice(0, 6).join(' | ')
            });
            console.error('Product import validation errors:', validationErrors);
            return;
        }

        const parsePublishedValue = (value: any): boolean => {
            if (typeof value === 'boolean') return value;
            if (typeof value === 'number') return value === 1;
            if (typeof value === 'string') {
                const normalized = value.trim().toLowerCase();
                return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'co';
            }
            return true;
        };

        let successCount = 0;
        const errors: string[] = [];
        for (const [index, row] of rows.entries()) {
            try {
                const category = categories.find(c => c.name.toLowerCase() === row.category_name?.toLowerCase());
                if (!category) throw new Error(`Chuyên mục '${row.category_name}' không tồn tại.`);

                const rawImagePaths = String(row.image_paths || '')
                    .split(';')
                    .map((path: string) => path.trim())
                    .filter(Boolean);

                const productToSave: Partial<Product> = {
                    id: row.id || undefined,
                    name: String(row.name || '').trim(),
                    slug: String(row.slug || generateSlug(row.name)).trim(),
                    description: row.description,
                    long_description: JSON.parse(row.long_description_json || '[]'),
                    price: parseFloat(row.price),
                    vat_rate: parseVatRateFromRow(row),
                    stock_quantity: parseInt(row.stock_quantity, 10),
                    category_id: category.id,
                    sku: String(row.sku || '').trim() || undefined,
                    expiry_date: row.expiry_date ? String(row.expiry_date).trim() : undefined,
                    low_stock_threshold: row.low_stock_threshold !== undefined && row.low_stock_threshold !== null && row.low_stock_threshold !== '' ? parseInt(row.low_stock_threshold, 10) : 5,
                    usage_instructions: row.usage_instructions,
                    ingredients: row.ingredients,
                    is_published: parsePublishedValue(row.is_published),
                    key_benefits: row.key_benefits?.split(';').map((s: string) => s.trim()),
                    skin_types: row.skin_types?.split(';').map((s: string) => s.trim()),
                    volume: row.volume,
                    texture: row.texture,
                    origin: row.origin,
                    precautions: row.precautions,
                    images: rawImagePaths.map((path: string, i: number) => ({
                        id: 0,
                        product_id: 0,
                        image_path: path,
                        image_url: '',
                        display_order: i,
                        is_primary: i === 0
                    })),
                    brand: row.brand
                };
                await onSaveProduct(productToSave, []);
                successCount++;
            } catch (err: any) {
                errors.push(`Dòng ${index + 2}: ${err.message}`);
            }
        }
        addToast(`Hoàn tất nhập sản phẩm`, { type: 'success', description: `${successCount} thành công, ${errors.length} thất bại.` });
        if (errors.length > 0) {
            console.error("Import errors:", errors);
            addToast('Lỗi chi tiết', { type: 'error', description: errors.slice(0, 5).join(' | ') });
        }
    };

    const processCategoryImport = async (rows: any[]) => {
        let successCount = 0;
        const errors: string[] = [];
        for (const [index, row] of rows.entries()) {
            try {
                if (!row.name || !row.slug) throw new Error('Thiếu tên hoặc slug.');
                await onSaveCategory({ id: row.id, name: row.name, slug: row.slug, description: row.description });
                successCount++;
            } catch (err: any) {
                errors.push(`Dòng ${index + 2}: ${err.message}`);
            }
        }
        addToast(`Hoàn tất nhập chuyên mục`, { type: 'success', description: `${successCount} thành công, ${errors.length} thất bại.` });
        if (errors.length > 0) console.error("Import errors:", errors);
    };

    const handleExportCategories = async () => {
        await handleExport(categories, "Natural_Skin_Categories_Export.xlsx", "Categories");
    };

    const handleDownloadCategoryTemplate = async () => {
        await handleExport([{ id: "(Để trống cho chuyên mục mới)", name: "Tên chuyên mục", slug: "slug-chuyen-muc", description: "Mô tả" }], "Natural_Skin_Category_Template.xlsx", "Template");
    };

    const generateSlug = (name: string) => name.toLowerCase().replace(/đ/g, 'd').replace(/ /g, '-').replace(/[^\w-]+/g, '');
    const featuredCategoriesCount = useMemo(() => categories.filter((category) => Boolean(category.is_featured)).length, [categories]);

    const pharmacyTabs = useMemo<Array<{ key: ActiveTab; label: string }>>(() => [
        { key: 'products', label: t('admin.manage_products') },
        { key: 'categories', label: t('admin.manage_categories') },
        { key: 'brands', label: 'Thương hiệu' },
        { key: 'discounts', label: 'Mã giảm giá' },
        { key: 'taxes', label: 'Thuế & VAT' },
        { key: 'ghtk_settings', label: t('admin.ghtk_settings') },
    ], [t]);
    const pharmacyTaskItems = useMemo(() => [
        ...pharmacyTabs.map((tab) => ({
            key: tab.key,
            label: tab.label,
            view: { page: 'adminPharmacyManagement', section: tab.key } as AdminNavigationView,
        })),
        {
            key: 'image_importer',
            label: 'Gắn ảnh sản phẩm',
            view: { page: 'adminProductImageImporter' } as AdminNavigationView,
        }
    ], [pharmacyTabs]);
    const dashboardOrderTaskItems = useMemo(() => [
        { key: 'overview', label: 'Tổng quan', view: { page: 'adminDashboard', section: 'overview' } as AdminNavigationView },
        { key: 'orders', label: 'Đơn hàng', view: { page: 'adminPharmacyManagement', section: 'orders' } as AdminNavigationView },
        { key: 'customers', label: 'Khách hàng', view: { page: 'adminDashboard', section: 'customers' } as AdminNavigationView },
        { key: 'appointments', label: 'Lịch hẹn', view: { page: 'adminDashboard', section: 'appointments' } as AdminNavigationView },
        { key: 'reports', label: 'Báo cáo', view: { page: 'adminDashboard', section: 'reports' } as AdminNavigationView },
    ], []);

    const orderTaskItems: Array<{ key: AdminPharmacyOrderPreset; label: string }> = [
        { key: 'all', label: 'Tất cả đơn' },
        { key: 'priority_queue', label: 'Ưu tiên ngay' },
        { key: 'shipping_handover', label: 'Thiếu vận đơn' },
        { key: 'bank_transfer_followup', label: 'Bank transfer' },
        { key: 'refund_attention', label: 'Refund cần rà' },
        { key: 'today_watch', label: 'Đơn hôm nay' },
    ];

    const discountSummary = useMemo(() => {
        const active = discountCodes.filter((code) => code.is_active).length;
        const expiringSoon = discountCodes.filter((code) => {
            if (!code.ends_at) return false;
            const endsAt = new Date(code.ends_at).getTime();
            if (Number.isNaN(endsAt)) return false;
            const diff = endsAt - Date.now();
            return diff > 0 && diff <= 7 * 24 * 60 * 60 * 1000;
        }).length;
        return {
            total: discountCodes.length,
            active,
            inactive: Math.max(discountCodes.length - active, 0),
            expiringSoon,
        };
    }, [discountCodes]);

    const taxSummary = useMemo(() => {
        const activeProfiles = taxProfiles.filter((profile) => profile.is_active).length;
        const defaultProfile = taxProfiles.find((profile) => profile.is_default);
        const totalOverrides = taxProfiles.reduce((sum, profile) => sum + (profile.rates?.length || 0), 0);
        return {
            totalProfiles: taxProfiles.length,
            activeProfiles,
            totalOverrides,
            defaultProfileName: defaultProfile?.name || 'Chưa có mặc định',
        };
    }, [taxProfiles]);

    const ghtkSummary = useMemo(() => ({
        addressCount: pickAddresses.length,
        connectionLabel:
            ghtkConnectionStatus === 'ready'
                ? 'Sẵn sàng'
                : ghtkConnectionStatus === 'missing_token'
                    ? 'Thiếu token'
                    : ghtkConnectionStatus === 'error'
                        ? 'Lỗi kết nối'
                        : 'Chưa kiểm tra',
        detailLoaded: selectedAddressDetail ? 'Đã tải' : 'Chưa tải',
    }), [pickAddresses.length, ghtkConnectionStatus, selectedAddressDetail]);

    const sectionMeta = useMemo(() => {
        if (view === 'edit-product') {
            return {
                title: selectedProduct ? 'Chỉnh sửa sản phẩm' : 'Tạo sản phẩm mới',
                description: 'Editor sản phẩm tập trung vào catalog, media, SEO và tồn kho. Đơn hàng được quản lý trong Dashboard vận hành.',
                eyebrow: 'Catalog editor',
                insights: [
                    { label: 'Sản phẩm', value: String(products.length), hint: `${categories.length} chuyên mục • ${brands.length} thương hiệu` },
                    { label: 'Màn hiện tại', value: selectedProduct ? 'Đang sửa' : 'Tạo mới', hint: 'Đi thẳng giữa sản phẩm trước và sau ngay trong editor' },
                    { label: 'Đơn hàng', value: String(productOrders.length), hint: 'Được quản lý trong Dashboard vận hành' },
                ],
            };
        }

        if (activeTab === 'orders') {
            return {
                title: 'Điều phối đơn hàng',
                description: 'Tách riêng khu đơn hàng để xử lý trạng thái, thanh toán, vận chuyển, refund và timeline mà không bị nhiễu bởi catalog hoặc cấu hình thuế.',
                eyebrow: 'Order operations',
                insights: [
                    { label: 'Đơn hàng', value: String(productOrders.length), hint: `${orderStats.todayOrders} đơn hôm nay • ${selectedOrderIds.length} đơn đang chọn` },
                    { label: 'Doanh thu lọc', value: formatCurrency(orderStats.totalRevenue), hint: `Refunded: ${formatCurrency(orderStats.refundedAmount)}` },
                    { label: 'Cần xử lý', value: String(orderStats.statusCounts.pending + orderStats.statusCounts.processing), hint: 'Pending + Processing trong bộ lọc hiện tại' },
                ],
            };
        }

        if (activeTab === 'brands') {
            return {
                title: 'Quản lý thương hiệu',
                description: 'Thương hiệu được tách khỏi sản phẩm để tập trung vào logo, mô tả landing page, độ phủ catalog và các brand đang thiếu nội dung.',
                eyebrow: 'Brand library',
                insights: [
                    { label: 'Thương hiệu', value: String(brands.length), hint: `${brandSummary.brandsWithLogo} brand có logo` },
                    { label: 'Có mô tả', value: String(brandSummary.brandsWithDescription), hint: `${brandSummary.emptyBrands} brand chưa gắn sản phẩm` },
                    { label: 'Tổng SKU', value: String(products.length), hint: 'Dùng để đo độ phủ từng thương hiệu trong catalog' },
                ],
            };
        }

        if (activeTab === 'categories') {
            return {
                title: 'Chuyên mục sản phẩm',
                description: 'Chuyên mục được tách thành một task riêng để quản lý taxonomy, featured categories và import/export mà không lẫn với bảng sản phẩm.',
                eyebrow: 'Catalog taxonomy',
                insights: [
                    { label: 'Chuyên mục', value: String(categories.length), hint: `${featuredCategoriesCount} chuyên mục nổi bật` },
                    { label: 'Sản phẩm', value: String(products.length), hint: 'Dùng để rà category coverage trước khi đổi taxonomy' },
                    { label: 'Import / export', value: 'Excel', hint: 'Template và export được giữ riêng cho taxonomy' },
                ],
            };
        }

        if (activeTab === 'discounts') {
            return {
                title: 'Mã giảm giá',
                description: 'Tách riêng khối khuyến mãi để kiểm soát vòng đời mã, thời gian hiệu lực, ngưỡng đơn hàng và giới hạn dùng mà không lẫn với thuế hoặc order.',
                eyebrow: 'Promotion controls',
                insights: [
                    { label: 'Tổng mã', value: String(discountSummary.total), hint: `${discountSummary.active} đang bật • ${discountSummary.inactive} đang tắt` },
                    { label: 'Sắp hết hạn', value: String(discountSummary.expiringSoon), hint: 'Trong 7 ngày tới' },
                    { label: 'Áp dụng', value: 'Checkout', hint: 'Chỉ kiểm soát mã giảm giá của luồng mua hàng' },
                ],
            };
        }

        if (activeTab === 'taxes') {
            return {
                title: 'Thuế và VAT',
                description: 'Tách cấu hình thuế khỏi phần catalog để tập trung vào tax profile, rate override theo địa bàn và chuẩn tính thuế của từng đơn hàng.',
                eyebrow: 'Tax operations',
                insights: [
                    { label: 'Tax profile', value: String(taxSummary.totalProfiles), hint: `${taxSummary.activeProfiles} đang hoạt động` },
                    { label: 'Rate override', value: String(taxSummary.totalOverrides), hint: 'Override theo tỉnh / quận' },
                    { label: 'Mặc định', value: taxSummary.defaultProfileName, hint: 'Profile đang làm chuẩn tính thuế cho checkout' },
                ],
            };
        }

        if (activeTab === 'ghtk_settings') {
            return {
                title: 'Cấu hình GHTK',
                description: 'Khu này chỉ giữ kết nối giao vận: token, webhook, địa chỉ lấy hàng và trạng thái đồng bộ với GHTK, không trộn với order list.',
                eyebrow: 'Shipping integration',
                insights: [
                    { label: 'Kết nối', value: ghtkSummary.connectionLabel, hint: `${ghtkSummary.addressCount} địa chỉ lấy hàng` },
                    { label: 'Webhook', value: useD1Api ? 'Cloudflare Worker' : 'Supabase fn', hint: 'Đơn GHTK sẽ cập nhật trạng thái qua webhook' },
                    { label: 'Địa chỉ chi tiết', value: ghtkSummary.detailLoaded, hint: 'Mở từng địa chỉ để xem payload đầy đủ' },
                ],
            };
        }

        return {
            title: t('admin.pharmacy_management_title'),
            description: 'Khu sản phẩm dành riêng cho catalog và tồn kho: lọc SKU, chỉnh VAT, quick edit và bulk actions.',
            eyebrow: 'Catalog & inventory',
            insights: [
                { label: 'Sản phẩm', value: String(products.length), hint: `${categories.length} chuyên mục • ${brands.length} thương hiệu` },
                { label: 'Đang nổi bật', value: String(products.filter((product) => product.is_featured).length), hint: 'Các SKU đang được đẩy lên homepage và listing' },
                { label: 'Đơn hàng', value: String(productOrders.length), hint: 'Được quản lý trong Dashboard vận hành' },
            ],
        };
    }, [
        view,
        selectedProduct,
        products,
        categories.length,
        brands.length,
        productOrders.length,
        activeTab,
        orderStats,
        selectedOrderIds.length,
        brandSummary,
        featuredCategoriesCount,
        discountSummary,
        taxSummary,
        ghtkSummary,
        t,
    ]);

    const workspaceActions = (() => {
        const secondaryButtonClass = adminActionButtonClass;
        const primaryButtonClass = adminPrimaryActionButtonClass;
        const actionLayoutClass = 'grid gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap xl:justify-end';

        if (view === 'edit-product') {
            return (
                <div className={actionLayoutClass}>
                    <button
                        type="button"
                        onClick={closeProductEditor}
                        className={secondaryButtonClass}
                    >
                        Về danh sách
                    </button>
                    <button
                        type="button"
                        onClick={handleAddNewProduct}
                        className={primaryButtonClass}
                    >
                        <PlusCircleIcon className="h-4 w-4" />
                        <span>Tạo sản phẩm mới</span>
                    </button>
                </div>
            );
        }

        if (activeTab === 'orders') {
            return (
                <div className={actionLayoutClass}>
                    <button
                        type="button"
                        onClick={() => onNavigate({ page: 'adminPharmacyManagement', section: 'products' })}
                        className={secondaryButtonClass}
                    >
                        Mở sản phẩm
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleExportOrders(filteredOrders)}
                        disabled={isExportingOrders}
                        className={`${primaryButtonClass} disabled:opacity-60`}
                    >
                        <span>{isExportingOrders ? 'Đang xuất...' : 'Xuất đơn đã lọc'}</span>
                    </button>
                </div>
            );
        }

        if (activeTab === 'brands') {
            return (
                <div className={actionLayoutClass}>
                    <button
                        type="button"
                        onClick={() => onNavigate({ page: 'adminPharmacyManagement', section: 'categories' })}
                        className={secondaryButtonClass}
                    >
                        Mở chuyên mục
                    </button>
                    <button
                        type="button"
                        onClick={() => onNavigate({ page: 'adminPharmacyManagement', section: 'products' })}
                        className={primaryButtonClass}
                    >
                        <span>Rà sản phẩm theo brand</span>
                    </button>
                </div>
            );
        }

        if (activeTab === 'categories') {
            return (
                <div className={actionLayoutClass}>
                    <button
                        type="button"
                        onClick={() => onNavigate({ page: 'adminPharmacyManagement', section: 'brands' })}
                        className={secondaryButtonClass}
                    >
                        Mở thương hiệu
                    </button>
                    <button
                        type="button"
                        onClick={() => onNavigate({ page: 'adminPharmacyManagement', section: 'products' })}
                        className={primaryButtonClass}
                    >
                        <span>Rà sản phẩm theo category</span>
                    </button>
                </div>
            );
        }

        if (activeTab === 'discounts') {
            return (
                <div className={actionLayoutClass}>
                    <button
                        type="button"
                        onClick={() => onNavigate({ page: 'adminPharmacyManagement', section: 'orders' })}
                        className={secondaryButtonClass}
                    >
                        Mở đơn hàng
                    </button>
                    <button
                        type="button"
                        onClick={() => onNavigate({ page: 'adminPharmacyManagement', section: 'taxes' })}
                        className={primaryButtonClass}
                    >
                        <span>Đi tới thuế & VAT</span>
                    </button>
                </div>
            );
        }

        if (activeTab === 'taxes') {
            return (
                <div className={actionLayoutClass}>
                    <button
                        type="button"
                        onClick={() => onNavigate({ page: 'adminPharmacyManagement', section: 'discounts' })}
                        className={secondaryButtonClass}
                    >
                        Mở mã giảm giá
                    </button>
                    <button
                        type="button"
                        onClick={() => onNavigate({ page: 'adminPharmacyManagement', section: 'orders' })}
                        className={primaryButtonClass}
                    >
                        <span>Kiểm tra đơn hàng</span>
                    </button>
                </div>
            );
        }

        if (activeTab === 'ghtk_settings') {
            return (
                <div className={actionLayoutClass}>
                    <button
                        type="button"
                        onClick={() => onNavigate({ page: 'adminPharmacyManagement', section: 'orders' })}
                        className={secondaryButtonClass}
                    >
                        Mở đơn hàng
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleFetchPickAddresses()}
                        disabled={isLoadingAddresses}
                        className={`${primaryButtonClass} disabled:opacity-60`}
                    >
                        <span>{isLoadingAddresses ? 'Đang tải...' : 'Tải địa chỉ GHTK'}</span>
                    </button>
                </div>
            );
        }

        return (
            <div className={actionLayoutClass}>
                <button
                    type="button"
                    onClick={handleAddNewProduct}
                    className={primaryButtonClass}
                >
                    <PlusCircleIcon className="h-4 w-4" />
                    <span>{t('admin.add_product')}</span>
                </button>
                <button
                    type="button"
                    onClick={() => onNavigate({ page: 'adminPharmacyManagement', section: 'orders' })}
                    className={secondaryButtonClass}
                >
                    Mở đơn hàng
                </button>
            </div>
        );
    })();

    useEffect(() => {
        const isOrderWorkspace = activeTab === 'orders';
        setSidebarConfig({
            title: isOrderWorkspace ? 'Dashboard kinh doanh' : sectionMeta.title,
            description: isOrderWorkspace
                ? 'Theo dõi doanh số bán hàng, dịch vụ, sản phẩm bán chạy và các địa phương đặt hàng nhiều nhất.'
                : sectionMeta.description,
            icon: isOrderWorkspace ? <CogIcon className="h-8 w-8" /> : <ShoppingBagIcon className="w-8 h-8" />,
            eyebrow: isOrderWorkspace ? 'Tuần này' : sectionMeta.eyebrow,
            actions: workspaceActions,
            insights: sectionMeta.insights,
            taskItems: isOrderWorkspace ? dashboardOrderTaskItems : pharmacyTaskItems,
            activeTaskKey: activeTab,
        });
    }, [setSidebarConfig, sectionMeta, workspaceActions, activeTab, dashboardOrderTaskItems, pharmacyTaskItems]);

    const renderContent = () => {
        if (view === 'edit-product') {
            return (
                <ProductEditorForm
                    product={selectedProduct}
                    categories={categories}
                    brands={brands}
                    onSave={handleSaveProductForm}
                    onCancel={closeProductEditor}
                    onCreateNewProduct={handleAddNewProduct}
                    previousProduct={previousProduct}
                    nextProduct={nextProduct}
                    onSelectPreviousProduct={previousProduct ? () => openProductEditor(previousProduct) : undefined}
                    onSelectNextProduct={nextProduct ? () => openProductEditor(nextProduct) : undefined}
                    productPositionLabel={productPositionLabel}
                />
            );
        }

        const filterButtons: { key: InventoryFilter, label: string }[] = [
            { key: 'all', label: t('admin.filter_all') },
            { key: 'in_stock', label: t('admin.filter_in_stock') },
            { key: 'low_stock', label: t('admin.filter_low_stock') },
            { key: 'out_of_stock', label: t('admin.filter_out_of_stock') },
            { key: 'hidden', label: 'Đang ẩn web' },
            { key: 'featured', label: 'Đang nổi bật' },
            { key: 'near_expiry', label: 'Sắp hết hạn 30 ngày' },
            { key: 'no_sku', label: 'Thiếu SKU' },
        ];

        return (
            <>
                {activeTab === 'products' && (
                    <div className="space-y-5 bg-transparent border-0 shadow-none">
                        <div className="rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 md:p-5">
                            <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div className="min-w-0">
                                    <h3 className="text-xl font-bold">{t('admin.products_list')} <span className="text-muted-foreground font-normal text-sm ml-2">({products.length} sản phẩm)</span></h3>
                                </div>
                                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center xl:justify-end bg-transparent w-full md:w-auto">
                                    <button onClick={handleDownloadProductTemplate} className={`${adminActionButtonClass} w-full sm:w-auto px-2 sm:px-4 text-xs sm:text-sm`}>
                                        <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-taifilemau.webp" alt="" className="w-4 h-4 sm:w-5 sm:h-5 object-contain" />
                                        <span>Mẫu Excel</span>
                                    </button>
                                    <button onClick={() => productFileInputRef.current?.click()} disabled={isImporting} className={`${adminActionButtonClass} w-full sm:w-auto px-2 sm:px-4 text-xs sm:text-sm disabled:opacity-50`}>
                                        {isImporting ? <Spinner className="w-4 h-4 sm:w-5 sm:h-5" /> : <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-inputexcel.webp" alt="" className="w-4 h-4 sm:w-5 sm:h-5 object-contain" />}
                                        <span>Nhập Excel</span>
                                    </button>
                                    <button onClick={handleExportProducts} className={`${adminActionButtonClass} w-full sm:w-auto px-2 sm:px-4 text-xs sm:text-sm`}>
                                        <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-outputexcel.webp" alt="" className="w-4 h-4 sm:w-5 sm:h-5 object-contain" />
                                        <span>Xuất Excel</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleSyncProductsToPancake()}
                                        disabled={isSyncingPancakeProducts}
                                        className={`${adminActionButtonClass} w-full sm:w-auto px-2 sm:px-4 text-xs sm:text-sm text-primary hover:text-primary disabled:cursor-wait`}
                                        title={selectedProductIds.length > 0 ? `Đồng bộ ${selectedProductIds.length} sản phẩm đã chọn với Pancake` : 'Đồng bộ toàn bộ sản phẩm đang hoạt động với Pancake'}
                                    >
                                        {isSyncingPancakeProducts ? <Spinner className="w-4 h-4 sm:w-5 sm:h-5" /> : <WrenchScrewdriverIcon className="w-4 h-4 sm:w-5 sm:h-5" />}
                                        <span>Đồng bộ sản phẩm</span>
                                    </button>
                                    <button onClick={handleAddNewProduct} className={`${adminPrimaryActionButtonClass} w-full sm:w-auto px-2 sm:px-4 text-xs sm:text-sm`}>
                                        <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-themmoi.webp" alt="" className="w-4 h-4 sm:w-5 sm:h-5 object-contain" />
                                        <span>Thêm mới</span>
                                    </button>
                                    <input type="file" ref={productFileInputRef} onChange={(e) => handleImportFile(e, 'product')} accept=".xlsx, .xls" className="hidden" />
                                </div>
                            </div>
                            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.45fr)_240px_240px]">
                            <div className="min-w-0 rounded-2xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] transition-all hover:ring-1 hover:ring-primary/30 focus-within:ring-2 focus-within:ring-primary/50 overflow-hidden">
                                <input
                                    type="text"
                                    placeholder="Tìm theo tên hoặc SKU..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full h-11 px-4 py-2 border-none bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/70"
                                />
                            </div>
                            <div className="min-w-0 rounded-2xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] transition-all hover:ring-1 hover:ring-primary/30 focus-within:ring-2 focus-within:ring-primary/50 overflow-hidden">
                                <select
                                    value={selectedCategoryId}
                                    onChange={e => setSelectedCategoryId(e.target.value)}
                                    className="w-full h-11 px-4 py-2 border-none bg-transparent text-sm font-medium focus:outline-none appearance-none cursor-pointer"
                                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
                                >
                                    <option value="all">Tất cả chuyên mục</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="min-w-0 rounded-2xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] transition-all hover:ring-1 hover:ring-primary/30 focus-within:ring-2 focus-within:ring-primary/50 overflow-hidden">
                                <select
                                    value={selectedBrand}
                                    onChange={e => setSelectedBrand(e.target.value)}
                                    className="w-full h-11 px-4 py-2 border-none bg-transparent text-sm font-medium focus:outline-none appearance-none cursor-pointer"
                                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
                                >
                                    <option value="all">Tất cả thương hiệu</option>
                                    {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                                </select>
                            </div>
                            </div>
                            <div className="mt-4 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                <div className="flex min-w-max gap-2 xl:flex-wrap p-1">
                                    {filterButtons.map(btn => (
                                        <button key={btn.key} onClick={() => navigateToProductFilter(btn.key)} className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${inventoryFilter === btn.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                                            {btn.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        {(() => {
                            const selectedProducts = products.filter(product => selectedProductIds.includes(product.id));
                            const allCurrentPageSelected = currentProductIds.length > 0 && currentProductIds.every(id => selectedProductIds.includes(id));

                            return (
                                <>
                                    <div className="mb-4 rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 md:p-4">
                                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                        <div className="grid grid-cols-2 gap-2 text-sm sm:flex sm:flex-wrap sm:items-center">
                                            <span className="col-span-2 sm:col-span-1 text-center font-semibold px-3 py-2 rounded-2xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] text-foreground">
                                                Đã chọn: {selectedProductIds.length} sản phẩm
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => toggleSelectProducts(currentProductIds, true)}
                                                className="w-full sm:w-auto inline-flex h-11 items-center justify-center rounded-2xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                            >
                                                Chọn trang
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedProductIds([])}
                                                className="w-full sm:w-auto inline-flex h-11 items-center justify-center rounded-2xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                            >
                                                Bỏ chọn hết
                                            </button>
                                        </div>
                                        <div className="grid gap-2 md:grid-cols-2 xl:min-w-[520px] xl:flex-1">
                                            <select
                                                value={bulkAction}
                                                onChange={(e) => setBulkAction(e.target.value as any)}
                                                className="h-11 rounded-2xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-4 py-2 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none pr-10 cursor-pointer"
                                                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
                                            >
                                                <option value="none">-- Thao tác hàng loạt --</option>
                                                <option value="publish">Hiện trên web</option>
                                                <option value="unpublish">Ẩn khỏi web</option>
                                                <option value="set_featured">Đánh dấu Nổi bật</option>
                                                <option value="unset_featured">Bỏ Nổi bật</option>
                                                <option value="set_category">Đổi chuyên mục...</option>
                                                <option value="set_brand">Đổi thương hiệu...</option>
                                                <option value="adjust_stock">Chỉnh kho (+/-)...</option>
                                                <option value="set_low_threshold">Mức cảnh báo tồn...</option>
                                                <option value="set_vat_rate">Chỉnh % VAT...</option>
                                                <option value="delete">Xóa sản phẩm</option>
                                            </select>

                                            {bulkAction === 'set_category' && (
                                                <select
                                                    value={bulkCategoryId}
                                                    onChange={(e) => setBulkCategoryId(e.target.value)}
                                                    className="h-11 rounded-2xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-4 py-2 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none pr-10 cursor-pointer"
                                                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
                                                >
                                                    <option value="all">Chọn chuyên mục</option>
                                                    {categories.map(category => (
                                                        <option key={category.id} value={category.id}>{category.name}</option>
                                                    ))}
                                                </select>
                                            )}

                                            {bulkAction === 'set_brand' && (
                                                <select
                                                    value={bulkBrandName}
                                                    onChange={(e) => setBulkBrandName(e.target.value)}
                                                    className="h-11 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl px-4 py-2 text-sm font-semibold shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50 appearance-none pr-10 cursor-pointer"
                                                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
                                                >
                                                    <option value="all">Chọn thương hiệu</option>
                                                    <option value="__none__">Không thương hiệu</option>
                                                    {brands.map(brand => (
                                                        <option key={brand.id} value={brand.name}>{brand.name}</option>
                                                    ))}
                                                </select>
                                            )}

                                            {(bulkAction === 'adjust_stock' || bulkAction === 'set_low_threshold' || bulkAction === 'set_vat_rate') && (
                                                <input
                                                    type="number"
                                                    value={bulkNumericValue}
                                                    onChange={(e) => setBulkNumericValue(e.target.value)}
                                                    placeholder={
                                                        bulkAction === 'adjust_stock'
                                                            ? 'VD: +10 hoặc -5'
                                                            : bulkAction === 'set_vat_rate'
                                                                ? 'VD: 8 hoặc 10'
                                                                : 'VD: 8'
                                                    }
                                                    className="h-11 w-40 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl px-4 py-2 text-sm font-semibold shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
                                                />
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => void handleApplyBulkAction(selectedProducts)}
                                                disabled={isApplyingBulkAction || selectedProductIds.length === 0}
                                                className="inline-flex items-center justify-center rounded-2xl bg-primary px-3 py-2 text-sm font-bold text-black transition-colors hover:bg-primary/90 disabled:bg-muted xl:ml-auto"
                                            >
                                                {isApplyingBulkAction ? <Spinner className="w-4 h-4" /> : 'Áp dụng thao tác'}
                                            </button>
                                        </div>
                                    </div>
                                    </div>

                                    <div className="rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 overflow-visible lg:overflow-hidden">
                                        <AdminMobileList>
                                            {currentProducts.length === 0 && (
                                                <AdminMobileCard className="flex min-h-[250px] flex-col items-center justify-center rounded-[1.45rem] border border-dashed p-6 text-center transition-all border-primary/25 bg-gradient-to-br from-primary/[0.07] via-card/70 to-sky-100/50 dark:to-slate-900/50">
                                                    <p className="text-base font-bold text-foreground">Không có sản phẩm nào khớp bộ lọc hiện tại.</p>
                                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Thử đổi search, chuyên mục, thương hiệu hoặc filter tồn kho để xem thêm SKU.</p>
                                                </AdminMobileCard>
                                            )}

                                            {currentProducts.map((p, productIndex) => {
                                                const statusInfo = getInventoryStatusInfo(p);
                                                const draft = getQuickDraft(p);
                                                const isDirty = isQuickDraftDirty(p);
                                                const isSavingThis = savingQuickProductId === p.id;
                                                const isSelected = selectedProductIds.includes(p.id);
                                                const isMenuOpen = openMobileMenuProductId === p.id;
                                                const isNearBottom = currentProducts.length > 2 && productIndex >= currentProducts.length - 2;
                                                const categoryName = categoryNameById.get(p.category_id || 0) || 'Chưa gắn chuyên mục';

                                                return (
                                                    <AdminMobileCard
                                                        key={p.id}
                                                        className={`relative transition-all p-3.5 ${
                                                            isMenuOpen ? 'z-40 border-primary/40 bg-card shadow-lg' : isSelected ? 'z-0 border-primary/35 bg-primary/[0.04]' : 'z-0'
                                                        }`}
                                                    >
                                                        {/* Backdrop overlay for active popup */}
                                                        {isMenuOpen && (
                                                            <div
                                                                className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px] transition-opacity animate-in fade-in"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setOpenMobileMenuProductId(null);
                                                                }}
                                                            />
                                                        )}

                                                        {/* Main product row: Checkbox + Square Image + Info + 3-dots Action button */}
                                                        <div className="relative z-10 flex items-start gap-3">
                                                            {/* Checkbox */}
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => toggleProductSelection(p.id)}
                                                                className="mt-1 h-4 w-4 shrink-0 rounded border-input text-primary focus:ring-primary"
                                                                aria-label={`Chọn sản phẩm ${p.name}`}
                                                            />

                                                            {/* Square Product Image */}
                                                            <div className="relative shrink-0">
                                                                <img
                                                                    src={p.images?.[0]?.image_url || 'https://placehold.co/100x100?text=SP'}
                                                                    alt={p.name}
                                                                    className="h-20 w-20 rounded-2xl border border-border/70 bg-card/60 backdrop-blur-xl object-cover shadow-xs"
                                                                    onError={(e) => {
                                                                        (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=SP';
                                                                    }}
                                                                />
                                                                {p.is_featured ? (
                                                                    <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 shadow-xs" title="Sản phẩm nổi bật">
                                                                        <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-star.webp" alt="Nổi bật" className="h-3 w-3 object-contain" />
                                                                    </span>
                                                                ) : null}
                                                            </div>

                                                            {/* Product Details */}
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-start justify-between gap-1">
                                                                    <p 
                                                                        className="line-clamp-2 text-sm font-bold text-foreground leading-snug cursor-pointer hover:text-primary transition-colors" 
                                                                        title={p.name}
                                                                        onClick={() => handleEditProduct(p)}
                                                                    >
                                                                        {p.name}
                                                                    </p>

                                                                    {/* 3-Dots Action Popup Trigger */}
                                                                    <div className="relative shrink-0" data-mobile-action-menu>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setOpenMobileMenuProductId((prev) => (prev === p.id ? null : p.id));
                                                                            }}
                                                                            aria-label={`Thao tác cho ${p.name}`}
                                                                            className={`relative z-50 flex h-8 w-8 items-center justify-center rounded-xl border transition-all active:scale-95 ${
                                                                                isMenuOpen
                                                                                    ? 'border-primary bg-primary text-primary-foreground shadow-md'
                                                                                    : 'border-border/70 bg-card/40 backdrop-blur-xl text-muted-foreground hover:bg-card/80 hover:text-foreground'
                                                                            }`}
                                                                        >
                                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
                                                                            </svg>
                                                                        </button>

                                                                        {/* Popover Action Menu */}
                                                                        {isMenuOpen && (
                                                                            <div className={`absolute right-0 z-50 w-52 rounded-2xl border border-white/80 bg-card/98 p-1.5 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.4)] backdrop-blur-2xl transition-all animate-in fade-in zoom-in-95 dark:border-white/10 ${
                                                                                isNearBottom ? 'bottom-10 origin-bottom-right' : 'top-10 origin-top-right'
                                                                            }`}>
                                                                                <div className="space-y-0.5">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setOpenMobileMenuProductId(null);
                                                                                            handleEditProduct(p);
                                                                                        }}
                                                                                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                                                                                    >
                                                                                        <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="Sửa" className="h-4 w-4 object-contain" />
                                                                                        <span>Chỉnh sửa sản phẩm</span>
                                                                                    </button>

                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setOpenMobileMenuProductId(null);
                                                                                            void onSaveProduct({ ...p, is_published: !p.is_published }, []);
                                                                                        }}
                                                                                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                                                                                    >
                                                                                        <img 
                                                                                            src={p.is_published ? "https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-invisible.webp" : "https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-visible.webp"} 
                                                                                            alt={p.is_published ? "Ẩn" : "Hiện"} 
                                                                                            className="h-4 w-4 object-contain" 
                                                                                        />
                                                                                        <span>{p.is_published ? 'Ẩn khỏi website' : 'Hiện trên website'}</span>
                                                                                    </button>

                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setOpenMobileMenuProductId(null);
                                                                                            void onSaveProduct({ ...p, is_featured: !p.is_featured }, []);
                                                                                        }}
                                                                                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                                                                                    >
                                                                                        <img 
                                                                                            src={p.is_featured ? "https://thegioitrimun.vn/r2/assets/admin-icons/20260720160138-unstar.webp" : "https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-star.webp"} 
                                                                                            alt={p.is_featured ? "Bỏ nổi bật" : "Nổi bật"} 
                                                                                            className="h-4 w-4 object-contain" 
                                                                                        />
                                                                                        <span>{p.is_featured ? 'Bỏ nổi bật' : 'Đánh dấu nổi bật'}</span>
                                                                                    </button>

                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setOpenMobileMenuProductId(null);
                                                                                            void handleSyncProductToPancake(p);
                                                                                        }}
                                                                                        disabled={syncingPancakeProductId === p.id}
                                                                                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                                                                                    >
                                                                                        {syncingPancakeProductId === p.id ? (
                                                                                            <Spinner className="h-4 w-4" />
                                                                                        ) : (
                                                                                            <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786688261441-dongbocanva.webp" alt="Đồng bộ" className="h-4 w-4 object-contain" />
                                                                                        )}
                                                                                        <span>Đồng bộ Pancake</span>
                                                                                    </button>

                                                                                    <div className="my-1 border-t border-border/50" />

                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setOpenMobileMenuProductId(null);
                                                                                            onDeleteProduct(p.id);
                                                                                        }}
                                                                                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
                                                                                    >
                                                                                        <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="Xóa" className="h-4 w-4 object-contain" />
                                                                                        <span>Xóa sản phẩm</span>
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Brand & category */}
                                                                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                                                    {p.brand || 'Chưa có Brand'} • {categoryName}{p.volume ? ` • ${p.volume}` : ''}
                                                                </p>

                                                                {/* Price & Stock */}
                                                                <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-1.5">
                                                                    <span className="text-sm font-black text-primary">
                                                                        {formatCurrency(Number(p.price) || 0)}
                                                                    </span>
                                                                    <span className={`text-xs font-medium ${p.stock_quantity <= 0 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                                                                        Kho: <strong className="text-foreground">{p.stock_quantity || 0}</strong>
                                                                    </span>
                                                                </div>

                                                                {/* Bottom meta badges: Status + SKU / ID */}
                                                                <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 border-t border-border/30 pt-1.5">
                                                                    <div className="flex flex-wrap items-center gap-1">
                                                                        {p.is_published ? (
                                                                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                                                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                                                Hiện web
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                                                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                                                                                Ẩn web
                                                                            </span>
                                                                        )}

                                                                        {statusInfo.color === 'bg-red-500' && (
                                                                            <span className="inline-flex items-center rounded-md border border-rose-500/25 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-400">
                                                                                Hết hàng
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    <span className="text-[10px] text-muted-foreground font-mono">
                                                                        SKU: {p.sku || '-'} • #{p.id}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Quick Draft unsaved changes notification bar if dirty */}
                                                        {isDirty && (
                                                            <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-300">
                                                                <span className="font-semibold">Có thay đổi nhanh chưa lưu</span>
                                                                <div className="flex items-center gap-1.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => void handleSaveQuickDraft(p)}
                                                                        disabled={isSavingThis}
                                                                        className="inline-flex h-6.5 items-center gap-1 rounded-lg bg-primary px-2 text-[11px] font-bold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
                                                                    >
                                                                        {isSavingThis ? <Spinner className="h-3 w-3" /> : 'Lưu'}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => resetQuickDraft(p.id)}
                                                                        className="inline-flex h-6.5 items-center rounded-lg border border-border/70 bg-background/60 px-1.5 text-[11px] font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                                                                    >
                                                                        Hủy
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </AdminMobileCard>
                                                );
                                            })}
                                        </AdminMobileList>
                                    </div>

                                        <div className="hidden overflow-visible rounded-[1.7rem] bg-transparent backdrop-blur-xl border-0 shadow-none lg:block">
                                                <table className="w-full table-fixed text-left text-sm">
                                                    <thead className="bg-muted/50 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                                        <tr>
                                                            <th className="w-12 px-4 py-3">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={allCurrentPageSelected}
                                                                    onChange={(e) => toggleSelectProducts(currentProductIds, e.target.checked)}
                                                                    className="h-4 w-4 rounded border-input"
                                                                    aria-label="Chọn tất cả sản phẩm trên bảng"
                                                                />
                                                            </th>
                                                            <th className="w-[48%] px-4 py-3 font-semibold cursor-pointer select-none hover:text-foreground" onClick={() => {
                                                                if (productSortColumn === 'name') {
                                                                    setProductSortDirection(productSortDirection === 'asc' ? 'desc' : 'asc');
                                                                } else {
                                                                    setProductSortColumn('name');
                                                                    setProductSortDirection('asc');
                                                                }
                                                            }}>
                                                                Sản phẩm {productSortColumn === 'name' ? (productSortDirection === 'asc' ? '↑' : '↓') : <span className="text-muted-foreground/30 ml-1">↕</span>}
                                                            </th>
                                                            <th className="w-[20%] px-4 py-3 font-semibold cursor-pointer select-none hover:text-foreground" onClick={() => {
                                                                if (productSortColumn === 'price') {
                                                                    setProductSortDirection(productSortDirection === 'asc' ? 'desc' : 'asc');
                                                                } else {
                                                                    setProductSortColumn('price');
                                                                    setProductSortDirection('asc');
                                                                }
                                                            }}>
                                                                Giá {productSortColumn === 'price' ? (productSortDirection === 'asc' ? '↑' : '↓') : <span className="text-muted-foreground/30 ml-1">↕</span>}
                                                            </th>
                                                            <th className="w-[12%] px-4 py-3 font-semibold cursor-pointer select-none hover:text-foreground" onClick={() => {
                                                                if (productSortColumn === 'status') {
                                                                    setProductSortDirection(productSortDirection === 'asc' ? 'desc' : 'asc');
                                                                } else {
                                                                    setProductSortColumn('status');
                                                                    setProductSortDirection('asc');
                                                                }
                                                            }}>
                                                                Trạng thái {productSortColumn === 'status' ? (productSortDirection === 'asc' ? '↑' : '↓') : <span className="text-muted-foreground/30 ml-1">↕</span>}
                                                            </th>
                                                            <th className="w-[20%] px-4 py-3 font-semibold text-right">Thao tác</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-border">
                                                        {currentProducts.length === 0 && (
                                                            <tr>
                                                                <td colSpan={5} className="px-6 py-12 text-center">
                                                                    <p className="text-base font-semibold text-foreground">Không có sản phẩm nào khớp bộ lọc hiện tại.</p>
                                                                    <p className="mt-2 text-sm text-muted-foreground">Thử đổi search, chuyên mục, thương hiệu hoặc filter tồn kho để xem thêm SKU.</p>
                                                                </td>
                                                            </tr>
                                                        )}

                                                        {currentProducts.map(p => {
                                                            const statusInfo = getInventoryStatusInfo(p);
                                                            const contentReview = getEffectiveContentReviewForProduct(p);
                                                            const draft = getQuickDraft(p);
                                                            const isDirty = isQuickDraftDirty(p);
                                                            const isSavingThis = savingQuickProductId === p.id;
                                                            const isSelected = selectedProductIds.includes(p.id);
                                                            const categoryName = categoryNameById.get(p.category_id || 0) || 'Chưa gắn chuyên mục';

                                                            return (
                                                                <tr
                                                                    key={p.id}
                                                                    className={`align-middle transition-colors ${isSelected ? 'bg-primary/[0.04]' : 'hover:bg-muted/20'}`}
                                                                >
                                                                    <td className="px-4 py-4">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isSelected}
                                                                            onChange={() => toggleProductSelection(p.id)}
                                                                            className="mt-1 h-4 w-4 rounded border-input"
                                                                            aria-label={`Chọn sản phẩm ${p.name}`}
                                                                        />
                                                                    </td>
                                                                    <td className="px-4 py-4">
                                                                        <div className="flex min-w-0 items-center gap-3">
                                                                            <div className="group/img-preview relative shrink-0">
                                                                                <img
                                                                                    src={p.images?.[0]?.image_url || 'https://placehold.co/80x80?text=SP'}
                                                                                    alt={p.name}
                                                                                    className="h-11 w-11 shrink-0 rounded-xl border border-border/80 bg-muted/20 object-cover shadow-xs transition-all duration-200 group-hover/img-preview:scale-105 group-hover/img-preview:border-primary/60 group-hover/img-preview:shadow-md cursor-pointer"
                                                                                    onError={(e) => {
                                                                                        (e.target as HTMLImageElement).src = 'https://placehold.co/80x80?text=SP';
                                                                                    }}
                                                                                />
                                                                                {/* Floating enlarged preview on hover - Fixed width, fully opaque & clean */}
                                                                                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3.5 z-[100] hidden group-hover/img-preview:block w-[208px] min-w-[208px] max-w-[208px] rounded-2xl border border-border/80 bg-popover p-2 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] transition-all animate-in fade-in zoom-in-95">
                                                                                    <img
                                                                                        src={p.images?.[0]?.image_url || 'https://placehold.co/240x240?text=SP'}
                                                                                        alt={p.name}
                                                                                        className="h-48 w-48 min-w-[192px] max-w-none rounded-xl object-cover bg-muted border border-border/40 block"
                                                                                        onError={(e) => {
                                                                                            (e.target as HTMLImageElement).src = 'https://placehold.co/240x240?text=SP';
                                                                                        }}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                            <div className="min-w-0">
                                                                                <div className="flex flex-wrap items-center gap-2">
                                                                                    <p className="truncate text-sm font-bold leading-6 text-foreground" title={p.name}>{p.name}</p>
                                                                                    {isDirty && (
                                                                                        <StatusChip
                                                                                            label="Chưa lưu"
                                                                                            tone="border-amber-200 bg-amber-50 text-amber-700"
                                                                                        />
                                                                                    )}
                                                                                </div>
                                                                                <p className="mt-1 text-xs text-muted-foreground">
                                                                                    ID: {p.id} • {p.brand || 'Chưa gắn brand'} • {categoryName}
                                                                                    {p.volume ? ` • ${p.volume}` : ''}
                                                                                    {p.origin ? ` • ${p.origin}` : ''}
                                                                                </p>

                                                                            </div>
                                                                        </div>
                                                                    </td>

                                                                    <td className="px-4 py-4">
                                                                        {editingPriceId === p.id ? (
                                                                            <input
                                                                                autoFocus
                                                                                type="number"
                                                                                min={0}
                                                                                step={1000}
                                                                                value={draft.price}
                                                                                onChange={(e) => updateQuickDraftField(p, 'price', e.target.value)}
                                                                                onBlur={() => setEditingPriceId(null)}
                                                                                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                                                                placeholder="Giá"
                                                                            />
                                                                        ) : (
                                                                            <div
                                                                                className="cursor-text rounded-md px-2 py-1 text-xs font-medium text-foreground hover:bg-muted/50"
                                                                                onClick={() => setEditingPriceId(p.id)}
                                                                                title="Nhấn để sửa giá"
                                                                            >
                                                                                {formatCurrency(Number(draft.price) || 0)}
                                                                            </div>
                                                                        )}
                                                                    </td>

                                                                    <td className="px-4 py-4">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    void onSaveProduct({ ...p, is_published: !p.is_published }, []);
                                                                                }}
                                                                                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
                                                                                    p.is_published
                                                                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                                                        : 'border-border bg-background text-muted-foreground hover:border-rose-200 hover:text-rose-700'
                                                                                }`}
                                                                                title={p.is_published ? 'Đang hiện trên Web. Nhấn để Ẩn' : 'Đang ẩn trên Web. Nhấn để Hiện'}
                                                                            >
                                                                                {p.is_published ? <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-visible.webp" alt="Hiện" className="h-5 w-5 object-contain inline-block" /> : <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-invisible.webp" alt="Ẩn" className="h-5 w-5 object-contain inline-block" />}
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => onSaveProduct({ ...p, is_featured: !p.is_featured }, [])}
                                                                                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
                                                                                    p.is_featured
                                                                                        ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                                                                        : 'border-border bg-background text-muted-foreground hover:border-amber-200 hover:text-amber-700'
                                                                                }`}
                                                                                title={p.is_featured ? 'Gỡ nổi bật trên Trang Chủ' : 'Đánh dấu nổi bật trên Trang Chủ'}
                                                                            >
                                                                                {p.is_featured ? <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-star.webp" alt="Nổi bật" className="h-5 w-5 object-contain inline-block" /> : <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260720160138-unstar.webp" alt="Không nổi bật" className="h-5 w-5 object-contain inline-block" />}
                                                                            </button>
                                                                        </div>
                                                                    </td>

                                                                    <td className="px-4 py-4 text-right">
                                                                        <div className="flex items-center justify-end gap-2">
                                                                            {isDirty && (
                                                                                <>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => void handleSaveQuickDraft(p)}
                                                                                        disabled={isSavingThis}
                                                                                        className="inline-flex h-7 items-center justify-center rounded-lg bg-primary px-2 text-[11px] font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                                                                                    >
                                                                                        {isSavingThis ? <Spinner className="h-3 w-3" /> : 'Lưu'}
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => resetQuickDraft(p.id)}
                                                                                        className="inline-flex h-7 items-center justify-center rounded-lg border border-border px-2 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                                                                    >
                                                                                        Hủy
                                                                                    </button>
                                                                                </>
                                                                            )}
                                                                            <div className="relative group inline-flex">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleEditProduct(p)}
                                                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl transition-all hover:scale-110 hover:bg-card/40 active:scale-95"
                                                                                    aria-label="Sửa đầy đủ"
                                                                                >
                                                                                    <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="Sửa" className="h-6 w-6 object-contain" />
                                                                                </button>
                                                                                <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                                                                    Sửa đầy đủ
                                                                                </span>
                                                                            </div>
                                                                            <div className="relative group inline-flex">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => void handleSyncProductToPancake(p)}
                                                                                    disabled={syncingPancakeProductId === p.id}
                                                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl transition-all hover:scale-110 hover:bg-card/40 active:scale-95 disabled:cursor-wait disabled:opacity-60"
                                                                                    aria-label="Đồng bộ Pancake"
                                                                                >
                                                                                    {syncingPancakeProductId === p.id ? (
                                                                                        <Spinner className="h-5 w-5" />
                                                                                    ) : (
                                                                                        <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786688261441-dongbocanva.webp" alt="Đồng bộ" className="h-6 w-6 object-contain" />
                                                                                    )}
                                                                                </button>
                                                                                <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                                                                    Đồng bộ Pancake
                                                                                </span>
                                                                            </div>
                                                                            <div className="relative group inline-flex">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => onDeleteProduct(p.id)}
                                                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl transition-all hover:scale-110 hover:bg-card/40 active:scale-95"
                                                                                    aria-label="Xóa sản phẩm"
                                                                                >
                                                                                    <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="Xóa" className="h-6 w-6 object-contain" />
                                                                                </button>
                                                                                <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                                                                    Xóa sản phẩm
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                        </div>

                                    <Pagination
                                        currentPage={productsCurrentPage}
                                        totalPages={totalProductPages}
                                        onPageChange={setProductsCurrentPage}
                                    />
                                </>
                            );
                        })()}
                    </div>
                )}

                {activeTab === 'categories' && (
                    <div className="space-y-6 bg-transparent border-0 shadow-none p-3 md:p-5">
                        {isCategoryFormVisible ? (
                            <div className="w-full">
                                <div className="w-full">
                                    <div className="flex items-center justify-between gap-3 mb-5">
                                        <div>
                                            <h3 className="text-2xl font-black">Thêm chuyên mục mới</h3>
                                        </div>
                                    </div>
                                    <form onSubmit={handleAddNewCategory} className="space-y-4 max-w-2xl">
                                        <div>
                                            <label className="text-sm font-medium">Tên chuyên mục <span className="text-red-500">*</span></label>
                                            <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="mt-1 w-full p-2.5 border border-input rounded-xl bg-background" placeholder="Nhập tên chuyên mục..." required />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium">Slug <span className="text-red-500">*</span></label>
                                            <input type="text" value={newCategorySlug} onChange={e => setNewCategorySlug(e.target.value)} className="mt-1 w-full p-2.5 border border-input rounded-xl bg-background font-mono" placeholder="vi-du-slug" required />
                                        </div>
                                        <div className="flex items-center gap-2 pt-2">
                                            <input type="checkbox" id="newCategoryIsFeatured" checked={newCategoryIsFeatured} onChange={e => setNewCategoryIsFeatured(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                            <label htmlFor="newCategoryIsFeatured" className="text-sm font-bold text-primary">⭐ Hiển thị chuyên mục này trên Trang Chủ</label>
                                        </div>
                                        <div className="flex items-center gap-3 pt-3">
                                            <button type="submit" className="bg-primary text-primary-foreground font-bold py-3 px-6 rounded-xl hover:bg-primary/90 transition-colors btn-press">
                                                Tạo chuyên mục
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIsCategoryFormVisible(false)}
                                                className="border border-border bg-background px-5 py-3 rounded-xl text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                            >
                                                Hủy
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 md:p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <h3 className="text-xl font-bold">Quản lý chuyên mục sản phẩm</h3>
                                        <p className="text-sm text-muted-foreground">Tổng số {categories.length} chuyên mục</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 xl:justify-end bg-transparent">
                                        <button onClick={handleDownloadCategoryTemplate} className={adminActionButtonClass}>
                                            <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-taifilemau.webp" alt="" className="w-5 h-5 object-contain" />
                                            <span>{t('admin.download_template')}</span>
                                        </button>
                                        <button onClick={() => categoryFileInputRef.current?.click()} disabled={isImporting} className={`${adminActionButtonClass} disabled:opacity-50`}>
                                            {isImporting ? <Spinner className="w-5 h-5" /> : <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-inputexcel.webp" alt="" className="w-5 h-5 object-contain" />}
                                            <span>{t('admin.import_excel')}</span>
                                        </button>
                                        <button onClick={handleExportCategories} className={adminActionButtonClass}>
                                            <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-outputexcel.webp" alt="" className="w-5 h-5 object-contain" />
                                            <span>{t('admin.export_excel')}</span>
                                        </button>
                                        <button onClick={() => setIsCategoryFormVisible(true)} className={adminPrimaryActionButtonClass}>
                                            <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-themmoi.webp" alt="" className="w-5 h-5 object-contain" />
                                            <span>Tạo chuyên mục</span>
                                        </button>
                                        <input type="file" ref={categoryFileInputRef} onChange={(e) => handleImportFile(e, 'category')} accept=".xlsx, .xls" className="hidden" />
                                    </div>
                                </div>

                                {/* Desktop Table */}
                                <div className="hidden overflow-hidden rounded-[1.25rem] lg:block border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10">
                                    <table className="w-full table-fixed text-left text-sm">
                                        <thead className="bg-muted/50 text-[12px] uppercase tracking-[0.18em] text-foreground font-black">
                                            <tr>
                                                <th className="w-[35%] px-4 py-3 text-center font-extrabold">Tên chuyên mục</th>
                                                <th className="w-[35%] px-4 py-3 text-center font-extrabold">Slug</th>
                                                <th className="w-[15%] px-4 py-3 text-center font-extrabold">Trang chủ</th>
                                                <th className="w-[15%] px-4 py-3 text-center font-extrabold">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-transparent">
                                            {categories.map(cat => (
                                                <tr key={cat.id} className="transition-colors hover:bg-muted/30">
                                                    {editingCategoryId === cat.id ? (
                                                        <td colSpan={4} className="p-3 bg-muted/20">
                                                            <div className="flex items-center gap-3">
                                                                <input type="text" value={editCategoryName} onChange={e => setEditCategoryName(e.target.value)} className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm" placeholder="Tên chuyên mục" />
                                                                <input type="text" value={editCategorySlug} onChange={e => setEditCategorySlug(e.target.value)} className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm font-mono" placeholder="Slug" />
                                                                <button onClick={handleSaveEditCategory} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90">Lưu</button>
                                                                <button onClick={handleCancelEditCategory} className="rounded-xl border border-border px-3 py-2 text-sm font-bold text-muted-foreground hover:bg-muted">Hủy</button>
                                                            </div>
                                                        </td>
                                                    ) : (
                                                        <>
                                                            <td className="px-4 py-3.5 font-bold text-foreground truncate">{cat.name}</td>
                                                            <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground truncate">{cat.slug}</td>
                                                            <td className="px-4 py-3.5 text-center">
                                                                <button
                                                                    onClick={() => onSaveCategory({ ...cat, is_featured: !cat.is_featured })}
                                                                    title={cat.is_featured ? 'Bỏ khỏi Trang Chủ' : 'Đưa lên Trang Chủ'}
                                                                    className={`text-lg transition-all ${cat.is_featured ? 'scale-110 text-yellow-500' : 'text-gray-300 grayscale hover:text-yellow-400'}`}
                                                                >
                                                                    ⭐
                                                                </button>
                                                            </td>
                                                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <div className="relative group inline-flex">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleStartEditCategory(cat)}
                                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-card/40 hover:text-primary transition-all hover:scale-110 active:scale-95"
                                                                            aria-label={`Sửa chuyên mục: ${cat.name}`}
                                                                        >
                                                                            <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="Sửa" className="w-5 h-5 object-contain" />
                                                                        </button>
                                                                        <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                                                            Sửa
                                                                        </span>
                                                                    </div>
                                                                    <div className="relative group inline-flex">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => onDeleteCategory(cat.id)}
                                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-card/40 hover:text-destructive transition-all hover:scale-110 active:scale-95"
                                                                            aria-label={`Xóa chuyên mục: ${cat.name}`}
                                                                        >
                                                                            <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="Xóa" className="w-5 h-5 object-contain" />
                                                                        </button>
                                                                        <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                                                            Xóa
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile List */}
                                <div className="lg:hidden rounded-[1.25rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3">
                                    <ul className="divide-y divide-border">
                                        {categories.map(cat => (
                                            <li key={cat.id} className="py-3.5 first:pt-0 last:pb-0">
                                                {editingCategoryId === cat.id ? (
                                                    <div className="space-y-3">
                                                        <div>
                                                            <label className="text-xs font-medium text-muted-foreground">Tên</label>
                                                            <input type="text" value={editCategoryName} onChange={e => setEditCategoryName(e.target.value)} className="mt-1 w-full admin-glass-input" />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-medium text-muted-foreground">Slug</label>
                                                            <input type="text" value={editCategorySlug} onChange={e => setEditCategorySlug(e.target.value)} className="mt-1 w-full admin-glass-input font-mono" />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <button onClick={handleCancelEditCategory} className="rounded-xl border border-border px-3 py-2 text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground">Hủy</button>
                                                            <button onClick={handleSaveEditCategory} className="rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90">Lưu</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex min-w-0 items-start gap-2">
                                                            <button
                                                                onClick={() => onSaveCategory({ ...cat, is_featured: !cat.is_featured })}
                                                                title={cat.is_featured ? 'Bỏ khỏi Trang Chủ' : 'Đưa lên Trang Chủ'}
                                                                className={`mt-0.5 text-lg transition-all ${cat.is_featured ? 'scale-110 text-yellow-500' : 'text-gray-300 grayscale hover:text-yellow-400'}`}
                                                            >
                                                                ⭐
                                                            </button>
                                                            <div className="min-w-0">
                                                                <p className="truncate font-bold text-foreground">{cat.name}</p>
                                                                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{cat.slug}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex shrink-0 items-center gap-1">
                                                            <button onClick={() => handleStartEditCategory(cat)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary" title="Sửa chuyên mục"><img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="Sửa" className="w-6 h-6 object-contain" /></button>
                                                            <button onClick={() => onDeleteCategory(cat.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-destructive" title="Xóa chuyên mục"><img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="Xóa" className="w-6 h-6 object-contain" /></button>
                                                        </div>
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'discounts' && (
                    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 bg-transparent border-0 shadow-none p-3 md:p-5">
                        <div className="xl:col-span-2">
                            <div className="rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 md:p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-bold">{editingDiscountId ? 'Cập nhật mã giảm giá' : 'Tạo mã giảm giá mới'}</h3>
                                    {editingDiscountId && (
                                        <button
                                            type="button"
                                            onClick={resetDiscountForm}
                                            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border"
                                        >
                                            Hủy sửa
                                        </button>
                                    )}
                                </div>

                                <form onSubmit={handleSaveDiscountCode} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Mã giảm giá <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            value={discountForm.code}
                                            onChange={(e) => setDiscountForm(prev => ({ ...prev, code: e.target.value.toUpperCase().replace(/\s+/g, '') }))}
                                            className="w-full admin-glass-input font-mono"
                                            placeholder="VD: ISKIN10"
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Loại giảm</label>
                                            <select
                                                value={discountForm.type}
                                                onChange={(e) => setDiscountForm(prev => ({
                                                    ...prev,
                                                    type: e.target.value as DiscountCode['type'],
                                                    max_discount_amount: e.target.value === 'fixed_amount' ? '' : prev.max_discount_amount,
                                                }))}
                                                className="w-full admin-glass-input"
                                            >
                                                <option value="percentage">Theo phần trăm (%)</option>
                                                <option value="fixed_amount">Theo số tiền (VND)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Giá trị giảm <span className="text-red-500">*</span></label>
                                            <input
                                                type="number"
                                                min={0}
                                                step={discountForm.type === 'percentage' ? 0.01 : 1000}
                                                value={discountForm.value}
                                                onChange={(e) => setDiscountForm(prev => ({ ...prev, value: e.target.value }))}
                                                className="w-full admin-glass-input"
                                                placeholder={discountForm.type === 'percentage' ? '10' : '50000'}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Đơn tối thiểu (VND)</label>
                                            <input
                                                type="number"
                                                min={0}
                                                step={1000}
                                                value={discountForm.min_purchase_amount}
                                                onChange={(e) => setDiscountForm(prev => ({ ...prev, min_purchase_amount: e.target.value }))}
                                                className="w-full admin-glass-input"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Giảm tối đa (VND)</label>
                                            <input
                                                type="number"
                                                min={0}
                                                step={1000}
                                                value={discountForm.max_discount_amount}
                                                onChange={(e) => setDiscountForm(prev => ({ ...prev, max_discount_amount: e.target.value }))}
                                                className="w-full admin-glass-input"
                                                placeholder={discountForm.type === 'percentage' ? 'Không bắt buộc' : 'Không áp dụng'}
                                                disabled={discountForm.type !== 'percentage'}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Giới hạn tổng lượt</label>
                                            <input
                                                type="number"
                                                min={1}
                                                step={1}
                                                value={discountForm.usage_limit}
                                                onChange={(e) => setDiscountForm(prev => ({ ...prev, usage_limit: e.target.value }))}
                                                className="w-full admin-glass-input"
                                                placeholder="Để trống = không giới hạn"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Giới hạn mỗi khách</label>
                                            <input
                                                type="number"
                                                min={1}
                                                step={1}
                                                value={discountForm.usage_limit_per_user}
                                                onChange={(e) => setDiscountForm(prev => ({ ...prev, usage_limit_per_user: e.target.value }))}
                                                className="w-full admin-glass-input"
                                                placeholder="Để trống = không giới hạn"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Bắt đầu</label>
                                            <input
                                                type="datetime-local"
                                                value={discountForm.starts_at}
                                                onChange={(e) => setDiscountForm(prev => ({ ...prev, starts_at: e.target.value }))}
                                                className="w-full admin-glass-input"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Kết thúc</label>
                                            <input
                                                type="datetime-local"
                                                value={discountForm.ends_at}
                                                onChange={(e) => setDiscountForm(prev => ({ ...prev, ends_at: e.target.value }))}
                                                className="w-full admin-glass-input"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">Mô tả nội bộ</label>
                                        <textarea
                                            value={discountForm.description}
                                            onChange={(e) => setDiscountForm(prev => ({ ...prev, description: e.target.value }))}
                                            className="w-full admin-glass-input min-h-20"
                                            placeholder="Ví dụ: Áp dụng chiến dịch tháng 3"
                                        />
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <input
                                            id="discount_is_active"
                                            type="checkbox"
                                            checked={discountForm.is_active}
                                            onChange={(e) => setDiscountForm(prev => ({ ...prev, is_active: e.target.checked }))}
                                            className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                                        />
                                        <label htmlFor="discount_is_active" className="text-sm font-medium">Kích hoạt mã giảm giá</label>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSavingDiscountCode}
                                        className="w-full bg-primary text-primary-foreground font-bold py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors btn-press disabled:bg-muted flex items-center justify-center"
                                    >
                                        {isSavingDiscountCode ? <Spinner className="w-5 h-5" /> : (editingDiscountId ? 'Cập nhật mã giảm giá' : 'Tạo mã giảm giá')}
                                    </button>
                                </form>
                            </div>
                        </div>

                        <div className="xl:col-span-3">
                            <div className="overflow-hidden rounded-[1.25rem] bg-card">
                                <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <h3 className="text-lg font-bold">Danh sách mã giảm giá ({discountCodes.length})</h3>
                                    <button
                                        type="button"
                                        onClick={() => void loadDiscountCodes()}
                                        disabled={isLoadingDiscountCodes}
                                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-bold text-secondary-foreground transition-colors hover:bg-secondary/90 disabled:opacity-50 sm:w-auto"
                                    >
                                        {isLoadingDiscountCodes ? <Spinner className="w-4 h-4" /> : 'Tải lại'}
                                    </button>
                                </div>

                                {isLoadingDiscountCodes ? (
                                    <div className="flex justify-center p-10"><Spinner /></div>
                                ) : discountCodes.length === 0 ? (
                                    <p className="text-muted-foreground text-center p-8">Chưa có mã giảm giá nào.</p>
                                ) : (
                                    <>
                                    <AdminMobileList className="p-3">
                                        {discountCodes.map((discount) => (
                                            <AdminMobileCard key={discount.id || discount.code}>
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="font-mono text-base font-black text-foreground">{discount.code}</p>
                                                        {discount.description ? <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{discount.description}</p> : null}
                                                    </div>
                                                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${discount.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {discount.is_active ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <XCircleIcon className="w-3.5 h-3.5" />}
                                                        {discount.is_active ? 'Bật' : 'Tắt'}
                                                    </span>
                                                </div>
                                                <div className="mt-3 grid grid-cols-2 gap-2">
                                                    <AdminMobileMeta
                                                        label="Loại"
                                                        value={discount.type === 'percentage' ? `${discount.value}%` : formatCurrency(discount.value)}
                                                    />
                                                    <AdminMobileMeta
                                                        label="Đã dùng"
                                                        value={`${discount.usage_count ?? 0}${discount.usage_limit ? ` / ${discount.usage_limit}` : ' / ∞'}`}
                                                    />
                                                    <AdminMobileMeta
                                                        label="Đơn tối thiểu"
                                                        value={formatCurrency(discount.min_purchase_amount || 0)}
                                                    />
                                                    <AdminMobileMeta
                                                        label="Mỗi khách"
                                                        value={discount.usage_limit_per_user ?? '∞'}
                                                    />
                                                    <AdminMobileMeta
                                                        label="Bắt đầu"
                                                        value={discount.starts_at ? new Date(discount.starts_at).toLocaleString('vi-VN') : 'Ngay lập tức'}
                                                        className="col-span-2"
                                                    />
                                                    <AdminMobileMeta
                                                        label="Kết thúc"
                                                        value={discount.ends_at ? new Date(discount.ends_at).toLocaleString('vi-VN') : 'Không giới hạn'}
                                                        className="col-span-2"
                                                    />
                                                </div>
                                                <div className="mt-4 grid grid-cols-2 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleStartEditDiscount(discount)}
                                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-3 text-sm font-bold text-foreground transition-colors hover:border-primary/35 hover:text-primary"
                                                    >
                                                        <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="Sửa" className="h-4 w-4 object-contain" />
                                                        Sửa
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleDeleteDiscountCode(discount)}
                                                        disabled={deletingDiscountId === discount.id}
                                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-3 text-sm font-bold text-muted-foreground transition-colors hover:border-destructive/35 hover:text-destructive disabled:opacity-50"
                                                    >
                                                        {deletingDiscountId === discount.id ? <Spinner className="h-4 w-4" /> : <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="Xóa" className="h-4 w-4 object-contain" />}
                                                        Xóa
                                                    </button>
                                                </div>
                                            </AdminMobileCard>
                                        ))}
                                    </AdminMobileList>
                                    <div className="hidden overflow-x-auto lg:block">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                                                <tr>
                                                    <th className="px-4 py-3">Mã</th>
                                                    <th className="px-4 py-3">Loại</th>
                                                    <th className="px-4 py-3">Điều kiện</th>
                                                    <th className="px-4 py-3">Sử dụng</th>
                                                    <th className="px-4 py-3">Hiệu lực</th>
                                                    <th className="px-4 py-3">Trạng thái</th>
                                                    <th className="px-4 py-3 text-right">Thao tác</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {discountCodes.map((discount) => (
                                                    <tr key={discount.id || discount.code} className="border-b border-border last:border-0">
                                                        <td className="px-4 py-3">
                                                            <p className="font-mono font-semibold">{discount.code}</p>
                                                            {discount.description && <p className="text-xs text-muted-foreground mt-1">{discount.description}</p>}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {discount.type === 'percentage' ? (
                                                                <span className="font-semibold">{discount.value}%</span>
                                                            ) : (
                                                                <span className="font-semibold">{formatCurrency(discount.value)}</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <p className="text-xs">Đơn tối thiểu: <span className="font-semibold">{formatCurrency(discount.min_purchase_amount || 0)}</span></p>
                                                            {discount.type === 'percentage' && (
                                                                <p className="text-xs">Giảm tối đa: <span className="font-semibold">{discount.max_discount_amount ? formatCurrency(discount.max_discount_amount) : 'Không giới hạn'}</span></p>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-xs">
                                                            <p>
                                                                {discount.usage_count ?? 0}
                                                                {discount.usage_limit ? ` / ${discount.usage_limit}` : ' / ∞'}
                                                            </p>
                                                            <p className="text-muted-foreground">
                                                                / khách: {discount.usage_limit_per_user ?? '∞'}
                                                            </p>
                                                        </td>
                                                        <td className="px-4 py-3 text-xs">
                                                            <p>{discount.starts_at ? new Date(discount.starts_at).toLocaleString('vi-VN') : 'Ngay lập tức'}</p>
                                                            <p className="text-muted-foreground">{discount.ends_at ? new Date(discount.ends_at).toLocaleString('vi-VN') : 'Không giới hạn'}</p>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${discount.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                {discount.is_active ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <XCircleIcon className="w-3.5 h-3.5" />}
                                                                {discount.is_active ? 'Đang bật' : 'Đang tắt'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <div className="relative group inline-flex">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleStartEditDiscount(discount)}
                                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-card/40 hover:text-primary transition-all hover:scale-110 active:scale-95"
                                                                        aria-label={`Sửa mã giảm giá: ${discount.code}`}
                                                                    >
                                                                        <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="Sửa" className="w-5 h-5 object-contain" />
                                                                    </button>
                                                                    <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                                                        Sửa mã
                                                                    </span>
                                                                </div>
                                                                <div className="relative group inline-flex">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => void handleDeleteDiscountCode(discount)}
                                                                        disabled={deletingDiscountId === discount.id}
                                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-card/40 hover:text-destructive transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
                                                                        aria-label={`Xóa mã giảm giá: ${discount.code}`}
                                                                    >
                                                                        {deletingDiscountId === discount.id ? <Spinner className="w-4 h-4" /> : <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="Xóa" className="w-5 h-5 object-contain" />}
                                                                    </button>
                                                                    <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                                                        Xóa mã
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'taxes' && (
                    <div className="space-y-6 bg-transparent border-0 shadow-none p-3 md:p-5">




                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div className="rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 md:p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-bold">{editingTaxProfileId ? 'Cập nhật hồ sơ thuế' : 'Tạo hồ sơ thuế mới'}</h3>
                                    <div className="flex items-center gap-2">
                                        {editingTaxProfileId && (
                                            <button
                                                type="button"
                                                onClick={resetTaxProfileForm}
                                                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border"
                                            >
                                                Hủy sửa
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => void loadTaxSettings()}
                                            disabled={isLoadingTaxSettings}
                                            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border disabled:opacity-50"
                                        >
                                            {isLoadingTaxSettings ? 'Đang tải...' : 'Tải lại'}
                                        </button>
                                    </div>
                                </div>

                                <form onSubmit={handleSaveTaxProfile} className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Mã hồ sơ <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                value={taxProfileForm.code}
                                                onChange={(e) => setTaxProfileForm(prev => ({ ...prev, code: e.target.value.toUpperCase().replace(/\s+/g, '_') }))}
                                                className="w-full admin-glass-input font-mono"
                                                placeholder="VAT_STANDARD"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Tên hồ sơ <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                value={taxProfileForm.name}
                                                onChange={(e) => setTaxProfileForm(prev => ({ ...prev, name: e.target.value }))}
                                                className="w-full admin-glass-input"
                                                placeholder="VAT tiêu chuẩn"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Tax mode</label>
                                            <select
                                                value={taxProfileForm.tax_mode}
                                                onChange={(e) => setTaxProfileForm(prev => ({ ...prev, tax_mode: e.target.value as TaxProfile['tax_mode'] }))}
                                                className="w-full admin-glass-input"
                                            >
                                                <option value="exclusive">Exclusive</option>
                                                <option value="inclusive">Inclusive</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Thuế mặc định (%)</label>
                                            <input
                                                type="number"
                                                min={0}
                                                max={100}
                                                step={0.01}
                                                value={taxProfileForm.default_rate}
                                                onChange={(e) => setTaxProfileForm(prev => ({ ...prev, default_rate: e.target.value }))}
                                                className="w-full admin-glass-input"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Tiền tệ</label>
                                            <input
                                                type="text"
                                                value={taxProfileForm.currency}
                                                onChange={(e) => setTaxProfileForm(prev => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                                                className="w-full admin-glass-input"
                                                placeholder="VND"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Bắt đầu</label>
                                            <input
                                                type="datetime-local"
                                                value={taxProfileForm.starts_at}
                                                onChange={(e) => setTaxProfileForm(prev => ({ ...prev, starts_at: e.target.value }))}
                                                className="w-full admin-glass-input"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Kết thúc</label>
                                            <input
                                                type="datetime-local"
                                                value={taxProfileForm.ends_at}
                                                onChange={(e) => setTaxProfileForm(prev => ({ ...prev, ends_at: e.target.value }))}
                                                className="w-full admin-glass-input"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <label className="flex items-center gap-2 text-sm font-medium">
                                            <input
                                                type="checkbox"
                                                checked={taxProfileForm.applies_to_shipping}
                                                onChange={(e) => setTaxProfileForm(prev => ({ ...prev, applies_to_shipping: e.target.checked }))}
                                                className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                                            />
                                            Tính thuế cho ship
                                        </label>
                                        <label className="flex items-center gap-2 text-sm font-medium">
                                            <input
                                                type="checkbox"
                                                checked={taxProfileForm.is_active}
                                                onChange={(e) => setTaxProfileForm(prev => ({ ...prev, is_active: e.target.checked }))}
                                                className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                                            />
                                            Đang kích hoạt
                                        </label>
                                        <label className="flex items-center gap-2 text-sm font-medium">
                                            <input
                                                type="checkbox"
                                                checked={taxProfileForm.is_default}
                                                onChange={(e) => setTaxProfileForm(prev => ({ ...prev, is_default: e.target.checked }))}
                                                className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                                            />
                                            Hồ sơ mặc định
                                        </label>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSavingTaxProfile}
                                        className="w-full bg-primary text-primary-foreground font-bold py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors btn-press disabled:bg-muted flex items-center justify-center"
                                    >
                                        {isSavingTaxProfile ? <Spinner className="w-5 h-5" /> : (editingTaxProfileId ? 'Cập nhật hồ sơ thuế' : 'Tạo hồ sơ thuế')}
                                    </button>
                                </form>
                            </div>

                            <div className="rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 md:p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-bold">{editingTaxRateId ? 'Cập nhật rate override' : 'Tạo rate override'}</h3>
                                    {editingTaxRateId && (
                                        <button
                                            type="button"
                                            onClick={() => resetTaxRateForm(taxRateForm.tax_profile_id)}
                                            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border"
                                        >
                                            Hủy sửa
                                        </button>
                                    )}
                                </div>

                                <form onSubmit={handleSaveTaxRate} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Hồ sơ thuế</label>
                                        <select
                                            value={taxRateForm.tax_profile_id}
                                            onChange={(e) => setTaxRateForm(prev => ({ ...prev, tax_profile_id: e.target.value }))}
                                            className="w-full admin-glass-input"
                                            required
                                        >
                                            <option value="">Chọn hồ sơ thuế</option>
                                            {taxProfiles.map(profile => (
                                                <option key={profile.id} value={profile.id}>{profile.code} - {profile.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Tỉnh/Thành</label>
                                            <input
                                                type="text"
                                                value={taxRateForm.province}
                                                onChange={(e) => setTaxRateForm(prev => ({ ...prev, province: e.target.value }))}
                                                className="w-full admin-glass-input"
                                                placeholder="VD: Hồ Chí Minh"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Quận/Huyện</label>
                                            <input
                                                type="text"
                                                value={taxRateForm.district}
                                                onChange={(e) => setTaxRateForm(prev => ({ ...prev, district: e.target.value }))}
                                                className="w-full admin-glass-input"
                                                placeholder="Để trống nếu áp dụng cả tỉnh"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Mức thuế (%)</label>
                                            <input
                                                type="number"
                                                min={0}
                                                max={100}
                                                step={0.01}
                                                value={taxRateForm.rate}
                                                onChange={(e) => setTaxRateForm(prev => ({ ...prev, rate: e.target.value }))}
                                                className="w-full admin-glass-input"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Độ ưu tiên</label>
                                            <input
                                                type="number"
                                                step={1}
                                                value={taxRateForm.priority}
                                                onChange={(e) => setTaxRateForm(prev => ({ ...prev, priority: e.target.value }))}
                                                className="w-full admin-glass-input"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Tiền tệ override</label>
                                            <input
                                                type="text"
                                                value={taxRateForm.currency}
                                                onChange={(e) => setTaxRateForm(prev => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                                                className="w-full admin-glass-input"
                                                placeholder="Để trống = dùng profile"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Thuế ship</label>
                                            <select
                                                value={taxRateForm.applies_to_shipping}
                                                onChange={(e) => setTaxRateForm(prev => ({ ...prev, applies_to_shipping: e.target.value as TaxRateFormState['applies_to_shipping'] }))}
                                                className="w-full admin-glass-input"
                                            >
                                                <option value="inherit">Kế thừa từ profile</option>
                                                <option value="true">Có tính ship</option>
                                                <option value="false">Không tính ship</option>
                                            </select>
                                        </div>
                                        <label className="flex items-center gap-2 text-sm font-medium mt-8">
                                            <input
                                                type="checkbox"
                                                checked={taxRateForm.is_active}
                                                onChange={(e) => setTaxRateForm(prev => ({ ...prev, is_active: e.target.checked }))}
                                                className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                                            />
                                            Override đang kích hoạt
                                        </label>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Bắt đầu</label>
                                            <input
                                                type="datetime-local"
                                                value={taxRateForm.starts_at}
                                                onChange={(e) => setTaxRateForm(prev => ({ ...prev, starts_at: e.target.value }))}
                                                className="w-full admin-glass-input"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Kết thúc</label>
                                            <input
                                                type="datetime-local"
                                                value={taxRateForm.ends_at}
                                                onChange={(e) => setTaxRateForm(prev => ({ ...prev, ends_at: e.target.value }))}
                                                className="w-full admin-glass-input"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSavingTaxRate || !taxProfiles.length}
                                        className="w-full bg-primary text-primary-foreground font-bold py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors btn-press disabled:bg-muted flex items-center justify-center"
                                    >
                                        {isSavingTaxRate ? <Spinner className="w-5 h-5" /> : (editingTaxRateId ? 'Cập nhật rate override' : 'Tạo rate override')}
                                    </button>
                                </form>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div className="bg-card rounded-lg shadow-md border border-border overflow-hidden">
                                <div className="p-4 border-b border-border">
                                    <h3 className="text-lg font-bold">Danh sách hồ sơ thuế ({taxProfiles.length})</h3>
                                </div>

                                {isLoadingTaxSettings ? (
                                    <div className="flex justify-center p-10"><Spinner /></div>
                                ) : taxProfiles.length === 0 ? (
                                    <p className="text-muted-foreground text-center p-8">Chưa có hồ sơ thuế nào.</p>
                                ) : (
                                    <div className="divide-y divide-border">
                                        {taxProfiles.map(profile => (
                                            <div key={profile.id} className="p-4">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="font-mono font-semibold">{profile.code}</p>
                                                            {profile.is_default && <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">Mặc định</span>}
                                                            {profile.is_active ? (
                                                                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Đang bật</span>
                                                            ) : (
                                                                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Đang tắt</span>
                                                            )}
                                                        </div>
                                                        <p className="font-semibold mt-1">{profile.name}</p>
                                                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                            <p>Mode: <span className="font-semibold text-foreground">{profile.tax_mode}</span></p>
                                                            <p>Default rate: <span className="font-semibold text-foreground">{rateToPercentInput(profile.default_rate)}%</span></p>
                                                            <p>Ship: <span className="font-semibold text-foreground">{profile.applies_to_shipping ? 'Có tính' : 'Không tính'}</span></p>
                                                            <p>Currency: <span className="font-semibold text-foreground">{profile.currency}</span></p>
                                                        </div>
                                                        {(profile.starts_at || profile.ends_at) && (
                                                            <p className="text-xs text-muted-foreground mt-2">
                                                                Hiệu lực: {profile.starts_at ? new Date(profile.starts_at).toLocaleString('vi-VN') : 'Ngay'} - {profile.ends_at ? new Date(profile.ends_at).toLocaleString('vi-VN') : 'Không giới hạn'}
                                                            </p>
                                                        )}
                                                        <p className="text-xs text-muted-foreground mt-2">Override theo khu vực: {profile.rates?.length || 0}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <div className="relative group inline-flex">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleStartEditTaxProfile(profile)}
                                                                className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-card/40 hover:text-primary transition-all hover:scale-110 active:scale-95"
                                                                aria-label={`Sửa hồ sơ thuế: ${profile.name}`}
                                                            >
                                                                <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="Sửa" className="w-5 h-5 object-contain" />
                                                            </button>
                                                            <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                                                Sửa hồ sơ
                                                            </span>
                                                        </div>
                                                        <div className="relative group inline-flex">
                                                            <button
                                                                type="button"
                                                                onClick={() => void handleDeleteTaxProfile(profile)}
                                                                disabled={deletingTaxProfileId === profile.id}
                                                                className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-card/40 hover:text-destructive transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
                                                                aria-label={`Xóa hồ sơ thuế: ${profile.name}`}
                                                            >
                                                                {deletingTaxProfileId === profile.id ? <Spinner className="w-4 h-4" /> : <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="Xóa" className="w-5 h-5 object-contain" />}
                                                            </button>
                                                            <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                                                Xóa hồ sơ
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="bg-card rounded-lg shadow-md border border-border overflow-hidden">
                                <div className="p-4 border-b border-border">
                                    <h3 className="text-lg font-bold">Danh sách rate override ({allTaxRates.length})</h3>
                                </div>

                                {isLoadingTaxSettings ? (
                                    <div className="flex justify-center p-10"><Spinner /></div>
                                ) : allTaxRates.length === 0 ? (
                                    <p className="text-muted-foreground text-center p-8">Chưa có rate override nào. Hiện checkout sẽ dùng `default_rate` và `products.vat_rate`.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                                                <tr>
                                                    <th className="px-4 py-3">Profile</th>
                                                    <th className="px-4 py-3">Khu vực</th>
                                                    <th className="px-4 py-3">Rate</th>
                                                    <th className="px-4 py-3">Ưu tiên</th>
                                                    <th className="px-4 py-3">Trạng thái</th>
                                                    <th className="px-4 py-3 text-right">Thao tác</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {allTaxRates.map((rate) => (
                                                    <tr key={rate.id} className="border-b border-border last:border-0">
                                                        <td className="px-4 py-3">
                                                            <p className="font-mono font-semibold">{rate.profile_code}</p>
                                                            <p className="text-xs text-muted-foreground">{rate.profile_name}</p>
                                                        </td>
                                                        <td className="px-4 py-3 text-xs">
                                                            <p>{rate.province || 'Toàn quốc'}</p>
                                                            <p className="text-muted-foreground">{rate.district || 'Tất cả quận/huyện'}</p>
                                                        </td>
                                                        <td className="px-4 py-3 text-xs">
                                                            <p className="font-semibold">{rateToPercentInput(rate.rate)}%</p>
                                                            <p className="text-muted-foreground">
                                                                Ship: {rate.applies_to_shipping == null ? 'Kế thừa' : rate.applies_to_shipping ? 'Có tính' : 'Không tính'}
                                                            </p>
                                                        </td>
                                                        <td className="px-4 py-3">{rate.priority}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${rate.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                {rate.is_active ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <XCircleIcon className="w-3.5 h-3.5" />}
                                                                {rate.is_active ? 'Đang bật' : 'Đang tắt'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <div className="relative group inline-flex">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleStartEditTaxRate(rate)}
                                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-card/40 hover:text-primary transition-all hover:scale-110 active:scale-95"
                                                                        aria-label={`Sửa rate: ${rate.profile_code}`}
                                                                    >
                                                                        <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="Sửa" className="w-5 h-5 object-contain" />
                                                                    </button>
                                                                    <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                                                        Sửa rate
                                                                    </span>
                                                                </div>
                                                                <div className="relative group inline-flex">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => void handleDeleteTaxRate(rate)}
                                                                        disabled={deletingTaxRateId === rate.id}
                                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-card/40 hover:text-destructive transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
                                                                        aria-label={`Xóa rate: ${rate.profile_code}`}
                                                                    >
                                                                        {deletingTaxRateId === rate.id ? <Spinner className="w-4 h-4" /> : <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="Xóa" className="w-5 h-5 object-contain" />}
                                                                    </button>
                                                                    <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                                                        Xóa rate
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'orders' && (
                    <div className="space-y-5 bg-transparent border-0 shadow-none p-3 md:p-5">


                        <div className="rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 md:p-5">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                <div>
                                    <h4 className="mt-2 text-xl font-bold">Danh sách đơn</h4>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        Bộ lọc đang bật: <span className="font-semibold text-foreground">{activeOrderFilterCount}</span> • Preset hiện tại: <span className="font-semibold text-foreground">{orderPresetLabel}</span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            navigateToOrderPreset('all');
                                            setOrderSearchQuery('');
                                            setOrderStatusFilter('all');
                                            setOrderPaymentFilter('all');
                                            setOrderShippingFilter('all');
                                            setOrderDateFrom('');
                                            setOrderDateTo('');
                                        }}
                                        className="text-sm font-semibold text-primary hover:underline"
                                    >
                                        Xóa bộ lọc
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleExportOrders(filteredOrders)}
                                        disabled={isExportingOrders}
                                        className="inline-flex items-center justify-center rounded-full bg-secondary px-4 py-2 text-sm font-bold text-secondary-foreground transition-colors hover:bg-secondary/90 disabled:opacity-50"
                                    >
                                        {isExportingOrders ? <Spinner className="w-4 h-4" /> : t('admin.order_export_filtered')}
                                    </button>
                                </div>
                            </div>

                            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
                                <div className="xl:col-span-2">
                                    <input
                                        type="text"
                                        value={orderSearchQuery}
                                        onChange={(e) => setOrderSearchQuery(e.target.value)}
                                        placeholder="Mã đơn / tên khách / SĐT / mã vận đơn"
                                        className="w-full rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <select value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value as OrderStatusFilter)} className="w-full rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all">
                                        <option value="all">Tất cả</option>
                                        <option value="pending">{t('admin.order_status_pending')}</option>
                                        <option value="processing">{t('admin.order_status_processing')}</option>
                                        <option value="shipped">{t('admin.order_status_shipped')}</option>
                                        <option value="completed">{t('admin.order_status_completed')}</option>
                                        <option value="cancelled">{t('admin.order_status_cancelled')}</option>
                                    </select>
                                </div>
                                <div>
                                    <select value={orderPaymentFilter} onChange={(e) => setOrderPaymentFilter(e.target.value as OrderPaymentFilter)} className="w-full rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all">
                                        <option value="all">Tất cả</option>
                                        <option value="unpaid">{t('admin.payment_status_unpaid')}</option>
                                        <option value="paid">{t('admin.payment_status_paid')}</option>
                                        <option value="failed">{t('admin.payment_status_failed')}</option>
                                        <option value="refunded">{t('admin.payment_status_refunded')}</option>
                                    </select>
                                </div>
                                <div>
                                    <select value={orderShippingFilter} onChange={(e) => setOrderShippingFilter(e.target.value as OrderShippingFilter)} className="w-full rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all">
                                        <option value="all">Tất cả</option>
                                        <option value="ghtk">GHTK</option>
                                        <option value="manual">Nhà vận chuyển khác</option>
                                        <option value="none">Chưa có</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="relative">
                                        <input 
                                            type={orderDateFrom ? "date" : "text"} 
                                            value={orderDateFrom} 
                                            onChange={(e) => setOrderDateFrom(e.target.value)} 
                                            onFocus={(e) => e.target.type = 'date'}
                                            onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
                                            placeholder="Từ ngày"
                                            className="w-full rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all" 
                                        />
                                    </div>
                                    <div className="relative">
                                        <input 
                                            type={orderDateTo ? "date" : "text"} 
                                            value={orderDateTo} 
                                            onChange={(e) => setOrderDateTo(e.target.value)} 
                                            onFocus={(e) => e.target.type = 'date'}
                                            onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
                                            placeholder="Đến ngày"
                                            className="w-full rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all" 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {(() => {
                            const totalOrders = filteredOrders.length;
                            const totalOrderPages = Math.max(1, Math.ceil(totalOrders / ITEMS_PER_PAGE));
                            const currentOrders = filteredOrders.slice(
                                (ordersCurrentPage - 1) * ITEMS_PER_PAGE,
                                ordersCurrentPage * ITEMS_PER_PAGE
                            );
                            const currentOrderIds = currentOrders.map(order => order.id);
                            const selectedOrders = productOrders.filter(order => selectedOrderIds.includes(order.id));
                            const allCurrentPageSelected = currentOrderIds.length > 0 && currentOrderIds.every(id => selectedOrderIds.includes(id));

                            return (
                                <>
                                    <div className="overflow-hidden rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10">
                                        <div className="px-5 py-4">
                                            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between rounded-xl p-3">
                                                <div>
                                                    <span className="font-semibold px-3 py-2 rounded-2xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] text-foreground text-sm">
                                                        Đã chọn {selectedOrderIds.length} đơn
                                                    </span>
                                                </div>
                                                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                                                    <button type="button" onClick={() => toggleSelectOrders(currentOrderIds, true)} className="inline-flex h-11 items-center justify-center rounded-2xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-4 py-2 text-sm font-semibold transition-all hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50">Chọn trang hiện tại</button>
                                                    <button type="button" onClick={() => setSelectedOrderIds([])} className="inline-flex h-11 items-center justify-center rounded-2xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-4 py-2 text-sm font-semibold transition-all hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50">Bỏ chọn tất cả</button>
                                                    <select value={bulkOrderStatus} onChange={(e) => setBulkOrderStatus(e.target.value as OrderFulfillmentStatus)} className="h-11 rounded-2xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-4 py-2 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none pr-10 cursor-pointer" style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}>
                                                        <option value="pending">{t('admin.order_status_pending')}</option>
                                                        <option value="processing">{t('admin.order_status_processing')}</option>
                                                        <option value="shipped">{t('admin.order_status_shipped')}</option>
                                                        <option value="completed">{t('admin.order_status_completed')}</option>
                                                        <option value="cancelled">{t('admin.order_status_cancelled')}</option>
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleBulkUpdateOrderStatus(selectedOrders)}
                                                        disabled={isApplyingOrderBulkStatus || selectedOrderIds.length === 0}
                                                        className="inline-flex h-11 items-center justify-center rounded-2xl border border-primary/50 bg-primary/80 backdrop-blur-xl px-5 py-2 text-sm font-bold text-black shadow-md transition-all hover:-translate-y-0.5 hover:bg-primary hover:shadow-lg disabled:translate-y-0 disabled:bg-muted disabled:opacity-50 disabled:shadow-none"
                                                    >
                                                        {isApplyingOrderBulkStatus ? <Spinner className="w-4 h-4" /> : 'Cập nhật hàng loạt'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <AdminMobileList className="p-3">
                                            {currentOrders.length === 0 ? (
                                                <AdminMobileCard>
                                                    <p className="text-base font-bold text-foreground">Không có đơn hàng phù hợp bộ lọc.</p>
                                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Thử đổi preset, trạng thái hoặc khoảng ngày để xem lại đơn.</p>
                                                </AdminMobileCard>
                                            ) : currentOrders.map(order => {
                                                const fulfillmentStatus = getOrderFulfillmentStatus(order);
                                                const paymentStatus = getOrderPaymentStatus(order);
                                                const shippingType = getShippingType(order);
                                                const isSelected = selectedOrderIds.includes(order.id);

                                                return (
                                                    <AdminMobileCard
                                                        key={order.id}
                                                        className={isSelected ? 'border-primary/35 bg-primary/[0.04]' : undefined}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => toggleOrderSelection(order.id)}
                                                                className="mt-1 h-4 w-4 shrink-0 rounded border-input"
                                                                aria-label={`Chọn đơn ${order.order_code || order.id}`}
                                                            />
                                                            <div className="min-w-0 flex-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onNavigate({ page: 'adminPharmacyManagement', section: 'orders', action: 'order-detail', orderId: String(order.id) })}
                                                                    className="break-all font-mono text-base font-black text-primary hover:underline"
                                                                >
                                                                    {order.order_code}
                                                                </button>
                                                                <p className="mt-1 text-sm font-semibold text-foreground">{order.customer_name}</p>
                                                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                                                    {formatOrderRecordedAt(order.created_at)} • {getOrderItemCount(order)} SP
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                                            <StatusChip label={getFulfillmentStatusLabel(fulfillmentStatus, t)} tone={getFulfillmentTone(fulfillmentStatus)} />
                                                        </div>
                                                        <div className="mt-4 grid grid-cols-2 gap-2">
                                                            <AdminMobileMeta label="Tổng tiền" value={formatCurrency(getOrderGrandTotal(order))} />
                                                            <AdminMobileMeta label="Thanh toán" value={getPaymentMethodLabel(getOrderPaymentMethod(order), t)} />
                                                            <AdminMobileMeta label="SĐT" value={order.customer_phone || 'Chưa có'} />
                                                            <AdminMobileMeta label="Mã vận đơn" value={order.shipping_code || 'Chưa có'} />
                                                            <AdminMobileMeta
                                                                label="Địa chỉ"
                                                                value={[order.shipping_ward, order.shipping_district, order.shipping_province].filter(Boolean).join(', ') || 'Chưa có'}
                                                                className="col-span-2"
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => onNavigate({ page: 'adminPharmacyManagement', section: 'orders', action: 'order-detail', orderId: String(order.id) })}
                                                            className="mt-4 w-full rounded-xl bg-primary px-3 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
                                                        >
                                                            Mở chi tiết đơn
                                                        </button>
                                                    </AdminMobileCard>
                                                );
                                            })}
                                        </AdminMobileList>
                                        <div className="hidden overflow-x-auto lg:block">
                                            <table className="w-full min-w-[1100px] text-sm text-left">
                                                <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                    <tr>
                                                        <th className="w-12 px-3 py-3 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={allCurrentPageSelected}
                                                                onChange={(e) => toggleSelectOrders(currentOrderIds, e.target.checked)}
                                                                className="h-4 w-4 rounded border-input"
                                                                aria-label="Chọn tất cả đơn trang hiện tại"
                                                            />
                                                        </th>
                                                        <th className="px-4 py-3">Đơn hàng</th>
                                                        <th className="px-4 py-3">Sản phẩm</th>
                                                        <th className="px-4 py-3">Khách hàng</th>
                                                        <th className="px-4 py-3">Giá trị</th>
                                                        <th className="px-4 py-3">Trạng thái & Giao hàng</th>
                                                        <th className="px-4 py-3 text-right">Thao tác</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {currentOrders.length === 0 && (
                                                        <tr>
                                                            <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                                                                Không có đơn hàng phù hợp bộ lọc.
                                                            </td>
                                                        </tr>
                                                    )}
                                                    {currentOrders.map((order, index) => (
                                                        <OrderRow
                                                            key={order.id}
                                                            order={order}
                                                            rowIndex={index}
                                                            onUpdate={handleUpdateOrderInState}
                                                            isSelected={selectedOrderIds.includes(order.id)}
                                                            onToggleSelect={toggleOrderSelection}
                                                            onViewDetails={(order) => onNavigate({ page: 'adminPharmacyManagement', section: 'orders', action: 'order-detail', orderId: String(order.id) })}
                                                        />
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <Pagination
                                        currentPage={ordersCurrentPage}
                                        totalPages={totalOrderPages}
                                        onPageChange={setOrdersCurrentPage}
                                    />
                                </>
                            );
                        })()}
                    </div>
                )}

                {activeTab === 'ghtk_settings' && (
                    <div className="space-y-8 bg-transparent border-0 shadow-none p-3 md:p-5">
                        <div className="rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 md:p-6">
                            <h3 className="text-xl font-bold">Cài đặt Giao Hàng Tiết Kiệm</h3>

                            <div className="mt-6 space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Trạng thái API Token</label>
                                    {ghtkConnectionStatus === 'ready' && (
                                        <p className="mt-1 text-green-600 font-semibold">Đã cấu hình và kết nối GHTK thành công.</p>
                                    )}
                                    {ghtkConnectionStatus === 'missing_token' && (
                                        <p className="mt-1 text-amber-600 font-semibold">Chưa bật kết nối GHTK trên Cloudflare Worker.</p>
                                    )}
                                    {ghtkConnectionStatus === 'error' && (
                                        <p className="mt-1 text-red-600 font-semibold">Không thể kết nối GHTK. Vui lòng kiểm tra lại cấu hình máy chủ.</p>
                                    )}
                                    {ghtkConnectionStatus === 'unknown' && (
                                        <p className="mt-1 text-muted-foreground font-semibold">Chưa kiểm tra. Nhấn &quot;Tải lại danh sách&quot; để kiểm tra kết nối.</p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Webhook URL</label>
                                    <p className="text-xs text-muted-foreground mb-1">Sao chép URL này và dán vào tài khoản GHTK để nhận cập nhật trạng thái đơn hàng tự động.</p>
                                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md border">
                                        <input type="text" readOnly value={ghtkWebhookSampleUrl} className="bg-transparent w-full text-sm font-mono" />
                                        <button onClick={() => navigator.clipboard.writeText(ghtkWebhookSampleUrl)} className="bg-secondary text-secondary-foreground text-xs font-bold py-1 px-3 rounded-md">Sao chép</button>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">Token xác thực webhook được quản lý bằng Cloudflare Secret và không xuất hiện trên giao diện.</p>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 md:p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold">Địa chỉ lấy hàng GHTK</h3>
                                <button onClick={handleFetchPickAddresses} disabled={isLoadingAddresses} className="bg-secondary text-secondary-foreground text-sm font-bold py-2 px-4 rounded-lg hover:bg-secondary/90 transition-colors btn-press disabled:opacity-50 flex items-center gap-2">
                                    {isLoadingAddresses ? <Spinner className="w-5 h-5" /> : 'Tải lại danh sách'}
                                </button>
                            </div>
                            {isLoadingAddresses ? (
                                <div className="flex justify-center p-8"><Spinner /></div>
                            ) : pickAddresses.length > 0 ? (
                                <div className="grid md:grid-cols-2 gap-4">
                                    {pickAddresses.map(addr => (
                                        <div key={addr.pick_address_id} className={`p-4 rounded-lg border ${addr.is_default ? 'border-primary bg-primary/5' : 'bg-muted/50'}`}>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-bold">{addr.pick_name} {addr.is_default ? <span className="text-xs text-primary font-semibold">(Mặc định)</span> : ''}</p>
                                                    <p className="text-sm text-muted-foreground">{addr.pick_address}</p>
                                                    <p className="text-sm text-muted-foreground">SĐT: {addr.pick_tel}</p>
                                                </div>
                                                <button onClick={() => handleViewAddressDetail(addr)} className="text-sm font-semibold text-primary hover:underline flex-shrink-0 ml-2">
                                                    Xem chi tiết
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted-foreground text-center py-4">Chưa có dữ liệu. Nhấn nút để tải danh sách địa chỉ đã đăng ký với GHTK.</p>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'brands' && (
                    <div className="space-y-6 bg-transparent border-0 shadow-none p-3 md:p-5">


                        {(isBrandFormVisible || editingBrandId) ? (
                            <div className="w-full rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 md:p-6">
                                <div className="mb-4 flex items-center justify-between">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsBrandFormVisible(false);
                                            handleCancelEditBrand();
                                        }}
                                        className="flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                                        Quay lại danh sách
                                    </button>
                                </div>
                                <div className="w-full">
                                <div className="flex items-center justify-between gap-3 mb-5">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.2em] text-primary font-bold">
                                            {editingBrandId ? 'Edit Mode' : 'Create Mode'}
                                        </p>
                                        <h3 className="text-2xl font-black mt-1">
                                            {editingBrandId ? 'Cập nhật thương hiệu' : 'Tạo thương hiệu mới'}
                                        </h3>
                                    </div>
                                    {editingBrandId && (
                                        <button
                                            type="button"
                                            onClick={handleCancelEditBrand}
                                            className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full border border-border"
                                        >
                                            Hủy sửa
                                        </button>
                                    )}
                                </div>

                                <div className="rounded-2xl flex min-h-[250px] flex-col items-center justify-center rounded-[1.45rem] border border-dashed p-6 text-center transition-all border-primary/25 bg-gradient-to-br from-primary/[0.07] via-card/70 to-sky-100/50 dark:to-slate-900/50 mb-5">
                                    <div className="aspect-[4/3] rounded-[1.4rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 overflow-hidden flex items-center justify-center">
                                        {editingBrandId ? (
                                            editBrandPreviewUrl ? (
                                                <img src={editBrandPreviewUrl} alt="Preview logo thương hiệu" className="w-full h-full object-contain p-6" />
                                            ) : editingBrand?.logo_url ? (
                                                <img src={editingBrand.logo_url} alt={editingBrand.name} className="w-full h-full object-contain p-6" />
                                            ) : (
                                                <div className="text-center px-4">
                                                    <p className="text-sm font-semibold text-muted-foreground">Chưa có logo</p>
                                                    <p className="text-xs text-muted-foreground mt-1">Tải logo để card thương hiệu nhìn chuyên nghiệp hơn</p>
                                                </div>
                                            )
                                        ) : newBrandPreviewUrl ? (
                                            <img src={newBrandPreviewUrl} alt="Preview logo mới" className="w-full h-full object-contain p-6" />
                                        ) : (
                                            <div className="text-center px-4">
                                                <p className="text-sm font-semibold text-muted-foreground">Preview logo</p>
                                                <p className="text-xs text-muted-foreground mt-1">Logo sẽ hiển thị ở đây trước khi lưu</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                        <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-1 font-semibold">
                                            {editingBrandId ? 'Đang chỉnh sửa' : 'Brand mới'}
                                        </span>
                                        <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2.5 py-1 font-semibold">
                                            {editingBrandId
                                                ? (editBrandImage ? `Logo mới: ${editBrandImage.name}` : 'Đang dùng logo hiện tại')
                                                : (newBrandImage ? `Đã chọn: ${newBrandImage.name}` : 'Chưa chọn logo')}
                                        </span>
                                    </div>
                                </div>

                                <form
                                    onSubmit={(e) => {
                                        if (editingBrandId) {
                                            e.preventDefault();
                                            void handleSaveEditBrand();
                                        } else {
                                            void handleAddNewBrand(e);
                                        }
                                    }}
                                    className="space-y-4"
                                >
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Tên thương hiệu <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            value={editingBrandId ? editBrandName : newBrandName}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                if (editingBrandId) {
                                                    setEditBrandName(value);
                                                } else {
                                                    setNewBrandName(value);
                                                    setNewBrandSlug(generateSlug(value));
                                                }
                                            }}
                                            className="w-full admin-glass-input"
                                            placeholder="Ví dụ: La Roche-Posay"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Slug <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            value={editingBrandId ? editBrandSlug : newBrandSlug}
                                            onChange={(e) => editingBrandId ? setEditBrandSlug(e.target.value) : setNewBrandSlug(e.target.value)}
                                            className="w-full admin-glass-input font-mono text-sm"
                                            placeholder="la-roche-posay"
                                            required
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">Slug sạch giúp route và SEO ổn định.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Mô tả chi tiết thương hiệu</label>
                                        <textarea
                                            value={editingBrandId ? editBrandDescription : newBrandDescription}
                                            onChange={(e) => editingBrandId ? setEditBrandDescription(e.target.value) : setNewBrandDescription(e.target.value)}
                                            className="w-full admin-glass-input min-h-[170px]"
                                            placeholder={'Viết 2-3 đoạn mô tả để dùng cho trang /thuong-hieu/<slug>, SEO và nội dung giới thiệu thương hiệu.'}
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">Có thể xuống dòng để tách nhiều đoạn. Nội dung này hiển thị ở landing page của thương hiệu.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Logo thương hiệu</label>
                                        <ImageDropzone
                                            onFilesSelected={(files) => {
                                                const nextFile = files[0] || null;
                                                if (editingBrandId) {
                                                    setEditBrandImage(nextFile);
                                                    return;
                                                }
                                                setNewBrandImage(nextFile);
                                            }}
                                            className="h-32"
                                            label={editingBrandId ? 'Kéo logo mới vào đây hoặc' : 'Kéo logo thương hiệu vào đây hoặc'}
                                            helpText="PNG, JPG, WEBP. Logo sẽ được nén và chuyển WebP tự động khi lưu."
                                            selectedFileLabel={
                                                editingBrandId
                                                    ? (editBrandImage ? `Đã chọn: ${editBrandImage.name}` : null)
                                                    : (newBrandImage ? `Đã chọn: ${newBrandImage.name}` : null)
                                            }
                                        />
                                        {(editingBrandId ? editBrandImage : newBrandImage) && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (editingBrandId) {
                                                        setEditBrandImage(null);
                                                        return;
                                                    }
                                                    setNewBrandImage(null);
                                                }}
                                                className="mt-3 inline-flex items-center rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
                                            >
                                                Bỏ ảnh đã chọn
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        {editingBrandId && (
                                            <button
                                                type="button"
                                                onClick={handleCancelEditBrand}
                                                className="flex-1 border border-border text-foreground font-bold py-3 rounded-xl hover:bg-muted transition-colors btn-press"
                                            >
                                                Hủy
                                            </button>
                                        )}
                                        <button
                                            type="submit"
                                            disabled={
                                                editingBrandId
                                                    ? (isSavingEditBrand || !editBrandName || !editBrandSlug)
                                                    : (isSavingBrand || !newBrandName || !newBrandSlug)
                                            }
                                            className="flex-1 bg-primary text-primary-foreground font-bold py-3 rounded-xl hover:bg-primary/90 transition-colors btn-press disabled:bg-muted flex justify-center items-center"
                                        >
                                            {editingBrandId
                                                ? (isSavingEditBrand ? <Spinner className="w-5 h-5" /> : 'Lưu thương hiệu')
                                                : (isSavingBrand ? <Spinner className="w-5 h-5" /> : 'Tạo thương hiệu')}
                                        </button>
                                    </div>
                                </form>
                            </div>
                            </div>
                        ) : (
                            <div className="space-y-4 rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 md:p-6">
                                <div className="bg-transparent rounded-2xl p-4">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <h3 className="text-xl font-bold">Kho thương hiệu</h3>
                                            <p className="text-sm text-muted-foreground mt-0.5">
                                                Quản lý logo và thông tin thương hiệu
                                            </p>
                                        </div>
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                                            <div className="w-full sm:w-64">
                                                <input
                                                    type="text"
                                                    value={brandSearchQuery}
                                                    onChange={(e) => setBrandSearchQuery(e.target.value)}
                                                    placeholder="Tìm thương hiệu..."
                                                    className="w-full admin-glass-input"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setNewBrandName('');
                                                    setNewBrandSlug('');
                                                    setNewBrandDescription('');
                                                    setNewBrandImage(null);
                                                    setIsBrandFormVisible(true);
                                                }}
                                                className="flex h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm btn-press"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                                Thêm
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {filteredBrands.length === 0 ? (
                                    <div className="rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-6 md:p-12 text-center">
                                        <p className="text-lg font-semibold">Không tìm thấy thương hiệu phù hợp</p>
                                        <p className="text-sm text-muted-foreground mt-2">Thử đổi từ khóa tìm kiếm hoặc tạo thương hiệu mới ở panel bên trái.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                                        {filteredBrands.map((brand) => {
                                            const isEditingThisBrand = editingBrandId === brand.id;
                                            return (
                                                <div
                                                    key={brand.id}
                                                    className={`rounded-2xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] transition-all flex flex-col sm:flex-row p-3 gap-4 items-start sm:items-center ${isEditingThisBrand ? 'border-0 ring-2 ring-primary/50 bg-primary/20 backdrop-blur-xl' : 'border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 hover:-translate-y-0.5 hover:bg-card/40'}`}
                                                >
                                                    {/* Logo */}
                                                    <div className="w-20 h-20 shrink-0 rounded-[1.1rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 overflow-hidden flex items-center justify-center p-2">
                                                        {brand.logo_url ? (
                                                            <img src={brand.logo_url} alt={brand.name} className="w-full h-full object-contain" />
                                                        ) : (
                                                            <div className="text-center">
                                                                <p className="text-[10px] font-bold text-muted-foreground uppercase">No Logo</p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-base font-black truncate">{brand.name}</h4>
                                                            {isEditingThisBrand && (
                                                                <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                                                                    Đang sửa
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="font-mono text-xs text-muted-foreground truncate mt-0.5">{brand.slug}</p>
                                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                                            <span className="inline-flex items-center rounded-md bg-secondary text-secondary-foreground px-2 py-0.5 text-[10px] font-semibold">
                                                                {brand.productCount} SP
                                                            </span>
                                                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${brand.logo_url ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                {brand.logo_url ? 'Có logo' : 'Thiếu logo'}
                                                            </span>
                                                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${brand.descriptionSnippet ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                                                {brand.descriptionSnippet ? 'Có mô tả' : 'Thiếu mô tả'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex sm:flex-col gap-1.5 shrink-0 w-full sm:w-auto mt-2 sm:mt-0 items-center justify-end">
                                                        <div className="relative group inline-flex">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleStartEditBrand(brand)}
                                                                className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-foreground hover:bg-card/40 hover:text-primary transition-all hover:scale-110 active:scale-95"
                                                                aria-label={`Sửa thương hiệu: ${brand.name}`}
                                                            >
                                                                <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="Sửa" className="w-5 h-5 object-contain" />
                                                            </button>
                                                            <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                                                Sửa
                                                            </span>
                                                        </div>
                                                        <div className="relative group inline-flex">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteBrandConfirm(brand)}
                                                                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-red-200 text-destructive hover:bg-red-50 dark:hover:bg-red-950/30 transition-all hover:scale-110 active:scale-95"
                                                                aria-label={`Xóa thương hiệu: ${brand.name}`}
                                                            >
                                                                <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="Xóa" className="w-4 h-4 object-contain" />
                                                            </button>
                                                            <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                                                Xóa
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </>
        );
    };

    if (view === 'edit-product') {
        const editorSidebarItems = [
            {
                key: 'products',
                label: 'Danh sách sản phẩm',
                hint: 'Quay lại bảng SKU và quick edit.',
                icon: <ShoppingBagIcon className="h-5 w-5" />,
                active: true,
                onClick: closeProductEditor,
            },
            {
                key: 'categories',
                label: 'Chuyên mục',
                hint: 'Chỉnh taxonomy và featured categories.',
                icon: <DocumentDuplicateIcon className="h-5 w-5" />,
                onClick: () => onNavigate({ page: 'adminPharmacyManagement', section: 'categories' }),
            },
            {
                key: 'brands',
                label: 'Thương hiệu',
                hint: 'Quản lý logo, mô tả và landing page.',
                icon: <WrenchScrewdriverIcon className="h-5 w-5" />,
                onClick: () => onNavigate({ page: 'adminPharmacyManagement', section: 'brands' }),
            },
            {
                key: 'discounts',
                label: 'Khuyến mãi',
                hint: 'Mã giảm giá và luật áp dụng checkout.',
                icon: <PlusCircleIcon className="h-5 w-5" />,
                onClick: () => onNavigate({ page: 'adminPharmacyManagement', section: 'discounts' }),
            },
            {
                key: 'taxes',
                label: 'Thuế & VAT',
                hint: 'Tax profile, rate override và shipping tax.',
                icon: <CogIcon className="h-5 w-5" />,
                onClick: () => onNavigate({ page: 'adminPharmacyManagement', section: 'taxes' }),
            },
        ];

        return (
            <>
                <AnimatedSection stagger={80}>
                    <ProductEditorForm
                        product={selectedProduct}
                        categories={categories}
                        brands={brands}
                        onSave={handleSaveProductForm}
                        onCancel={closeProductEditor}
                        onCreateNewProduct={handleAddNewProduct}
                        previousProduct={previousProduct}
                        nextProduct={nextProduct}
                        onSelectPreviousProduct={previousProduct ? () => openProductEditor(previousProduct) : undefined}
                        onSelectNextProduct={nextProduct ? () => openProductEditor(nextProduct) : undefined}
                        productPositionLabel={productPositionLabel}
                    />
                </AnimatedSection>
            </>
        );
    }

    if (selectedOrderDetail) {
        return (
            <>
                <AnimatedSection stagger={100}>
                    <div className="overflow-hidden rounded-[2rem] bg-transparent shadow-[0_36px_90px_-48px_rgba(15,20,16,0.78)]">
                        {(() => {
                            const detailFulfillmentStatus = getOrderFulfillmentStatus(selectedOrderDetail);
                            const detailPaymentStatus = getOrderPaymentStatus(selectedOrderDetail);
                            const detailPaymentMethod = getOrderPaymentMethod(selectedOrderDetail);
                            const detailShippingType = getShippingType(selectedOrderDetail);
                            const subtotal = selectedOrderDetail.subtotal_price || (selectedOrderDetail.order_items || []).reduce((sum, item) => sum + (Number(item.price_at_purchase || 0) * Number(item.quantity || 0)), 0);
                            const discount = selectedOrderDetail.discount_amount || 0;
                            const shipping = selectedOrderDetail.shipping_fee || 0;
                            const taxAmount = Number(selectedOrderDetail.tax_amount || 0) + Number(selectedOrderDetail.shipping_tax_amount || 0);
                            const total = Number(selectedOrderDetail.grand_total || selectedOrderDetail.total_price || 0);
                            const detailItemCount = getOrderItemCount(selectedOrderDetail);

                            return (
                                <>
                                    <div className="border-b border-border bg-gradient-to-r from-primary/[0.10] via-card to-card px-6 py-5 md:px-8">
                                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Order detail</p>
                                                <h3 className="mt-2 text-2xl font-bold md:text-3xl">Chi tiết đơn hàng {selectedOrderDetail.order_code}</h3>
                                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                                    Tạo lúc {new Date(selectedOrderDetail.created_at).toLocaleString('vi-VN')}. Dùng panel này để kiểm tra timeline, payment, refund và tình trạng vận chuyển mà không phải quay lại bảng đơn.
                                                </p>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="flex flex-wrap gap-2">
                                                    <StatusChip label={getFulfillmentStatusLabel(detailFulfillmentStatus, t)} tone={getFulfillmentTone(detailFulfillmentStatus)} />
                                                    <StatusChip label={getPaymentStatusLabel(detailPaymentStatus, t)} tone={getPaymentTone(detailPaymentStatus)} />
                                                    <StatusChip label={getShippingTypeLabel(detailShippingType)} tone={getShippingTypeTone(detailShippingType)} />
                                                </div>
                                                <button onClick={() => onNavigate({ page: 'adminPharmacyManagement', section: 'orders' })} className="rounded-full border border-border bg-background p-2 text-muted-foreground transition-colors hover:border-primary/35 hover:text-primary">
                                                    <CloseIcon className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                            <div className="flex gap-3 rounded-[1.2rem] bg-transparent shadow-md px-4 py-3">
                                                <div className="mt-0.5 flex-shrink-0 rounded-full bg-primary/10 p-2 text-primary h-fit">
                                                    <UserIcon className="h-5 w-5" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Khách hàng</p>
                                                    <p className="mt-1.5 truncate text-base font-bold">{selectedOrderDetail.customer_name}</p>
                                                    <p className="mt-0.5 truncate text-sm text-muted-foreground">{selectedOrderDetail.customer_phone}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3 rounded-[1.2rem] bg-transparent shadow-md px-4 py-3">
                                                <div className="mt-0.5 flex-shrink-0 rounded-full bg-emerald-50 p-2 text-emerald-600 h-fit">
                                                    <ReceiptIcon className="h-5 w-5" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Tổng thanh toán</p>
                                                    <p className="mt-1.5 truncate text-base font-bold">{formatCurrency(total)}</p>
                                                    <p className="mt-0.5 truncate text-sm text-muted-foreground">{detailItemCount} sản phẩm</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3 rounded-[1.2rem] bg-transparent shadow-md px-4 py-3">
                                                <div className="mt-0.5 flex-shrink-0 rounded-full bg-amber-50 p-2 text-amber-600 h-fit">
                                                    <CheckCircleIcon className="h-5 w-5" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Thanh toán</p>
                                                    <p className="mt-1.5 truncate text-base font-bold">{getPaymentMethodLabel(detailPaymentMethod, t)}</p>
                                                    <p className="mt-0.5 truncate text-sm text-muted-foreground">{getPaymentStatusLabel(detailPaymentStatus, t)}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3 rounded-[1.2rem] bg-transparent shadow-md px-4 py-3">
                                                <div className="mt-0.5 flex-shrink-0 rounded-full bg-sky-50 p-2 text-sky-600 h-fit">
                                                    <TruckIcon className="h-5 w-5" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Vận chuyển</p>
                                                    <p className="mt-1.5 truncate text-base font-bold">{selectedOrderDetail.shipping_provider || 'N/A'}</p>
                                                    <p className="mt-0.5 truncate text-sm text-muted-foreground">{selectedOrderDetail.shipping_code || 'Chưa có mã vận đơn'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="px-6 py-6 md:px-8">
                                        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_360px] 2xl:grid-cols-[minmax(0,1.24fr)_390px]">
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                                    <div className="rounded-[1.5rem] border border-border bg-muted/20 p-5">
                                                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Thông tin khách hàng</p>
                                                        <div className="mt-4 space-y-2 text-sm leading-6">
                                                            <p><span className="text-muted-foreground">Tên:</span> <span className="font-semibold">{selectedOrderDetail.customer_name}</span></p>
                                                            <p><span className="text-muted-foreground">SĐT:</span> {selectedOrderDetail.customer_phone}</p>
                                                            <p><span className="text-muted-foreground">{t('admin.payment_method')}:</span> {getPaymentMethodLabel(detailPaymentMethod, t)}</p>
                                                            <p><span className="text-muted-foreground">Vận chuyển:</span> {selectedOrderDetail.shipping_provider || 'N/A'}</p>
                                                            {selectedOrderDetail.shipping_code && <p><span className="text-muted-foreground">Mã vận đơn:</span> {selectedOrderDetail.shipping_code}</p>}
                                                        </div>
                                                    </div>

                                                    <div className="rounded-[1.5rem] border border-border bg-muted/20 p-5">
                                                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Địa chỉ giao hàng</p>
                                                        <div className="mt-4 space-y-2 text-sm leading-6">
                                                            <p>{selectedOrderDetail.shipping_street}</p>
                                                            <p>{selectedOrderDetail.shipping_ward}, {selectedOrderDetail.shipping_district}</p>
                                                            <p>{selectedOrderDetail.shipping_province}</p>
                                                            {selectedOrderDetail.notes ? (
                                                                <div className="mt-3 rounded-xl border border-border bg-background px-3 py-3">
                                                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Ghi chú đơn hàng</p>
                                                                    <p className="mt-2 text-sm text-foreground">{selectedOrderDetail.notes}</p>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                                                    <div className="rounded-[1.5rem] border border-border bg-muted/20 p-5">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <h4 className="font-bold">{t('admin.order_status_history')}</h4>
                                                            <StatusChip label={`${orderStatusHistory.length}`} tone="border-border bg-background text-muted-foreground" />
                                                        </div>
                                                        {isLoadingOrderLifecycle ? (
                                                            <div className="flex justify-center py-8"><Spinner /></div>
                                                        ) : orderStatusHistory.length === 0 ? (
                                                            <p className="mt-4 text-sm text-muted-foreground">Chưa có dữ liệu.</p>
                                                        ) : (
                                                            <div className="mt-4 space-y-3">
                                                                {orderStatusHistory.map(history => (
                                                                    <div key={history.id} className="rounded-xl border border-border bg-background px-3 py-3 text-sm">
                                                                        <p className="font-semibold">
                                                                            {history.from_status
                                                                                ? `${getFulfillmentStatusLabel(history.from_status, t)} → ${getFulfillmentStatusLabel(history.to_status, t)}`
                                                                                : `Khởi tạo → ${getFulfillmentStatusLabel(history.to_status, t)}`}
                                                                        </p>
                                                                        <p className="mt-1 text-xs text-muted-foreground">{new Date(history.created_at).toLocaleString('vi-VN')}</p>
                                                                        {history.note && <p className="mt-1 text-xs text-muted-foreground">{history.note}</p>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="rounded-[1.5rem] border border-border bg-muted/20 p-5">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <h4 className="font-bold">{t('admin.order_payment_logs')}</h4>
                                                            <StatusChip label={`${orderPaymentLogs.length}`} tone="border-border bg-background text-muted-foreground" />
                                                        </div>
                                                        {isLoadingOrderLifecycle ? (
                                                            <div className="flex justify-center py-8"><Spinner /></div>
                                                        ) : orderPaymentLogs.length === 0 ? (
                                                            <p className="mt-4 text-sm text-muted-foreground">Chưa có dữ liệu.</p>
                                                        ) : (
                                                            <div className="mt-4 space-y-3">
                                                                {orderPaymentLogs.map(payment => (
                                                                    <div key={payment.id} className="rounded-xl border border-border bg-background px-3 py-3 text-sm">
                                                                        <p className="font-semibold">{getPaymentStatusLabel(payment.status, t)} - {formatCurrency(payment.amount)}</p>
                                                                        <p className="mt-1 text-xs text-muted-foreground">{getPaymentMethodLabel(payment.method, t)}</p>
                                                                        <p className="mt-1 text-xs text-muted-foreground">{new Date(payment.created_at).toLocaleString('vi-VN')}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="rounded-[1.5rem] border border-border bg-muted/20 p-5">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <h4 className="font-bold">{t('admin.order_refund_logs')}</h4>
                                                            <StatusChip label={`${orderRefundLogs.length}`} tone="border-border bg-background text-muted-foreground" />
                                                        </div>
                                                        {isLoadingOrderLifecycle ? (
                                                            <div className="flex justify-center py-8"><Spinner /></div>
                                                        ) : orderRefundLogs.length === 0 ? (
                                                            <p className="mt-4 text-sm text-muted-foreground">{t('admin.order_refund_none')}</p>
                                                        ) : (
                                                            <div className="mt-4 space-y-3">
                                                                {orderRefundLogs.map(refund => (
                                                                    <div key={refund.id} className="rounded-xl border border-border bg-background px-3 py-3 text-sm">
                                                                        <p className="font-semibold">{formatCurrency(refund.amount)}</p>
                                                                        <p className="mt-1 text-xs text-muted-foreground">{refund.reason || 'Không có lý do'}</p>
                                                                        <p className="mt-1 text-xs text-muted-foreground">Restock: {refund.restocked ? 'Có' : 'Không'} • {new Date(refund.created_at).toLocaleString('vi-VN')}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="overflow-hidden rounded-[1.5rem] border border-border bg-card">
                                                    <div className="border-b border-border px-5 py-4">
                                                        <h4 className="font-bold">Sản phẩm trong đơn ({selectedOrderDetail.order_items?.length || 0})</h4>
                                                    </div>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-sm text-left">
                                                            <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                                <tr>
                                                                    <th className="px-4 py-3">Sản phẩm</th>
                                                                    <th className="px-4 py-3 text-right">Số lượng</th>
                                                                    <th className="px-4 py-3 text-right">Đơn giá</th>
                                                                    <th className="px-4 py-3 text-right">Thành tiền</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {(selectedOrderDetail.order_items || []).length === 0 && (
                                                                    <tr>
                                                                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Không có dữ liệu sản phẩm.</td>
                                                                    </tr>
                                                                )}
                                                                {(selectedOrderDetail.order_items || []).map(item => {
                                                                    const lineTotal = Number(item.price_at_purchase || 0) * Number(item.quantity || 0);
                                                                    const imageUrl = item.product?.main_image_url || item.product?.images?.[0]?.image_url || '';
                                                                    return (
                                                                        <tr key={item.id} className="border-b border-border last:border-0">
                                                                            <td className="px-4 py-3">
                                                                                <div className="flex min-w-[220px] items-center gap-3">
                                                                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted text-[10px] font-bold text-muted-foreground">
                                                                                        {imageUrl ? (
                                                                                            <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                                                                                        ) : (
                                                                                            <span>SP</span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="min-w-0">
                                                                                        <p className="font-semibold">{getOrderItemDisplayName(item)}</p>
                                                                                        <p className="mt-1 text-xs text-muted-foreground">ID sản phẩm: {item.product_id}</p>
                                                                                    </div>
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-4 py-3 text-right">{item.quantity}</td>
                                                                            <td className="px-4 py-3 text-right">{formatCurrency(Number(item.price_at_purchase || 0))}</td>
                                                                            <td className="px-4 py-3 text-right font-semibold">{formatCurrency(lineTotal)}</td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-6 xl:sticky xl:top-6">
                                                <div className="rounded-[1.5rem] border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-[0_20px_40px_-32px_rgba(28,24,18,0.35)]">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Tổng quan thanh toán</p>
                                                    <div className="mt-4 space-y-3 text-sm">
                                                        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Tạm tính</span><span className="font-semibold">{formatCurrency(subtotal)}</span></div>
                                                        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Giảm giá {selectedOrderDetail.discount_code ? `(${selectedOrderDetail.discount_code})` : ''}</span><span className="font-semibold">- {formatCurrency(discount)}</span></div>
                                                        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Thuế</span><span className="font-semibold">{formatCurrency(taxAmount)}</span></div>
                                                        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Phí vận chuyển</span><span className="font-semibold">{formatCurrency(shipping)}</span></div>
                                                        <div className="border-t border-border pt-3 flex justify-between gap-4 text-base font-bold"><span>Tổng thanh toán</span><span>{formatCurrency(total)}</span></div>
                                                    </div>
                                                </div>

                                                <div className="rounded-[1.5rem] border border-border bg-muted/20 p-5">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('admin.order_refund_create')}</p>
                                                    <div className="mt-4 space-y-3">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="1000"
                                                            value={refundAmount}
                                                            onChange={(e) => setRefundAmount(e.target.value)}
                                                            className="w-full admin-glass-input"
                                                            placeholder={t('admin.order_refund_amount')}
                                                        />
                                                        <textarea
                                                            value={refundReason}
                                                            onChange={(e) => setRefundReason(e.target.value)}
                                                            className="min-h-24 w-full admin-glass-input"
                                                            placeholder={t('admin.order_refund_reason')}
                                                        />
                                                        <label className="flex items-center gap-2 text-sm">
                                                            <input
                                                                type="checkbox"
                                                                checked={refundRestock}
                                                                onChange={(e) => setRefundRestock(e.target.checked)}
                                                                className="h-4 w-4 rounded border-input"
                                                            />
                                                            {t('admin.order_refund_restock')}
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={() => void handleCreateRefund()}
                                                            disabled={isSubmittingRefund || detailPaymentStatus !== 'paid'}
                                                            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:bg-muted"
                                                        >
                                                            {isSubmittingRefund ? <Spinner className="w-4 h-4" /> : t('admin.order_refund_create_button')}
                                                        </button>
                                                        {detailPaymentStatus !== 'paid' && (
                                                            <p className="text-xs text-muted-foreground">{t('admin.order_refund_paid_only')}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </AnimatedSection>
            </>
        );
    }

    return (
        <>
            <AnimatedSection stagger={100} threshold={0}>
                {renderContent()}
            </AnimatedSection>

            {selectedAddressDetail && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedAddressDetail(null)}>
                    <div className="bg-card rounded-lg shadow-xl w-full max-w-lg m-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 border-b border-border">
                            <h3 className="text-lg font-bold">Chi tiết địa chỉ lấy hàng</h3>
                            <button onClick={() => setSelectedAddressDetail(null)} className="p-1 rounded-full hover:bg-accent"><CloseIcon className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6">
                            {isLoadingAddressDetail ? <div className="flex justify-center p-8"><Spinner /></div> : (
                                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                                    <dt className="text-sm font-medium text-muted-foreground">Tên điểm lấy</dt>
                                    <dd className="sm:col-span-1 font-semibold">{selectedAddressDetail.pick_name}</dd>

                                    <dt className="text-sm font-medium text-muted-foreground">Địa chỉ</dt>
                                    <dd className="sm:col-span-1">{selectedAddressDetail.pick_address}</dd>

                                    <dt className="text-sm font-medium text-muted-foreground">Phường/Xã</dt>
                                    <dd className="sm:col-span-1">{selectedAddressDetail.pick_ward}</dd>

                                    <dt className="text-sm font-medium text-muted-foreground">Quận/Huyện</dt>
                                    <dd className="sm:col-span-1">{selectedAddressDetail.pick_district}</dd>

                                    <dt className="text-sm font-medium text-muted-foreground">Tỉnh/Thành</dt>
                                    <dd className="sm:col-span-1">{selectedAddressDetail.pick_province}</dd>

                                    <dt className="text-sm font-medium text-muted-foreground">Điện thoại</dt>
                                    <dd className="sm:col-span-1">{selectedAddressDetail.pick_tel}</dd>

                                    <dt className="text-sm font-medium text-muted-foreground">Email</dt>
                                    <dd className="sm:col-span-1">{selectedAddressDetail.pick_email || 'N/A'}</dd>

                                    <dt className="text-sm font-medium text-muted-foreground">Mặc định</dt>
                                    <dd className="sm:col-span-1">{selectedAddressDetail.is_default ? 'Có' : 'Không'}</dd>
                                </dl>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AdminPharmacyManagementPage;
