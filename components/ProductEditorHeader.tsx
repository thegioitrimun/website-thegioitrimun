import React from 'react';
import { CheckCircleIcon } from './icons';
import type { ProductEditorSection } from '../src/productEditorTypes';

interface DraftState {
  lastSavedAt?: string | null;
  hasRestorableDraft?: boolean;
  onRestore?: () => void;
  onDiscard?: () => void;
  note?: string;
  label?: string;
  status?: 'idle' | 'loading' | 'saving' | 'saved' | 'error';
}

interface ProductEditorHeaderProps {
  title: string;
  subtitle: string;
  positionLabel?: string | null;
  isDirty?: boolean;
  isSaving?: boolean;
  sections?: ProductEditorSection[];
  draftState?: DraftState;
  actionSlot?: React.ReactNode;
  secondaryActionSlot?: React.ReactNode;
}

const ProductEditorHeader: React.FC<ProductEditorHeaderProps> = ({
  title,
  subtitle,
  positionLabel,
  isDirty = false,
  isSaving = false,
  sections = [],
  draftState,
  actionSlot,
  secondaryActionSlot,
}) => {
  const formattedDraftTime = draftState?.lastSavedAt
    ? new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(draftState.lastSavedAt))
    : null;

  return (
    <div className="mb-6 space-y-4">
      <div className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0 p-5 md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-[2rem]">{title}</h1>
              {positionLabel ? (
                <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {positionLabel}
                </span>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  isSaving
                    ? 'border-primary/25 bg-primary/10 text-primary'
                    : isDirty
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                }`}
              >
                <CheckCircleIcon className="h-4 w-4" />
                {isSaving ? 'Đang lưu bản nháp' : isDirty ? 'Có thay đổi chưa lưu' : 'Đã đồng bộ'}
              </span>

              {formattedDraftTime ? (
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    draftState?.status === 'error'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-sky-200 bg-sky-50 text-sky-800'
                  }`}
                >
                  {(draftState?.label || 'Autosave')} {formattedDraftTime}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[360px] xl:items-end">
            {secondaryActionSlot ? <div className="flex flex-wrap justify-end gap-2">{secondaryActionSlot}</div> : null}
            {actionSlot ? <div className="flex flex-wrap justify-end gap-2">{actionSlot}</div> : null}
          </div>
        </div>

        {draftState?.hasRestorableDraft ? (
          <div className="mt-4 rounded-[1.4rem] border border-sky-200 bg-sky-50/90 px-4 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-sky-950">Có bản nháp local chưa áp vào form.</p>
                <p className="mt-1 text-sm text-sky-900">
                  {formattedDraftTime ? `Bản nháp được autosave lúc ${formattedDraftTime}.` : 'Đã tìm thấy bản nháp autosave trên máy này.'}
                  {draftState.note ? ` ${draftState.note}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {draftState.onDiscard ? (
                  <button
                    type="button"
                    onClick={draftState.onDiscard}
                    className="rounded-full border border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-900 transition-colors hover:border-sky-400"
                  >
                    Bỏ bản nháp
                  </button>
                ) : null}
                {draftState.onRestore ? (
                  <button
                    type="button"
                    onClick={draftState.onRestore}
                    className="rounded-full border border-sky-700 bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-800"
                  >
                    Khôi phục
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {sections.length > 0 ? (
        <div className="sticky top-3 z-30 overflow-x-auto rounded-[1.6rem] bg-transparent border-0 p-2 backdrop-blur-xl">
          <div className="flex min-w-max gap-2">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  section.status === 'complete'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : section.status === 'warning'
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/25 hover:text-primary'
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${
                  section.status === 'complete'
                    ? 'bg-emerald-500'
                    : section.status === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-border'
                }`} />
                {section.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ProductEditorHeader;
