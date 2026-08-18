import React from 'react';
import type { ProductContentAudit } from '../types';

interface ProductContentReviewPanelProps {
  productId?: number;
  audit: ProductContentAudit;
  reviewLabel: string;
  reviewTone: string;
  isStale: boolean;
  canPublish: boolean;
  reviewNotes: string;
  reviewedAt?: string | null;
  reviewedByLabel?: string | null;
  isLoading: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  onReviewNotesChange: (value: string) => void;
  onMarkInReview: () => void;
  onRequestRewrite: () => void;
  onApprove: () => void;
}

const ProductContentReviewPanel: React.FC<ProductContentReviewPanelProps> = ({
  productId,
  audit,
  reviewLabel,
  reviewTone,
  isStale,
  canPublish,
  reviewNotes,
  reviewedAt,
  reviewedByLabel,
  isLoading,
  isSaving,
  hasUnsavedChanges,
  onReviewNotesChange,
  onMarkInReview,
  onRequestRewrite,
  onApprove,
}) => {
  const formattedReviewedAt = reviewedAt
    ? new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(reviewedAt))
    : null;

  const disabledReason = !productId
    ? 'Lưu sản phẩm ít nhất một lần để tạo hồ sơ đánh giá.'
    : '';

  return (
    <section className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0 p-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">Đánh giá nội dung</p>
        <h3 className="mt-2 text-lg font-bold text-foreground">Chất lượng nội dung & chuẩn SEO</h3>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${reviewTone}`}>
          {reviewLabel}
        </span>
        <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground">
          Score {audit.score}/100
        </span>
        <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          {audit.blocker_count} gợi ý ưu tiên • {audit.warning_count} lưu ý
        </span>
        {isStale ? (
          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
            Nội dung đã đổi sau lần đánh giá gần nhất
          </span>
        ) : null}
      </div>

      <div className="mt-4 rounded-[1.2rem] bg-card/25 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] border-0 px-4 py-4">
        <p className="text-sm font-semibold text-foreground">{audit.summary}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {canPublish
            ? 'Nội dung đạt chuẩn chất lượng SEO.'
            : 'Các chỉ số trên giúp tham khảo và nâng cao chất lượng content, không ảnh hưởng việc lưu hoặc xuất bản sản phẩm.'}
        </p>
        {formattedReviewedAt ? (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Lần cập nhật đánh giá gần nhất: {formattedReviewedAt}
            {reviewedByLabel ? ` • ${reviewedByLabel}` : ''}
          </p>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        {audit.issues.length === 0 ? (
          <div className="rounded-[1.1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Không có lỗi nội dung nghiêm trọng. Reviewer chỉ cần rà câu chữ cuối và media trước khi duyệt.
          </div>
        ) : (
          audit.issues.slice(0, 6).map((issue) => (
            <div key={`${issue.field}-${issue.code}`} className="rounded-[1.1rem] bg-card/25 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] border-0 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{issue.message}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">{issue.field}</p>
                </div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    issue.severity === 'blocker'
                      ? 'border border-rose-200 bg-rose-50 text-rose-800'
                      : 'border border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  {issue.severity === 'blocker' ? 'Blocker' : 'Warning'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-medium text-foreground">Ghi chú reviewer / brief viết lại</span>
        <textarea
          value={reviewNotes}
          onChange={(event) => onReviewNotesChange(event.target.value)}
          rows={4}
          className="w-full admin-glass-input.5 text-sm text-foreground outline-none transition-colors focus:border-primary/45 focus:ring-2 focus:ring-primary/15"
          placeholder="Ghi rõ nội dung nào cần viết lại, guideline câu chữ hoặc lý do duyệt."
        />
      </label>

      {disabledReason ? (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{disabledReason}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onMarkInReview}
          disabled={Boolean(disabledReason) || isLoading || isSaving}
          className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900 transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Đang lưu...' : 'Đánh dấu đang duyệt'}
        </button>
        <button
          type="button"
          onClick={onRequestRewrite}
          disabled={Boolean(disabledReason) || isLoading || isSaving}
          className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-900 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Yêu cầu viết lại
        </button>
        <button
          type="button"
          onClick={onApprove}
          disabled={Boolean(disabledReason) || isLoading || isSaving || audit.blocker_count > 0}
          className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Duyệt nội dung
        </button>
      </div>
    </section>
  );
};

export default ProductContentReviewPanel;
