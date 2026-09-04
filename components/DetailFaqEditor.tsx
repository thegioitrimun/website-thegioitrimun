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
  hideHeader?: boolean;
}

const EMPTY_ITEM: DetailFaqEntry = { question: '', answer: '' };

const DetailFaqEditor: React.FC<DetailFaqEditorProps> = ({
  value,
  onChange,
  title = 'FAQ chi tiết',
  description,
  addLabel = 'Thêm câu hỏi',
  hideHeader = false,
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
    <div className="space-y-4">
      {/* Header bar (khi không ẩn): Thiết kế đồng bộ chuẩn Image 2 */}
      {!hideHeader && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div>
            {title ? (
              <div className="flex items-center gap-2.5">
                <h3 className="text-base sm:text-lg font-bold text-foreground">
                  {title}
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                  {items.length} câu
                </span>
              </div>
            ) : null}
            {description ? (
              <p className="mt-1 text-xs text-muted-foreground leading-normal">
                {description}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary transition-all hover:bg-primary/20 active:scale-95 shadow-2xs shrink-0"
          >
            <PlusCircleIcon className="h-4 w-4" />
            <span>{addLabel}</span>
          </button>
        </div>
      )}

      {/* Danh sách câu hỏi dạng thẻ chuẩn phong cách Image 2 */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 rounded-2xl border border-dashed border-border/70 bg-background/20 text-center">
          <p className="text-xs font-medium text-muted-foreground mb-3">Chưa có câu hỏi thường gặp nào.</p>
          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary hover:text-primary-foreground px-4 py-2 text-xs font-bold text-primary transition-all active:scale-95 shadow-2xs"
          >
            <PlusCircleIcon className="h-4 w-4" />
            <span>{addLabel}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item, index) => (
            <div
              key={`faq-item-${index}`}
              className="rounded-2xl border border-white/70 bg-card/60 backdrop-blur-xl shadow-xs p-4 sm:p-5 transition-all hover:border-primary/30 dark:border-white/10"
            >
              {/* Dòng 1: Label Câu hỏi #{index + 1} + Nút Xóa */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Câu hỏi #{index + 1}
                </span>

                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border/70 bg-background/50 text-muted-foreground hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive active:scale-95 transition-all shadow-2xs"
                  title={`Xóa câu hỏi ${index + 1}`}
                  aria-label={`Xóa câu hỏi ${index + 1}`}
                >
                  <img src={DELETE_ICON} alt="Xóa" className="h-4 w-4 object-contain shrink-0" />
                </button>
              </div>

              {/* Ô nhập câu hỏi chuẩn admin-glass-input */}
              <input
                type="text"
                value={item.question}
                onChange={(e) => handleItemChange(index, 'question', e.target.value)}
                className="admin-glass-input w-full text-sm font-semibold text-foreground placeholder:text-muted-foreground/60"
                placeholder="Nhập câu hỏi (ví dụ: Tần suất sử dụng sản phẩm như thế nào?)..."
              />

              {/* Dòng 2: Label Câu trả lời + Ô nhập câu trả lời chuẩn admin-glass-input */}
              <label className="mt-3.5 block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Câu trả lời
                </span>
                <textarea
                  value={item.answer}
                  onChange={(e) => handleItemChange(index, 'answer', e.target.value)}
                  rows={3}
                  className="admin-glass-input w-full min-h-[86px] text-sm text-foreground placeholder:text-muted-foreground/60 leading-relaxed resize-y"
                  placeholder="Nhập câu trả lời rõ ràng, có ngữ cảnh mua hàng hoặc điều trị..."
                />
              </label>
            </div>
          ))}

          {/* Nút thêm câu hỏi phía dưới */}
          <button
            type="button"
            onClick={handleAddItem}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold transition-all active:scale-95 shadow-2xs"
          >
            <PlusCircleIcon className="h-4 w-4" />
            <span>{addLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default DetailFaqEditor;
