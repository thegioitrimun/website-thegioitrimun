import React from 'react';
import type { DetailFaqEntry } from '../types';
import { PlusCircleIcon, TrashIcon } from './icons';

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
    description = 'FAQ này sẽ được ưu tiên hiển thị trên trang chi tiết và trong schema SEO. Nếu để trống, hệ thống sẽ fallback sang FAQ dựng từ nội dung hiện có.',
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
        <fieldset className="space-y-4 rounded-[1.5rem] bg-transparent border-0 p-4">
            <legend className="px-2 text-lg font-semibold text-primary">{title}</legend>

            <div className="space-y-4">
                {items.map((item, index) => (
                    <div key={`faq-item-${index}`} className="relative rounded-[1.3rem] bg-card/25 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] border-0 p-4">
                        <div className="absolute right-3 top-3 relative group inline-flex">
                            <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                className="rounded-full bg-card/80 p-1.5 text-muted-foreground transition-all hover:scale-110 hover:text-destructive active:scale-95"
                                aria-label={`Xóa câu hỏi ${index + 1}`}
                            >
                                <TrashIcon className="h-4 w-4" />
                            </button>
                            <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                Xóa câu hỏi
                            </span>
                        </div>
                        <div className="space-y-4 pr-10">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-foreground">Câu hỏi {index + 1}</label>
                                <input
                                    type="text"
                                    value={item.question}
                                    onChange={(e) => handleItemChange(index, 'question', e.target.value)}
                                    className="w-full rounded-md border admin-glass-input p-2"
                                    placeholder="Ví dụ: Sản phẩm này phù hợp với loại da nào?"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-foreground">Câu trả lời</label>
                                <textarea
                                    value={item.answer}
                                    onChange={(e) => handleItemChange(index, 'answer', e.target.value)}
                                    rows={4}
                                    className="w-full rounded-md border admin-glass-input p-2"
                                    placeholder="Viết câu trả lời rõ ràng, có ngữ cảnh mua hàng hoặc điều trị."
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/20"
            >
                <PlusCircleIcon className="h-5 w-5" />
                {addLabel}
            </button>
        </fieldset>
    );
};

export default DetailFaqEditor;
