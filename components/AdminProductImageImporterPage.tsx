import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AnimatedSection from './AnimatedSection';
import { useAdminLayoutDispatch } from './AdminLayoutContext';
import { useToast } from '../hooks/useToast';
import type { AdminNavigationView, Product, ProductImage } from '../types';
import * as api from '../services/api';
import {
  CameraIcon,
  CheckCircleIcon,
  DocumentDuplicateIcon,
  LoadingIcon,
  SearchIcon,
  TrashIcon,
  XCircleIcon,
} from './icons';

type AdminProductImageImporterPageProps = {
  onNavigate: (page: AdminNavigationView) => void;
  onBack: () => void;
};

type SourceFile = {
  key: string;
  file: File;
  relativePath: string;
  extension: string;
  tooLarge: boolean;
};

type MatchStrategy = 'product_id_prefix' | 'folder_slug_exact' | 'file_slug_exact' | 'slug_or_name_contained';

type PlannedImage = SourceFile & {
  hash: string;
  productId: number;
  productSlug: string;
  productName: string;
  strategy: MatchStrategy;
  confidence: number;
  imagePath: string;
  displayOrder: number;
};

type DuplicateImage = Omit<PlannedImage, 'displayOrder'> & {
  reason: 'same_file_already_planned_or_imported';
};

type UnmatchedImage = SourceFile & {
  hash: string;
  reason: 'cannot_match_product';
};

type ImportPlan = {
  createdAt: string;
  products: Product[];
  existingForMatchedProducts: ProductImage[];
  planned: PlannedImage[];
  duplicates: DuplicateImage[];
  unmatched: UnmatchedImage[];
  tooLarge: SourceFile[];
  totals: {
    files: number;
    products: number;
    existingProductImages: number;
    planned: number;
    matchedProducts: number;
    unmatched: number;
    duplicates: number;
    tooLarge: number;
  };
};

type ImportReport = {
  createdAt: string;
  mode: 'append_gallery_only' | 'append_gallery_and_replace_primary';
  totals: ImportPlan['totals'] & {
    uploaded: number;
    inserted: number;
    primaryUpdated: number;
    failed: number;
  };
  imported: Array<Record<string, unknown>>;
  primaryUpdates: Array<Record<string, unknown>>;
  failed: Array<Record<string, unknown>>;
  unmatched: Array<Record<string, unknown>>;
  duplicates: Array<Record<string, unknown>>;
  tooLarge: Array<Record<string, unknown>>;
};

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']);
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

const normalizeText = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

const safeFileBase = (fileName: string) => {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '');
  return normalizeText(withoutExtension) || 'image';
};

const fileExtension = (fileName: string) => {
  const match = fileName.toLowerCase().match(/\.[^.]+$/);
  return match?.[0] || '';
};

const stripFile = (item: SourceFile | PlannedImage | DuplicateImage | UnmatchedImage) => {
  const { file, ...safe } = item;
  return safe;
};

