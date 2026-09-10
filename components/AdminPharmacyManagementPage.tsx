import { AdminDesktopOnly } from './admin/AdminResponsive';
import React, { useState, useEffect, useMemo, useDeferredValue, useRef, lazy } from 'react';
import { createPortal } from 'react-dom';
import { printProductOrder, getOrderChannelLabel } from '../src/orderReceipt';
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
import {
    AdminPageHeader,
    AdminSectionTabs,
    AdminButton,
    AdminProductListPage,
    AdminProductCategoryList,
    AdminProductBrandList,
    AdminProductDiscountList,
    AdminProductTaxSettings,
    AdminGhtkSettings,
} from './admin';

const AdminOrderCreatePage = lazy(() => import('./AdminOrderCreatePage'));
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
type OrderChannelFilter = 'all' | 'online' | 'pos';
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
    if (status === 'processing') return 'border-amber-300/80 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300';
    if (status === 'shipped') return 'border-sky-300/80 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-950/40 dark:text-sky-300';
    if (status === 'completed') return 'border-emerald-300/80 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300';
    if (status === 'cancelled') return 'border-rose-300/80 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300';
    return 'border-border/70 bg-background/60 text-muted-foreground dark:border-border/40 dark:bg-muted/20 dark:text-muted-foreground';
};

