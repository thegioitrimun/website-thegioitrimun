import React from 'react';
import type { DetailFaqEntry } from '../types';
import DetailFaqEditor from './DetailFaqEditor';

interface FAQEditorProps {
  id?: string;
  value: DetailFaqEntry[];
  onChange: (items: DetailFaqEntry[]) => void;
}

const FAQEditor: React.FC<FAQEditorProps> = ({ id, value, onChange }) => {
  return (
    <section id={id} className="scroll-mt-32 rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-4 sm:p-5 md:p-6">
      <div className="mb-4 sm:mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">FAQ & SEO</p>
        <h3 className="mt-1 text-lg sm:text-xl font-bold text-foreground">FAQ sản phẩm</h3>
      </div>

      <DetailFaqEditor
        value={value}
        onChange={onChange}
        title="Câu hỏi thường gặp"
        addLabel="Thêm câu hỏi"
      />
    </section>
  );
};

export default FAQEditor;