const hashFile = async (file: File) => {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const parseProductIdFromPath = (relativePath: string) => {
  const parts = relativePath.split('/').filter(Boolean);
  const candidates = [...parts, parts[parts.length - 1]];
  for (const candidate of candidates) {
    const match = String(candidate || '').match(/^(\d{1,6})(?:[-_\s]|$)/);
    if (match) return Number(match[1]);
  }
  return null;
};

const downloadJson = (fileName: string, payload: unknown) => {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const timestamp = () => Date.now().toString();

const strategyLabel: Record<MatchStrategy, string> = {
  product_id_prefix: 'ID sản phẩm',
  folder_slug_exact: 'Slug thư mục',
  file_slug_exact: 'Slug tên file',
  slug_or_name_contained: 'Tên hoặc slug',
};

const AdminProductImageImporterPage: React.FC<AdminProductImageImporterPageProps> = ({ onNavigate }) => {
  const setSidebarConfig = useAdminLayoutDispatch();
  const { addToast } = useToast();
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<string[]>([]);

  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ uploaded: 0, inserted: 0, total: 0, failed: 0 });
  const [logs, setLogs] = useState<string[]>(['Chọn thư mục hoặc các file ảnh để bắt đầu.']);
  const [setAsPrimary, setSetAsPrimary] = useState(false);
  const [stopOnFirstError, setStopOnFirstError] = useState(true);
  const [concurrency, setConcurrency] = useState(3);
  const [searchQuery, setSearchQuery] = useState('');
  const [backupPayload, setBackupPayload] = useState<Record<string, unknown> | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  const appendLog = useCallback((message: string) => {
    const time = new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date());
    setLogs((current) => [...current.slice(-99), `[${time}] ${message}`]);
  }, []);

  const revokePreviewUrls = useCallback(() => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current = [];
    setPreviewUrls({});
  }, []);

  useEffect(() => () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const resetResult = useCallback(() => {
    setPlan(null);
    setBackupPayload(null);
    setReport(null);
    setImportProgress({ uploaded: 0, inserted: 0, total: 0, failed: 0 });
    revokePreviewUrls();
  }, [revokePreviewUrls]);

  const addFiles = useCallback((incoming: File[]) => {
    const imageFiles = incoming.filter((file) => IMAGE_EXTENSIONS.has(fileExtension(file.name)));
    if (!imageFiles.length) {
      addToast('Không tìm thấy file ảnh hợp lệ', {
        type: 'info',
        description: 'Hỗ trợ JPG, PNG, WebP, AVIF và GIF.',
      });
      return;
    }

    const paths = imageFiles.map((file) => (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name);
    const firstParts = paths.map((path) => path.split('/')[0]);
    const sharedRoot = paths.every((path) => path.includes('/')) && firstParts.every((part) => part === firstParts[0]);
    const shouldStripRoot = sharedRoot && ['input', 'images', 'anh', 'hinh-anh'].includes(normalizeText(firstParts[0]));
    const next = imageFiles.map((file, index) => {
      const rawPath = paths[index].replace(/\\/g, '/');
      const relativePath = shouldStripRoot ? rawPath.split('/').slice(1).join('/') : rawPath;
      return {
        key: `${relativePath}:${file.size}:${file.lastModified}`,
        file,
        relativePath: relativePath || file.name,
        extension: fileExtension(file.name),
        tooLarge: file.size > MAX_FILE_SIZE_BYTES,
      };
    });

    setSourceFiles((current) => {
      const byKey = new Map(current.map((item) => [item.key, item]));
      next.forEach((item) => byKey.set(item.key, item));
      return [...byKey.values()].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    });
    resetResult();
    setLogs([`Đã nhận ${next.length} file ảnh. Bấm Scan / Dry-run để kiểm tra ghép sản phẩm.`]);
  }, [addToast, resetResult]);

  const handleInputFiles = useCallback((files: FileList | null) => {
    if (files) addFiles(Array.from(files));
  }, [addFiles]);

  const clearFiles = useCallback(() => {
    setSourceFiles([]);
    resetResult();
    setLogs(['Đã xóa danh sách file đang chọn.']);
    if (folderInputRef.current) folderInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [resetResult]);

  const buildPlan = useCallback(async () => {
    if (!sourceFiles.length) {
      addToast('Chưa có ảnh để scan', { type: 'info', description: 'Hãy chọn thư mục hoặc các file ảnh trước.' });
      return;
    }

    setIsScanning(true);
    setReport(null);
    setBackupPayload(null);
    revokePreviewUrls();
    appendLog('Đang tải catalog sản phẩm và gallery hiện tại.');

    try {
      const products = await api.getAllProducts();
      const allImages = products.flatMap((product) => product.images || []);
      const byId = new Map(products.map((product) => [Number(product.id), product]));
      const bySlug = new Map<string, Product>();
      products.forEach((product) => {
        const slugKey = normalizeText(product.slug);
        if (slugKey) bySlug.set(slugKey, product);
      });
      const searchable = products
        .map((product) => ({
          product,
          keys: [normalizeText(product.slug), normalizeText(product.name)].filter(Boolean),
        }))
        .sort((a, b) => Math.max(...b.keys.map((key) => key.length)) - Math.max(...a.keys.map((key) => key.length)));

      const existingPaths = new Set(allImages.map((image) => String(image.image_path || '')).filter(Boolean));
      const nextOrder = new Map<number, number>();
      products.forEach((product) => {
        const maxOrder = (product.images || []).reduce((max, image) => Math.max(max, Number(image.display_order || 0)), 0);
        nextOrder.set(Number(product.id), maxOrder + 1);
      });

      const eligibleFiles = sourceFiles.filter((file) => !file.tooLarge);
      const hashes = new Map<string, string>();
      let cursor = 0;
      setScanProgress({ current: 0, total: eligibleFiles.length });
      const hashWorker = async () => {
        while (cursor < eligibleFiles.length) {
          const index = cursor;
          cursor += 1;
          const item = eligibleFiles[index];
          hashes.set(item.key, await hashFile(item.file));
          setScanProgress((current) => ({ ...current, current: current.current + 1 }));
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, eligibleFiles.length || 1) }, () => hashWorker()));

      const planned: PlannedImage[] = [];
      const duplicates: DuplicateImage[] = [];
      const unmatched: UnmatchedImage[] = [];
      const seenPlannedPaths = new Set<string>();

      for (const source of eligibleFiles) {
        const pathParts = source.relativePath.split('/').filter(Boolean);
        const folder = normalizeText(pathParts.slice(0, -1).join('/'));
        const leafFolder = normalizeText(pathParts.length > 1 ? pathParts[pathParts.length - 2] : '');
        const base = normalizeText(source.file.name.replace(/\.[^.]+$/, ''));
        const combined = normalizeText(`${folder}-${base}`);
        const productId = parseProductIdFromPath(source.relativePath);
        let product: Product | undefined;
        let strategy: MatchStrategy | undefined;
        let confidence = 0;

        if (productId && byId.has(productId)) {
          product = byId.get(productId);
          strategy = 'product_id_prefix';
          confidence = 1;
        } else if (leafFolder && bySlug.has(leafFolder)) {
          product = bySlug.get(leafFolder);
          strategy = 'folder_slug_exact';
          confidence = 0.98;
        } else if (folder && bySlug.has(folder)) {
          product = bySlug.get(folder);
          strategy = 'folder_slug_exact';
          confidence = 0.98;
        } else if (base && bySlug.has(base)) {
          product = bySlug.get(base);
          strategy = 'file_slug_exact';
          confidence = 0.96;
        } else {
          for (const candidate of searchable) {
            const key = candidate.keys.find((value) => value.length >= 12 && combined.includes(value));
            if (!key) continue;
            product = candidate.product;
            strategy = 'slug_or_name_contained';
            confidence = Math.min(0.95, key.length / Math.max(combined.length, key.length));
            break;
          }
        }

        const hash = hashes.get(source.key) || '';
        if (!product || !strategy) {
          unmatched.push({ ...source, hash, reason: 'cannot_match_product' });
          continue;
        }

        const imagePath = `products/${normalizeText(product.slug || product.name || `product-${product.id}`)}/manual-gallery/${hash.slice(0, 12)}-${safeFileBase(source.file.name)}${source.extension}`;
        const matchedBase = {
          ...source,
          hash,
          productId: Number(product.id),
          productSlug: product.slug,
          productName: product.name,
          strategy,
          confidence,
          imagePath,
        };

        if (existingPaths.has(imagePath) || seenPlannedPaths.has(imagePath)) {
          duplicates.push({ ...matchedBase, reason: 'same_file_already_planned_or_imported' });
          continue;
        }

        seenPlannedPaths.add(imagePath);
        const displayOrder = nextOrder.get(Number(product.id)) || 1;
        nextOrder.set(Number(product.id), displayOrder + 1);
        planned.push({ ...matchedBase, displayOrder });
      }

      const matchedIds = new Set(planned.map((item) => item.productId));
      const result: ImportPlan = {
        createdAt: new Date().toISOString(),
        products,
        existingForMatchedProducts: allImages.filter((image) => matchedIds.has(Number(image.product_id))),
        planned,
        duplicates,
        unmatched,
        tooLarge: sourceFiles.filter((file) => file.tooLarge),
        totals: {
          files: sourceFiles.length,
          products: products.length,
          existingProductImages: allImages.length,
          planned: planned.length,
          matchedProducts: matchedIds.size,
          unmatched: unmatched.length,
          duplicates: duplicates.length,
          tooLarge: sourceFiles.filter((file) => file.tooLarge).length,
        },
      };

      setPlan(result);
      const nextPreviewUrls: Record<string, string> = {};
      planned.forEach((item) => {
        const url = URL.createObjectURL(item.file);
        previewUrlsRef.current.push(url);
        nextPreviewUrls[item.key] = url;
      });
      setPreviewUrls(nextPreviewUrls);
      appendLog(`Dry-run xong: ${planned.length} ảnh mới, ${duplicates.length} ảnh trùng, ${unmatched.length} ảnh chưa match.`);
      addToast('Đã hoàn tất dry-run', {
        type: planned.length ? 'success' : 'info',
        description: `${planned.length} ảnh sẵn sàng import vào ${matchedIds.size} sản phẩm.`,
      });
    } catch (error: any) {
      appendLog(`Scan thất bại: ${error?.message || 'Lỗi không xác định'}`);
      addToast('Không thể scan ảnh', { type: 'error', description: error?.message || 'Lỗi không xác định' });
    } finally {
      setIsScanning(false);
    }
  }, [addToast, appendLog, revokePreviewUrls, sourceFiles]);

  const createBackupPayload = useCallback((currentPlan: ImportPlan) => ({
    createdAt: new Date().toISOString(),
    mode: 'append_gallery_only',
    safety: {
      deletesExistingImages: false,
      updatesExistingImages: setAsPrimary,
      setsNewImagesAsPrimary: setAsPrimary,
    },
    existingForMatchedProducts: currentPlan.existingForMatchedProducts,
    planned: currentPlan.planned.map(stripFile),
    unmatched: currentPlan.unmatched.map(stripFile),
    duplicates: currentPlan.duplicates.map(stripFile),
    tooLarge: currentPlan.tooLarge.map(stripFile),
  }), [setAsPrimary]);

  const startImport = useCallback(async () => {
    if (!plan || (!plan.planned.length && !(setAsPrimary && plan.duplicates.length))) {
      addToast('Không có ảnh cần import', { type: 'info', description: 'Hãy chạy dry-run và kiểm tra danh sách trước.' });
      return;
    }

    const backup = createBackupPayload(plan);
    setBackupPayload(backup);
    setReport(null);
    setIsImporting(true);
    setImportProgress({ uploaded: 0, inserted: 0, total: plan.planned.length, failed: 0 });
    appendLog('Đã tạo dữ liệu backup trước import. Bắt đầu tải ảnh lên Cloudflare R2.');

    const uploaded: PlannedImage[] = [];
    const failed: Array<Record<string, unknown>> = [];
    let cursor = 0;
    let stopped = false;

    try {
      const uploadWorker = async () => {
        while (!stopped && cursor < plan.planned.length) {
          const index = cursor;
          cursor += 1;
          const item = plan.planned[index];
          try {
            await api.uploadPublicAssetToR2('product-images', item.imagePath, item.file);
            uploaded.push(item);
            setImportProgress((current) => ({ ...current, uploaded: uploaded.length }));
            if (uploaded.length % 10 === 0 || uploaded.length === plan.planned.length) {
              appendLog(`Đã upload ${uploaded.length}/${plan.planned.length} ảnh.`);
            }
          } catch (error: any) {
            failed.push({ ...stripFile(item), error: error?.message || 'Upload thất bại' });
            setImportProgress((current) => ({ ...current, failed: failed.length }));
            appendLog(`Upload lỗi: ${item.relativePath} - ${error?.message || 'không rõ lỗi'}`);
            if (stopOnFirstError) stopped = true;
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(concurrency, plan.planned.length || 1) }, () => uploadWorker()));

      if (uploaded.length) {
        appendLog(`Đang ghi ${uploaded.length} ảnh vào product_images.`);
        const rows = uploaded.map((item) => ({
          product_id: item.productId,
          image_path: item.imagePath,
          display_order: item.displayOrder,
          is_primary: false,
        }));
        for (let index = 0; index < rows.length; index += 100) {
          const chunk = rows.slice(index, index + 100);
          await api.appendProductGalleryImages(chunk);
          setImportProgress((current) => ({ ...current, inserted: Math.min(index + chunk.length, rows.length) }));
        }
      }

      const primaryByProduct = new Map<number, { product_id: number; image_path: string; source: string }>();
      if (setAsPrimary) {
        [...uploaded]
          .sort((a, b) => a.productId - b.productId || a.displayOrder - b.displayOrder || a.relativePath.localeCompare(b.relativePath))
          .forEach((item) => {
            if (!primaryByProduct.has(item.productId)) {
              primaryByProduct.set(item.productId, { product_id: item.productId, image_path: item.imagePath, source: 'new_upload' });
            }
          });
        [...plan.duplicates]
          .sort((a, b) => a.productId - b.productId || a.relativePath.localeCompare(b.relativePath))
          .forEach((item) => {
            if (!primaryByProduct.has(item.productId)) {
              primaryByProduct.set(item.productId, { product_id: item.productId, image_path: item.imagePath, source: 'existing_duplicate' });
            }
          });

        if (primaryByProduct.size) {
          appendLog(`Đang cập nhật ảnh đại diện cho ${primaryByProduct.size} sản phẩm.`);
          await api.promoteProductGalleryImages([...primaryByProduct.values()]);
        }
      }

      const nextReport: ImportReport = {
        createdAt: new Date().toISOString(),
        mode: setAsPrimary ? 'append_gallery_and_replace_primary' : 'append_gallery_only',
        totals: {
          ...plan.totals,
          uploaded: uploaded.length,
          inserted: uploaded.length,
          primaryUpdated: primaryByProduct.size,
          failed: failed.length,
        },
        imported: uploaded.map(stripFile),
        primaryUpdates: [...primaryByProduct.values()],
        failed,
        unmatched: plan.unmatched.map(stripFile),
        duplicates: plan.duplicates.map(stripFile),
        tooLarge: plan.tooLarge.map(stripFile),
      };
      setReport(nextReport);
      appendLog(`Hoàn tất: ${uploaded.length} ảnh đã thêm, ${primaryByProduct.size} ảnh đại diện đã cập nhật, ${failed.length} lỗi.`);
      addToast('Import ảnh hoàn tất', {
        type: failed.length ? 'info' : 'success',
        description: `${uploaded.length} ảnh đã được thêm vào gallery sản phẩm.`,
      });
    } catch (error: any) {
      appendLog(`Import dừng vì lỗi: ${error?.message || 'Lỗi không xác định'}`);
      addToast('Import ảnh thất bại', { type: 'error', description: error?.message || 'Lỗi không xác định' });
    } finally {
      setIsImporting(false);
    }
  }, [addToast, appendLog, concurrency, createBackupPayload, plan, setAsPrimary, stopOnFirstError]);

  const filteredPreview = useMemo(() => {
    const query = normalizeText(searchQuery);
    if (!plan || !query) return plan?.planned || [];
    return plan.planned.filter((item) => normalizeText(`${item.productName} ${item.relativePath} ${item.imagePath}`).includes(query));
  }, [plan, searchQuery]);

  useEffect(() => {
    setSidebarConfig({
      title: 'Gắn ảnh sản phẩm',
      description: 'Scan tên file, ghép đúng sản phẩm và thêm ảnh vào gallery mà không xóa dữ liệu hiện có.',
      icon: <DocumentDuplicateIcon className="h-6 w-6" />,
      eyebrow: 'Cloudflare R2',
      insights: [
        { label: 'Ảnh đã chọn', value: String(sourceFiles.length), hint: 'JPG, PNG, WebP, AVIF hoặc GIF.' },
        { label: 'Sẵn sàng', value: String(plan?.totals.planned || 0), hint: 'Ảnh mới đã match sau dry-run.' },
        { label: 'Không match', value: String(plan?.totals.unmatched || 0), hint: 'Cần đổi tên file hoặc thư mục.' },
      ],
      taskItems: [],
      actions: (
        <button
          type="button"
          onClick={() => folderInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-card/80 px-4 py-2 text-sm font-bold text-foreground shadow-sm backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:text-primary"
        >
          <CameraIcon className="h-4 w-4" />
          Chọn thư mục
        </button>
      ),
    });
  }, [plan, setSidebarConfig, sourceFiles.length]);

  const isBusy = isScanning || isImporting;
  const importPercent = importProgress.total
    ? Math.round(((importProgress.inserted || importProgress.uploaded) / importProgress.total) * 100)
    : 0;

  return (
    <AnimatedSection stagger={80}>
      <div className="space-y-5">
        <input
          ref={folderInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => handleInputFiles(event.target.files)}
          {...({ webkitdirectory: '', directory: '' } as any)}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => handleInputFiles(event.target.files)}
        />

        <section className="overflow-hidden rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
            <div className="p-4 sm:p-6">
              <div
                onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragging(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  addFiles(Array.from(event.dataTransfer.files));
                }}
                className={`flex min-h-[250px] flex-col items-center justify-center rounded-[1.45rem] border border-dashed p-6 text-center transition-all ${
                  isDragging
                    ? 'border-primary bg-primary/10 shadow-inner'
                    : 'border-primary/25 bg-gradient-to-br from-primary/[0.07] via-card/70 to-sky-100/50 dark:to-slate-900/50'
                }`}
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-white/80 bg-card/90 text-primary shadow-[0_18px_40px_-24px_rgba(20,88,75,0.7)] backdrop-blur-xl">
                  <CameraIcon className="h-8 w-8" />
                </span>
                <h2 className="mt-5 text-xl font-black text-foreground sm:text-2xl">Chọn ảnh cần gắn vào sản phẩm</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  Tên file nên bắt đầu bằng ID sản phẩm hoặc chứa đúng slug/tên sản phẩm. Mỗi ảnh tối đa 15 MB.
                </p>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => folderInputRef.current?.click()}
                    className="rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Chọn cả thư mục
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-full border border-border bg-card/80 px-5 py-3 text-sm font-bold text-foreground transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Chọn file ảnh
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-white/70 bg-background/35 p-4 sm:p-6 xl:border-l xl:border-t-0 dark:border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Phiên làm việc</p>
                  <h3 className="mt-2 text-lg font-black text-foreground">{sourceFiles.length} ảnh đã chọn</h3>
                </div>
                {sourceFiles.length > 0 ? (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={clearFiles}
                    title="Xóa danh sách ảnh"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-all hover:border-red-200 hover:text-red-500 disabled:opacity-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <div className="mt-5 space-y-3">
                <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/70 bg-card/75 px-4 py-3 shadow-sm dark:border-white/10">
                  <span>
                    <span className="block text-sm font-bold text-foreground">Thay ảnh đại diện</span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">Ảnh mới đầu tiên của mỗi sản phẩm.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={setAsPrimary}
                    onChange={(event) => setSetAsPrimary(event.target.checked)}
                    disabled={isBusy}
                    className="h-5 w-5 shrink-0 accent-primary"
                  />
                </label>
                <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/70 bg-card/75 px-4 py-3 shadow-sm dark:border-white/10">
                  <span>
                    <span className="block text-sm font-bold text-foreground">Dừng khi gặp lỗi</span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">Hạn chế import dở dang khi R2 lỗi.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={stopOnFirstError}
                    onChange={(event) => setStopOnFirstError(event.target.checked)}
                    disabled={isBusy}
                    className="h-5 w-5 shrink-0 accent-primary"
                  />
                </label>
                <label className="block rounded-2xl border border-white/70 bg-card/75 px-4 py-3 shadow-sm dark:border-white/10">
                  <span className="text-sm font-bold text-foreground">Số luồng upload</span>
                  <select
                    value={concurrency}
                    onChange={(event) => setConcurrency(Number(event.target.value))}
                    disabled={isBusy}
                    className="mt-2 w-full rounded-xl border border-border bg-background/70 px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-primary/40"
                  >
                    {[1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>{value} luồng</option>)}
                  </select>
                </label>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isBusy || !sourceFiles.length}
                  onClick={() => void buildPlan()}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-card px-4 py-3 text-sm font-bold text-primary transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isScanning ? <LoadingIcon className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />}
                  Dry-run
                </button>
                <button
                  type="button"
                  disabled={isBusy || !plan || (!plan.planned.length && !(setAsPrimary && plan.duplicates.length))}
                  onClick={() => void startImport()}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isImporting ? <LoadingIcon className="h-4 w-4 animate-spin" /> : <CheckCircleIcon className="h-4 w-4" />}
                  Import ảnh
                </button>
              </div>
            </div>
          </div>
        </section>

        {(isScanning || plan) ? (
          <section className="rounded-[1.7rem] border border-white/70 bg-card/75 p-4 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl sm:p-5 dark:border-white/10">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                ['File ảnh', plan?.totals.files ?? sourceFiles.length],
                ['Sẽ import', plan?.totals.planned ?? 0],
                ['Sản phẩm match', plan?.totals.matchedProducts ?? 0],
                ['Không match', plan?.totals.unmatched ?? 0],
                ['Trùng ảnh', plan?.totals.duplicates ?? 0],
              ].map(([label, value], index) => (
                <div key={String(label)} className={`rounded-2xl border border-white/70 bg-background/55 p-4 shadow-sm dark:border-white/10 ${index === 4 ? 'col-span-2 md:col-span-1' : ''}`}>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
                  <p className="mt-2 text-2xl font-black text-foreground">{value}</p>
                </div>
              ))}
            </div>
            {isScanning ? (
              <div className="mt-4">
                <div className="flex items-center justify-between gap-4 text-sm font-semibold text-muted-foreground">
                  <span>Đang đọc và băm nội dung ảnh</span>
                  <span>{scanProgress.current}/{scanProgress.total}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${scanProgress.total ? Math.round((scanProgress.current / scanProgress.total) * 100) : 0}%` }} />
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {isImporting || report ? (
          <section className="overflow-hidden rounded-[1.7rem] border border-white/70 bg-card/75 p-5 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Tiến trình import</p>
                <h2 className="mt-2 text-xl font-black text-foreground">{isImporting ? 'Đang đưa ảnh vào gallery' : 'Đã hoàn tất phiên import'}</h2>
              </div>
              <div className="flex gap-2">
                {backupPayload ? (
                  <button type="button" onClick={() => downloadJson(`before-putimage-${timestamp()}.json`, backupPayload)} className="rounded-full border border-border bg-card/80 px-4 py-2 text-sm font-bold text-foreground hover:text-primary">Tải backup</button>
                ) : null}
                {report ? (
                  <button type="button" onClick={() => downloadJson(`putimage-report-${timestamp()}.json`, report)} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Tải report</button>
                ) : null}
              </div>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-card/80 shadow-inner">
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${importPercent}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-muted-foreground">
              <span>Upload: {importProgress.uploaded}/{importProgress.total}</span>
              <span>Ghi DB: {importProgress.inserted}/{importProgress.total}</span>
              <span>Lỗi: {importProgress.failed}</span>
            </div>
          </section>
        ) : null}

        {plan ? (
          <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.55fr)]">
            <section className="min-w-0 overflow-hidden rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10">
              <div className="flex flex-col gap-4 border-b border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Preview</p>
                  <h2 className="mt-1 text-xl font-black text-foreground">Ảnh sẽ được thêm</h2>
                </div>
                <label className="flex min-w-0 items-center gap-2 rounded-full border border-border bg-background/65 px-4 py-2 sm:w-72">
                  <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Tìm sản phẩm hoặc file" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none" />
                </label>
              </div>
              <div className="max-h-[720px] overflow-y-auto p-3 sm:p-4">
                {filteredPreview.length ? (
                  <div className="space-y-2">
                    {filteredPreview.slice(0, 120).map((item) => (
                      <article key={item.key} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 rounded-2xl border border-border/70 bg-background/55 p-3 sm:grid-cols-[76px_minmax(0,1fr)_auto] sm:items-center">
                        <img src={previewUrls[item.key]} alt="" className="h-16 w-16 rounded-xl border border-white/80 bg-white object-cover shadow-sm sm:h-[76px] sm:w-[76px]" />
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-black text-foreground sm:text-base">{item.productName}</h3>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{item.relativePath}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">display_order {item.displayOrder}</p>
                        </div>
                        <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1 sm:block sm:text-right">
                          <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{strategyLabel[item.strategy]}</span>
                          <p className="text-xs font-semibold text-muted-foreground sm:mt-2">{Math.round(item.confidence * 100)}% khớp</p>
                        </div>
                      </article>
                    ))}
                    {filteredPreview.length > 120 ? <p className="py-3 text-center text-sm text-muted-foreground">Đang hiển thị 120/{filteredPreview.length} ảnh đầu tiên.</p> : null}
                  </div>
                ) : (
                  <div className="flex min-h-40 flex-col items-center justify-center text-center">
                    <DocumentDuplicateIcon className="h-9 w-9 text-muted-foreground" />
                    <p className="mt-3 text-sm font-semibold text-muted-foreground">Không có ảnh phù hợp bộ lọc.</p>
                  </div>
                )}
              </div>
            </section>

            <aside className="space-y-5">
              <section className="rounded-[1.7rem] border border-white/70 bg-card/75 p-4 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl sm:p-5 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><XCircleIcon className="h-5 w-5" /></span>
                  <div>
                    <h2 className="text-lg font-black text-foreground">Cần xử lý</h2>
                    <p className="text-xs text-muted-foreground">Đổi tên rồi chạy dry-run lại.</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {plan.unmatched.slice(0, 30).map((item) => (
                    <div key={item.key} className="rounded-2xl border border-amber-200/70 bg-amber-50/70 px-3 py-2.5 dark:border-amber-500/20 dark:bg-amber-500/10">
                      <p className="break-all text-sm font-bold text-foreground">{item.relativePath}</p>
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Không tìm thấy sản phẩm phù hợp</p>
                    </div>
                  ))}
                  {plan.tooLarge.slice(0, 10).map((item) => (
                    <div key={item.key} className="rounded-2xl border border-red-200/70 bg-red-50/70 px-3 py-2.5 dark:border-red-500/20 dark:bg-red-500/10">
                      <p className="break-all text-sm font-bold text-foreground">{item.relativePath}</p>
                      <p className="mt-1 text-xs text-red-600 dark:text-red-300">File lớn hơn 15 MB</p>
                    </div>
                  ))}
                  {!plan.unmatched.length && !plan.tooLarge.length ? (
                    <div className="flex items-center gap-2 rounded-2xl bg-primary/10 px-3 py-3 text-sm font-bold text-primary"><CheckCircleIcon className="h-5 w-5" /> Tất cả file đều hợp lệ</div>
                  ) : null}
                </div>
              </section>

              <section className="rounded-[1.7rem] border border-white/70 bg-card/75 p-4 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl sm:p-5 dark:border-white/10">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Log</p>
                    <h2 className="mt-1 text-lg font-black text-foreground">Tiến trình</h2>
                  </div>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">{logs.length} dòng</span>
                </div>
                <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-200">{logs.join('\n')}</pre>
              </section>
            </aside>
          </div>
        ) : null}
      </div>
    </AnimatedSection>
  );
};

export default AdminProductImageImporterPage;