const getPaymentTone = (status: OrderPaymentStatus): string => {
    if (status === 'paid') return 'border-emerald-300/80 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300';
    if (status === 'failed') return 'border-rose-300/80 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300';
    if (status === 'refunded') return 'border-orange-300/80 bg-orange-50 text-orange-800 dark:border-orange-500/30 dark:bg-orange-950/40 dark:text-orange-300';
    return 'border-border/70 bg-background/60 text-muted-foreground dark:border-border/40 dark:bg-muted/20 dark:text-muted-foreground';
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
            <td className="px-4 py-4 align-top w-[130px]">
                <div className="relative inline-flex items-center">
                    <select 
                        value={status} 
                        onChange={e => setStatus(e.target.value as OrderFulfillmentStatus)} 
                        className={`appearance-none cursor-pointer rounded-full border pl-2.5 pr-6 py-1 text-[11px] font-bold tracking-tight shadow-2xs outline-none transition-all hover:scale-105 active:scale-95 focus:ring-2 focus:ring-primary/20 ${getFulfillmentTone(status)}`}
                    >
                        {allowedStatusTargets.includes('pending') && <option value="pending" className="bg-card text-foreground">{t('admin.order_status_pending')}</option>}
                        {allowedStatusTargets.includes('processing') && <option value="processing" className="bg-card text-foreground">{t('admin.order_status_processing')}</option>}
                        {allowedStatusTargets.includes('shipped') && <option value="shipped" className="bg-card text-foreground">{t('admin.order_status_shipped')}</option>}
                        {allowedStatusTargets.includes('completed') && <option value="completed" className="bg-card text-foreground">{t('admin.order_status_completed')}</option>}
                        {allowedStatusTargets.includes('cancelled') && <option value="cancelled" className="bg-card text-foreground">{t('admin.order_status_cancelled')}</option>}
                    </select>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="pointer-events-none absolute right-2 h-3 w-3 opacity-60">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
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
    const [openMobileMenuOrderId, setOpenMobileMenuOrderId] = useState<string | null>(null);
    const [showMobileOrderFilters, setShowMobileOrderFilters] = useState<boolean>(false);
    const [showProductFilters, setShowProductFilters] = useState<boolean>(false);
    const [showProductActionsMenu, setShowProductActionsMenu] = useState<boolean>(false);
    const [orderDetailTab, setOrderDetailTab] = useState<'status' | 'payments' | 'refunds'>('status');
    const [showRefundForm, setShowRefundForm] = useState<boolean>(false);
    const [orderChannelFilter, setOrderChannelFilter] = useState<OrderChannelFilter>('all');
    const [isUpdatingOrderStatus, setIsUpdatingOrderStatus] = useState<boolean>(false);

    useEffect(() => {
        if (!openMobileMenuProductId && !openMobileMenuOrderId && !showProductActionsMenu) return;
        const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target?.closest('[data-mobile-action-menu]')) {
                setOpenMobileMenuProductId(null);
                setOpenMobileMenuOrderId(null);
            }
            if (!target?.closest('[data-product-actions-menu]')) {
                setShowProductActionsMenu(false);
            }
        };
        document.addEventListener('click', handleOutsideClick);
        document.addEventListener('touchstart', handleOutsideClick);
        return () => {
            document.removeEventListener('click', handleOutsideClick);
            document.removeEventListener('touchstart', handleOutsideClick);
        };
    }, [openMobileMenuProductId, openMobileMenuOrderId, showProductActionsMenu]);

    const [isImporting, setIsImporting] = useState(false);
    const productFileInputRef = useRef<HTMLInputElement>(null);
    const categoryFileInputRef = useRef<HTMLInputElement>(null);

    const [productsCurrentPage, setProductsCurrentPage] = useState(1);
    const [productContentReviewsById, setProductContentReviewsById] = useState<Record<number, ProductContentReviewRecord>>({});
    const [isLoadingProductContentReviews, setIsLoadingProductContentReviews] = useState(false);
    const [ordersCurrentPage, setOrdersCurrentPage] = useState(1);
    const [orderSearchQuery, setOrderSearchQuery] = useState('');
    const deferredOrderSearchQuery = useDeferredValue(orderSearchQuery);
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
    const [categorySearchQuery, setCategorySearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'featured'>('all');
    const [showCategoryActionsMenu, setShowCategoryActionsMenu] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategorySlug, setNewCategorySlug] = useState('');
    const [newCategoryIsFeatured, setNewCategoryIsFeatured] = useState(false);
    const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
    const [editCategoryName, setEditCategoryName] = useState('');
    const [editCategorySlug, setEditCategorySlug] = useState('');
    const [editCategoryIsFeatured, setEditCategoryIsFeatured] = useState(false);
    const [isCategoryFormVisible, setIsCategoryFormVisible] = useState(false);

    // State for brand management
    const [brandFilter, setBrandFilter] = useState<'all' | 'has_logo' | 'no_logo'>('all');
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

    // State for discount search and filter
    const [discountSearchQuery, setDiscountSearchQuery] = useState('');
    const [discountFilter, setDiscountFilter] = useState<'all' | 'active' | 'inactive' | 'percentage' | 'fixed_amount'>('all');
    const [isDiscountFormVisible, setIsDiscountFormVisible] = useState(false);

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

    const handleOpenOrderDetail = (order: ProductOrder) => {
        setSelectedOrderDetail(order);
        onNavigate({ page: 'adminPharmacyManagement', section: 'orders', action: 'order-detail', orderId: String(order.id) });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handlePrintOrder = (order: ProductOrder, format: 'a4' | 'receipt80') => {
        printProductOrder(order, format);
    };

    const handleUpdateOrderStatus = async (orderId: string, nextStatus: OrderFulfillmentStatus) => {
        setIsUpdatingOrderStatus(true);
        try {
            const updated = await api.transitionOrderStatus(orderId, nextStatus, 'Admin cập nhật trạng thái đơn');
            handleUpdateOrderInState(orderId, updated);
            const logs = await api.getOrderLifecycleLogs(orderId);
            setOrderStatusHistory(logs.statusHistory);
            addToast('Cập nhật trạng thái thành công', { type: 'success' });
        } catch (error: any) {
            addToast('Không thể cập nhật trạng thái', { type: 'error', description: error.message });
        } finally {
            setIsUpdatingOrderStatus(false);
        }
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
        setEditCategoryIsFeatured(Boolean(cat.is_featured));
        setIsCategoryFormVisible(true);
    };

    const handleSaveEditCategory = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (editingCategoryId && editCategoryName && editCategorySlug) {
            const originalCat = categories.find(c => c.id === editingCategoryId);
            onSaveCategory({
                ...originalCat,
                id: editingCategoryId,
                name: editCategoryName,
                slug: editCategorySlug,
                is_featured: editCategoryIsFeatured,
            });
            setEditingCategoryId(null);
            setIsCategoryFormVisible(false);
        }
    };

    const handleCancelEditCategory = () => {
        setEditingCategoryId(null);
        setEditCategoryName('');
        setEditCategorySlug('');
        setEditCategoryIsFeatured(false);
        setIsCategoryFormVisible(false);
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

        if (deferredOrderSearchQuery.trim()) {
            const query = deferredOrderSearchQuery.trim().toLowerCase();
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

        if (orderChannelFilter !== 'all') {
            result = result.filter(order => (order.order_channel || 'online') === orderChannelFilter);
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
    }, [productOrders, orderOpsPreset, deferredOrderSearchQuery, orderStatusFilter, orderPaymentFilter, orderShippingFilter, orderDateFrom, orderDateTo]);

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
            orderChannelFilter !== 'all',
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
        setIsDiscountFormVisible(false);
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

    const inventoryCounts = useMemo<Record<InventoryFilter, number>>(() => {
        const counts: Record<InventoryFilter, number> = {
            all: products.length,
            in_stock: 0,
            low_stock: 0,
            out_of_stock: 0,
            hidden: 0,
            featured: 0,
            near_expiry: 0,
            no_sku: 0,
        };
        for (const p of products) {
            const flags = getProductFlags(p);
            if (!flags.isOutOfStock && !flags.isLowStock && !flags.isNearExpiry) counts.in_stock++;
            if (flags.isLowStock) counts.low_stock++;
            if (flags.isOutOfStock) counts.out_of_stock++;
            if (flags.isHidden) counts.hidden++;
            if (p.is_featured) counts.featured++;
            if (flags.isNearExpiry && !flags.isExpired) counts.near_expiry++;
            if (flags.hasNoSku) counts.no_sku++;
        }
        return counts;
    }, [products]);

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

    const filteredCategories = useMemo(() => {
        const query = categorySearchQuery.trim().toLowerCase();
        let list = categories;
        if (categoryFilter === 'featured') {
            list = list.filter((cat) => Boolean(cat.is_featured));
        }
        if (!query) return list;
        return list.filter((cat) =>
            (cat.name || '').toLowerCase().includes(query) ||
            (cat.slug || '').toLowerCase().includes(query)
        );
    }, [categories, categoryFilter, categorySearchQuery]);

    const filteredBrands = useMemo(() => {
        const query = brandSearchQuery.trim().toLowerCase();
        let rows = brands.map((brand) => {
            const metric = brandMetrics.get(normalizeBrandMatchKey(brand.name)) || { total: 0, published: 0 };
            return {
                ...brand,
                productCount: metric.total,
                publishedProductCount: metric.published,
                descriptionSnippet: getBrandDescriptionSnippet(brand.description, 170),
            };
        });

        if (brandFilter === 'has_logo') {
            rows = rows.filter((b) => Boolean(b.logo_url || b.logo_path));
        } else if (brandFilter === 'no_logo') {
            rows = rows.filter((b) => !b.logo_url && !b.logo_path);
        }

        if (!query) {
            return rows;
        }

        return rows.filter((brand) =>
            brand.name.toLowerCase().includes(query) ||
            brand.slug.toLowerCase().includes(query) ||
            String(brand.description || '').toLowerCase().includes(query)
        );
    }, [brands, brandMetrics, brandSearchQuery, brandFilter]);

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
        setSelectedProductIds([]);
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
        setSelectedOrderIds([]);
    }, [orderSearchQuery, orderOpsPreset, orderStatusFilter, orderPaymentFilter, orderShippingFilter, orderDateFrom, orderDateTo]);

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

    const filteredDiscountCodes = useMemo(() => {
        const query = discountSearchQuery.trim().toLowerCase();
        let list = discountCodes;
        if (discountFilter === 'active') list = list.filter((d) => d.is_active);
        else if (discountFilter === 'inactive') list = list.filter((d) => !d.is_active);
        else if (discountFilter === 'percentage') list = list.filter((d) => d.type === 'percentage');
        else if (discountFilter === 'fixed_amount') list = list.filter((d) => d.type === 'fixed_amount');

        if (!query) return list;
        return list.filter((d) =>
            (d.code || '').toLowerCase().includes(query) ||
            (d.description || '').toLowerCase().includes(query)
        );
    }, [discountCodes, discountFilter, discountSearchQuery]);

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
                <div className="space-y-3 sm:space-y-4 -mx-3 sm:mx-0">
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
                        onSyncPancake={selectedProduct?.id ? () => handleSyncProductToPancake(selectedProduct) : undefined}
                    />
                </div>
            );
        }

        if (activeTab !== 'orders') {
            const productTabs = [
                { key: 'products', label: 'Sản phẩm', count: products.length },
                { key: 'categories', label: 'Chuyên mục', count: categories.length },
                { key: 'brands', label: 'Thương hiệu', count: brands.length },
                { key: 'discounts', label: 'Mã giảm giá', count: discountCodes.length },
                { key: 'taxes', label: 'Thuế bán hàng' },
                { key: 'ghtk_settings', label: 'Giao hàng GHTK' },
            ];

            const getHeaderMeta = () => {
                switch (activeTab) {
                    case 'categories':
                        return {
                            title: 'Chuyên mục',
                            subtitle: 'Phân loại sản phẩm và thiết lập hiển thị nổi bật trên trang chủ',
                            action: (
                                <AdminButton
                                    variant="primary"
                                    onClick={() => {
                                        setEditingCategoryId(null);
                                        setIsCategoryFormVisible(true);
                                    }}
                                    leftIcon={<PlusCircleIcon className="h-4 w-4" />}
                                >
                                    Thêm chuyên mục
                                </AdminButton>
                            ),
                        };
                    case 'brands':
                        return {
                            title: 'Thương hiệu',
                            subtitle: 'Quản lý thương hiệu đối tác, logo và mô tả giới thiệu',
                            action: (
                                <AdminButton
                                    variant="primary"
                                    onClick={() => {
                                        setEditingBrandId(null);
                                        setIsBrandFormVisible(true);
                                    }}
                                    leftIcon={<PlusCircleIcon className="h-4 w-4" />}
                                >
                                    Thêm thương hiệu
                                </AdminButton>
                            ),
                        };
                    case 'discounts':
                        return {
                            title: 'Mã giảm giá',
                            subtitle: 'Cấu hình voucher giảm giá phần trăm hoặc số tiền cố định',
                            action: (
                                <AdminButton
                                    variant="primary"
                                    onClick={() => {
                                        resetDiscountForm();
                                        setIsDiscountFormVisible(true);
                                    }}
                                    leftIcon={<PlusCircleIcon className="h-4 w-4" />}
                                >
                                    Tạo mã voucher
                                </AdminButton>
                            ),
                        };
                    case 'taxes':
                        return {
                            title: 'Thuế bán hàng',
                            subtitle: 'Hồ sơ thuế suất VAT mặc định và các chính sách ghi đè theo địa phương',
                            action: null,
                        };
                    case 'ghtk_settings':
                        return {
                            title: 'Giao Hàng Tiết Kiệm',
                            subtitle: 'Trạng thái kết nối webhook và cấu hình kho lấy hàng GHTK',
                            action: null,
                        };
                    case 'products':
                    default:
                        return {
                            title: 'Sản phẩm',
                            subtitle: 'Quản lý danh mục dược mỹ phẩm, tồn kho và bảng giá bán',
                            action: (
                                <div className="flex items-center gap-2">
                                    <AdminButton
                                        variant="primary"
                                        onClick={handleAddNewProduct}
                                        leftIcon={<PlusCircleIcon className="h-4 w-4" />}
                                    >
                                        Thêm sản phẩm mới
                                    </AdminButton>
                                </div>
                            ),
                        };
                }
            };

            const headerMeta = getHeaderMeta();

            return (
                <div className="space-y-4">
                    <AdminPageHeader
                        title={headerMeta.title}
                        subtitle={headerMeta.subtitle}
                        actions={headerMeta.action}
                    />

                    <AdminSectionTabs
                        items={productTabs}
                        activeKey={activeTab}
                        onChange={(tabKey) => {
                            setActiveTab(tabKey as ActiveTab);
                            onNavigate({ page: 'adminPharmacyManagement', section: tabKey as AdminPharmacySection });
                        }}
                    />

                    {activeTab === 'products' && (
                        <AdminProductListPage
                            products={products}
                            categories={categories}
                            brands={brands}
                            categoryNameById={categoryNameById}
                            inventoryCounts={inventoryCounts}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            inventoryFilter={inventoryFilter}
                            navigateToProductFilter={navigateToProductFilter}
                            selectedCategoryId={selectedCategoryId}
                            setSelectedCategoryId={setSelectedCategoryId}
                            selectedBrand={selectedBrand}
                            setSelectedBrand={setSelectedBrand}
                            productSortColumn={productSortColumn}
                            productSortDirection={productSortDirection}
                            setProductSortColumn={setProductSortColumn}
                            setProductSortDirection={setProductSortDirection}
                            currentProducts={currentProducts}
                            filteredProducts={filteredProducts}
                            productsCurrentPage={productsCurrentPage}
                            totalProductPages={totalProductPages}
                            setProductsCurrentPage={setProductsCurrentPage}
                            selectedProductIds={selectedProductIds}
                            toggleProductSelection={toggleProductSelection}
                            toggleSelectProducts={toggleSelectProducts}
                            setSelectedProductIds={setSelectedProductIds}
                            bulkAction={bulkAction}
                            setBulkAction={setBulkAction}
                            bulkCategoryId={bulkCategoryId}
                            setBulkCategoryId={setBulkCategoryId}
                            bulkBrandName={bulkBrandName}
                            setBulkBrandName={setBulkBrandName}
                            bulkNumericValue={bulkNumericValue}
                            setBulkNumericValue={setBulkNumericValue}
                            handleApplyBulkAction={handleApplyBulkAction}
                            isApplyingBulkAction={isApplyingBulkAction}
                            handleAddNewProduct={handleAddNewProduct}
                            handleEditProduct={handleEditProduct}
                            onDeleteProduct={onDeleteProduct}
                            handleSyncProductToPancake={handleSyncProductToPancake}
                            handleSyncProductsToPancake={handleSyncProductsToPancake}
                            isSyncingPancakeProducts={isSyncingPancakeProducts}
                            syncingPancakeProductId={syncingPancakeProductId}
                            handleExportProducts={handleExportProducts}
                            productFileInputRef={productFileInputRef}
                            handleImportFile={handleImportFile}
                            isImporting={isImporting}
                            handleDownloadProductTemplate={handleDownloadProductTemplate}
                            getInventoryStatusInfo={getInventoryStatusInfo}
                            getEffectiveContentReviewForProduct={getEffectiveContentReviewForProduct}
                            getQuickDraft={getQuickDraft}
                            isQuickDraftDirty={isQuickDraftDirty}
                            updateQuickDraftField={updateQuickDraftField}
                            handleSaveQuickDraft={handleSaveQuickDraft}
                            resetQuickDraft={resetQuickDraft}
                            savingQuickProductId={savingQuickProductId}
                            editingPriceId={editingPriceId}
                            setEditingPriceId={setEditingPriceId}
                            onSaveProduct={handleSaveProductForm}
                        />
                    )}

                    {activeTab === 'categories' && (
                        <AdminProductCategoryList
                            categories={categories}
                            filteredCategories={filteredCategories}
                            categorySearchQuery={categorySearchQuery}
                            setCategorySearchQuery={setCategorySearchQuery}
                            categoryFilter={categoryFilter}
                            setCategoryFilter={setCategoryFilter}
                            isCategoryFormVisible={isCategoryFormVisible}
                            setIsCategoryFormVisible={setIsCategoryFormVisible}
                            editingCategoryId={editingCategoryId}
                            setEditingCategoryId={setEditingCategoryId}
                            newCategoryName={newCategoryName}
                            setNewCategoryName={setNewCategoryName}
                            newCategorySlug={newCategorySlug}
                            setNewCategorySlug={setNewCategorySlug}
                            newCategoryIsFeatured={newCategoryIsFeatured}
                            setNewCategoryIsFeatured={setNewCategoryIsFeatured}
                            editCategoryName={editCategoryName}
                            setEditCategoryName={setEditCategoryName}
                            editCategorySlug={editCategorySlug}
                            setEditCategorySlug={setEditCategorySlug}
                            editCategoryIsFeatured={editCategoryIsFeatured}
                            setEditCategoryIsFeatured={setEditCategoryIsFeatured}
                            handleStartEditCategory={handleStartEditCategory}
                            handleCancelEditCategory={handleCancelEditCategory}
                            handleAddNewCategory={handleAddNewCategory}
                            handleSaveEditCategory={handleSaveEditCategory}
                            onSaveCategory={onSaveCategory}
                            onDeleteCategory={onDeleteCategory}
                            handleExportCategories={handleExportCategories}
                            handleImportFile={handleImportFile}
                            handleDownloadCategoryTemplate={handleDownloadCategoryTemplate}
                        />
                    )}

                    {activeTab === 'brands' && (
                        <AdminProductBrandList
                            brands={brands}
                            filteredBrands={filteredBrands}
                            brandSearchQuery={brandSearchQuery}
                            setBrandSearchQuery={setBrandSearchQuery}
                            isBrandFormVisible={isBrandFormVisible}
                            setIsBrandFormVisible={setIsBrandFormVisible}
                            editingBrandId={editingBrandId}
                            editingBrand={editingBrand}
                            isSavingBrand={isSavingBrand}
                            newBrandName={newBrandName}
                            setNewBrandName={setNewBrandName}
                            newBrandSlug={newBrandSlug}
                            setNewBrandSlug={setNewBrandSlug}
                            newBrandDescription={newBrandDescription}
                            setNewBrandDescription={setNewBrandDescription}
                            newBrandImage={newBrandImage}
                            setNewBrandImage={setNewBrandImage}
                            newBrandPreviewUrl={newBrandPreviewUrl}
                            editBrandName={editBrandName}
                            setEditBrandName={setEditBrandName}
                            editBrandSlug={editBrandSlug}
                            setEditBrandSlug={setEditBrandSlug}
                            editBrandDescription={editBrandDescription}
                            setEditBrandDescription={setEditBrandDescription}
                            editBrandImage={editBrandImage}
                            setEditBrandImage={setEditBrandImage}
                            editBrandPreviewUrl={editBrandPreviewUrl}
                            handleStartEditBrand={handleStartEditBrand}
                            handleCancelEditBrand={handleCancelEditBrand}
                            handleAddNewBrand={handleAddNewBrand}
                            handleSaveEditBrand={handleSaveEditBrand}
                            onDeleteBrand={(brandId) => {
                                const b = brands.find(x => x.id === brandId);
                                if (b) handleDeleteBrandConfirm(b);
                            }}
                        />
                    )}

                    {activeTab === 'discounts' && (
                        <AdminProductDiscountList
                            discountCodes={discountCodes}
                            filteredDiscountCodes={filteredDiscountCodes}
                            discountSummary={discountSummary}
                            discountSearchQuery={discountSearchQuery}
                            setDiscountSearchQuery={setDiscountSearchQuery}
                            discountFilter={discountFilter}
                            setDiscountFilter={setDiscountFilter}
                            isDiscountFormVisible={isDiscountFormVisible}
                            setIsDiscountFormVisible={setIsDiscountFormVisible}
                            editingDiscountId={editingDiscountId}
                            discountForm={discountForm}
                            setDiscountForm={setDiscountForm}
                            isSavingDiscountCode={isSavingDiscountCode}
                            isLoadingDiscountCodes={isLoadingDiscountCodes}
                            deletingDiscountId={deletingDiscountId}
                            handleStartEditDiscount={handleStartEditDiscount}
                            resetDiscountForm={resetDiscountForm}
                            handleSaveDiscountCode={handleSaveDiscountCode}
                            handleDeleteDiscountCode={handleDeleteDiscountCode}
                            loadDiscountCodes={loadDiscountCodes}
                        />
                    )}

                    {activeTab === 'taxes' && (
                        <AdminProductTaxSettings
                            taxProfiles={taxProfiles}
                            allTaxRates={allTaxRates}
                            taxSummary={taxSummary}
                            isLoadingTaxSettings={isLoadingTaxSettings}
                            isSavingTaxProfile={isSavingTaxProfile}
                            isSavingTaxRate={isSavingTaxRate}
                            editingTaxProfileId={editingTaxProfileId}
                            editingTaxRateId={editingTaxRateId}
                            deletingTaxProfileId={deletingTaxProfileId}
                            deletingTaxRateId={deletingTaxRateId}
                            taxProfileForm={taxProfileForm}
                            setTaxProfileForm={setTaxProfileForm}
                            taxRateForm={taxRateForm}
                            setTaxRateForm={setTaxRateForm}
                            loadTaxSettings={loadTaxSettings}
                            resetTaxProfileForm={resetTaxProfileForm}
                            resetTaxRateForm={resetTaxRateForm}
                            handleStartEditTaxProfile={handleStartEditTaxProfile}
                            handleStartEditTaxRate={handleStartEditTaxRate}
                            handleSaveTaxProfile={handleSaveTaxProfile}
                            handleSaveTaxRate={handleSaveTaxRate}
                            handleDeleteTaxProfile={handleDeleteTaxProfile}
                            handleDeleteTaxRate={handleDeleteTaxRate}
                        />
                    )}

                    {activeTab === 'ghtk_settings' && (
                        <AdminGhtkSettings
                            ghtkConnectionStatus={ghtkConnectionStatus}
                            pickAddresses={pickAddresses}
                            isLoadingAddresses={isLoadingAddresses}
                            ghtkWebhookSampleUrl={ghtkWebhookSampleUrl}
                            selectedAddressDetail={selectedAddressDetail}
                            isLoadingAddressDetail={isLoadingAddressDetail}
                            handleFetchPickAddresses={handleFetchPickAddresses}
                            handleViewAddressDetail={handleViewAddressDetail}
                            setSelectedAddressDetail={setSelectedAddressDetail}
                        />
                    )}
                </div>
            );
        }

        return (
            <div className="space-y-3 sm:space-y-4 bg-transparent border-0 shadow-none p-0 sm:p-2 md:p-5 -mx-3 sm:mx-0">
                {(() => {
                    const ORDER_PRESET_TABS: Array<{ key: AdminPharmacyOrderPreset; label: string }> = [
                        { key: 'all', label: 'Tất cả đơn' },
                        { key: 'priority_queue', label: 'Ưu tiên ngay' },
                        { key: 'shipping_handover', label: 'Thiếu vận đơn' },
                        { key: 'bank_transfer_followup', label: 'Bank tra' },
                        { key: 'refund_attention', label: 'Hoàn tiền' },
                        { key: 'today_watch', label: 'Trong ngày' },
                    ];

                    const orderPresetCounts: Record<string, number> = {
                        all: productOrders.length,
                        priority_queue: orderWorkspaceQueues.priorityQueue.length,
                        shipping_handover: orderWorkspaceQueues.shippingHandover.length,
                        bank_transfer_followup: orderWorkspaceQueues.bankTransferFollowup.length,
                        refund_attention: orderWorkspaceQueues.refundAttention.length,
                        today_watch: orderWorkspaceQueues.todayWatch.length,
                    };

                    const totalOrders = filteredOrders.length;
                    const totalOrderPages = Math.max(1, Math.ceil(totalOrders / ITEMS_PER_PAGE));
                    const currentOrders = filteredOrders.slice(
                        (ordersCurrentPage - 1) * ITEMS_PER_PAGE,
                        ordersCurrentPage * ITEMS_PER_PAGE
                    );
                    const currentOrderIds = currentOrders.map(order => order.id);
                    const selectedOrders = productOrders.filter(order => selectedOrderIds.includes(order.id));
                    const allCurrentPageSelected = currentOrderIds.length > 0 && currentOrderIds.every(id => selectedOrderIds.includes(id));
                    const activeMenuOrder = currentOrders.find(o => o.id === openMobileMenuOrderId);

                    return (
                        <div className="space-y-3 sm:space-y-5 bg-transparent border-0 shadow-none p-0 sm:p-2 md:p-5 -mx-3 sm:mx-0">
                            {/* Header & Filter Card */}
                            <div className="admin-surface rounded-2xl sm:rounded-[1.7rem] border p-3 sm:p-4 mx-1 sm:mx-0">
                                {/* Preset pills row */}
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                    {ORDER_PRESET_TABS.map((preset) => {
                                        const count = orderPresetCounts[preset.key] || 0;
                                        const isActive = orderOpsPreset === preset.key;
                                        return (
                                            <button
                                                key={preset.key}
                                                type="button"
                                                onClick={() => navigateToOrderPreset(preset.key)}
                                                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                                                    isActive
                                                        ? 'bg-primary text-primary-foreground shadow-xs'
                                                        : 'border border-border/60 bg-background/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                                                }`}
                                            >
                                                <span>{preset.label}</span>
                                                {count > 0 && (
                                                    <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                                                        isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'
                                                    }`}>
                                                        {count}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Search bar, Filter toggle & Icon-only Export button */}
                                <div className="mt-2 flex items-center gap-1.5 sm:gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            value={orderSearchQuery}
                                            onChange={(e) => setOrderSearchQuery(e.target.value)}
                                            placeholder="Mã đơn / tên khách / SĐT / mã vận đơn..."
                                            className="w-full h-9 rounded-xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] pl-8 pr-8 text-xs placeholder:text-muted-foreground/70 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                                        />
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                                        </svg>
                                        {orderSearchQuery && (
                                            <button
                                                type="button"
                                                onClick={() => setOrderSearchQuery('')}
                                                className="absolute right-2 top-2 p-0.5 rounded-full text-muted-foreground hover:text-foreground"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowMobileOrderFilters(!showMobileOrderFilters)}
                                        className={`flex items-center gap-1.5 h-9 px-3 rounded-xl border text-xs font-semibold transition-all shrink-0 ${
                                            showMobileOrderFilters || (activeOrderFilterCount > (orderOpsPreset !== 'all' ? 1 : 0))
                                                ? 'border-primary/50 bg-primary/10 text-primary font-bold shadow-xs'
                                                : 'border-border/60 bg-background/40 text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                        }`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-3.5 h-3.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                                        </svg>
                                        <span>Bộ lọc</span>
                                        {activeOrderFilterCount > 0 && (
                                            <span className="flex h-4 min-w-[1rem] px-1 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                                                {activeOrderFilterCount}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleExportOrders(filteredOrders)}
                                        disabled={isExportingOrders}
                                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/40 shadow-2xs backdrop-blur-md transition-all hover:bg-muted/50 active:scale-95 disabled:opacity-50 shrink-0"
                                        title="Xuất đơn Excel"
                                    >
                                        {isExportingOrders ? (
                                            <Spinner className="w-4 h-4 text-primary" />
                                        ) : (
                                            <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-outputexcel.webp" alt="Xuất đơn" className="w-4.5 h-4.5 object-contain" />
                                        )}
                                    </button>
                                </div>

                                {/* Collapsible / Desktop Grid Filters */}
                                <div className={`mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 transition-all ${
                                    showMobileOrderFilters ? 'grid' : 'hidden xl:grid'
                                }`}>
                                    {activeOrderFilterCount > 0 && (
                                        <div className="col-span-2 sm:col-span-2 lg:col-span-3 xl:col-span-5 flex items-center justify-between pb-1 border-b border-border/20">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                                {filteredOrders.length} đơn tìm thấy
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigateToOrderPreset('all');
                                                    setOrderSearchQuery('');
                                                    setOrderStatusFilter('all');
                                                    setOrderPaymentFilter('all');
                                                    setOrderShippingFilter('all');
                                                    setOrderChannelFilter('all');
                                                    setOrderDateFrom('');
                                                    setOrderDateTo('');
                                                }}
                                                className="text-[11px] font-semibold text-primary hover:underline"
                                            >
                                                Xóa bộ lọc ({activeOrderFilterCount})
                                            </button>
                                        </div>
                                    )}
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Trạng thái đơn</label>
                                        <select value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value as OrderStatusFilter)} className="w-full h-8 rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2.5 text-xs focus:ring-1 focus:ring-primary/50 outline-none transition-all">
                                            <option value="all">Tất cả trạng thái</option>
                                            <option value="pending">{t('admin.order_status_pending')}</option>
                                            <option value="processing">{t('admin.order_status_processing')}</option>
                                            <option value="shipped">{t('admin.order_status_shipped')}</option>
                                            <option value="completed">{t('admin.order_status_completed')}</option>
                                            <option value="cancelled">{t('admin.order_status_cancelled')}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Thanh toán</label>
                                        <select value={orderPaymentFilter} onChange={(e) => setOrderPaymentFilter(e.target.value as OrderPaymentFilter)} className="w-full h-8 rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2.5 text-xs focus:ring-1 focus:ring-primary/50 outline-none transition-all">
                                            <option value="all">Tất cả thanh toán</option>
                                            <option value="unpaid">{t('admin.payment_status_unpaid')}</option>
                                            <option value="paid">{t('admin.payment_status_paid')}</option>
                                            <option value="failed">{t('admin.payment_status_failed')}</option>
                                            <option value="refunded">{t('admin.payment_status_refunded')}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Vận chuyển</label>
                                        <select value={orderShippingFilter} onChange={(e) => setOrderShippingFilter(e.target.value as OrderShippingFilter)} className="w-full h-8 rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2.5 text-xs focus:ring-1 focus:ring-primary/50 outline-none transition-all">
                                            <option value="all">Tất cả vận chuyển</option>
                                            <option value="ghtk">GHTK</option>
                                            <option value="manual">Nhà vận chuyển khác</option>
                                            <option value="none">Chưa có vận chuyển</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Nguồn đơn</label>
                                        <select value={orderChannelFilter} onChange={(e) => setOrderChannelFilter(e.target.value as OrderChannelFilter)} className="w-full h-8 rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2.5 text-xs focus:ring-1 focus:ring-primary/50 outline-none transition-all" aria-label="Lọc nguồn đơn">
                                            <option value="all">Mọi nguồn</option>
                                            <option value="online">Online</option>
                                            <option value="pos">POS</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2 sm:col-span-2 lg:col-span-1">
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Khoảng ngày</label>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            <input 
                                                type={orderDateFrom ? "date" : "text"} 
                                                value={orderDateFrom} 
                                                onChange={(e) => setOrderDateFrom(e.target.value)} 
                                                onFocus={(e) => e.target.type = 'date'}
                                                onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
                                                placeholder="Từ ngày"
                                                className="w-full h-8 rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2 text-xs focus:ring-1 focus:ring-primary/50 outline-none transition-all" 
                                            />
                                            <input 
                                                type={orderDateTo ? "date" : "text"} 
                                                value={orderDateTo} 
                                                onChange={(e) => setOrderDateTo(e.target.value)} 
                                                onFocus={(e) => e.target.type = 'date'}
                                                onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
                                                placeholder="Đến ngày"
                                                className="w-full h-8 rounded-lg border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-2 text-xs focus:ring-1 focus:ring-primary/50 outline-none transition-all" 
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="admin-surface overflow-hidden rounded-2xl sm:rounded-[1.7rem] border mx-1 sm:mx-0">
                                {/* Slim Smart Selection Bar */}
                                <div className="border-b border-border/50 px-3 py-2.5 sm:px-5 sm:py-3 bg-muted/10 backdrop-blur-md">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <label className="flex items-center gap-2 cursor-pointer select-none text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground">
                                            <input
                                                type="checkbox"
                                                checked={allCurrentPageSelected}
                                                onChange={(e) => toggleSelectOrders(currentOrderIds, e.target.checked)}
                                                className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                                                aria-label="Chọn tất cả đơn trang hiện tại"
                                            />
                                            <span>
                                                {selectedOrderIds.length > 0 ? (
                                                    <span className="font-bold text-foreground">
                                                        Đã chọn <span className="text-primary">{selectedOrderIds.length}</span> đơn
                                                    </span>
                                                ) : (
                                                    `Chọn trang (${currentOrders.length} đơn)`
                                                )}
                                            </span>
                                        </label>

                                        <div className="flex items-center gap-1.5 sm:gap-2">
                                            {selectedOrderIds.length > 0 ? (
                                                <>
                                                    <select
                                                        value={bulkOrderStatus}
                                                        onChange={(e) => setBulkOrderStatus(e.target.value as OrderFulfillmentStatus)}
                                                        className="h-8 rounded-xl border border-border/70 bg-card/90 px-2 sm:px-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/50"
                                                    >
                                                        <option value="pending">{t('admin.order_status_pending')}</option>
                                                        <option value="processing">{t('admin.order_status_processing')}</option>
                                                        <option value="shipped">{t('admin.order_status_shipped')}</option>
                                                        <option value="completed">{t('admin.order_status_completed')}</option>
                                                        <option value="cancelled">{t('admin.order_status_cancelled')}</option>
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleBulkUpdateOrderStatus(selectedOrders)}
                                                        disabled={isApplyingOrderBulkStatus}
                                                        className="inline-flex h-8 items-center justify-center rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground shadow-xs transition-all hover:bg-primary/90 disabled:opacity-50"
                                                    >
                                                        {isApplyingOrderBulkStatus ? <Spinner className="w-3.5 h-3.5" /> : 'Cập nhật'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedOrderIds([])}
                                                        className="inline-flex h-8 items-center justify-center rounded-xl border border-border/70 bg-card/50 px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                                                    >
                                                        Bỏ chọn
                                                    </button>
                                                </>
                                            ) : (
                                                <span className="text-[11px] text-muted-foreground">
                                                    Trang {ordersCurrentPage} / {totalOrderPages}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <AdminMobileList className="p-0 divide-y divide-border/25">
                                    {currentOrders.length === 0 ? (
                                        <AdminMobileCard className="p-6 text-center">
                                            <p className="text-base font-bold text-foreground">Không có đơn hàng phù hợp bộ lọc.</p>
                                            <p className="mt-2 text-sm leading-6 text-muted-foreground">Thử đổi preset, trạng thái hoặc khoảng ngày để xem lại đơn.</p>
                                        </AdminMobileCard>
                                    ) : currentOrders.map((order) => {
                                        const fulfillmentStatus = getOrderFulfillmentStatus(order);
                                        const paymentStatus = getOrderPaymentStatus(order);
                                        const paymentMethod = getOrderPaymentMethod(order);
                                        const isSelected = selectedOrderIds.includes(order.id);
                                        const isMenuOpen = openMobileMenuOrderId === order.id;

                                        const itemCount = getOrderItemCount(order);
                                        const firstItem = order.order_items?.[0];
                                        const firstItemImage = firstItem?.product?.main_image_url 
                                            || firstItem?.product?.images?.[0]?.image_url 
                                            || firstItem?.resolved_product_image_path 
                                            || firstItem?.product_image_path;

                                        const addressParts = [order.shipping_ward, order.shipping_district, order.shipping_province].filter(Boolean);
                                        const shortAddress = addressParts.slice(0, 2).join(', ');

                                        return (
                                            <AdminMobileCard
                                                key={order.id}
                                                className={`relative transition-all px-3 py-2.5 sm:p-3.5 ${isSelected ? 'border-primary/35 bg-primary/[0.04]' : ''} ${isMenuOpen ? 'z-30' : 'z-0'}`}
                                            >
                                                {/* Main order row: Checkbox + Square Image + Info + 3-dots Action button */}
                                                <div className="flex items-start gap-2.5 sm:gap-3">
                                                    {/* Checkbox */}
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleOrderSelection(order.id)}
                                                        className="mt-1 h-4 w-4 shrink-0 rounded border-input text-primary focus:ring-primary"
                                                        aria-label={`Chọn đơn ${order.order_code || order.id}`}
                                                    />

                                                    {/* Square Product / Order Image */}
                                                    <div 
                                                        className="relative shrink-0 cursor-pointer"
                                                        onClick={() => handleOpenOrderDetail(order)}
                                                    >
                                                        {firstItemImage ? (
                                                            <img
                                                                src={firstItemImage}
                                                                alt={order.order_code || 'Đơn hàng'}
                                                                className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl sm:rounded-2xl border border-border/70 bg-card/60 backdrop-blur-xl object-cover shadow-xs"
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).src = 'https://thegioitrimun.vn/r2/assets/admin-icons/1786688261441-dongbocanva.webp';
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl sm:rounded-2xl border border-border/70 bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-xl flex flex-col items-center justify-center text-primary shadow-xs">
                                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                                                                </svg>
                                                            </div>
                                                        )}

                                                        {/* Corner badge: Item count badge */}
                                                        <span 
                                                            className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-[1.125rem] px-1 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-xs"
                                                            title={`${itemCount} sản phẩm`}
                                                        >
                                                            {itemCount}
                                                        </span>
                                                    </div>

                                                    {/* Order Details */}
                                                    <div className="min-w-0 flex-1">
                                                        {/* Customer Name, Order Code & 3-Dots Action Button */}
                                                        <div className="flex items-start justify-between gap-1.5">
                                                            <div 
                                                                className="min-w-0 flex-1 cursor-pointer"
                                                                onClick={() => handleOpenOrderDetail(order)}
                                                            >
                                                                <p className="line-clamp-1 text-xs sm:text-sm font-bold text-foreground leading-snug hover:text-primary transition-colors">
                                                                    <span className="font-mono text-primary font-black mr-1">{order.order_code || `#${order.id.slice(0, 6)}`}</span>
                                                                    <span>{order.customer_name || 'Khách vãng lai'}</span>
                                                                </p>
                                                            </div>

                                                            {/* 3-Dots Action Button with Clean Dropdown Menu (No dark blur background) */}
                                                            <div className="relative shrink-0" data-mobile-action-menu>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setOpenMobileMenuOrderId((prev) => (prev === order.id ? null : order.id));
                                                                    }}
                                                                    aria-label={`Thao tác cho đơn ${order.order_code || order.id}`}
                                                                    className={`flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-95 ${
                                                                        isMenuOpen
                                                                            ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                                                                            : 'border-border/70 bg-card/50 backdrop-blur-xl text-muted-foreground hover:bg-card/80 hover:text-foreground'
                                                                    }`}
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
                                                                    </svg>
                                                                </button>

                                                                {/* Popover Action Menu */}
                                                                {isMenuOpen && (
                                                                    <>
                                                                        {/* Transparent Backdrop Click Catcher - Completely Invisible, NO Blur, NO Darkening */}
                                                                        <div
                                                                            className="fixed inset-0 z-40 bg-transparent"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setOpenMobileMenuOrderId(null);
                                                                            }}
                                                                        />

                                                                        {/* Crisp Solid Popover (Matching Sidebar bg-card) */}
                                                                        <div
                                                                            className="absolute right-0 top-9 z-50 w-56 rounded-2xl border border-border/80 bg-card p-1.5 shadow-2xl transition-all animate-in fade-in zoom-in-95"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <div className="space-y-0.5">
                                                                                {/* 1. Mở chi tiết đơn */}
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setOpenMobileMenuOrderId(null);
                                                                                        handleOpenOrderDetail(order);
                                                                                    }}
                                                                                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                                                                                >
                                                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4 shrink-0 text-primary">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                                                                    </svg>
                                                                                    <span>Mở chi tiết đơn</span>
                                                                                </button>

                                                                                {/* 2. Gọi khách */}
                                                                                {order.customer_phone && (
                                                                                    <a
                                                                                        href={`tel:${order.customer_phone}`}
                                                                                        onClick={() => setOpenMobileMenuOrderId(null)}
                                                                                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 transition-colors hover:bg-emerald-500/10"
                                                                                    >
                                                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4 shrink-0">
                                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                                                                                        </svg>
                                                                                        <span className="truncate">Gọi khách ({order.customer_phone})</span>
                                                                                    </a>
                                                                                )}

                                                                                {/* 3. Sao chép mã đơn */}
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setOpenMobileMenuOrderId(null);
                                                                                        void navigator.clipboard.writeText(order.order_code || String(order.id));
                                                                                        addToast(`Đã chép mã đơn: ${order.order_code || order.id}`, { type: 'success' });
                                                                                    }}
                                                                                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                                                                                >
                                                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4 shrink-0 text-muted-foreground">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                                                                                    </svg>
                                                                                    <span>Sao chép mã đơn</span>
                                                                                </button>

                                                                                {/* 4. Sao chép mã vận đơn */}
                                                                                {order.shipping_code && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setOpenMobileMenuOrderId(null);
                                                                                            void navigator.clipboard.writeText(order.shipping_code || '');
                                                                                            addToast(`Đã chép mã vận đơn: ${order.shipping_code}`, { type: 'success' });
                                                                                        }}
                                                                                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-sky-600 dark:text-sky-400 transition-colors hover:bg-sky-500/10"
                                                                                    >
                                                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4 shrink-0">
                                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.25V3.75A1.125 1.125 0 0 0 13.125 2.625H4.125A1.125 1.125 0 0 0 3 3.75v10.5" />
                                                                                        </svg>
                                                                                        <span className="truncate">Sao chép mã vận đơn</span>
                                                                                    </button>
                                                                                )}

                                                                                <div className="my-1 border-t border-border/40" />

                                                                                {/* 5. In nhanh đơn hàng */}
                                                                                <div className="grid grid-cols-2 gap-1 px-1 py-0.5">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setOpenMobileMenuOrderId(null);
                                                                                            handlePrintOrder(order, 'a4');
                                                                                        }}
                                                                                        className="flex items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted active:scale-95 transition-all"
                                                                                    >
                                                                                        <PrinterIcon className="h-3.5 w-3.5" />
                                                                                        <span>In A4</span>
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setOpenMobileMenuOrderId(null);
                                                                                            handlePrintOrder(order, 'receipt80');
                                                                                        }}
                                                                                        className="flex items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted active:scale-95 transition-all"
                                                                                    >
                                                                                        <PrinterIcon className="h-3.5 w-3.5" />
                                                                                        <span>In 80mm</span>
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Subtitle: Date & Time • Phone • Short Address */}
                                                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                                            {formatOrderRecordedAt(order.created_at)} • {order.customer_phone || 'Chưa có SĐT'}{shortAddress ? ` • ${shortAddress}` : ''}
                                                        </p>

                                                        {/* Price & Payment Method */}
                                                        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-1">
                                                            <span className="text-xs sm:text-sm font-black text-primary">
                                                                {formatCurrency(getOrderGrandTotal(order))}
                                                            </span>
                                                            <span className="text-[11px] font-medium text-muted-foreground">
                                                                {getPaymentMethodLabel(paymentMethod, t)}: <strong className={paymentStatus === 'paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}>{getPaymentStatusLabel(paymentStatus, t)}</strong>
                                                            </span>
                                                        </div>

                                                        {/* Bottom meta badges: Status with Dot + Channel + Shipping Code */}
                                                        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 border-t border-border/25 pt-1.5">
                                                            <div className="flex flex-wrap items-center gap-1">
                                                                {/* Fulfillment Status Chip with colored dot */}
                                                                {fulfillmentStatus === 'completed' && (
                                                                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                                        {getFulfillmentStatusLabel('completed', t)}
                                                                    </span>
                                                                )}
                                                                {fulfillmentStatus === 'shipped' && (
                                                                    <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-400">
                                                                        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                                                                        {getFulfillmentStatusLabel('shipped', t)}
                                                                    </span>
                                                                )}
                                                                {fulfillmentStatus === 'processing' && (
                                                                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                                                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                                                        {getFulfillmentStatusLabel('processing', t)}
                                                                    </span>
                                                                )}
                                                                {fulfillmentStatus === 'cancelled' && (
                                                                    <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/25 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-400">
                                                                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                                                        {getFulfillmentStatusLabel('cancelled', t)}
                                                                    </span>
                                                                )}
                                                                {fulfillmentStatus === 'pending' && (
                                                                    <span className="inline-flex items-center gap-1 rounded-md border border-slate-500/25 bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                                                                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                                                        {getFulfillmentStatusLabel('pending', t)}
                                                                    </span>
                                                                )}

                                                                {/* Channel Badge */}
                                                                <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${(order.order_channel || 'online') === 'pos' ? 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-400' : 'border-sky-500/20 bg-sky-500/5 text-sky-600 dark:text-sky-400'}`}>
                                                                    {getOrderChannelLabel(order.order_channel)}
                                                                </span>
                                                            </div>

                                                            {/* Shipping Code / Order Code on the right */}
                                                            <span className="text-[10px] text-muted-foreground font-mono">
                                                                {order.shipping_code ? `MVD: ${order.shipping_code}` : `ID: #${order.id.slice(0, 6)}`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </AdminMobileCard>
                                        );
                                    })}
                                </AdminMobileList>

