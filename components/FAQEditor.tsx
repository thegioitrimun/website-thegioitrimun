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
    <section id={id} className="scroll-mt-32 rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0 p-5 md:p-6">
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">FAQ & SEO</p>
        <h3 className="mt-2 text-xl font-bold text-foreground">FAQ sản phẩm</h3>

      </div>

      <DetailFaqEditor
        value={value}
        onChange={onChange}
        title="Câu hỏi thường gặp"
        description="FAQ này ưu tiên hiển thị trên trang chi tiết và schema SEO tiếng Việt. Nếu để trống, hệ thống sẽ fallback sang FAQ dựng từ hồ sơ sản phẩm."
        addLabel="Thêm câu hỏi"
      />
    </section>
  );
};

export default FAQEditor;
