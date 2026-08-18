import React from 'react';
import { useTranslation } from 'react-i18next';
import Spinner from './Spinner';

interface StickyActionBarProps {
  isDirty: boolean;
  isSaving: boolean;
  isUploadingImages: boolean;
  publishState: boolean;
  onCancel: () => void;
  onSave?: () => void;
  onSaveCurrent?: () => void;
  onSaveDraft?: () => void;
}

const StickyActionBar: React.FC<StickyActionBarProps> = ({
  isDirty,
  isSaving,
  isUploadingImages,
  publishState,
  onCancel,
  onSave,
  onSaveCurrent,
  onSaveDraft,
}) => {
  const { t } = useTranslation();
  const handleSave = onSave || onSaveCurrent || onSaveDraft;
  const statusLabel = isSaving
    ? t('admin.sticky_status_saving', 'Đang lưu')
    : isUploadingImages
      ? t('admin.sticky_status_uploading', 'Đang tải ảnh')
      : isDirty
        ? t('admin.sticky_status_dirty', 'Có thay đổi chưa lưu')
        : t('admin.sticky_status_saved', 'Mọi thay đổi đã được lưu');

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/96 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-3 px-3 py-3 sm:px-4 md:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${
              isSaving
                ? 'border-primary/25 bg-primary/10 text-primary'
                : isDirty
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {statusLabel}
          </span>
          <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            {publishState
              ? t('admin.sticky_publish_live', 'Sẽ hiển thị trên website sau khi lưu')
              : t('admin.sticky_publish_draft', 'Đang ở chế độ bản nháp (ẩn web)')}
          </span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/35 hover:text-primary"
          >
            {t('common.cancel', 'Hủy')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isUploadingImages}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-[0_18px_34px_-24px_rgba(32,58,40,0.68)] transition-colors hover:bg-primary/92 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Spinner className="h-4 w-4" /> : null}
            <span>
              {isSaving
                ? t('admin.sticky_action_saving', 'Đang lưu...')
                : isUploadingImages
                  ? t('admin.sticky_action_wait_upload', 'Đợi upload ảnh')
                  : publishState
                    ? t('admin.sticky_action_publish', 'Lưu & xuất bản website')
                    : t('admin.sticky_action_save', 'Lưu sản phẩm')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default StickyActionBar;
