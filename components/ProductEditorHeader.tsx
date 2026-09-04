import React, { useState, useEffect } from 'react';
import Spinner from './Spinner';
import type { Product } from '../types';
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
  subtitle?: string;
  productName?: string;
  positionLabel?: string | null;
  isDirty?: boolean;
  isSaving?: boolean;
  isUploadingImages?: boolean;
  publishState?: boolean;
  isPublished?: boolean;
  isFeatured?: boolean;
  onTogglePublished?: () => void;
  onToggleFeatured?: () => void;
  sections?: ProductEditorSection[];
  draftState?: DraftState;
  onBack?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  onCreateNew?: () => void;
  previousProduct?: Pick<Product, 'id' | 'name'> | null;
  nextProduct?: Pick<Product, 'id' | 'name'> | null;
  onSelectPreviousProduct?: () => void;
  onSelectNextProduct?: () => void;
  disabledActions?: boolean;
  actionSlot?: React.ReactNode;
  secondaryActionSlot?: React.ReactNode;
}

const ProductEditorHeader: React.FC<ProductEditorHeaderProps> = ({
  title,
  subtitle,
  productName,
  positionLabel,
  isDirty = false,
  isSaving = false,
  isUploadingImages = false,
  publishState = false,
  isPublished = false,
  isFeatured = false,
  onTogglePublished,
  onToggleFeatured,
  sections = [],
  draftState,
  onBack,
  onSave,
  onCancel,
  onCreateNew,
  previousProduct = null,
  nextProduct = null,
  onSelectPreviousProduct,
  onSelectNextProduct,
  disabledActions = false,
  actionSlot,
  secondaryActionSlot,
}) => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  useEffect(() => {
    if (!showMobileMenu) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('[data-mobile-header-menu]')) {
        setShowMobileMenu(false);
      }
    };
    const handleScroll = () => {
      setShowMobileMenu(false);
    };
    document.addEventListener('click', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      document.removeEventListener('click', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [showMobileMenu]);

  const formattedDraftTime = draftState?.lastSavedAt
    ? new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(draftState.lastSavedAt))
    : null;

  const handleCancel = onCancel || onBack;

  return (
    <div className={`mb-3 sm:mb-4 space-y-2.5 sm:space-y-3 relative ${showMobileMenu ? 'z-50' : ''}`}>
      {/* 1. Glass Header Banner */}
      <div className={`rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-3 sm:p-4 md:p-5 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 relative transition-[z-index] mx-1 ${showMobileMenu ? 'z-50' : 'z-30'}`}>
        {/* DESKTOP LAYOUT (md+) */}
        <div className="hidden md:flex md:items-center md:justify-between md:gap-4">
          {/* Left: Nút quay lại + Tên sản phẩm + Badge trạng thái */}
          <div className="flex items-center gap-3 min-w-0">
            {handleCancel ? (
              <button
                type="button"
                onClick={handleCancel}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/50 text-muted-foreground hover:border-primary/50 hover:bg-card hover:text-primary transition-all active:scale-95 shadow-2xs"
                title="Về danh sách sản phẩm"
                aria-label="Về danh sách"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.25} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
              </button>
            ) : null}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg lg:text-xl font-black text-foreground tracking-tight truncate max-w-[280px] lg:max-w-[420px] 2xl:max-w-none">
                  {productName || title}
                </h1>

                {/* Badge trạng thái thay đổi */}
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold border transition-all shrink-0 ${
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
                  <span>{isSaving ? 'Đang lưu...' : isDirty ? 'Có thay đổi chưa lưu' : 'Đã đồng bộ'}</span>
                </span>

                {formattedDraftTime ? (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300 shrink-0">
                    Autosave {formattedDraftTime}
                  </span>
                ) : null}
              </div>

              {positionLabel ? (
                <p className="mt-0.5 text-xs text-muted-foreground font-medium">
                  {positionLabel}
                </p>
              ) : null}
            </div>
          </div>

          {/* Right: Thao tác (Chuyển trang, Nổi bật, Hiện web, Tạo mới, Hủy, Lưu) */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Bộ chuyển sản phẩm trước / sau */}
            {(previousProduct || nextProduct) ? (
              <div className="flex items-center rounded-xl border border-border/60 bg-background/50 p-0.5 shadow-2xs backdrop-blur-md">
                <button
                  type="button"
                  onClick={onSelectPreviousProduct}
                  disabled={!previousProduct || disabledActions}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all"
                  title={previousProduct?.name ? `Trước: ${previousProduct.name}` : 'Không có sản phẩm trước'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.25} stroke="currentColor" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
                <span className="text-[10px] font-bold text-muted-foreground px-2 border-x border-border/40 select-none">
                  Chuyển
                </span>
                <button
                  type="button"
                  onClick={onSelectNextProduct}
                  disabled={!nextProduct || disabledActions}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all"
                  title={nextProduct?.name ? `Sau: ${nextProduct.name}` : 'Không có sản phẩm sau'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.25} stroke="currentColor" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </div>
            ) : null}

            {/* Toggle Hiển thị trên website (Icon hệ thống) */}
            {onTogglePublished ? (
              <button
                type="button"
                onClick={onTogglePublished}
                disabled={disabledActions}
                className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-semibold transition-all active:scale-95 shadow-2xs ${
                  isPublished
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold'
                    : 'border-border/70 bg-background/50 text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title={isPublished ? 'Đang hiển thị trên website (Click để ẩn)' : 'Đang ẩn khỏi website (Click để hiện)'}
              >
                <img
                  src={isPublished ? 'https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-visible.webp' : 'https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-invisible.webp'}
                  alt=""
                  className="w-4 h-4 object-contain shrink-0"
                />
                <span className="hidden lg:inline">{isPublished ? 'Hiện web' : 'Ẩn web'}</span>
              </button>
            ) : null}

            {/* Toggle Đánh dấu nổi bật (Icon hệ thống) */}
            {onToggleFeatured ? (
              <button
                type="button"
                onClick={onToggleFeatured}
                disabled={disabledActions}
                className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-semibold transition-all active:scale-95 shadow-2xs ${
                  isFeatured
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold'
                    : 'border-border/70 bg-background/50 text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title={isFeatured ? 'Đang nổi bật trên homepage (Click để bỏ)' : 'Chưa nổi bật (Click để bật nổi bật)'}
              >
                <img
                  src={isFeatured ? 'https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-star.webp' : 'https://thegioitrimun.vn/r2/assets/admin-icons/20260720160138-unstar.webp'}
                  alt=""
                  className="w-4 h-4 object-contain shrink-0"
                />
                <span className="hidden lg:inline">{isFeatured ? 'Nổi bật' : 'Bình thường'}</span>
              </button>
            ) : null}

            {onCreateNew ? (
              <button
                type="button"
                onClick={onCreateNew}
                disabled={disabledActions}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-background/50 px-2.5 sm:px-3 text-xs font-bold text-foreground hover:bg-muted hover:border-primary/40 active:scale-95 disabled:opacity-50 transition-all shadow-2xs"
                title="Tạo sản phẩm mới"
              >
                <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-themmoi.webp" alt="" className="w-5 h-5 object-contain" />
                <span className="hidden xl:inline">Tạo mới</span>
              </button>
            ) : null}

            {/* Vạch ngăn cách */}
            <div className="h-6 w-px bg-border/60 mx-0.5" />

            {/* Nút HỦY */}
            {handleCancel ? (
              <button
                type="button"
                onClick={handleCancel}
                className="h-9 px-3.5 sm:px-4 rounded-xl border border-border/70 bg-background/50 text-xs font-bold text-foreground hover:bg-muted active:scale-95 transition-all shadow-2xs"
              >
                Hủy
              </button>
            ) : null}

            {/* Nút LƯU & CẬP NHẬT WEBSITE */}
            {onSave ? (
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving || isUploadingImages || disabledActions}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-primary px-4 sm:px-5 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
              >
                {isSaving ? <Spinner className="h-3.5 w-3.5" /> : null}
                <span>
                  {isSaving
                    ? 'Đang lưu...'
                    : isUploadingImages
                      ? 'Đợi upload ảnh'
                      : publishState
                        ? 'Lưu & xuất bản website'
                        : 'Lưu sản phẩm'}
                </span>
              </button>
            ) : null}
          </div>
        </div>

        {/* MOBILE LAYOUT (< md) - Thiết kế tối ưu với menu 3 chấm [ ⋯ ] */}
        <div className="block md:hidden space-y-2.5">
          {/* Row 1: Back + Name + Pager + Dấu 3 chấm [ ⋯ ] */}
          <div className="flex items-center gap-2">
            {handleCancel ? (
              <button
                type="button"
                onClick={handleCancel}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/50 text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-all shadow-2xs"
                title="Về danh sách"
                aria-label="Về danh sách"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.25} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
              </button>
            ) : null}

            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-bold text-foreground truncate">
                {productName || title}
              </h1>
              {positionLabel ? (
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {positionLabel}
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Pager trước / sau */}
              {(previousProduct || nextProduct) ? (
                <div className="flex items-center rounded-xl border border-border/60 bg-background/50 p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={onSelectPreviousProduct}
                    disabled={!previousProduct || disabledActions}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                    title={previousProduct?.name ? `Trước: ${previousProduct.name}` : 'Không có'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.25} stroke="currentColor" className="h-3.5 w-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={onSelectNextProduct}
                    disabled={!nextProduct || disabledActions}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                    title={nextProduct?.name ? `Sau: ${nextProduct.name}` : 'Không có'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.25} stroke="currentColor" className="h-3.5 w-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                </div>
              ) : null}

              {/* Nút Ba Chấm [ ⋯ ] chứa Nổi bật, Hiện web, Tạo mới trên mobile */}
              <div className={`relative ${showMobileMenu ? 'z-50' : ''}`} data-mobile-header-menu>
                <button
                  type="button"
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className={`flex h-8.5 w-8.5 items-center justify-center rounded-xl border transition-all active:scale-95 shadow-2xs shrink-0 ${
                    showMobileMenu
                      ? 'border-primary/50 bg-primary/10 text-primary shadow-xs'
                      : 'border-border/70 bg-background/50 text-muted-foreground hover:text-foreground'
                  }`}
                  title="Tùy chọn: Hiện web, Nổi bật, Tạo mới"
                  aria-label="Tùy chọn thêm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                  </svg>
                </button>

                {showMobileMenu && (
                  <>
                    {/* Invisible Backdrop click catcher */}
                    <div
                      className="fixed inset-0 z-40 bg-transparent"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMobileMenu(false);
                      }}
                    />

                    {/* Dropdown Popover */}
                    <div className="absolute right-0 top-full mt-1.5 w-56 max-w-[calc(100vw-2rem)] rounded-2xl border border-white/80 bg-card/95 backdrop-blur-2xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.3)] z-[60] p-1.5 space-y-1 dark:border-white/10 animate-in fade-in zoom-in-95 duration-100">
                      {/* Toggle Hiển thị web */}
                      {onTogglePublished && (
                        <button
                          type="button"
                          onClick={() => {
                            onTogglePublished();
                            setShowMobileMenu(false);
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-muted/60 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2.5">
                            <img
                              src={isPublished ? 'https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-visible.webp' : 'https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-invisible.webp'}
                              alt=""
                              className="w-4 h-4 object-contain shrink-0"
                            />
                            <span>{isPublished ? 'Ẩn khỏi web' : 'Hiện trên web'}</span>
                          </div>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            isPublished ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'
                          }`}>
                            {isPublished ? 'Đang bật' : 'Đang tắt'}
                          </span>
                        </button>
                      )}

                      {/* Toggle Đánh dấu nổi bật */}
                      {onToggleFeatured && (
                        <button
                          type="button"
                          onClick={() => {
                            onToggleFeatured();
                            setShowMobileMenu(false);
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-muted/60 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2.5">
                            <img
                              src={isFeatured ? 'https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-star.webp' : 'https://thegioitrimun.vn/r2/assets/admin-icons/20260720160138-unstar.webp'}
                              alt=""
                              className="w-4 h-4 object-contain shrink-0"
                            />
                            <span>{isFeatured ? 'Bỏ nổi bật' : 'Đánh dấu nổi bật'}</span>
                          </div>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            isFeatured ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-muted text-muted-foreground'
                          }`}>
                            {isFeatured ? 'Đang bật' : 'Đang tắt'}
                          </span>
                        </button>
                      )}

                      {onCreateNew && (
                        <>
                          <div className="my-1 border-t border-border/50" />
                          <button
                            type="button"
                            onClick={() => {
                              onCreateNew();
                              setShowMobileMenu(false);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-muted/60 transition-colors text-left"
                          >
                            <img
                              src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-themmoi.webp"
                              alt=""
                              className="w-4 h-4 object-contain shrink-0"
                            />
                            <span>Tạo sản phẩm mới</span>
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Autosave time + Nút HỦY & LƯU VÀ CẬP NHẬT TRÊN TOP */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
            {/* Autosave thời gian */}
            <div className="min-w-0">
              {formattedDraftTime ? (
                <span className="text-[11px] text-muted-foreground font-medium truncate">
                  Auto {formattedDraftTime}
                </span>
              ) : null}
            </div>

            {/* Nút Hủy & Lưu */}
            <div className="flex items-center gap-2 shrink-0">
              {handleCancel ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="h-8.5 px-3 rounded-xl border border-border/70 bg-background/50 text-xs font-bold text-foreground hover:bg-muted active:scale-95 transition-all shadow-2xs"
                >
                  Hủy
                </button>
              ) : null}

              {onSave ? (
                <button
                  type="button"
                  onClick={onSave}
                  disabled={isSaving || isUploadingImages || disabledActions}
                  className="inline-flex h-8.5 items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                >
                  {isSaving ? <Spinner className="h-3.5 w-3.5" /> : null}
                  <span>
                    {isSaving
                      ? 'Đang lưu...'
                      : isUploadingImages
                        ? 'Đợi ảnh'
                        : publishState
                          ? 'Lưu & xuất bản'
                          : 'Lưu sản phẩm'}
                  </span>
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Thông báo bản nháp nếu có */}
        {draftState?.hasRestorableDraft ? (
          <div className="mt-3.5 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-900 dark:text-sky-200">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold">Có bản nháp cục bộ chưa áp dụng.</p>
                <p className="text-[11px] opacity-80 mt-0.5">
                  {formattedDraftTime ? `Autosave lúc ${formattedDraftTime}.` : 'Đã tìm thấy bản nháp autosave trên máy này.'}
                  {draftState.note ? ` ${draftState.note}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {draftState.onDiscard ? (
                  <button
                    type="button"
                    onClick={draftState.onDiscard}
                    className="rounded-lg border border-border/60 bg-background/50 px-2.5 py-1 text-xs font-semibold hover:bg-muted transition-all active:scale-95"
                  >
                    Bỏ qua
                  </button>
                ) : null}
                {draftState.onRestore ? (
                  <button
                    type="button"
                    onClick={draftState.onRestore}
                    className="rounded-lg bg-sky-600 px-3 py-1 text-xs font-bold text-white hover:bg-sky-700 transition-all active:scale-95"
                  >
                    Khôi phục
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* 2. Apple Glass Section Navigator & Sticky Status Badges */}
      <div className={`sticky top-2 sm:top-3 flex items-center gap-1.5 overflow-x-auto py-1 px-0.5 mx-1 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${showMobileMenu ? 'z-0 pointer-events-none' : 'z-10'}`}>
        {/* Badge trạng thái đồng bộ */}
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/80 bg-card/85 shadow-xs backdrop-blur-2xl px-2.5 py-1.5 text-xs font-bold transition-all dark:border-white/10 ${
            isSaving
              ? 'text-primary'
              : isDirty
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-emerald-700 dark:text-emerald-400'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isSaving ? 'bg-primary animate-pulse' : isDirty ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
          />
          <span>{isSaving ? 'Đang lưu...' : isDirty ? 'Chưa lưu' : 'Đã đồng bộ'}</span>
        </span>

        {/* Badge / Nút Hiện / Ẩn Web */}
        {onTogglePublished ? (
          <button
            type="button"
            onClick={onTogglePublished}
            disabled={disabledActions}
            className={`inline-flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-all active:scale-95 shadow-xs backdrop-blur-2xl ${
              isPublished
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-white/80 bg-card/85 text-muted-foreground hover:text-foreground dark:border-white/10'
            }`}
            title={isPublished ? 'Đang hiện web (Click để ẩn)' : 'Đang ẩn web (Click để hiện)'}
          >
            <img
              src={isPublished ? 'https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-visible.webp' : 'https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-invisible.webp'}
              alt=""
              className="w-3.5 h-3.5 object-contain shrink-0"
            />
            <span>{isPublished ? 'Hiện web' : 'Ẩn web'}</span>
          </button>
        ) : (
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold shadow-xs backdrop-blur-2xl ${
              isPublished
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-white/80 bg-card/85 text-muted-foreground dark:border-white/10'
            }`}
          >
            <img
              src={isPublished ? 'https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-visible.webp' : 'https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-invisible.webp'}
              alt=""
              className="w-3.5 h-3.5 object-contain shrink-0"
            />
            <span>{isPublished ? 'Hiện web' : 'Ẩn web'}</span>
          </span>
        )}

        {/* Badge / Nút Nổi bật */}
        {isFeatured ? (
          onToggleFeatured ? (
            <button
              type="button"
              onClick={onToggleFeatured}
              disabled={disabledActions}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 transition-all active:scale-95 shadow-xs backdrop-blur-2xl"
              title="Đang nổi bật (Click để bỏ)"
            >
              <img
                src="https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-star.webp"
                alt=""
                className="w-3.5 h-3.5 object-contain shrink-0"
              />
              <span>Nổi bật</span>
            </button>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 shadow-xs backdrop-blur-2xl">
              <img
                src="https://thegioitrimun.vn/r2/assets/admin-icons/20260720152322-star.webp"
                alt=""
                className="w-3.5 h-3.5 object-contain shrink-0"
              />
              <span>Nổi bật</span>
            </span>
          )
        ) : null}

        {/* Divider phân cách giữa nhóm trạng thái và các section navigation */}
        {sections.length > 0 && (
          <div className="h-5 w-px bg-border/60 shrink-0 mx-0.5" />
        )}

        {/* Các liên kết chuyển mục section */}
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/80 bg-card/85 shadow-xs backdrop-blur-2xl px-3 py-1.5 text-xs font-bold text-foreground transition-all hover:bg-muted hover:border-primary/40 active:scale-95 dark:border-white/10"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                section.status === 'complete'
                  ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]'
                  : section.status === 'warning'
                    ? 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.7)]'
                    : 'bg-muted-foreground/40'
              }`}
            />
            <span>{section.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
};

export default ProductEditorHeader;
