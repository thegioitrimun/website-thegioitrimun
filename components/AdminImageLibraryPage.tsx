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
  DocumentDuplicateIcon,
  LoadingIcon,
  SearchIcon,
  TrashIcon,
} from './icons';

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

  const selectedBucket = useMemo(
    () => BUCKET_OPTIONS.find((option) => option.value === bucket) || BUCKET_OPTIONS[0],
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
  }, [addToast, assets, bucket]);

  useEffect(() => {
    setSidebarConfig({
      title: "Hình ảnh",
      description: "Upload icon, ảnh sản phẩm và ảnh nội dung trực tiếp lên Cloudflare R2, rồi dùng lại như một thư viện media nội bộ.",
      icon: <CameraIcon className="h-6 w-6" />,
      eyebrow: "Cloudflare R2",
      insights: [
        { label: 'Bucket', value: selectedBucket.label, hint: selectedBucket.hint },
        { label: 'Folder', value: folder || 'root', hint: 'Thư mục đang duyệt trong bucket.' },
        { label: 'Hiển thị', value: String(filteredAssets.length), hint: 'Số ảnh đang hiện trong lưới.' },
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
      <div className="space-y-5">
        <AnimatedSection className="overflow-hidden rounded-[1.7rem] border border-white/70 bg-card/75 p-4 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl md:p-5 dark:border-white/10">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                <label className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">Bucket</span>
                  <select
                    value={bucket}
                    onChange={(event) => setBucket(event.target.value as PublicImageBucket)}
                    className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground outline-none transition-all focus:border-primary/35"
                  >
                    {BUCKET_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">Thư mục con</span>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={folderDraft}
                      onChange={(event) => setFolderDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleApplyFolder();
                        }
                      }}
                      placeholder="Vi du: admin-icons, banners/home"
                      className="min-w-0 flex-1 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-all focus:border-primary/35"
                    />
                    <button
                      type="button"
                      onClick={handleApplyFolder}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-all hover:opacity-95"
                    >
                      <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-mothumuc.webp" alt="Mở thư mục" className="h-5 w-5 object-contain" />
                      Mở thư mục
                    </button>
                  </div>
                </div>
              </div>

              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">Tìm nhanh trong danh sách</span>
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                  <SearchIcon className="h-5 w-5 text-muted-foreground" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Tên file, thư mục hoặc URL"
                    className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </label>
            </div>

            <div className="min-h-[220px]">
              <ImageDropzone
                multiple
                onFilesSelected={(files) => void handleUpload(files)}
                label="Kéo ảnh vào đây hoặc"
                buttonLabel={isUploading ? 'đang tải lên...' : 'nhấn để chọn ảnh'}
                helpText={`Bucket: ${selectedBucket.label}${folder ? ` • folder: ${folder}` : ' • root bucket'}`}
                selectedFileLabel={isUploading ? 'Đang tải ảnh lên Cloudflare R2...' : null}
                className="h-full"
              />
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection className="overflow-hidden rounded-[1.7rem] border border-white/70 bg-card/75 p-4 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl md:p-5 dark:border-white/10">
          {isLoading ? (
            <div className="flex min-h-[280px] items-center justify-center">
              <LoadingIcon className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex min-h-[250px] flex-col items-center justify-center rounded-[1.45rem] border border-dashed p-6 text-center transition-all border-primary/25 bg-gradient-to-br from-primary/[0.07] via-card/70 to-sky-100/50 dark:to-slate-900/50">
              <CameraIcon className="h-10 w-10 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-black text-foreground">Chưa có ảnh trong vùng đang chọn</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Upload ảnh vào bucket <span className="font-bold text-foreground">{selectedBucket.label}</span>
                {folder ? <> và thư mục <span className="font-bold text-foreground">{folder}</span></> : null}
                . Sau khi tải lên, URL public sẽ dùng lại được ngay trong admin hoặc frontend.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {filteredAssets.map((item) => (
                  <article key={item.key} className="overflow-hidden rounded-[1.35rem] border border-border bg-card shadow-sm">
                    <div className="aspect-[4/3] overflow-hidden bg-muted/20">
                      <img src={item.public_url} alt={item.path} className="h-full w-full object-cover" />
                    </div>
                    <div className="space-y-3 p-4">
                      <div>
                        <p className="line-clamp-1 text-sm font-black text-foreground">{item.path.split('/').pop() || item.path}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.path}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div className="rounded-2xl border-0 bg-transparent px-3 py-2">
                          <p className="font-semibold uppercase tracking-[0.14em]">Dung lượng</p>
                          <p className="mt-1 font-bold text-foreground">{formatBytes(item.size)}</p>
                        </div>
                        <div className="rounded-2xl border-0 bg-transparent px-3 py-2">
                          <p className="font-semibold uppercase tracking-[0.14em]">Cập nhật</p>
                          <p className="mt-1 font-bold text-foreground">{formatDateTime(item.uploaded_at)}</p>
                        </div>
                      </div>

                      {item.usage?.count ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100">
                          <p className="font-bold">Đang dùng tại {item.usage.count} vị trí</p>
                          <p className="mt-1 leading-5">{item.usage.types.join(', ')}</p>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100">
                          Có thể xóa an toàn
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleCopy(item.public_url, 'URL ảnh')}
                          className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-bold text-foreground transition-all hover:border-primary/30 hover:text-primary"
                        >
                          <img src="https://thegioitrimun.vn/r2/assets/admin-icons/1786688261441-dongbocanva.webp" alt="Copy URL" className="h-4 w-4 object-contain" />
                          Copy URL
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCopy(item.path, 'đường dẫn ảnh')}
                          className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-bold text-foreground transition-all hover:border-primary/30 hover:text-primary"
                        >
                          <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-hinhanh.webp" alt="Copy path" className="h-4 w-4 object-contain" />
                          Copy path
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(item.path)}
                          disabled={deletingPath === item.path || Boolean(item.usage?.count)}
                          title={item.usage?.count ? `Ảnh đang dùng tại: ${item.usage.types.join(', ')}` : 'Xóa ảnh'}
                          className="inline-flex items-center gap-2 rounded-full border border-red-200 px-3 py-2 text-xs font-bold text-red-600 transition-all hover:bg-red-50 disabled:opacity-60"
                        >
                          {deletingPath === item.path ? (
                            <LoadingIcon className="h-4 w-4 animate-spin" />
                          ) : (
                            <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="Xóa" className="h-4 w-4 object-contain" />
                          )}
                          Xóa
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {hasMore ? (
                <div className="mt-5 flex justify-center">
                  <button
                    type="button"
                    onClick={() => void loadAssets(cursor)}
                    disabled={isLoadingMore || !cursor}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-bold text-foreground transition-all hover:border-primary/30 hover:text-primary disabled:opacity-60"
                  >
                    {isLoadingMore ? <LoadingIcon className="h-4 w-4 animate-spin" /> : <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-hinhanh.webp" alt="Tải thêm" className="h-4 w-4 object-contain" />}
                    Tải thêm ảnh
                  </button>
                </div>
              ) : null}
            </>
          )}
        </AnimatedSection>
      </div>
    </AnimatedSection>
  );
};

export default AdminImageLibraryPage;
