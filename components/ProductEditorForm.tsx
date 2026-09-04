import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Product,
  ProductBrand,
  ProductCategory,
  ProductContentBlock,
  ProductContentReviewRecord,
  ProductContentReviewStatus,
  ProductImage,
} from '../types';
import { ArrowLeftIcon, ArrowRightIcon, PlusCircleIcon } from './icons';
import ProductEditorHeader from './ProductEditorHeader';
import ProductMainForm from './ProductMainForm';
import ProductMetaPanel from './ProductMetaPanel';
import InventoryPanel from './InventoryPanel';
import ProductContentReviewPanel from './ProductContentReviewPanel';
import * as api from '../services/api';
import { useToast } from '../hooks/useToast';
import useAdminLocalDraft from '../hooks/useAdminLocalDraft';
import { useTranslation } from 'react-i18next';
import { normalizeDetailFaqItems, sanitizeDetailFaqItems } from '../src/detailFaq';
import { buildProductContentImagePath } from '../src/imageSeo';
import type { ProductEditorSection, TempContentBlock, UnifiedImage } from '../src/productEditorTypes';
import { auditProductContent, resolveProductContentReview } from '../src/productContentReview';

interface ProductEditorFormProps {
  product: Partial<Product> | null;
  categories: ProductCategory[];
  brands: ProductBrand[];
  onSave: (product: Partial<Product>, imagesToDelete: ProductImage[]) => Promise<Product>;
  onCancel: () => void;
  onCreateNewProduct?: () => void;
  previousProduct?: Pick<Product, 'id' | 'name'> | null;
  nextProduct?: Pick<Product, 'id' | 'name'> | null;
  onSelectPreviousProduct?: () => void;
  onSelectNextProduct?: () => void;
  productPositionLabel?: string | null;
}

const DEFAULT_PRODUCT_VAT_RATE = 0.1;

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

const vatRateToPercentInput = (value?: number | null): string => {
  const numeric = Number(value ?? DEFAULT_PRODUCT_VAT_RATE);
  if (!Number.isFinite(numeric)) return '10';
  const percent = Math.round(numeric * 10000) / 100;
  return String(percent).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
};

const generateSlug = (title: string) =>
  title.toLowerCase().replace(/đ/g, 'd').replace(/ /g, '-').replace(/[^\w-]+/g, '');

