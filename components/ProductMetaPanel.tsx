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
    <div className="space-y-4 sm:space-y-5 xl:sticky xl:top-4">
      <section className="hidden xl:block overflow-hidden rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10">
        <div className="border-b border-border/30 bg-gradient-to-br from-primary/10 via-transparent to-transparent p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">Quick snapshot</p>
          <div className="mt-3.5 flex items-start gap-3.5">
            <div className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-2xl border border-white/60 dark:border-white/10 bg-background/50 backdrop-blur-xl shadow-xs">
              {primaryImagePreview ? (
                <img src={primaryImagePreview} alt={productName || 'Ảnh sản phẩm'} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center px-2 text-center text-xs text-muted-foreground">Chưa có ảnh bìa</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base sm:text-lg font-bold text-foreground line-clamp-2">{productName || 'Sản phẩm mới'}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground line-clamp-2">{description || 'Thêm mô tả ngắn để scan nhanh hơn.'}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-border/50 bg-background/40 backdrop-blur-xl px-3 py-2.5 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Trạng thái</p>
              <p className="mt-1 text-xs font-bold text-foreground">{isPublished ? 'Đang hiển thị' : 'Bản nháp'}</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-background/40 backdrop-blur-xl px-3 py-2.5 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ảnh sẵn sàng</p>
              <p className="mt-1 text-xs font-bold text-foreground">{readyImagesCount}</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-background/40 backdrop-blur-xl px-3 py-2.5 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Khối content</p>
              <p className="mt-1 text-xs font-bold text-foreground">{textBlockCount} text / {imageBlockCount} ảnh</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-background/40 backdrop-blur-xl px-3 py-2.5 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Giá bán</p>
              <p className="mt-1 text-xs font-bold text-primary">{priceLabel}</p>
            </div>
          </div>

          <div className="mt-3.5 space-y-1.5 rounded-xl border border-border/50 bg-background/40 backdrop-blur-xl p-3 text-xs shadow-2xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Chuyên mục</span>
              <span className="text-right font-semibold text-foreground">{selectedCategoryLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Thương hiệu</span>
              <span className="text-right font-semibold text-foreground">{selectedBrandLabel}</span>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Checklist trước khi publish</p>
          <div className="mt-3 space-y-2">
            {validationItems.map((item) => (
              <div key={item.label} className="rounded-xl border border-border/50 bg-background/40 backdrop-blur-xl px-3 py-2.5 shadow-2xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground">{item.label}</p>
                    {item.hint ? <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{item.hint}</p> : null}
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold border shrink-0 ${
                      item.complete
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
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
