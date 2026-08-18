import React from 'react';

interface ProductMetaPanelProps {
  productName: string;
  description: string;
  primaryImagePreview?: string | null;
  isPublished: boolean;
  readyImagesCount: number;
  textBlockCount: number;
  imageBlockCount: number;
  selectedCategoryLabel: string;
  selectedBrandLabel: string;
  priceLabel: string;
  validationItems: Array<{
    label: string;
    complete: boolean;
    hint?: string;
  }>;
  children: React.ReactNode;
}

const ProductMetaPanel: React.FC<ProductMetaPanelProps> = ({
  productName,
  description,
  primaryImagePreview,
  isPublished,
  readyImagesCount,
  textBlockCount,
  imageBlockCount,
  selectedCategoryLabel,
  selectedBrandLabel,
  priceLabel,
  validationItems,
  children,
}) => {
  return (
    <div className="space-y-5 xl:sticky xl:top-4">
      <section className="overflow-hidden rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0">
        <div className="border-b border-border/30 bg-gradient-to-br from-primary/10 via-transparent to-transparent px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">Quick snapshot</p>
          <div className="mt-4 flex items-start gap-4">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-[1.3rem] bg-card/25 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] border-0">
              {primaryImagePreview ? (
                <img src={primaryImagePreview} alt={productName || 'Ảnh sản phẩm'} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center px-2 text-center text-xs text-muted-foreground">Chưa có ảnh bìa</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold text-foreground">{productName || 'Sản phẩm mới'}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground line-clamp-3">{description || 'Thêm mô tả ngắn để đội vận hành và SEO scan nhanh hơn.'}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-[1.15rem] bg-card/25 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] border-0 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Trạng thái</p>
              <p className="mt-2 text-sm font-semibold">{isPublished ? 'Đang hiển thị' : 'Bản nháp'}</p>
            </div>
            <div className="rounded-[1.15rem] bg-card/25 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] border-0 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Ảnh sẵn sàng</p>
              <p className="mt-2 text-sm font-semibold">{readyImagesCount}</p>
            </div>
            <div className="rounded-[1.15rem] bg-card/25 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] border-0 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Khối content</p>
              <p className="mt-2 text-sm font-semibold">{textBlockCount} text / {imageBlockCount} ảnh</p>
            </div>
            <div className="rounded-[1.15rem] bg-card/25 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] border-0 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Giá bán</p>
              <p className="mt-2 text-sm font-semibold">{priceLabel}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2 rounded-[1.2rem] bg-card/25 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] border-0 px-4 py-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Chuyên mục</span>
              <span className="text-right font-semibold">{selectedCategoryLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Thương hiệu</span>
              <span className="text-right font-semibold">{selectedBrandLabel}</span>
            </div>
          </div>
        </div>

        <div className="px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Checklist trước khi publish</p>
          <div className="mt-4 space-y-3">
            {validationItems.map((item) => (
              <div key={item.label} className="rounded-[1.1rem] bg-card/25 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] border-0 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    {item.hint ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.hint}</p> : null}
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      item.complete
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border border-amber-200 bg-amber-50 text-amber-800'
                    }`}
                  >
                    {item.complete ? 'OK' : 'Thiếu'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {children}
    </div>
  );
};

export default ProductMetaPanel;
