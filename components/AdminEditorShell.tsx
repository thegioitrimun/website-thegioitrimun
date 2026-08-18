import React, { useEffect } from 'react';
import { CheckCircleIcon } from './icons';

export interface AdminEditorSectionLink {
  id: string;
  label: string;
}

export interface AdminEditorSummaryItem {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}

interface AdminEditorShellProps {
  eyebrow: string;
  title: string;
  description: string;
  testId?: string;
  positionLabel?: string | null;
  isDirty?: boolean;
  isSaving?: boolean;
  sections?: AdminEditorSectionLink[];
  summaryItems?: AdminEditorSummaryItem[];
  headerActions?: React.ReactNode;
  aside?: React.ReactNode;
  draftState?: {
    lastSavedAt?: string | null;
    hasRestorableDraft?: boolean;
    onRestore?: () => void;
    onDiscard?: () => void;
    note?: string;
    label?: string;
    status?: 'idle' | 'loading' | 'saving' | 'saved' | 'error';
  };
  children: React.ReactNode;
}

const AdminEditorShell: React.FC<AdminEditorShellProps> = ({
  eyebrow,
  title,
  description,
  testId,
  positionLabel = null,
  isDirty = false,
  isSaving = false,
  sections = [],
  summaryItems = [],
  headerActions,
  aside,
  draftState,
  children,
}) => {
  const formattedDraftTime = draftState?.lastSavedAt
    ? new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(draftState.lastSavedAt))
    : null;

  useEffect(() => {
    if (!isDirty) return undefined;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  return (
    <div data-testid={testId} className="space-y-5 md:space-y-7">
      {/* Top Hero Banner Card */}
      <div className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl px-5 py-6 shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] md:px-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">{eyebrow}</p>
            <h1 className="mt-2 text-2xl font-bold text-foreground md:text-3xl">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-base">{description}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${isDirty ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}>
                <CheckCircleIcon className="h-3.5 w-3.5" />
                {isDirty ? 'Có thay đổi chưa lưu' : 'Đã đồng bộ với form hiện tại'}
              </span>
              {isSaving ? (
                <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  Đang lưu...
                </span>
              ) : null}
              {formattedDraftTime ? (
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                  draftState?.status === 'error'
                    ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
                    : 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                }`}>
                  {(draftState?.label || 'Autosave local')} {formattedDraftTime}
                </span>
              ) : null}
              {positionLabel ? (
                <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {positionLabel}
                </span>
              ) : null}
            </div>
          </div>

          {headerActions ? <div className="flex flex-wrap justify-end gap-2 xl:max-w-[40%]">{headerActions}</div> : null}
        </div>
      </div>

      {draftState?.hasRestorableDraft ? (
        <div className="rounded-[1.7rem] border border-sky-500/30 bg-sky-500/10 backdrop-blur-xl p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-bold text-sky-900 dark:text-sky-200">Có bản nháp local chưa áp vào form hiện tại.</p>
              <p className="mt-1 text-xs text-sky-800 dark:text-sky-300">
                {formattedDraftTime ? `Bản nháp được autosave lúc ${formattedDraftTime}.` : 'Đã tìm thấy bản nháp autosave trên máy này.'}
                {draftState.note ? ` ${draftState.note}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {draftState.onDiscard ? (
                <button
                  type="button"
                  onClick={draftState.onDiscard}
                  className="rounded-full border border-sky-300 bg-background/90 px-4 py-1.5 text-xs font-semibold text-sky-900 dark:text-sky-200 transition-colors hover:border-sky-400"
                >
                  Bỏ bản nháp
                </button>
              ) : null}
              {draftState.onRestore ? (
                <button
                  type="button"
                  onClick={draftState.onRestore}
                  className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 shadow-sm"
                >
                  Khôi phục bản nháp
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {sections.length > 0 ? (
        <div className="sticky top-[76px] z-20 overflow-x-auto rounded-full border border-border/60 bg-background/80 backdrop-blur-xl p-1.5 shadow-sm lg:static">
          <div className="flex min-w-max gap-1">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="shrink-0 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-card hover:text-primary"
              >
                {section.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}

      <div className={`grid gap-5 md:gap-7 ${aside ? 'xl:grid-cols-[minmax(0,1.18fr)_360px] 2xl:grid-cols-[minmax(0,1.25fr)_390px]' : ''}`}>
        <div className="min-w-0">{children}</div>
        {aside ? (
          <aside className="space-y-4 xl:sticky xl:top-24">
            {summaryItems.length > 0 ? (
              <div className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl p-5 shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] md:p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Editor snapshot</p>
                <div className="mt-4 grid gap-3">
                  {summaryItems.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-border/60 bg-background/80 p-3.5 shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
                      <p className={`mt-1 text-base font-black ${item.tone || 'text-foreground'}`}>{item.value}</p>
                      {item.hint ? <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {aside}
          </aside>
        ) : null}
      </div>
    </div>
  );
};

export default AdminEditorShell;