<AdminDesktopOnly className="hidden overflow-x-auto lg:block">
                                    <table className="w-full min-w-[1100px] text-sm text-left">
                                        <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                            <tr>
                                                <th className="w-12 px-3 py-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={allCurrentPageSelected}
                                                        onChange={(e) => toggleSelectOrders(currentOrderIds, e.target.checked)}
                                                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
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
                                                    onViewDetails={(order) => handleOpenOrderDetail(order)}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </AdminDesktopOnly>
                            </div>

                            <Pagination
                                currentPage={ordersCurrentPage}
                                totalPages={totalOrderPages}
                                onPageChange={setOrdersCurrentPage}
                            />
                        </div>
                    );
                })()}
            </div>
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
                    <div className="space-y-3 sm:space-y-4 -mx-3 sm:mx-0">
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
                            onSyncPancake={selectedProduct?.id ? () => handleSyncProductToPancake(selectedProduct) : undefined}
                        />
                    </div>
                </AnimatedSection>
            </>
        );
    }

    if (selectedOrderDetail) {
        return (
            <>
                <AnimatedSection stagger={100}>
                    <div className="space-y-3.5 sm:space-y-4 -mx-3 sm:mx-0 p-0 sm:p-2 md:p-5">
                        {(() => {
                            const detailFulfillmentStatus = getOrderFulfillmentStatus(selectedOrderDetail);
                            const detailPaymentStatus = getOrderPaymentStatus(selectedOrderDetail);
                            const detailPaymentMethod = getOrderPaymentMethod(selectedOrderDetail);
                            const subtotal = selectedOrderDetail.subtotal_price || (selectedOrderDetail.order_items || []).reduce((sum, item) => sum + (Number(item.price_at_purchase || 0) * Number(item.quantity || 0)), 0);
                            const discount = selectedOrderDetail.discount_amount || 0;
                            const shipping = selectedOrderDetail.shipping_fee || 0;
                            const taxAmount = Number(selectedOrderDetail.tax_amount || 0) + Number(selectedOrderDetail.shipping_tax_amount || 0);
                            const total = Number(selectedOrderDetail.grand_total || selectedOrderDetail.total_price || 0);
                            const detailItemCount = getOrderItemCount(selectedOrderDetail);
                            const fullAddress = [
                                selectedOrderDetail.shipping_street,
                                selectedOrderDetail.shipping_ward,
                                selectedOrderDetail.shipping_district,
                                selectedOrderDetail.shipping_province,
                            ].filter(Boolean).join(', ');

                            const handleCloseDetail = () => {
                                setSelectedOrderDetail(null);
                                onNavigate({ page: 'adminPharmacyManagement', section: 'orders' });
                            };

                            return (
                                <>
                                    {/* 1. Glass Header Banner */}
                                    <div className="admin-surface rounded-2xl sm:rounded-[1.75rem] border p-3.5 sm:p-5 mx-1 sm:mx-0">
                                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                            {/* Left: Navigation back button + Order Code + Metadata */}
                                            <div className="flex items-start gap-2.5 sm:gap-3">
                                                <button
                                                    type="button"
                                                    onClick={handleCloseDetail}
                                                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/50 text-muted-foreground hover:border-primary/50 hover:bg-card hover:text-primary transition-all active:scale-95"
                                                    aria-label="Quay lại danh sách đơn"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                                                    </svg>
                                                </button>
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="font-mono text-lg sm:text-2xl font-black text-primary tracking-tight">
                                                            {selectedOrderDetail.order_code || `#${selectedOrderDetail.id.slice(0, 8)}`}
                                                        </h3>
                                                        <StatusChip label={getFulfillmentStatusLabel(detailFulfillmentStatus, t)} tone={getFulfillmentTone(detailFulfillmentStatus)} />
                                                        <StatusChip label={getPaymentStatusLabel(detailPaymentStatus, t)} tone={getPaymentTone(detailPaymentStatus)} />
                                                    </div>
                                                    <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                                                        Đặt lúc {formatOrderRecordedAt(selectedOrderDetail.created_at)} • Kênh: <strong className="text-foreground font-semibold">{getOrderChannelLabel(selectedOrderDetail.order_channel)}</strong>
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Right: Quick actions (Print A4, Print 80mm, Zalo, Close) */}
                                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handlePrintOrder(selectedOrderDetail, 'a4')}
                                                    className="inline-flex h-8 sm:h-9 items-center gap-1.5 rounded-xl border border-border/70 bg-background/50 px-2.5 sm:px-3 text-xs font-semibold text-foreground hover:bg-muted transition-all active:scale-95"
                                                >
                                                    <PrinterIcon className="h-3.5 w-3.5" />
                                                    <span>In A4</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handlePrintOrder(selectedOrderDetail, 'receipt80')}
                                                    className="inline-flex h-8 sm:h-9 items-center gap-1.5 rounded-xl border border-border/70 bg-background/50 px-2.5 sm:px-3 text-xs font-semibold text-foreground hover:bg-muted transition-all active:scale-95"
                                                >
                                                    <PrinterIcon className="h-3.5 w-3.5" />
                                                    <span>In 80mm</span>
                                                </button>
                                                {selectedOrderDetail.customer_phone && (
                                                    <a
                                                        href={`https://zalo.me/${selectedOrderDetail.customer_phone.replace(/\D/g, '')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex h-8 sm:h-9 items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-2.5 sm:px-3 text-xs font-bold text-sky-600 hover:bg-sky-500/20 transition-all active:scale-95"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="h-3.5 w-3.5">
                                                            <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.915 1.464 5.518 3.75 7.182v3.56l3.35-1.84c.915.253 1.884.39 2.9.39 5.523 0 10-4.145 10-9.292C22 6.145 17.523 2 12 2z" />
                                                        </svg>
                                                        <span>Zalo</span>
                                                    </a>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={handleCloseDetail}
                                                    className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground hover:text-foreground transition-all"
                                                    aria-label="Đóng chi tiết"
                                                >
                                                    <CloseIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. Top Summary 2 Cards Grid: Customer & Fulfillment | Payment & Financials */}
                                    <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 mx-1 sm:mx-0">
                                        {/* Card 1: Khách hàng & Giao nhận */}
                                        <div className="rounded-2xl sm:rounded-[1.6rem] border border-white/70 bg-card/85 p-4 sm:p-5 shadow-[0_20px_50px_-30px_rgba(24,35,32,0.4)] backdrop-blur-2xl dark:border-white/10 space-y-3">
                                            <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                                        <UserIcon className="h-4 w-4" />
                                                    </div>
                                                    <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground">
                                                        Khách hàng & Nhận hàng
                                                    </h4>
                                                </div>
                                                {selectedOrderDetail.customer_phone && (
                                                    <a
                                                        href={`tel:${selectedOrderDetail.customer_phone}`}
                                                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                                                        </svg>
                                                        <span>Gọi ngay</span>
                                                    </a>
                                                )}
                                            </div>

                                            <div className="space-y-2 text-xs sm:text-sm leading-relaxed">
                                                <div className="flex items-baseline justify-between gap-2">
                                                    <span className="text-muted-foreground">Người nhận:</span>
                                                    <span className="font-bold text-foreground">{selectedOrderDetail.customer_name || 'Khách vãng lai'}</span>
                                                </div>
                                                <div className="flex items-baseline justify-between gap-2">
                                                    <span className="text-muted-foreground">Số điện thoại:</span>
                                                    <span className="font-mono font-semibold text-foreground">{selectedOrderDetail.customer_phone || 'Chưa cung cấp'}</span>
                                                </div>
                                                <div className="flex items-start justify-between gap-2">
                                                    <span className="text-muted-foreground shrink-0">Địa chỉ:</span>
                                                    <span className="text-right font-medium text-foreground">{fullAddress || 'Nhận tại quầy / Chưa có'}</span>
                                                </div>
                                                <div className="flex items-baseline justify-between gap-2 border-t border-border/30 pt-2">
                                                    <span className="text-muted-foreground">Đơn vị VC:</span>
                                                    <span className="font-semibold text-foreground uppercase">{selectedOrderDetail.shipping_provider || 'Tự giao / Chưa gán'}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-muted-foreground">Mã vận đơn:</span>
                                                    {selectedOrderDetail.shipping_code ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-mono font-bold text-primary">{selectedOrderDetail.shipping_code}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    void navigator.clipboard.writeText(selectedOrderDetail.shipping_code || '');
                                                                    addToast(`Đã chép mã vận đơn ${selectedOrderDetail.shipping_code}`, { type: 'success' });
                                                                }}
                                                                className="text-xs text-muted-foreground hover:text-primary"
                                                                title="Sao chép mã"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-3.5 w-3.5">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">Chưa tạo vận đơn</span>
                                                    )}
                                                </div>
                                                {selectedOrderDetail.notes && (
                                                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-300">
                                                        <strong>Ghi chú:</strong> {selectedOrderDetail.notes}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Card 2: Thanh toán & Giá trị đơn */}
                                        <div className="rounded-2xl sm:rounded-[1.6rem] border border-white/70 bg-card/85 p-4 sm:p-5 shadow-[0_20px_50px_-30px_rgba(24,35,32,0.4)] backdrop-blur-2xl dark:border-white/10 space-y-3">
                                            <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                                                        <ReceiptIcon className="h-4 w-4" />
                                                    </div>
                                                    <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground">
                                                        Thanh toán & Giá trị
                                                    </h4>
                                                </div>
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                                                    detailPaymentStatus === 'paid' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                                }`}>
                                                    {getPaymentStatusLabel(detailPaymentStatus, t)}
                                                </span>
                                            </div>

                                            <div className="space-y-1.5 text-xs sm:text-sm leading-relaxed">
                                                <div className="flex justify-between gap-2">
                                                    <span className="text-muted-foreground">Phương thức:</span>
                                                    <span className="font-semibold text-foreground">{getPaymentMethodLabel(detailPaymentMethod, t)}</span>
                                                </div>
                                                <div className="flex justify-between gap-2">
                                                    <span className="text-muted-foreground">Tạm tính ({detailItemCount} SP):</span>
                                                    <span className="font-medium text-foreground">{formatCurrency(subtotal)}</span>
                                                </div>
                                                {discount > 0 && (
                                                    <div className="flex justify-between gap-2 text-rose-600 dark:text-rose-400">
                                                        <span>Giảm giá {selectedOrderDetail.discount_code ? `(${selectedOrderDetail.discount_code})` : ''}:</span>
                                                        <span className="font-semibold">- {formatCurrency(discount)}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between gap-2">
                                                    <span className="text-muted-foreground">Phí vận chuyển:</span>
                                                    <span className="font-medium text-foreground">{shipping > 0 ? formatCurrency(shipping) : 'Miễn phí'}</span>
                                                </div>
                                                {taxAmount > 0 && (
                                                    <div className="flex justify-between gap-2">
                                                        <span className="text-muted-foreground">Thuế VAT:</span>
                                                        <span className="font-medium text-foreground">{formatCurrency(taxAmount)}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-baseline justify-between gap-2 border-t border-border/50 pt-2.5">
                                                    <span className="text-sm font-bold text-foreground">Tổng thanh toán:</span>
                                                    <span className="font-mono text-base sm:text-xl font-black text-primary">
                                                        {formatCurrency(total)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3. Products List in Order */}
                                    <div className="rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-3.5 sm:p-5 shadow-[0_20px_50px_-30px_rgba(24,35,32,0.4)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
                                        <div className="flex items-center justify-between border-b border-border/40 pb-3">
                                            <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground">
                                                Sản phẩm trong đơn ({detailItemCount})
                                            </h4>
                                            <span className="text-xs text-muted-foreground">
                                                Tổng {selectedOrderDetail.order_items?.length || 0} mục
                                            </span>
                                        </div>

                                        <div className="divide-y divide-border/25">
                                            {(selectedOrderDetail.order_items || []).map((item, idx) => {
                                                const itemImg = item.product?.main_image_url
                                                    || item.product?.images?.[0]?.image_url
                                                    || item.resolved_product_image_path
                                                    || item.product_image_path;
                                                const unitPrice = Number(item.price_at_purchase || item.product?.price || 0);
                                                const itemQty = Number(item.quantity || 1);
                                                const lineTotal = unitPrice * itemQty;

                                                return (
                                                    <div key={item.id || idx} className="flex items-center gap-3 py-3">
                                                        {/* Thumbnail */}
                                                        <div className="relative shrink-0">
                                                            {itemImg ? (
                                                                <img
                                                                    src={itemImg}
                                                                    alt={item.product_name || item.product?.name || 'Sản phẩm'}
                                                                    className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl border border-border/70 bg-card/60 object-cover"
                                                                    onError={(e) => {
                                                                        (e.target as HTMLImageElement).src = 'https://thegioitrimun.vn/r2/assets/admin-icons/1786688261441-dongbocanva.webp';
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl border border-border/70 bg-muted flex items-center justify-center text-muted-foreground">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                                                                    </svg>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Product info */}
                                                        <div className="min-w-0 flex-1">
                                                            <p className="line-clamp-2 text-xs sm:text-sm font-semibold text-foreground leading-snug">
                                                                {item.product_name || item.product?.name || 'Sản phẩm không xác định'}
                                                            </p>
                                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                                {formatCurrency(unitPrice)} × {itemQty}
                                                            </p>
                                                        </div>

                                                        {/* Line total */}
                                                        <div className="text-right shrink-0">
                                                            <span className="font-mono text-xs sm:text-sm font-bold text-foreground">
                                                                {formatCurrency(lineTotal)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 4. Segmented Operations Tabs: Timeline & Status | Payments | Refunds */}
                                    <div className="rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-3.5 sm:p-5 shadow-[0_20px_50px_-30px_rgba(24,35,32,0.4)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
                                        {/* Tab Headers */}
                                        <div className="flex items-center gap-1.5 border-b border-border/40 pb-2.5 overflow-x-auto">
                                            <button
                                                type="button"
                                                onClick={() => setOrderDetailTab('status')}
                                                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                                                    orderDetailTab === 'status'
                                                        ? 'bg-primary text-primary-foreground shadow-xs'
                                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                                }`}
                                            >
                                                Lịch sử & Cập nhật trạng thái ({orderStatusHistory.length})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setOrderDetailTab('payments')}
                                                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                                                    orderDetailTab === 'payments'
                                                        ? 'bg-primary text-primary-foreground shadow-xs'
                                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                                }`}
                                            >
                                                Lịch sử thanh toán ({orderPaymentLogs.length})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setOrderDetailTab('refunds')}
                                                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                                                    orderDetailTab === 'refunds'
                                                        ? 'bg-primary text-primary-foreground shadow-xs'
                                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                                }`}
                                            >
                                                Hoàn tiền ({orderRefundLogs.length})
                                            </button>
                                        </div>

                                        {/* Tab Content 1: Trạng thái */}
                                        {orderDetailTab === 'status' && (
                                            <div className="mt-3.5 space-y-4">
                                                {/* Status update form inline */}
                                                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-background/40 p-2.5">
                                                    <span className="text-xs font-semibold text-muted-foreground">Đổi trạng thái:</span>
                                                    <select
                                                        value={detailFulfillmentStatus}
                                                        onChange={(e) => void handleUpdateOrderStatus(selectedOrderDetail.id, e.target.value as OrderFulfillmentStatus)}
                                                        disabled={isUpdatingOrderStatus}
                                                        className="h-8 rounded-lg border border-border/70 bg-card px-2 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                                    >
                                                        {getAllowedTransitionTargets(detailFulfillmentStatus).map(status => <option key={status} value={status}>{t(`admin.order_status_${status}`)}</option>)}
                                                    </select>
                                                    {isUpdatingOrderStatus && <Spinner className="w-3.5 h-3.5 text-primary" />}
                                                </div>

                                                {/* Timeline */}
                                                <div className="space-y-2.5 pt-1">
                                                    {orderStatusHistory.length === 0 ? (
                                                        <p className="py-4 text-center text-xs text-muted-foreground">Chưa có bản ghi lịch sử trạng thái.</p>
                                                    ) : (
                                                        orderStatusHistory.map((item) => (
                                                            <div key={item.id} className="flex items-start gap-2.5 text-xs">
                                                                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex flex-wrap items-baseline gap-1.5">
                                                                        <span className="font-bold text-foreground">
                                                                            {getFulfillmentStatusLabel(item.to_status, t)}
                                                                        </span>
                                                                        <span className="text-muted-foreground">• {new Date(item.created_at).toLocaleString('vi-VN')}</span>
                                                                    </div>
                                                                    {item.note && <p className="text-muted-foreground mt-0.5">{item.note}</p>}
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Tab Content 2: Thanh toán */}
                                        {orderDetailTab === 'payments' && (
                                            <div className="mt-3.5 space-y-2">
                                                {orderPaymentLogs.length === 0 ? (
                                                    <p className="py-4 text-center text-xs text-muted-foreground">Chưa có giao dịch thanh toán nào được ghi nhận.</p>
                                                ) : (
                                                    orderPaymentLogs.map((pmt) => (
                                                        <div key={pmt.id} className="flex items-center justify-between rounded-xl border border-border/40 bg-background/30 p-2.5 text-xs">
                                                            <div>
                                                                <p className="font-bold text-foreground">{formatCurrency(pmt.amount)}</p>
                                                                <p className="text-muted-foreground text-[11px]">{new Date(pmt.created_at).toLocaleString('vi-VN')}</p>
                                                            </div>
                                                            <span className="font-semibold text-primary uppercase">{pmt.method || 'Cổng TT'}</span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}

                                        {/* Tab Content 3: Hoàn tiền */}
                                        {orderDetailTab === 'refunds' && (
                                            <div className="mt-3.5 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-muted-foreground">Danh sách hoàn tiền</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowRefundForm(!showRefundForm)}
                                                        className="text-xs font-bold text-primary hover:underline"
                                                    >
                                                        {showRefundForm ? 'Ẩn form tạo hoàn' : '+ Tạo yêu cầu hoàn tiền'}
                                                    </button>
                                                </div>

                                                {/* Collapsible Refund Form */}
                                                {showRefundForm && (
                                                    <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-3 space-y-2.5 animate-in fade-in">
                                                        <p className="text-xs font-bold text-rose-700 dark:text-rose-400">Tạo yêu cầu hoàn tiền</p>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="1000"
                                                                value={refundAmount}
                                                                onChange={(e) => setRefundAmount(e.target.value)}
                                                                placeholder="Số tiền hoàn (đ)"
                                                                className="h-8 rounded-lg border border-border/70 bg-card px-2 text-xs focus:ring-1 focus:ring-primary outline-none"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={refundReason}
                                                                onChange={(e) => setRefundReason(e.target.value)}
                                                                placeholder="Lý do hoàn tiền..."
                                                                className="h-8 rounded-lg border border-border/70 bg-card px-2 text-xs focus:ring-1 focus:ring-primary outline-none"
                                                            />
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={refundRestock}
                                                                    onChange={(e) => setRefundRestock(e.target.checked)}
                                                                    className="h-3.5 w-3.5 rounded border-input text-primary focus:ring-primary"
                                                                />
                                                                <span>Hoàn lại số lượng tồn kho</span>
                                                            </label>
                                                            <button
                                                                type="button"
                                                                onClick={() => void handleCreateRefund()}
                                                                disabled={isSubmittingRefund || detailPaymentStatus !== 'paid'}
                                                                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 transition-all"
                                                            >
                                                                {isSubmittingRefund ? <Spinner className="w-3 h-3" /> : 'Xác nhận hoàn tiền'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Refund History list */}
                                                <div className="space-y-2">
                                                    {orderRefundLogs.length === 0 ? (
                                                        <p className="py-4 text-center text-xs text-muted-foreground">Chưa có giao dịch hoàn tiền nào.</p>
                                                    ) : (
                                                        orderRefundLogs.map((rf) => (
                                                            <div key={rf.id} className="flex items-center justify-between rounded-xl border border-border/40 bg-background/30 p-2.5 text-xs">
                                                                <div>
                                                                    <p className="font-bold text-rose-600 dark:text-rose-400">- {formatCurrency(rf.amount)}</p>
                                                                    <p className="text-muted-foreground text-[11px]">{new Date(rf.created_at).toLocaleString('vi-VN')} • Lý do: {rf.reason || 'N/A'}</p>
                                                                </div>
                                                                <span className="font-semibold text-muted-foreground uppercase">{rf.status || 'Đã hoàn'}</span>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )}
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