const ProductEditorForm: React.FC<ProductEditorFormProps> = ({
  product,
  categories,
  brands,
  onSave,
  onCancel,
  onCreateNewProduct,
  previousProduct = null,
  nextProduct = null,
  onSelectPreviousProduct,
  onSelectNextProduct,
  productPositionLabel = null,
}) => {
  const { t } = useTranslation();
  const { addToast } = useToast();

  const formRef = useRef<HTMLFormElement>(null);
  const draggedItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const [formData, setFormData] = useState<Partial<Product>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageList, setImageList] = useState<UnifiedImage[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<ProductImage[]>([]);
  const [contentBlocks, setContentBlocks] = useState<TempContentBlock[]>([]);
  const [keyBenefitsText, setKeyBenefitsText] = useState('');
  const [skinTypesText, setSkinTypesText] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [contentReviewRecord, setContentReviewRecord] = useState<ProductContentReviewRecord | null>(null);
  const [contentReviewNotes, setContentReviewNotes] = useState('');
  const [isLoadingContentReview, setIsLoadingContentReview] = useState(false);
  const [isSavingContentReview, setIsSavingContentReview] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({ ...product, faq_items: normalizeDetailFaqItems(product.faq_items) });
      setKeyBenefitsText((product.key_benefits || []).join('\n'));
      setSkinTypesText((product.skin_types || []).join('\n'));
      setImageList(
        (product.images || []).map((image) => ({
          id: image.id,
          type: 'existing',
          previewUrl: image.image_url || '',
          originalImage: image,
          uploadStatus: 'completed',
          image_path: image.image_path,
        })),
      );
      setContentBlocks(
        (product.long_description || []).map((block) => ({
          ...block,
          id: Math.random().toString(),
        })),
      );
    } else {
      setFormData({
        name: '',
        slug: '',
        description: '',
        price: 0,
        stock_quantity: 0,
        is_published: false,
        category_id: categories[0]?.id,
        images: [],
        sku: '',
        brand: '',
        low_stock_threshold: 5,
        expiry_date: '',
        long_description: [],
        vat_rate: DEFAULT_PRODUCT_VAT_RATE,
        faq_items: [],
      });
      setKeyBenefitsText('');
      setSkinTypesText('');
      setImageList([]);
      setContentBlocks([]);
    }

    setImagesToDelete([]);
    setHasUnsavedChanges(false);
  }, [product, categories]);

  useEffect(() => {
    let isCancelled = false;
    const currentProductId = Number(product?.id || 0);

    setContentReviewRecord(null);
    setContentReviewNotes('');

    if (!currentProductId) {
      setIsLoadingContentReview(false);
      return undefined;
    }

    setIsLoadingContentReview(true);
    void api.getAdminProductContentReviews([currentProductId])
      .then((records) => {
        if (isCancelled) return;
        const nextRecord = records[0] || null;
        setContentReviewRecord(nextRecord);
        setContentReviewNotes(nextRecord?.review_notes || nextRecord?.rewrite_brief || '');
      })
      .catch((error) => {
        if (isCancelled) return;
        console.warn('Could not load product content review record:', error);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingContentReview(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [product?.id]);

  useEffect(() => {
    if (!product && formData.name) {
      setFormData((prev) => ({ ...prev, slug: generateSlug(prev.name || '') }));
    }
  }, [formData.name, product]);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, key_benefits: keyBenefitsText.split('\n').filter((item) => item.trim() !== '') }));
  }, [keyBenefitsText]);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, skin_types: skinTypesText.split('\n').filter((item) => item.trim() !== '') }));
  }, [skinTypesText]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const markDirty = () => setHasUnsavedChanges(true);

  const currentProductId = Number(formData.id || product?.id || 0) || undefined;

  const normalizedLongDescription = useMemo<ProductContentBlock[]>(
    () =>
      contentBlocks.map((block) => {
        if (block.type === 'image') {
          return {
            type: 'image',
            image_path: block.image_path || '',
            image_url: block.image_url,
            caption: block.caption || '',
          } satisfies ProductContentBlock;
        }
        return { type: 'text', content: block.content || '' } satisfies ProductContentBlock;
      }),
    [contentBlocks],
  );

  const contentAuditSource = useMemo<Partial<Product>>(
    () => ({
      ...formData,
      key_benefits: keyBenefitsText.split('\n').filter((item) => item.trim() !== ''),
      skin_types: skinTypesText.split('\n').filter((item) => item.trim() !== ''),
      faq_items: sanitizeDetailFaqItems(formData.faq_items),
      long_description: normalizedLongDescription,
    }),
    [formData, keyBenefitsText, normalizedLongDescription, skinTypesText],
  );

  const contentAudit = useMemo(() => auditProductContent(contentAuditSource), [contentAuditSource]);
  const contentReview = useMemo(
    () => resolveProductContentReview(contentReviewRecord, contentAudit),
    [contentAudit, contentReviewRecord],
  );

  const handleCancelRequest = () => {
    if (hasUnsavedChanges && !window.confirm('Bạn có thay đổi chưa lưu. Rời editor sẽ mất các thay đổi này. Tiếp tục?')) {
      return;
    }
    onCancel();
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = event.target;
    let finalValue: string | number | boolean | null = value;

    if (type === 'number') {
      finalValue = value === '' ? null : parseFloat(value);
    }

    if (type === 'checkbox') {
      const nextChecked = (event.target as HTMLInputElement).checked;
      finalValue = nextChecked;
    }

    markDirty();
    setFormData((prev) => ({ ...prev, [name]: finalValue }));
  };

  const handleVatRatePercentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;

    if (value === '') {
      markDirty();
      setFormData((prev) => ({ ...prev, vat_rate: DEFAULT_PRODUCT_VAT_RATE }));
      return;
    }

    const percent = Number(value);
    if (!Number.isFinite(percent)) return;

    markDirty();
    setFormData((prev) => ({
      ...prev,
      vat_rate: Math.min(1, Math.max(0, percent / 100)),
    }));
  };

  const handleTogglePublished = () => {
    markDirty();
    setFormData((prev) => ({ ...prev, is_published: !prev.is_published }));
  };

  const handleToggleFeatured = () => {
    markDirty();
    setFormData((prev) => ({ ...prev, is_featured: !prev.is_featured }));
  };

  const handleGenerateDetails = async () => {
    if (!formData.name) {
      addToast(t('product_form.alert_empty_name', 'Vui lòng nhập tên sản phẩm'), { type: 'error' });
      return;
    }

    setIsGenerating(true);
    addToast(t('product_form.alert_generating', 'AI đang tạo thông tin...'), {
      type: 'info',
      description: t('product_form.alert_generating_desc', 'Quá trình này có thể mất vài giây.'),
    });

    try {
      const details = await api.generateProductDetailsFromAI(formData.name, categories);
      const generatedFaqItems = normalizeDetailFaqItems(details.faq_items);

      setFormData((prev) => ({
        ...prev,
        slug: prev.slug || generateSlug(formData.name || ''),
        description: details.description || '',
        price: details.price || 0,
        stock_quantity: details.stock_quantity || 10,
        usage_instructions: details.usage_instructions || '',
        ingredients: details.ingredients || '',
        key_benefits: details.key_benefits || [],
        skin_types: details.skin_types || [],
        volume: details.volume || '',
        texture: details.texture || '',
        origin: details.origin || '',
        brand: brands.find((brand) => brand.name.toLowerCase() === details.brand?.toLowerCase() || brand.slug === details.brand)?.name || details.brand || '',
        precautions: details.precautions || '',
        faq_items: generatedFaqItems.length > 0 ? generatedFaqItems : normalizeDetailFaqItems(prev.faq_items),
        category_id: categories.find((category) => category.slug === details.category_slug)?.id || prev.category_id,
      }));

      setContentBlocks([{ type: 'text', content: details.long_description || '', id: Math.random().toString() }]);
      setKeyBenefitsText((details.key_benefits || []).join('\n'));
      setSkinTypesText((details.skin_types || []).join('\n'));
      setHasUnsavedChanges(true);

      addToast(t('product_form.alert_generate_success', 'Tạo thông tin thành công!'), {
        type: 'success',
        description: t('product_form.alert_check_again', 'Vui lòng kiểm tra lại trước khi lưu.'),
      });
    } catch (error: any) {
      addToast(t('product_form.alert_generate_error', 'Lỗi tạo tự động'), {
        type: 'error',
        description: error.message,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImageFilesSelected = (files: File[]) => {
    const newImages: UnifiedImage[] = files.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      type: 'new',
      file,
      previewUrl: URL.createObjectURL(file),
      uploadStatus: 'uploading',
    }));

    markDirty();
    setImageList((prev) => [...prev, ...newImages]);
    newImages.forEach((image, index) => uploadFile(image.id, image.file!, imageList.length + index));
  };

  const uploadFile = async (imageId: string | number, file: File, imageIndexHint?: number) => {
    try {
      const { image_path } = await api.uploadSingleProductImage(file, {
        productSlug: formData.slug,
        productName: formData.name,
        imageIndex: imageIndexHint,
        suffix: String(imageId),
      });

      setImageList((prev) =>
        prev.map((image) =>
          image.id === imageId
            ? { ...image, uploadStatus: 'completed', image_path }
            : image,
        ),
      );
    } catch (error) {
      console.error('Upload failed for', file.name, error);
      setImageList((prev) =>
        prev.map((image) =>
          image.id === imageId
            ? { ...image, uploadStatus: 'error' }
            : image,
        ),
      );

      const message = error instanceof Error ? error.message : t('product_form.upload_fail', 'Tải lên thất bại');
      addToast(t('product_form.upload_fail', 'Tải lên thất bại'), {
        type: 'error',
        description: `${file.name}: ${message}`,
      });
    }
  };

  const handleDeleteImage = (idToDelete: number | string) => {
    const imageToDelete = imageList.find((image) => image.id === idToDelete);
    if (!imageToDelete) return;

    if (imageToDelete.type === 'existing' && imageToDelete.originalImage) {
      setImagesToDelete((prev) => [...prev, imageToDelete.originalImage!]);
    } else {
      URL.revokeObjectURL(imageToDelete.previewUrl);
    }

    markDirty();
    setImageList((prev) => prev.filter((image) => image.id !== idToDelete));
  };

  const handleMakePrimaryImage = (idToPromote: number | string) => {
    setImageList((prev) => {
      const targetIndex = prev.findIndex((image) => image.id === idToPromote);
      if (targetIndex <= 0) return prev;
      const next = [...prev];
      const [image] = next.splice(targetIndex, 1);
      next.unshift(image);
      return next;
    });
    markDirty();
  };

  const handleDragStart = (_event: React.DragEvent, position: number) => {
    draggedItem.current = position;
  };

  const handleDragEnter = (_event: React.DragEvent, position: number) => {
    dragOverItem.current = position;
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    if (draggedItem.current === null || dragOverItem.current === null) return;

    const next = [...imageList];
    const draggedImage = next[draggedItem.current];
    next.splice(draggedItem.current, 1);
    next.splice(dragOverItem.current, 0, draggedImage);

    draggedItem.current = null;
    dragOverItem.current = null;

    markDirty();
    setImageList(next);
  };

  const addContentBlock = (type: 'text' | 'image') => {
    const newBlock: TempContentBlock =
      type === 'text'
        ? { id: Math.random().toString(), type: 'text', content: '' }
        : { id: Math.random().toString(), type: 'image', image_path: '', caption: '' };
    markDirty();
    setContentBlocks((prev) => [...prev, newBlock]);
  };

  const updateContentBlock = (id: string, nextBlock: Partial<TempContentBlock>) => {
    markDirty();
    setContentBlocks((prev) => prev.map((block) => (block.id === id ? { ...block, ...nextBlock } : block)));
  };

  const handleContentImageSelected = (id: string, files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    const previewUrl = URL.createObjectURL(file);
    markDirty();
    updateContentBlock(id, { image_url: previewUrl, file });
  };

  const removeContentBlock = (id: string) => {
    markDirty();
    setContentBlocks((prev) => prev.filter((block) => block.id !== id));
  };

  const isAnyImageUploading = useMemo(() => imageList.some((image) => image.uploadStatus === 'uploading'), [imageList]);

  const selectedCategoryLabel = useMemo(
    () => categories.find((category) => category.id === formData.category_id)?.name || 'Chưa chọn chuyên mục',
    [categories, formData.category_id],
  );

  const selectedBrandLabel = useMemo(() => {
    if (!formData.brand) return 'Chưa gắn thương hiệu';
    return brands.find((brand) => brand.name === formData.brand)?.name || formData.brand;
  }, [brands, formData.brand]);

  const readyImagesCount = useMemo(
    () => imageList.filter((image) => image.uploadStatus === 'completed').length,
    [imageList],
  );

  const contentBlockSummary = useMemo(
    () => ({
      textBlocks: contentBlocks.filter((block) => block.type === 'text').length,
      imageBlocks: contentBlocks.filter((block) => block.type === 'image').length,
    }),
    [contentBlocks],
  );

  const primaryImagePreview = imageList[0]?.previewUrl || null;

  const draftStorageKey = useMemo(
    () => `admin-editor-draft:product:${product?.id ?? 'new'}`,
    [product?.id],
  );

  const productDraftSnapshot = useMemo(
    () => ({
      formData: {
        ...formData,
        faq_items: normalizeDetailFaqItems(formData.faq_items),
      },
      keyBenefitsText,
      skinTypesText,
      contentBlocks: contentBlocks.map((block) => ({
        id: block.id,
        type: block.type,
        content: block.content || '',
        image_path: block.image_path || '',
        caption: block.caption || '',
      })),
    }),
    [contentBlocks, formData, keyBenefitsText, skinTypesText],
  );

  const {
    lastSavedAt: productDraftSavedAt,
    hasRestorableDraft: hasRestorableProductDraft,
    restoreDraft: restoreProductDraft,
    discardDraft: discardProductDraft,
    clearDraft: clearProductDraft,
    note: productDraftNote,
    remoteStatus: productDraftStatus,
  } = useAdminLocalDraft({
    storageKey: draftStorageKey,
    remoteDraftKey: draftStorageKey,
    value: productDraftSnapshot,
    enabled: hasUnsavedChanges,
    onRestore: (draft) => {
      setFormData({ ...draft.formData, faq_items: normalizeDetailFaqItems(draft.formData.faq_items) });
      setKeyBenefitsText(draft.keyBenefitsText || '');
      setSkinTypesText(draft.skinTypesText || '');
      setContentBlocks(
        (draft.contentBlocks || []).map((block) => ({
          ...block,
          id: block.id || Math.random().toString(),
        })),
      );
      setHasUnsavedChanges(true);
    },
  });

  const validationItems = useMemo(
    () => [
      {
        label: 'Tên, slug và mô tả ngắn',
        complete: Boolean(formData.name && formData.slug && formData.description),
        hint: 'Thiếu một trong ba field này sẽ làm catalog khó scan và khó link public.',
      },
      {
        label: 'Ảnh đại diện sản phẩm',
        complete: readyImagesCount > 0,
        hint: 'Cần ít nhất một ảnh đã upload xong để publish tự tin.',
      },
      {
        label: 'Giá, tồn kho và chuyên mục',
        complete: Boolean(Number(formData.price || 0) > 0 && formData.stock_quantity !== null && formData.category_id),
        hint: 'Ba field này quyết định listing, checkout và inventory sync.',
      },
      {
        label: 'Nội dung bán hàng cơ bản',
        complete: Boolean(formData.usage_instructions || formData.ingredients || keyBenefitsText.trim() || contentBlocks.length > 0),
        hint: 'Nội dung chi tiết giúp khách hàng nắm rõ thông tin sản phẩm.',
      },
      {
        label: 'Đánh giá nội dung & SEO',
        complete: contentReview.canPublish,
        hint: contentReview.canPublish
          ? 'Nội dung đạt chuẩn chất lượng SEO.'
          : `${contentAudit.summary} (Tham khảo)`,
      },
    ],
    [
      contentAudit.summary,
      contentBlocks.length,
      contentReview.canPublish,
      formData.category_id,
      formData.description,
      formData.ingredients,
      formData.name,
      formData.price,
      formData.stock_quantity,
      formData.slug,
      formData.usage_instructions,
      keyBenefitsText,
      readyImagesCount,
    ],
  );

  const sections = useMemo<ProductEditorSection[]>(
    () => [
      {
        id: 'product-editor-general',
        label: 'Thông tin cơ bản',
        status: formData.name && formData.slug && formData.description ? 'complete' : 'warning',
      },
      {
        id: 'product-editor-content',
        label: 'Nội dung',
        status: formData.ingredients || formData.usage_instructions || keyBenefitsText.trim() || contentBlocks.length > 0 ? 'complete' : 'pending',
      },
      {
        id: 'product-editor-images',
        label: 'Media',
        status: readyImagesCount > 0 ? 'complete' : 'warning',
      },
      {
        id: 'product-editor-inventory',
        label: 'Giá & tồn kho',
        status: Number(formData.price || 0) > 0 && formData.category_id ? 'complete' : 'warning',
      },
      {
        id: 'product-editor-details',
        label: 'Chi tiết',
        status: formData.brand || formData.origin || formData.volume || formData.texture ? 'complete' : 'pending',
      },
      {
        id: 'product-editor-faq',
        label: 'FAQ',
        status: sanitizeDetailFaqItems(formData.faq_items).length > 0 ? 'complete' : 'pending',
      },
      {
        id: 'product-editor-review',
        label: 'Kiểm duyệt',
        status: contentReview.canPublish ? 'complete' : 'pending',
      },
    ],
    [
      contentBlocks.length,
      contentReview.canPublish,
      formData.brand,
      formData.category_id,
      formData.description,
      formData.faq_items,
      formData.ingredients,
      formData.name,
      formData.origin,
      formData.price,
      formData.slug,
      formData.texture,
      formData.usage_instructions,
      formData.volume,
      keyBenefitsText,
      readyImagesCount,
    ],
  );

  const persistContentReview = async (reviewStatus: ProductContentReviewStatus) => {
    if (!currentProductId) {
      addToast('Hãy lưu sản phẩm trước', {
        type: 'error',
        description: 'Sản phẩm mới cần được lưu ít nhất một lần để tạo hồ sơ đánh giá.',
      });
      return;
    }

    setIsSavingContentReview(true);
    try {
      const savedReview = await api.saveAdminProductContentReview({
        product_id: currentProductId,
        review_status: reviewStatus,
        review_notes: contentReviewNotes,
        rewrite_brief: reviewStatus === 'rewrite_requested' ? contentReviewNotes : '',
        audit_score: contentAudit.score,
        blocker_count: contentAudit.blocker_count,
        warning_count: contentAudit.warning_count,
        issues: contentAudit.issues,
        content_signature: contentAudit.content_signature,
      });
      setContentReviewRecord(savedReview);
      setContentReviewNotes(savedReview.review_notes || savedReview.rewrite_brief || '');
      addToast('Đã cập nhật trạng thái kiểm duyệt', {
        type: 'success',
        description:
          reviewStatus === 'approved'
            ? 'Đã ghi nhận nội dung đạt chuẩn.'
            : reviewStatus === 'rewrite_requested'
              ? 'Đã đánh dấu cần viết lại nội dung.'
              : 'Đã cập nhật trạng thái đánh giá.',
      });
    } catch (error) {
      console.error('Failed to persist product content review:', error);
      addToast('Không thể lưu trạng thái kiểm duyệt', {
        type: 'error',
        description: error instanceof Error ? error.message : 'Worker review store không phản hồi.',
      });
    } finally {
      setIsSavingContentReview(false);
    }
  };

  const requestSubmit = () => {
    formRef.current?.requestSubmit();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (isAnyImageUploading) {
      addToast(t('product_form.alert_uploading', 'Đang tải ảnh lên'), {
        type: 'error',
        description: t('product_form.alert_upload_wait', 'Vui lòng chờ tất cả hình ảnh được tải lên xong trước khi lưu.'),
      });
      return;
    }

    setIsLoading(true);

    try {
      const processedContentBlocks = await Promise.all(
        contentBlocks.map(async (block, index): Promise<ProductContentBlock> => {
          if (block.type === 'image') {
            let imagePath = block.image_path;
            if (block.file) {
              const webpFile = await api.convertImageToWebP(block.file);
              const filePath = buildProductContentImagePath({
                slug: formData.slug,
                name: formData.name,
                index,
                suffix: String(block.id),
                extension: 'webp',
              });
              const uploaded = await api.uploadPublicAsset('product-images', filePath, webpFile);
              imagePath = uploaded.path;
            }
            return { type: 'image', image_path: imagePath || '', caption: block.caption || '' };
          }
          return { type: 'text', content: block.content || '' };
        }),
      );

      const { category, category_slug, detail_loaded, ...finalData } = formData;

      if (finalData.expiry_date === '') finalData.expiry_date = null;
      if (finalData.sku === '') finalData.sku = null;
      if (finalData.brand === '') finalData.brand = null;
      if ((finalData.low_stock_threshold as any) === '') finalData.low_stock_threshold = null;
      finalData.vat_rate = Number(Number(finalData.vat_rate ?? DEFAULT_PRODUCT_VAT_RATE).toFixed(6));

      if (!Number.isFinite(finalData.vat_rate) || finalData.vat_rate < 0 || finalData.vat_rate > 1) {
        throw new Error('VAT sản phẩm phải nằm trong khoảng từ 0% đến 100%.');
      }

      finalData.faq_items = sanitizeDetailFaqItems(finalData.faq_items);
      finalData.long_description = processedContentBlocks;
      finalData.images = imageList
        .filter((image) => image.uploadStatus === 'completed')
        .map((image, index) => ({
          id: image.type === 'existing' ? (image.id as number) : 0,
          product_id: 0,
          image_path: image.image_path!,
          image_url: image.previewUrl,
          display_order: index,
          is_primary: index === 0,
        }));

      await onSave(finalData, imagesToDelete);
      setHasUnsavedChanges(false);
      clearProductDraft();
    } catch (error) {
      console.error('Failed to save product:', error);
      addToast(t('common.error', 'Lỗi'), {
        type: 'error',
        description: error instanceof Error ? error.message : t('product_form.alert_save_fail', 'Không thể lưu sản phẩm.'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <ProductEditorHeader
        title={product?.id ? t('product_form.edit_title', 'Chỉnh sửa sản phẩm') : t('product_form.new_title', 'Tạo sản phẩm mới')}
        productName={formData.name || product?.name || ''}
        subtitle="Editor này ưu tiên tốc độ nhập liệu và duyệt catalog trên desktop: cột trái cho nội dung và media, cột phải cho inventory, publish và checklist."
        positionLabel={productPositionLabel}
        isDirty={hasUnsavedChanges}
        isSaving={isLoading}
        isUploadingImages={isAnyImageUploading}
        publishState={Boolean(formData.is_published)}
        isPublished={Boolean(formData.is_published)}
        isFeatured={Boolean(formData.is_featured)}
        onTogglePublished={handleTogglePublished}
        onToggleFeatured={handleToggleFeatured}
        sections={sections}
        draftState={{
          lastSavedAt: productDraftSavedAt,
          hasRestorableDraft: hasRestorableProductDraft,
          onRestore: restoreProductDraft,
          onDiscard: discardProductDraft,
          label: 'Autosave local + server',
          status: productDraftStatus,
          note: '',
        }}
        onBack={handleCancelRequest}
        onCancel={handleCancelRequest}
        onSave={requestSubmit}
        onCreateNew={onCreateNewProduct}
        previousProduct={previousProduct}
        nextProduct={nextProduct}
        onSelectPreviousProduct={onSelectPreviousProduct}
        onSelectNextProduct={onSelectNextProduct}
        disabledActions={isLoading || isGenerating}
      />

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 pb-10 sm:pb-16">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
          <ProductMainForm
            formData={formData}
            keyBenefitsText={keyBenefitsText}
            skinTypesText={skinTypesText}
            isGenerating={isGenerating}
            contentBlocks={contentBlocks}
            imageList={imageList}
            faqItems={normalizeDetailFaqItems(formData.faq_items)}
            onChange={handleChange}
            onGenerateDetails={handleGenerateDetails}
            onKeyBenefitsChange={(value) => {
              markDirty();
              setKeyBenefitsText(value);
            }}
            onSkinTypesChange={(value) => {
              markDirty();
              setSkinTypesText(value);
            }}
            onAddContentBlock={addContentBlock}
            onUpdateContentBlock={updateContentBlock}
            onRemoveContentBlock={removeContentBlock}
            onContentImageSelected={handleContentImageSelected}
            onImageFilesSelected={handleImageFilesSelected}
            onDeleteImage={handleDeleteImage}
            onMakePrimaryImage={handleMakePrimaryImage}
            onImageDragStart={handleDragStart}
            onImageDragEnter={handleDragEnter}
            onImageDrop={handleDrop}
            onChangeFaq={(items) => {
              markDirty();
              setFormData((prev) => ({ ...prev, faq_items: items }));
            }}
          />

          <ProductMetaPanel
            productName={formData.name || 'Sản phẩm mới'}
            description={formData.description || ''}
            primaryImagePreview={primaryImagePreview}
            isPublished={Boolean(formData.is_published)}
            readyImagesCount={readyImagesCount}
            textBlockCount={contentBlockSummary.textBlocks}
            imageBlockCount={contentBlockSummary.imageBlocks}
            selectedCategoryLabel={selectedCategoryLabel}
            selectedBrandLabel={selectedBrandLabel}
            priceLabel={formatCurrency(Number(formData.price || 0))}
            validationItems={validationItems}
          >
            <div id="product-editor-review" className="scroll-mt-32">
              <ProductContentReviewPanel
                productId={currentProductId}
                audit={contentAudit}
                reviewLabel={contentReview.label}
                reviewTone={contentReview.tone}
                isStale={contentReview.isStale}
                canPublish={contentReview.canPublish}
                reviewNotes={contentReviewNotes}
                reviewedAt={contentReview.review?.reviewed_at || null}
                reviewedByLabel={contentReview.review?.reviewed_by_label || null}
                isLoading={isLoadingContentReview}
                isSaving={isSavingContentReview}
                hasUnsavedChanges={hasUnsavedChanges}
                onReviewNotesChange={setContentReviewNotes}
                onMarkInReview={() => void persistContentReview('in_review')}
                onRequestRewrite={() => void persistContentReview('rewrite_requested')}
                onApprove={() => void persistContentReview('approved')}
              />
            </div>

            <InventoryPanel
              id="product-editor-inventory"
              formData={formData}
              categories={categories}
              vatRatePercentValue={vatRateToPercentInput(formData.vat_rate)}
              onChange={handleChange}
              onVatRatePercentChange={handleVatRatePercentChange}
            />

            <section id="product-editor-details" className="scroll-mt-32 rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-4 sm:p-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">Metadata</p>
                <h3 className="mt-1.5 text-lg font-bold text-foreground">Thương hiệu và thông tin chi tiết</h3>
              </div>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-foreground">Thương hiệu</span>
                  {brands.length > 0 ? (
                    <select
                      name="brand"
                      value={formData.brand || ''}
                      onChange={handleChange}
                      className="w-full admin-glass-input"
                    >
                      <option value="">Chọn thương hiệu</option>
                      {brands.map((brand) => (
                        <option key={brand.id} value={brand.name}>
                          {brand.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      name="brand"
                      value={formData.brand || ''}
                      onChange={handleChange}
                      className="w-full admin-glass-input"
                      placeholder="VD: La Roche-Posay, Obagi..."
                    />
                  )}
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-foreground">Xuất xứ</span>
                  <input
                    type="text"
                    name="origin"
                    value={formData.origin || ''}
                    onChange={handleChange}
                    className="w-full admin-glass-input"
                    placeholder="VD: Pháp, Mỹ..."
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-foreground">Dung tích</span>
                    <input
                      type="text"
                      name="volume"
                      value={formData.volume || ''}
                      onChange={handleChange}
                      className="w-full admin-glass-input"
                      placeholder="VD: 50ml"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-foreground">Kết cấu</span>
                    <input
                      type="text"
                      name="texture"
                      value={formData.texture || ''}
                      onChange={handleChange}
                      className="w-full admin-glass-input"
                      placeholder="VD: Gel, cream, serum..."
                    />
                  </label>
                </div>
              </div>
            </section>
          </ProductMetaPanel>
        </div>
      </form>
    </>
  );
};

export default ProductEditorForm;
