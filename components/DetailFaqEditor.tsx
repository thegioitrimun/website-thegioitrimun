import React from 'react';
import type { DetailFaqEntry } from '../types';
import { PlusCircleIcon } from './icons';

const DELETE_ICON = 'https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp';

interface DetailFaqEditorProps {
  value: DetailFaqEntry[];
  onChange: (items: DetailFaqEntry[]) => void;
  title?: string;
  description?: string;
  addLabel?: string;
}

const EMPTY_ITEM: DetailFaqEntry = { question: '', answer: '' };

const DetailFaqEditor: React.FC<DetailFaqEditorProps> = ({
  value,
  onChange,
  title = 'FAQ chi tiết',
  description,
  addLabel = 'Thêm câu hỏi',
}) => {
  const items = Array.isArray(value) ? value : [];

  const handleItemChange = (index: number, field: keyof DetailFaqEntry, fieldValue: string) => {
    const nextItems = [...items];
    nextItems[index] = {
      ...nextItems[index],
      [field]: fieldValue,
    };
    onChange(nextItems);
  };

  const handleAddItem = () => {
    onChange([...items, { ...EMPTY_ITEM }]);
  };

  const handleRemoveItem = (index: number) => {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="space-y-2.5">
      {/* Header bar: Tiêu đề phụ + Đếm số câu hỏi + Nút thêm nhanh */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {title ? (
            <span className="text-xs font-bold text-foreground">
              {title}
            </span>
          ) : null}
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
            {items.length} câu
          </span>
        </div>

        <button
          type="button"
          onClick={handleAddItem}
          className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary hover:text-primary-foreground px-2.5 py-1 text-xs font-bold text-primary transition-all active:scale-95 shadow-2xs"
        >
          <PlusCircleIcon className="h-3.5 w-3.5" />
          <span>{addLabel}</span>
        </button>
      </div>

      {description ? (
        <p className="text-[11px] text-muted-foreground leading-normal">
          {description}
        </p>
      ) : null}

      {/* Danh sách câu hỏi dạng thẻ tinh gọn */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 px-4 rounded-2xl border border-dashed border-border/70 bg-background/20 text-center">
          <p className="text-xs text-muted-foreground mb-2">Chưa có câu hỏi thường gặp nào.</p>
          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 hover:bg-primary hover:text-primary-foreground px-3 py-1.5 text-xs font-bold text-primary transition-all active:scale-95"
          >
            <PlusCircleIcon className="h-4 w-4" />
            <span>{addLabel}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={`faq-item-${index}`}
              className="group rounded-xl border border-white/60 dark:border-white/10 bg-card/40 backdrop-blur-xl shadow-2xs p-2 sm:p-2.5 transition-all hover:border-primary/30 hover:bg-card/60"
            >
              {/* Dòng 1: Huy hiệu số thứ tự + Ô nhập câu hỏi + Nút xóa */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="flex h-8 px-2 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-[11px] font-bold border border-primary/20 select-none">
                  #{index + 1}
                </span>

                <input
                  type="text"
                  value={item.question}
                  onChange={(e) => handleItemChange(index, 'question', e.target.value)}
                  className="h-8 flex-1 rounded-lg border border-border/60 bg-background/50 px-2.5 text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:bg-background focus:ring-1 focus:ring-primary/30 outline-none transition-all"
                  placeholder="Nhập câu hỏi (ví dụ: Sản phẩm phù hợp với loại da nào?)..."
                />

                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive active:scale-95 transition-all"
                  title={`Xóa câu hỏi ${index + 1}`}
                  aria-label={`Xóa câu hỏi ${index + 1}`}
                >
                  <img src={DELETE_ICON} alt="Xóa" className="h-4 w-4 object-contain" />
                </button>
              </div>

              {/* Dòng 2: Ô nhập câu trả lời gọn (2 hàng) */}
              <div className="mt-1.5 pl-0 sm:pl-[38px]">
                <textarea
                  value={item.answer}
                  onChange={(e) => handleItemChange(index, 'answer', e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-border/50 bg-background/40 p-2 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:bg-background focus:ring-1 focus:ring-primary/30 outline-none transition-all resize-y min-h-[46px]"
                  placeholder="Nhập câu trả lời rõ ràng, có ngữ cảnh mua hàng hoặc điều trị..."
                />
              </div>
            </div>
          ))}

          {/* Nút thêm câu hỏi phía dưới */}
          <button
            type="button"
            onClick={handleAddItem}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold transition-all active:scale-95 mt-1"
          >
            <PlusCircleIcon className="h-3.5 w-3.5" />
            <span>{addLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default DetailFaqEditor;
