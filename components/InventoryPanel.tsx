import React from 'react';
import type { Product, ProductCategory } from '../types';

interface InventoryPanelProps {
  id?: string;
  formData: Partial<Product>;
  categories: ProductCategory[];
  vatRatePercentValue: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onVatRatePercentChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const fieldClassName = 'w-full admin-glass-input';

const InventoryPanel: React.FC<InventoryPanelProps> = ({
  id,
  formData,
  categories,
  vatRatePercentValue,
  onChange,
  onVatRatePercentChange,
}) => {
  return (
    <section id={id} className="scroll-mt-32 rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0 p-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">Commerce</p>
        <h3 className="mt-2 text-lg font-bold text-foreground">Giá và tồn kho</h3>
      </div>

      <div className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Giá bán (VND)</span>
            <input type="number" name="price" value={formData.price || ''} onChange={onChange} className={fieldClassName} required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Tồn kho</span>
            <input type="number" name="stock_quantity" value={formData.stock_quantity || ''} onChange={onChange} className={fieldClassName} required />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">VAT (%)</span>
            <input type="number" min={0} max={100} step={0.1} value={vatRatePercentValue} onChange={onVatRatePercentChange} className={fieldClassName} />
            <span className="mt-1.5 block text-xs leading-5 text-muted-foreground">
              Chỉ dùng cho checkout, không thay đổi giá niêm yết trên frontend.
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Chuyên mục</span>
            <select name="category_id" value={formData.category_id || ''} onChange={onChange} className={fieldClassName} required>
              <option value="">Chọn chuyên mục</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">SKU</span>
            <input type="text" name="sku" value={formData.sku || ''} onChange={onChange} className={fieldClassName} />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Đã bán (hiển thị)</span>
            <input type="number" name="sold_count" value={formData.sold_count || 0} onChange={onChange} className={fieldClassName} />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Ngưỡng báo tồn thấp</span>
            <input type="number" name="low_stock_threshold" value={formData.low_stock_threshold ?? ''} onChange={onChange} className={fieldClassName} />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Ngày hết hạn</span>
            <input type="date" name="expiry_date" value={formData.expiry_date || ''} onChange={onChange} className={fieldClassName} />
          </label>
        </div>
      </div>
    </section>
  );
};

export default InventoryPanel;
