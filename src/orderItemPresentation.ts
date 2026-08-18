import type { ProductOrderItem } from '../types';

const PLACEHOLDER_PRODUCT_NAME = /^(?:sản phẩm|sp|product)\s*#\s*\d+$/i;

export const isPlaceholderOrderProductName = (value: unknown): boolean =>
    PLACEHOLDER_PRODUCT_NAME.test(String(value || '').trim());

export const getOrderItemDisplayName = (item: ProductOrderItem): string => {
    const snapshotName = String(item.product_name || '').trim();
    const currentName = String(item.product?.name || '').trim();

    if (snapshotName && !isPlaceholderOrderProductName(snapshotName)) return snapshotName;
    return currentName || snapshotName || `Sản phẩm #${item.product_id}`;
};
