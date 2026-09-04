import React from 'react';
import { useTranslation } from 'react-i18next';
import Spinner from './Spinner';

const DELETE_ICON = 'https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp';
const SAVE_ICON = 'https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-save.webp';

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
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/60 dark:border-white/10 bg-card/85 backdrop-blur-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.08)]">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-2.5 px-3 py-2.5 sm:px-4 md:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold border transition-all ${
              isSaving
                ? 'border-primary/30 bg-primary/10 text-primary'
                : isDirty
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isSaving ? 'bg-primary animate-pulse' : isDirty ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
            <span>{statusLabel}</span>
          </span>
          <span className="inline-flex items-center rounded-full border border-border/60 bg-background/50 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {publishState
              ? t('admin.sticky_publish_live', 'Sẽ hiển thị trên website sau khi lưu')
              : t('admin.sticky_publish_draft', 'Đang ở chế độ bản nháp (ẩn web)')}
          </span>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center justify-center gap-1.5 px-4 rounded-xl border border-border/60 bg-background/40 text-sm font-bold text-foreground transition-all hover:bg-muted/50 active:scale-95"
          >
            <img src={DELETE_ICON} alt="" className="w-4 h-4 object-contain shrink-0" />
            <span>{t('common.cancel', 'Hủy')}</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isUploadingImages}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <img src={SAVE_ICON} alt="" className="w-4 h-4 object-contain shrink-0" />
            )}
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
