import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdminLayoutDispatch } from './AdminLayoutContext';
import AnimatedSection from './AnimatedSection';
import { ImageDropzone } from './ImageDropzone';
import { useToast } from '../hooks/useToast';
import type { AdminNavigationView } from '../types';
import type { PublicImageAssetRecord, PublicImageBucket } from '../services/api';
import * as api from '../services/api';
import {
  CameraIcon,
  CloseIcon,
  LoadingIcon,
  SearchIcon,
} from './icons';
import { AdminMobileList, AdminMobileCard } from './AdminResponsivePrimitives';

type AdminImageLibraryPageProps = {
  onNavigate: (page: AdminNavigationView) => void;
  onBack: () => void;
};

type BucketOption = {
  value: PublicImageBucket;
  label: string;
  hint: string;
};

const BUCKET_OPTIONS: BucketOption[] = [
  { value: 'assets', label: 'Assets', hint: 'Icon, banner, ảnh dùng chung.' },
  { value: 'product-images', label: 'Ảnh sản phẩm', hint: 'Ảnh gallery và thumb sản phẩm.' },
  { value: 'site-assets', label: 'Site assets', hint: 'Logo, ảnh section, ảnh nội dung site.' },
  { value: 'blog-images', label: 'Ảnh blog', hint: 'Cover và minh hoạ bài viết.' },
  { value: 'avatars', label: 'Avatar', hint: 'Ảnh hồ sơ bác sĩ, người dùng.' },
];

const BUCKET_SUGGESTIONS: Record<PublicImageBucket, string[]> = {
  'assets': ['admin-icons', 'banners', 'home', 'logos'],
  'product-images': ['products', 'manual-gallery'],
  'site-assets': ['sections', 'brands', 'clinic'],
  'blog-images': ['covers', 'articles'],
  'avatars': ['doctors', 'staff'],
};

const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const power = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const result = value / 1024 ** power;
  return `${result >= 10 || power === 0 ? Math.round(result) : result.toFixed(1)} ${units[power]}`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Chưa có dữ liệu';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const slugifyPart = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizeFolder = (value: string) =>
  value
    .split('/')
    .map((part) => slugifyPart(part))
    .filter(Boolean)
    .join('/');

const buildUploadPath = (folder: string, fileName: string) => {
  const lastDot = fileName.lastIndexOf('.');
  const rawName = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  const rawExt = lastDot > 0 ? fileName.slice(lastDot + 1) : '';
  const safeName = slugifyPart(rawName) || 'image';
  const safeExt = slugifyPart(rawExt).toLowerCase();
  const stamp = Date.now().toString();
  const file = safeExt ? `${stamp}-${safeName}.${safeExt}` : `${stamp}-${safeName}`;
  const cleanFolder = normalizeFolder(folder);
  return cleanFolder ? `${cleanFolder}/${file}` : file;
};

