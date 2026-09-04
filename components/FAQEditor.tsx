import React from 'react';
import type { DetailFaqEntry } from '../types';
import DetailFaqEditor from './DetailFaqEditor';
import { PlusCircleIcon } from './icons';

interface FAQEditorProps {
  id?: string;
  value: DetailFaqEntry[];
  onChange: (items: DetailFaqEntry[]) => void;
}

const FAQEditor: React.FC<FAQEditorProps> = ({ id, value, onChange }) => {
  const items = Array.isArray(value) ? value : [];

  const handleAddItem = () => {
    onChange([...items, { question: '', answer: '' }]);
  };

  return (
    <section id={id} className="scroll-mt-32 rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-4 sm:p-5 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">FAQ & SEO</p>
          <div className="mt-1 flex items-center gap-2.5">
            <h3 className="text-lg sm:text-xl font-bold text-foreground">FAQ sản phẩm</h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
              {items.length} câu
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAddItem}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary transition-all hover:bg-primary/20 active:scale-95 shadow-2xs shrink-0"
        >
          <PlusCircleIcon className="h-4 w-4" />
          <span>Thêm câu hỏi</span>
        </button>
      </div>

      <DetailFaqEditor
        value={value}
        onChange={onChange}
        hideHeader={true}
        addLabel="Thêm câu hỏi"
      />
    </section>
  );
};

export default FAQEditor;