const AdminImageLibraryPage: React.FC<AdminImageLibraryPageProps> = ({ onNavigate, onBack }) => {
  const setSidebarConfig = useAdminLayoutDispatch();
  const { addToast } = useToast();
  const [bucket, setBucket] = useState<PublicImageBucket>('assets');
  const [folderDraft, setFolderDraft] = useState('admin-icons');
  const [folder, setFolder] = useState('admin-icons');
  const [searchQuery, setSearchQuery] = useState('');
  const [assets, setAssets] = useState<PublicImageAssetRecord[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);

  // View mode and modal states
  const [showFolderFilter, setShowFolderFilter] = useState(false);
  const [showUploadDropzone, setShowUploadDropzone] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [previewImage, setPreviewImage] = useState<PublicImageAssetRecord | null>(null);

  const selectedBucket = useMemo(
    () => BUCKET_OPTIONS.find((option) => option.value === bucket) || BUCKET_OPTIONS[0],
    [bucket]
  );

  const currentSuggestions = useMemo(
    () => BUCKET_SUGGESTIONS[bucket] || [],
    [bucket]
  );

  const filteredAssets = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return assets;
    return assets.filter((item) =>
      item.path.toLowerCase().includes(keyword) ||
      item.public_url.toLowerCase().includes(keyword)
    );
  }, [assets, searchQuery]);

  const loadAssets = useCallback(async (nextCursor?: string | null) => {
    const append = Boolean(nextCursor);

    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const result = await api.listPublicAssets(bucket, {
        prefix: folder,
        cursor: nextCursor || null,
        limit: 60,
      });

      setAssets((current) => (append ? [...current, ...result.items] : result.items));
      setCursor(result.cursor);
      setHasMore(Boolean(result.truncated && result.cursor));
    } catch (error: any) {
      addToast('Không thể tải thư viện ảnh', {
        type: 'error',
        description: error?.message || 'Lỗi không xác định',
      });
      if (!append) {
        setAssets([]);
        setCursor(null);
        setHasMore(false);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [addToast, bucket, folder]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const handleApplyFolder = useCallback(() => {
    const normalized = normalizeFolder(folderDraft);
    setFolderDraft(normalized);
    if (normalized === folder) {
      void loadAssets();
      return;
    }
    setFolder(normalized);
  }, [folder, folderDraft, loadAssets]);

  const handleUpload = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setIsUploading(true);

    try {
      await Promise.all(
        files.map((file) => {
          const uploadPath = buildUploadPath(folder, file.name);
          return api.uploadPublicAssetToR2(bucket, uploadPath, file);
        })
      );

      addToast('Đã tải ảnh lên Cloudflare R2', {
        type: 'success',
        description: `${files.length} tệp đã được thêm vào thư viện.`,
      });
      setShowUploadDropzone(false);
      await loadAssets();
    } catch (error: any) {
      addToast('Tải ảnh thất bại', {
        type: 'error',
        description: error?.message || 'Không thể tải ảnh lên R2.',
      });
    } finally {
      setIsUploading(false);
    }
  }, [addToast, bucket, folder, loadAssets]);

  const handleCopy = useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      addToast(`Đã copy ${label}`, {
        type: 'success',
        description: value,
      });
    } catch (error: any) {
      addToast(`Không thể copy ${label}`, {
        type: 'error',
        description: error?.message || 'Clipboard bị chặn.',
      });
    }
  }, [addToast]);

  const handleDelete = useCallback(async (path: string) => {
    const asset = assets.find((item) => item.path === path);
    if (asset?.usage?.count) {
      addToast('Ảnh đang được sử dụng', {
        type: 'info',
        description: `Đang được tham chiếu tại: ${asset.usage.types.join(', ')}. Hãy thay ảnh ở các nội dung này trước khi xóa.`,
      });
      return;
    }
    const confirmed = window.confirm(`Xóa ảnh "${path}" khỏi thư viện ${bucket}?`);
    if (!confirmed) return;

    setDeletingPath(path);
    try {
      await api.removePublicAssets(bucket, [path]);
      setAssets((current) => current.filter((item) => item.path !== path));
      if (previewImage?.path === path) {
        setPreviewImage(null);
      }
      addToast('Đã xóa ảnh khỏi thư viện', {
        type: 'success',
        description: path,
      });
    } catch (error: any) {
      addToast('Không thể xóa ảnh', {
        type: 'error',
        description: error?.message || 'Lỗi không xác định',
      });
    } finally {
      setDeletingPath(null);
    }
  }, [addToast, assets, bucket, previewImage?.path]);

  useEffect(() => {
    setSidebarConfig({
      title: "Hình ảnh",
      description: "Upload icon, ảnh sản phẩm và ảnh nội dung trực tiếp lên Cloudflare R2, rồi dùng lại như một thư viện media nội bộ.",
      icon: <CameraIcon className="h-6 w-6" />,
      eyebrow: "Cloudflare R2",
      insights: [
        { label: 'Bucket', value: selectedBucket.label, hint: selectedBucket.hint },
        { label: 'Folder', value: folder || 'root', hint: 'Thư mục đang duyệt trong bucket.' },
        { label: 'Hiển thị', value: String(filteredAssets.length), hint: 'Số ảnh đang hiện trong danh sách.' },
      ],
      actions: (
        <button
          type="button"
          onClick={() => void loadAssets()}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-bold text-foreground transition-all hover:border-primary/30 hover:text-primary"
        >
          {isLoading ? <LoadingIcon className="h-4 w-4 animate-spin" /> : <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786688261441-dongbocanva.webp" alt="Làm mới" className="h-4 w-4 object-contain" />}
          Làm mới
        </button>
      ),
    });
  }, [setSidebarConfig, selectedBucket, folder, filteredAssets.length, loadAssets, isLoading]);

  return (
    <AnimatedSection stagger={100}>
      <div className="space-y-3 sm:space-y-4 -mx-3 sm:mx-0">
        
        {/* CARD 1: Header & Filter Toolbar */}
        <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 sm:p-4 mx-1 sm:mx-0 transition-all relative z-20">
          
          {/* Preset pills row (Buckets) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {BUCKET_OPTIONS.map((opt) => {
              const isActive = bucket === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    if (bucket !== opt.value) {
                      setBucket(opt.value);
                      setFolderDraft('');
                      setFolder('');
                    }
                  }}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'border border-border/60 bg-background/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search bar & action buttons */}
          <div className="mt-2 flex items-center gap-1.5 sm:gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Tìm theo tên file, thư mục hoặc URL..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 rounded-xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground/70 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
              />
              <SearchIcon className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 p-0.5 rounded-full text-muted-foreground hover:text-foreground"
                >
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Folder filter toggle button */}
            <button
              type="button"
              onClick={() => setShowFolderFilter(!showFolderFilter)}
              className={`flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-xl border text-xs font-semibold transition-all shrink-0 active:scale-95 ${
                showFolderFilter || folder
                  ? 'border-primary/50 bg-primary/10 text-primary font-bold shadow-xs'
                  : 'border-border/60 bg-background/40 text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              title="Quản lý thư mục con"
            >
              <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-mothumuc.webp" alt="" className="w-3.5 h-3.5 object-contain" />
              <span className="hidden sm:inline">Thư mục</span>
              {folder ? (
                <span className="flex h-4 max-w-[70px] sm:max-w-[110px] truncate px-1.5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {folder}
                </span>
              ) : null}
            </button>

            {/* Upload toggle button */}
            <button
              type="button"
              onClick={() => setShowUploadDropzone(!showUploadDropzone)}
              className={`flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-xl border text-xs font-semibold transition-all shrink-0 active:scale-95 ${
                showUploadDropzone
                  ? 'border-primary/50 bg-primary/10 text-primary font-bold shadow-xs'
                  : 'border-border/60 bg-background/40 text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              title="Tải ảnh lên R2"
            >
              <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-themmoi.webp" alt="" className="w-3.5 h-3.5 object-contain" />
              <span className="hidden sm:inline">Tải ảnh</span>
            </button>

            {/* Refresh button */}
            <button
              type="button"
              onClick={() => void loadAssets()}
              disabled={isLoading}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/40 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all active:scale-95 shrink-0"
              title="Làm mới thư viện"
            >
              {isLoading ? (
                <LoadingIcon className="w-4 h-4 animate-spin text-primary" />
              ) : (
                <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786688261441-dongbocanva.webp" alt="Làm mới" className="w-4 h-4 object-contain" />
              )}
            </button>
          </div>

          {/* Collapsible Folder row */}
          {showFolderFilter && (
            <div className="mt-2.5 pt-2.5 border-t border-border/40 animate-in fade-in slide-in-from-top-2 duration-150 space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    value={folderDraft}
                    onChange={(e) => setFolderDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyFolder();
                      }
                    }}
                    placeholder="Nhập tên thư mục con (ví dụ: admin-icons, banners)..."
                    className="w-full h-9 rounded-xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] px-3 text-xs text-foreground placeholder:text-muted-foreground/70 focus:ring-1 focus:ring-primary/50 outline-none transition-all font-mono"
                  />
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleApplyFolder}
                    className="h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-mothumuc.webp" alt="" className="w-3.5 h-3.5 object-contain" />
                    <span>Mở thư mục</span>
                  </button>
                  {folder && (
                    <button
                      type="button"
                      onClick={() => {
                        setFolderDraft('');
                        setFolder('');
                      }}
                      className="h-9 px-2.5 rounded-xl border border-border/60 bg-background/40 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                    >
                      Root
                    </button>
                  )}
                </div>
              </div>

              {/* Quick suggestions for current bucket */}
              {currentSuggestions.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[11px] text-muted-foreground font-medium mr-1">Gợi ý thư mục:</span>
                  {currentSuggestions.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => {
                        setFolderDraft(sug);
                        setFolder(sug);
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-mono transition-colors ${
                        folder === sug
                          ? 'bg-primary/15 text-primary font-bold'
                          : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Collapsible Upload Dropzone */}
          {showUploadDropzone && (
            <div className="mt-2.5 pt-2.5 border-t border-border/40 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Tải ảnh lên {selectedBucket.label} {folder ? `(${folder})` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setShowUploadDropzone(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>
              <ImageDropzone
                multiple
                onFilesSelected={(files) => void handleUpload(files)}
                label="Kéo thả ảnh vào đây hoặc"
                buttonLabel={isUploading ? 'đang tải lên...' : 'nhấn để chọn ảnh'}
                helpText={`Bucket: ${selectedBucket.label}${folder ? ` • Thư mục: ${folder}` : ' • root bucket'}`}
                selectedFileLabel={isUploading ? 'Đang tải ảnh lên Cloudflare R2...' : null}
                className="min-h-[140px]"
              />
            </div>
          )}
        </div>

        {/* CARD 2: Apple Glass Container for Image Library */}
        <div className="overflow-hidden rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
          
          {/* Top Bar (Selection / Info Bar) */}
          <div className="border-b border-border/50 px-3 py-2.5 sm:px-5 sm:py-3 bg-muted/10 backdrop-blur-md flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-foreground">
                {selectedBucket.label}
                {folder && <span className="text-muted-foreground font-normal ml-1 font-mono">/ {folder}</span>}
              </span>
              <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-bold">
                {filteredAssets.length} ảnh
              </span>
            </div>

            {/* Desktop View Switcher */}
            <div className="hidden lg:flex items-center gap-1 bg-muted/20 p-0.5 rounded-xl border border-border/40">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'table'
                    ? 'bg-card text-foreground shadow-xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Xem dạng bảng"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
                <span>Bảng</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-card text-foreground shadow-xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Xem dạng lưới"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                </svg>
                <span>Lưới</span>
              </button>
            </div>
          </div>

          {/* Loading state */}
          {isLoading ? (
            <div className="flex min-h-[260px] items-center justify-center">
              <LoadingIcon className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredAssets.length === 0 ? (
            /* Empty State */
            <div className="p-6 sm:p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/30 border border-border/50">
                <CameraIcon className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="mt-3 text-base font-bold text-foreground">Chưa có ảnh trong vùng đang chọn</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
                Thư mục <span className="font-mono text-foreground font-semibold">{folder || 'root'}</span> trong bucket <span className="font-semibold text-foreground">{selectedBucket.label}</span> chưa có hình ảnh nào.
              </p>
              <button
                type="button"
                onClick={() => setShowUploadDropzone(true)}
                className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:bg-primary/90 transition-all active:scale-95"
              >
                <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-themmoi.webp" alt="" className="w-4 h-4 object-contain" />
                <span>Tải ảnh ngay</span>
              </button>
            </div>
          ) : (
            <>
              {/* MOBILE LIST: Compact, Elegant Rows (< 1024px) */}
              <AdminMobileList className="p-0 divide-y divide-border/25">
                {filteredAssets.map((item) => {
                  const fileName = item.path.split('/').pop() || item.path;
                  return (
                    <AdminMobileCard key={item.key} className="px-3 py-2.5 sm:p-3.5 transition-colors hover:bg-muted/20">
                      <div className="flex items-start gap-2.5 sm:gap-3">
                        {/* Thumbnail */}
                        <div
                          className="relative shrink-0 cursor-pointer group/thumb"
                          onClick={() => setPreviewImage(item)}
                          title="Nhấn để phóng to ảnh"
                        >
                          <img
                            src={item.public_url}
                            alt={item.path}
                            className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl sm:rounded-2xl border border-border/70 bg-card/60 backdrop-blur-xl object-cover shadow-xs transition-transform group-hover/thumb:scale-105"
                            loading="lazy"
                          />
                        </div>

                        {/* Meta & Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-1.5">
                            <p
                              className="line-clamp-1 text-xs sm:text-sm font-bold text-foreground leading-snug cursor-pointer hover:text-primary transition-colors"
                              onClick={() => setPreviewImage(item)}
                              title={fileName}
                            >
                              {fileName}
                            </p>
                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={() => void handleDelete(item.path)}
                              disabled={deletingPath === item.path || Boolean(item.usage?.count)}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card/50 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-95 disabled:opacity-30"
                              title={item.usage?.count ? `Ảnh đang dùng tại: ${item.usage.types.join(', ')}` : 'Xóa ảnh'}
                            >
                              {deletingPath === item.path ? (
                                <LoadingIcon className="h-3.5 w-3.5 animate-spin text-primary" />
                              ) : (
                                <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="Xóa" className="h-4 w-4 object-contain" />
                              )}
                            </button>
                          </div>

                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground font-mono">
                            {item.path}
                          </p>

                          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-1">
                            <span className="text-[11px] font-semibold text-foreground">
                              {formatBytes(item.size)}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {formatDateTime(item.uploaded_at)}
                            </span>
                          </div>

                          {/* Footer Row: Status badge & Action buttons */}
                          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 border-t border-border/25 pt-1.5">
                            <div>
                              {item.usage?.count ? (
                                <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                  {item.usage.count} vị trí
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  An toàn
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => void handleCopy(item.public_url, 'URL ảnh')}
                                className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-card/60 px-2 py-1 text-[10px] font-bold text-foreground hover:bg-muted transition-all active:scale-95"
                              >
                                <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786688261441-dongbocanva.webp" alt="" className="h-3 w-3 object-contain" />
                                URL
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleCopy(item.path, 'đường dẫn')}
                                className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-card/60 px-2 py-1 text-[10px] font-bold text-foreground hover:bg-muted transition-all active:scale-95"
                              >
                                <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-hinhanh.webp" alt="" className="h-3 w-3 object-contain" />
                                Path
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </AdminMobileCard>
                  );
                })}
              </AdminMobileList>

              {/* DESKTOP TABLE VIEW: Clean table view matching AdminPharmacyManagementPage */}
              {viewMode === 'table' ? (
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full table-fixed text-left text-sm">
                    <thead className="bg-muted/50 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      <tr>
                        <th className="w-16 px-4 py-3 text-center font-semibold">Ảnh</th>
                        <th className="w-[38%] px-4 py-3 font-semibold">Tên & Đường dẫn</th>
                        <th className="w-[14%] px-4 py-3 font-semibold">Dung lượng</th>
                        <th className="w-[18%] px-4 py-3 font-semibold">Cập nhật</th>
                        <th className="w-[14%] px-4 py-3 font-semibold">Trạng thái</th>
                        <th className="w-[16%] px-4 py-3 font-semibold text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredAssets.map((item) => {
                        const fileName = item.path.split('/').pop() || item.path;
                        return (
                          <tr key={item.key} className="align-middle transition-colors hover:bg-muted/20">
                            {/* Thumbnail with hover zoom */}
                            <td className="px-4 py-3 text-center">
                              <div className="group/img-preview relative inline-block">
                                <img
                                  src={item.public_url}
                                  alt={fileName}
                                  className="h-11 w-11 shrink-0 rounded-xl border border-border/80 bg-muted/20 object-cover shadow-xs transition-all duration-200 group-hover/img-preview:scale-105 group-hover/img-preview:border-primary/60 group-hover/img-preview:shadow-md cursor-pointer"
                                  onClick={() => setPreviewImage(item)}
                                  loading="lazy"
                                />
                                {/* Big preview hover popover */}
                                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3.5 z-[100] hidden group-hover/img-preview:block w-[220px] rounded-2xl border border-border/80 bg-popover p-2 shadow-2xl transition-all animate-in fade-in zoom-in-95">
                                  <img
                                    src={item.public_url}
                                    alt=""
                                    className="h-44 w-44 rounded-xl object-contain bg-muted/40 border border-border/40 mx-auto block"
                                  />
                                  <p className="mt-1.5 truncate text-[11px] font-bold text-center text-foreground px-1">
                                    {fileName}
                                  </p>
                                  <p className="text-[10px] text-center text-muted-foreground">
                                    {formatBytes(item.size)}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* File Name & Path */}
                            <td className="px-4 py-3">
                              <p
                                className="font-bold text-foreground truncate text-sm hover:text-primary cursor-pointer transition-colors"
                                onClick={() => setPreviewImage(item)}
                                title={fileName}
                              >
                                {fileName}
                              </p>
                              <p className="text-xs text-muted-foreground truncate font-mono mt-0.5" title={item.path}>
                                {item.path}
                              </p>
                            </td>

                            {/* Size */}
                            <td className="px-4 py-3 text-xs font-semibold text-foreground">
                              {formatBytes(item.size)}
                            </td>

                            {/* Date */}
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {formatDateTime(item.uploaded_at)}
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3">
                              {item.usage?.count ? (
                                <span
                                  className="inline-flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
                                  title={`Đang được dùng tại: ${item.usage.types.join(', ')}`}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                  {item.usage.count} vị trí
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  An toàn
                                </span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Copy URL */}
                                <div className="relative group inline-flex">
                                  <button
                                    type="button"
                                    onClick={() => void handleCopy(item.public_url, 'URL ảnh')}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl transition-all hover:scale-110 hover:bg-card/60 active:scale-95 text-muted-foreground hover:text-foreground"
                                    aria-label="Copy URL ảnh"
                                  >
                                    <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786688261441-dongbocanva.webp" alt="Copy URL" className="h-5 w-5 object-contain" />
                                  </button>
                                  <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                    Copy URL
                                  </span>
                                </div>

                                {/* Copy Path */}
                                <div className="relative group inline-flex">
                                  <button
                                    type="button"
                                    onClick={() => void handleCopy(item.path, 'đường dẫn ảnh')}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl transition-all hover:scale-110 hover:bg-card/60 active:scale-95 text-muted-foreground hover:text-foreground"
                                    aria-label="Copy đường dẫn"
                                  >
                                    <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-hinhanh.webp" alt="Copy path" className="h-5 w-5 object-contain" />
                                  </button>
                                  <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                    Copy Path
                                  </span>
                                </div>

                                {/* Delete */}
                                <div className="relative group inline-flex">
                                  <button
                                    type="button"
                                    onClick={() => void handleDelete(item.path)}
                                    disabled={deletingPath === item.path || Boolean(item.usage?.count)}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl transition-all hover:scale-110 hover:bg-card/60 active:scale-95 text-muted-foreground hover:text-rose-600 disabled:opacity-30"
                                    aria-label="Xóa ảnh"
                                  >
                                    {deletingPath === item.path ? (
                                      <LoadingIcon className="h-4 w-4 animate-spin text-primary" />
                                    ) : (
                                      <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="Xóa" className="h-5 w-5 object-contain" />
                                    )}
                                  </button>
                                  <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                    {item.usage?.count ? 'Đang được dùng' : 'Xóa ảnh'}
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* DESKTOP GRID VIEW (when user toggles to Grid) */
                <div className="hidden lg:grid gap-3.5 p-4 sm:p-5 grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {filteredAssets.map((item) => {
                    const fileName = item.path.split('/').pop() || item.path;
                    return (
                      <article key={item.key} className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl shadow-sm hover:shadow-md transition-all group flex flex-col">
                        <div
                          className="aspect-[4/3] overflow-hidden bg-muted/20 relative cursor-pointer"
                          onClick={() => setPreviewImage(item)}
                        >
                          <img src={item.public_url} alt={fileName} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                          {item.usage?.count ? (
                            <span className="absolute top-2 left-2 rounded-md bg-amber-500/90 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                              {item.usage.count} vị trí
                            </span>
                          ) : null}
                        </div>
                        <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                          <div>
                            <p className="line-clamp-1 text-xs font-bold text-foreground" title={fileName}>{fileName}</p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">{formatBytes(item.size)} • {formatDateTime(item.uploaded_at)}</p>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-border/30">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => void handleCopy(item.public_url, 'URL')}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                                title="Copy URL"
                              >
                                <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786688261441-dongbocanva.webp" alt="" className="w-3.5 h-3.5 object-contain" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleCopy(item.path, 'Path')}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                                title="Copy Path"
                              >
                                <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-hinhanh.webp" alt="" className="w-3.5 h-3.5 object-contain" />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleDelete(item.path)}
                              disabled={deletingPath === item.path || Boolean(item.usage?.count)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50/50 transition-colors disabled:opacity-30"
                              title="Xóa"
                            >
                              <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="" className="w-3.5 h-3.5 object-contain" />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Load More Button outside the card */}
        {hasMore && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => void loadAssets(cursor)}
              disabled={isLoadingMore || !cursor}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/85 backdrop-blur-xl px-5 py-2.5 text-xs font-bold text-foreground transition-all hover:border-primary/40 hover:text-primary shadow-xs active:scale-95 disabled:opacity-50"
            >
              {isLoadingMore ? (
                <LoadingIcon className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-hinhanh.webp" alt="" className="h-4 w-4 object-contain" />
              )}
              Tải thêm ảnh ({filteredAssets.length} đã tải)
            </button>
          </div>
        )}

        {/* Image Preview Modal */}
        {previewImage && (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-150"
            onClick={() => setPreviewImage(null)}
          >
            <div
              className="relative max-w-2xl w-full rounded-2xl sm:rounded-3xl border border-white/80 bg-card/95 shadow-2xl p-4 sm:p-6 backdrop-blur-2xl dark:border-white/10 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div className="min-w-0 flex-1 pr-2">
                  <h3 className="font-bold text-sm sm:text-base text-foreground truncate">
                    {previewImage.path.split('/').pop()}
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                    {previewImage.path}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="p-1.5 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 flex items-center justify-center bg-muted/20 rounded-2xl p-2 border border-border/40 min-h-[220px] max-h-[55vh] overflow-hidden">
                <img
                  src={previewImage.public_url}
                  alt={previewImage.path}
                  className="max-h-[50vh] max-w-full object-contain rounded-xl"
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs">
                <span className="text-muted-foreground">
                  Dung lượng: <strong className="text-foreground">{formatBytes(previewImage.size)}</strong> • Cập nhật: <strong className="text-foreground">{formatDateTime(previewImage.uploaded_at)}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopy(previewImage.public_url, 'URL ảnh')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground font-bold active:scale-95 transition-all shadow-xs"
                  >
                    <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786688261441-dongbocanva.webp" alt="" className="w-3.5 h-3.5 object-contain" />
                    Copy URL
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopy(previewImage.path, 'đường dẫn')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-foreground font-semibold hover:bg-muted active:scale-95 transition-all"
                  >
                    <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-hinhanh.webp" alt="" className="w-3.5 h-3.5 object-contain" />
                    Copy Path
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AnimatedSection>
  );
};

export default AdminImageLibraryPage;
