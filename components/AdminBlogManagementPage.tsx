import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AdminBlogSection, AdminNavigationView, BlogPost, BlogCategory, UserData } from '../types';
import { CogIcon, PlusCircleIcon, SearchIcon, SparklesIcon, XCircleIcon } from './icons';
import { useAdminLayoutDispatch } from './AdminLayoutContext';
import AnimatedSection from './AnimatedSection';
import PostEditorForm from './PostEditorForm';
import { useToast } from '../hooks/useToast';
import Spinner from './Spinner';
import Pagination from './Pagination';
import { useTranslation } from 'react-i18next';
import * as geminiService from '../services/geminiService';
import {
  assertWorkbookRowLimit,
  SAFE_WORKBOOK_READ_OPTIONS,
  validateWorkbookImportFile,
} from '../src/workbookImportSecurity';

interface AdminBlogManagementPageProps {
  currentUser: UserData;
  posts: BlogPost[];
  categories: BlogCategory[];
  initialSection?: AdminBlogSection;
  onSavePost: (post: BlogPost, imageFile: File | null) => Promise<BlogPost | null>;
  onLoadPostDetail: (slug: string) => Promise<BlogPost | null>;
  onDeletePost: (slug: string) => void;
  onSaveCategory: (category: BlogCategory) => Promise<void>;
  onDeleteCategory: (slug: string) => void;
  onNavigate: (page: AdminNavigationView) => void;
  onBack: () => void;
}

type AdminView = 'list' | 'edit-post';
type ActiveTab = AdminBlogSection;

const ITEMS_PER_PAGE = 30;
const loadXLSX = () => import('xlsx');

// Asset Icons from R2
const OUTPUT_EXCEL_ICON = 'https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-outputexcel.webp';
const INPUT_EXCEL_ICON = 'https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-inputexcel.webp';
const TEMPLATE_EXCEL_ICON = 'https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-taifilemau.webp';
const EDIT_ICON = 'https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp';
const DELETE_ICON = 'https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp';
const BLOG_ICON = 'https://thegioitrimun.vn/r2/assets/admin-icons/1786688261441-dongbocanva.webp';

// Apple Glass UI Classes
const fieldClass =
  'w-full h-9 rounded-xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.08),0_1px_0_rgba(255,255,255,0.1)] px-3 text-xs sm:text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-primary/50';

const primaryButton =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 sm:px-4 text-xs sm:text-sm font-bold text-primary-foreground shadow-xs backdrop-blur-md transition-all hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 shrink-0';

const secondaryButton =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-background/40 px-3 text-xs sm:text-sm font-bold text-foreground shadow-2xs backdrop-blur-md transition-all hover:bg-muted/50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 shrink-0';

const iconButton =
  'flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/40 shadow-2xs backdrop-blur-md transition-all hover:bg-muted/50 active:scale-95 disabled:opacity-50 shrink-0 text-muted-foreground hover:text-foreground';

const AdminBlogManagementPage: React.FC<AdminBlogManagementPageProps> = ({
  currentUser,
  posts,
  categories,
  initialSection,
  onSavePost,
  onLoadPostDetail,
  onDeletePost,
  onSaveCategory,
  onDeleteCategory,
  onNavigate,
  onBack,
}) => {
  const { t } = useTranslation();
  const setSidebarConfig = useAdminLayoutDispatch();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<ActiveTab>(initialSection || 'posts');
  const [adminView, setAdminView] = useState<AdminView>('list');
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [postsCurrentPage, setPostsCurrentPage] = useState(1);
  const [showExcelMenu, setShowExcelMenu] = useState(false);

  // Category form state
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategorySlug, setNewCategorySlug] = useState('');
  const [newCategoryNameEn, setNewCategoryNameEn] = useState('');
  const [newCategoryNameRu, setNewCategoryNameRu] = useState('');
  const [newCategoryNameCn, setNewCategoryNameCn] = useState('');
  const [editingCategorySlug, setEditingCategorySlug] = useState<string | null>(null);
  const [isCategorySlugManual, setIsCategorySlugManual] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isGeneratingCategoryTranslations, setIsGeneratingCategoryTranslations] = useState(false);
  const [isLoadingPostDetail, setIsLoadingPostDetail] = useState(false);

  // Import / Export refs
  const [isImporting, setIsImporting] = useState(false);
  const postFileInputRef = useRef<HTMLInputElement>(null);
  const categoryFileInputRef = useRef<HTMLInputElement>(null);

  const selectedPostIndex = selectedPost
    ? posts.findIndex((item) => item.slug === selectedPost.slug)
    : -1;
  const previousPost = selectedPostIndex > 0 ? posts[selectedPostIndex - 1] : null;
  const nextPost =
    selectedPostIndex >= 0 && selectedPostIndex < posts.length - 1
      ? posts[selectedPostIndex + 1]
      : null;
  const postPositionLabel =
    selectedPostIndex >= 0
      ? `Bài viết ${selectedPostIndex + 1} / ${posts.length} trong danh sách hiện tại`
      : null;
  const selectedPostHasFullContent = Boolean(
    selectedPost?.detail_loaded && String(selectedPost?.content || '').trim().length > 0
  );

  // Queues
  const seoQueuePosts = useMemo(
    () =>
      posts.filter((post) => {
        const summary = String(post.summary || '').trim();
        const content = String(post.content || '')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        return (
          !String(post.meta_description || '').trim() ||
          !String(post.meta_keywords || '').trim() ||
          summary.length < 80 ||
          content.length < 420
        );
      }),
    [posts]
  );

  const imageQueuePosts = useMemo(
    () => posts.filter((post) => !String(post.image_path || '').trim()),
    [posts]
  );

  const activePostCollection = useMemo(() => {
    if (activeTab === 'seo_queue') return seoQueuePosts;
    if (activeTab === 'image_queue') return imageQueuePosts;
    return posts;
  }, [activeTab, seoQueuePosts, imageQueuePosts, posts]);

  // Filtered posts based on search query & category filter
  const filteredPosts = useMemo(() => {
    let result = activePostCollection;
    if (categoryFilter !== 'all') {
      result = result.filter((p) => p.category_slug === categoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.slug?.toLowerCase().includes(q) ||
          p.summary?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [activePostCollection, categoryFilter, searchQuery]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPostsCurrentPage(1);
  }, [searchQuery, categoryFilter, activeTab]);

  const blogTabs: Array<{ key: ActiveTab; label: string; count: number }> = [
    { key: 'posts', label: 'Tất cả bài viết', count: posts.length },
    { key: 'seo_queue', label: 'Hàng đợi SEO', count: seoQueuePosts.length },
    { key: 'image_queue', label: 'Thiếu ảnh cover', count: imageQueuePosts.length },
    { key: 'categories', label: 'Chuyên mục', count: categories.length },
  ];

  const blogTaskItems = useMemo(
    () =>
      blogTabs.map((tab) => ({
        key: tab.key,
        label: `${tab.label} (${tab.count})`,
        onClick: () => {
          setActiveTab(tab.key);
          setAdminView('list');
          onNavigate({ page: 'adminBlogManagement', section: tab.key });
        },
      })),
    [blogTabs, onNavigate]
  );

  useEffect(() => {
    setActiveTab(initialSection || 'posts');
    setAdminView('list');
    setSelectedPost(null);
  }, [initialSection]);

  const openNewPost = () => {
    setSelectedPost(null);
    setAdminView('edit-post');
  };

  // Synchronize sidebar layout with AdminWorkspaceLayout
  useEffect(() => {
    setSidebarConfig({
      eyebrow: 'CONTENT & SEO',
      title: 'Quản lý Blog',
      description: 'Soạn thảo bài viết, chuẩn hóa SEO, quản lý chuyên mục và kiểm soát media bài viết.',
      icon: (
        <img
          src={BLOG_ICON}
          alt="Blog"
          className="h-8 w-8 object-contain"
        />
      ),
      insights: [
        {
          label: 'Tổng bài viết',
          value: String(posts.length),
          hint: `${categories.length} chuyên mục đang hoạt động`,
        },
        {
          label: 'Cần tối ưu',
          value: String(seoQueuePosts.length + imageQueuePosts.length),
          hint: `${seoQueuePosts.length} thiếu SEO • ${imageQueuePosts.length} thiếu cover`,
        },
        {
          label: 'Màn hình',
          value: adminView === 'edit-post' ? 'Đang soạn thảo' : 'Danh sách',
          hint: 'Điều hướng nhanh qua task tabs',
        },
      ],
      taskItems: blogTaskItems,
      activeTaskKey: adminView === 'edit-post' ? 'posts' : activeTab,
      hideHeader: adminView === 'edit-post',
    });
  }, [setSidebarConfig, posts.length, categories.length, seoQueuePosts.length, imageQueuePosts.length, adminView, activeTab, blogTaskItems]);

  const resolvePostDetail = async (post: BlogPost | null) => {
    if (!post) {
      setSelectedPost(null);
      return null;
    }

    if (post.detail_loaded && String(post.content || '').trim().length > 0) {
      setSelectedPost(post);
      return post;
    }

    setIsLoadingPostDetail(true);
    try {
      const fullPost = await onLoadPostDetail(post.slug);
      setSelectedPost(fullPost || post);
      return fullPost || post;
    } catch (error: any) {
      addToast('Không thể tải chi tiết bài viết', {
        type: 'error',
        description: error?.message || 'Đã xảy ra lỗi khi nạp nội dung bài viết.',
      });
      setSelectedPost(post);
      return post;
    } finally {
      setIsLoadingPostDetail(false);
    }
  };

  const handleEditPost = async (post: BlogPost) => {
    setAdminView('edit-post');
    await resolvePostDetail(post);
  };

  const handleSavePostForm = async (post: BlogPost, imageFile: File | null) => {
    const savedPost = await onSavePost(post, imageFile);
    setSelectedPost(savedPost || post);
  };

  const generateSlug = (title: string) => {
    return title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  };

  useEffect(() => {
    if (!isCategorySlugManual) {
      setNewCategorySlug(generateSlug(newCategoryName));
    }
  }, [newCategoryName, isCategorySlugManual]);

  const resetCategoryForm = () => {
    setEditingCategorySlug(null);
    setNewCategoryName('');
    setNewCategorySlug('');
    setNewCategoryNameEn('');
    setNewCategoryNameRu('');
    setNewCategoryNameCn('');
    setIsCategorySlugManual(false);
  };

  const handleEditCategory = (category: BlogCategory) => {
    setEditingCategorySlug(category.slug);
    setNewCategoryName(category.name || '');
    setNewCategorySlug(category.slug || '');
    setNewCategoryNameEn(category.name_en || '');
    setNewCategoryNameRu(category.name_ru || '');
    setNewCategoryNameCn(category.name_cn || '');
    setIsCategorySlugManual(true);
  };

  const handleGenerateCategoryTranslations = async () => {
    if (!newCategoryName.trim()) {
      addToast('Thiếu tên chuyên mục', {
        type: 'error',
        description: 'Nhập tên chuyên mục tiếng Việt trước khi dùng AI.',
      });
      return;
    }

    setIsGeneratingCategoryTranslations(true);
    try {
      const generated = await geminiService.generateBlogCategoryTranslations(
        newCategoryName.trim()
      );
      setNewCategoryNameEn(generated.name_en);
      setNewCategoryNameRu(generated.name_ru);
      setNewCategoryNameCn(generated.name_cn);
      addToast('Đã tạo bản dịch chuyên mục', { type: 'success' });
    } catch (error: any) {
      addToast('AI tạo bản dịch thất bại', {
        type: 'error',
        description: error?.message || 'Không thể tạo bản dịch cho chuyên mục.',
      });
    } finally {
      setIsGeneratingCategoryTranslations(false);
    }
  };

  const handleAddNewCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedName = newCategoryName.trim();
    const normalizedSlug = generateSlug(newCategorySlug || newCategoryName);

    if (normalizedName && normalizedSlug) {
      setIsSavingCategory(true);
      try {
        await onSaveCategory({
          name: normalizedName,
          slug: editingCategorySlug || normalizedSlug,
          name_en: newCategoryNameEn || undefined,
          name_ru: newCategoryNameRu || undefined,
          name_cn: newCategoryNameCn || undefined,
        });
        resetCategoryForm();
      } finally {
        setIsSavingCategory(false);
      }
    }
  };

  // --- Excel Import/Export Logic ---
  const handleExport = async (data: any[], fileName: string, sheetName: string) => {
    const XLSX = await loadXLSX();
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName);
  };

  const handleExportPosts = async () => {
    setShowExcelMenu(false);
    const dataToExport = posts.map((p) => ({
      slug: p.slug,
      title: p.title,
      summary: p.summary,
      content: p.content,
      title_en: p.title_en,
      title_ru: p.title_ru,
      title_cn: p.title_cn,
      summary_en: p.summary_en,
      summary_ru: p.summary_ru,
      summary_cn: p.summary_cn,
      content_en: p.content_en,
      content_ru: p.content_ru,
      content_cn: p.content_cn,
      author_name: p.author?.name,
      date: p.date,
      category_slug: p.category_slug,
      image_path: p.image_path,
      meta_description: p.meta_description,
      meta_keywords: p.meta_keywords,
      canonical_url: p.canonical_url,
    }));
    await handleExport(dataToExport, 'Blog_Posts_Export.xlsx', 'Posts');
  };

  const handleExportCategories = async () => {
    setShowExcelMenu(false);
    await handleExport(categories, 'Blog_Categories_Export.xlsx', 'Categories');
  };

  const handleDownloadPostTemplate = async () => {
    setShowExcelMenu(false);
    const templateData = [
      {
        slug: 'ten-bai-viet-khong-dau (để trống sẽ tự tạo)',
        title: 'Tiêu đề bài viết (Bắt buộc)',
        summary: 'Tóm tắt ngắn gọn',
        content: 'Nội dung đầy đủ. Sử dụng ### cho tiêu đề phụ.',
        title_en: 'Translated English title',
        summary_en: 'Translated English summary',
        content_en: 'Translated English markdown body',
        title_ru: 'Переведенный заголовок',
        summary_ru: 'Переведенное краткое описание',
        content_ru: 'Переведенный markdown-текст',
        title_cn: '中文标题',
        summary_cn: '中文摘要',
        content_cn: '中文 Markdown 正文',
        category_slug: 'slug-cua-chuyen-muc (Bắt buộc)',
        image_path: 'blog/ten-anh.webp (Tùy chọn, ảnh phải được tải lên trước)',
        meta_description: 'Mô tả SEO dưới 160 ký tự.',
        meta_keywords: 'tu khoa 1, tu khoa 2, tu khoa 3',
        canonical_url: 'https://nguon-bai-viet.com/url (nếu có)',
      },
    ];
    await handleExport(templateData, 'Blog_Post_Template.xlsx', 'Template');
  };

  const handleDownloadCategoryTemplate = async () => {
    setShowExcelMenu(false);
    const templateData = [
      {
        slug: 'ten-chuyen-muc-khong-dau',
        name: 'Tên chuyên mục',
        name_en: 'English category name',
        name_ru: 'Название категории на русском',
        name_cn: '中文分类名',
      },
    ];
    await handleExport(templateData, 'Blog_Category_Template.xlsx', 'Template');
  };

  const handleImportFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'post' | 'category'
  ) => {
    setShowExcelMenu(false);
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    addToast('Đang xử lý tệp Excel...', { type: 'info' });

    try {
      await validateWorkbookImportFile(file);
      const data = await file.arrayBuffer();
      const XLSX = await loadXLSX();
      const workbook = XLSX.read(data, SAFE_WORKBOOK_READ_OPTIONS);
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error('Tệp Excel không có trang tính.');
      const worksheet = workbook.Sheets[sheetName];
      const json: any[] = XLSX.utils.sheet_to_json(worksheet);
      assertWorkbookRowLimit(json);

      if (type === 'post') {
        await processPostImport(json);
      } else {
        await processCategoryImport(json);
      }
    } catch (error: any) {
      addToast(t('admin.import_failed'), { type: 'error', description: error.message });
    } finally {
      setIsImporting(false);
      if (postFileInputRef.current) postFileInputRef.current.value = '';
      if (categoryFileInputRef.current) categoryFileInputRef.current.value = '';
    }
  };

  const processPostImport = async (rows: any[]) => {
    let successCount = 0;
    const errors: string[] = [];
    for (const [index, row] of rows.entries()) {
      try {
        if (!row.title || !row.category_slug) {
          throw new Error("Thiếu 'title' hoặc 'category_slug'.");
        }
        const categoryExists = categories.some((c) => c.slug === row.category_slug);
        if (!categoryExists) {
          throw new Error(`Chuyên mục '${row.category_slug}' không tồn tại.`);
        }

        const postToSave: BlogPost = {
          slug: row.slug || generateSlug(row.title),
          title: row.title,
          summary: row.summary || '',
          content: row.content || '',
          title_en: row.title_en || '',
          title_ru: row.title_ru || '',
          title_cn: row.title_cn || '',
          summary_en: row.summary_en || '',
          summary_ru: row.summary_ru || '',
          summary_cn: row.summary_cn || '',
          content_en: row.content_en || '',
          content_ru: row.content_ru || '',
          content_cn: row.content_cn || '',
          author_id: currentUser.profile.id,
          date: new Date().toISOString().split('T')[0],
          category_slug: row.category_slug,
          image_path: row.image_path || '',
          meta_description: row.meta_description || '',
          meta_keywords: row.meta_keywords || '',
          canonical_url: row.canonical_url || '',
        };

        await onSavePost(postToSave, null);
        successCount++;
      } catch (err: any) {
        errors.push(`Dòng ${index + 2}: ${err.message}`);
      }
    }
    addToast(t('admin.import_completed'), {
      type: errors.length > 0 ? 'info' : 'success',
      description: `${successCount} bài viết nhập thành công, ${errors.length} lỗi.`,
    });
  };

  const processCategoryImport = async (rows: any[]) => {
    let successCount = 0;
    const errors: string[] = [];
    for (const [index, row] of rows.entries()) {
      try {
        if (!row.name) {
          throw new Error("Thiếu 'name'.");
        }
        await onSaveCategory({
          name: row.name,
          slug: row.slug || generateSlug(row.name),
          name_en: row.name_en || '',
          name_ru: row.name_ru || '',
          name_cn: row.name_cn || '',
          ...('description' in row && { description: row.description }),
        });
        successCount++;
      } catch (err: any) {
        errors.push(`Dòng ${index + 2}: ${err.message}`);
      }
    }
    addToast(t('admin.import_completed'), {
      type: errors.length > 0 ? 'info' : 'success',
      description: `${successCount} chuyên mục nhập thành công, ${errors.length} lỗi.`,
    });
  };

  // --- Render Editor ---
  if (adminView === 'edit-post') {
    if (isLoadingPostDetail) {
      return (
        <div className="rounded-2xl border border-white/70 bg-card/85 p-8 backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0 -mx-3 sm:mx-0">
          <div className="flex min-h-[280px] items-center justify-center">
            <Spinner className="h-8 w-8 text-primary" />
          </div>
        </div>
      );
    }

    return (
      <PostEditorForm
        currentUser={currentUser}
        post={selectedPost}
        categories={categories}
        onSave={handleSavePostForm}
        onCancel={() => setAdminView('list')}
        isContentHydrated={!selectedPost || selectedPostHasFullContent}
        onRetryLoadDetail={
          selectedPost
            ? () => {
                void resolvePostDetail(selectedPost);
              }
            : undefined
        }
        previousPost={previousPost}
        nextPost={nextPost}
        postPositionLabel={postPositionLabel}
        onSelectPreviousPost={
          previousPost
            ? () => {
                void resolvePostDetail(previousPost);
              }
            : undefined
        }
        onSelectNextPost={
          nextPost
            ? () => {
                void resolvePostDetail(nextPost);
              }
            : undefined
        }
      />
    );
  }

  // --- Render Categories Tab ---
  if (activeTab === 'categories') {
    return (
      <div className="space-y-4 -mx-3 sm:mx-0 p-3 sm:p-0">
        {/* Category Toolbar Card */}
        <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3 sm:p-4 mx-1 sm:mx-0">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
                TAXONOMY CHUYÊN MỤC
              </p>
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                Quản lý Chuyên mục Blog ({categories.length})
              </h2>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Excel Utility 3-Dots Menu */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowExcelMenu(!showExcelMenu)}
                  className={iconButton}
                  title="Tiện ích Excel"
                >
                  <img src={OUTPUT_EXCEL_ICON} alt="Excel" className="h-4.5 w-4.5 object-contain" />
                </button>

                {showExcelMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40 bg-transparent"
                      onClick={() => setShowExcelMenu(false)}
                    />
                    <div
                      className="absolute right-0 top-10 z-50 w-52 rounded-2xl border border-border/80 bg-card p-1.5 shadow-2xl transition-all"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="space-y-0.5">
                        <button
                          type="button"
                          onClick={handleExportCategories}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          <img src={OUTPUT_EXCEL_ICON} alt="" className="h-4 w-4 object-contain" />
                          <span>Xuất danh mục Excel</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowExcelMenu(false);
                            categoryFileInputRef.current?.click();
                          }}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          <img src={INPUT_EXCEL_ICON} alt="" className="h-4 w-4 object-contain" />
                          <span>Nhập từ Excel</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadCategoryTemplate}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          <img src={TEMPLATE_EXCEL_ICON} alt="" className="h-4 w-4 object-contain" />
                          <span>Tải file mẫu Excel</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <input
                type="file"
                ref={categoryFileInputRef}
                onChange={(e) => handleImportFile(e, 'category')}
                accept=".xlsx, .xls"
                className="hidden"
              />

              <button
                type="button"
                onClick={() => {
                  setActiveTab('posts');
                  onNavigate({ page: 'adminBlogManagement', section: 'posts' });
                }}
                className={secondaryButton}
              >
                Về danh sách bài
              </button>
            </div>
          </div>
        </div>

        {/* 2-Column Responsive Categories Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Column 1: Category List (7 cols) */}
          <div className="lg:col-span-7 rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-4 sm:p-6 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0 space-y-3">
            <div className="flex items-center justify-between border-b border-border/20 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                Danh sách chuyên mục hiện có
              </h3>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                {categories.length} mục
              </span>
            </div>

            <div className="space-y-2">
              {categories.map((cat) => (
                <div
                  key={cat.slug}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-3 backdrop-blur-xl shadow-2xs transition-all ${
                    editingCategorySlug === cat.slug
                      ? 'border-primary/50 bg-primary/10'
                      : 'border-white/60 dark:border-white/10 bg-background/40 hover:bg-muted/30'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs sm:text-sm font-bold text-foreground">
                      {cat.name}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                      /{cat.slug}
                    </p>
                    {(cat.name_en || cat.name_ru || cat.name_cn) && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {cat.name_en && (
                          <span className="rounded bg-muted/60 px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground">
                            EN: {cat.name_en}
                          </span>
                        )}
                        {cat.name_ru && (
                          <span className="rounded bg-muted/60 px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground">
                            RU: {cat.name_ru}
                          </span>
                        )}
                        {cat.name_cn && (
                          <span className="rounded bg-muted/60 px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground">
                            CN: {cat.name_cn}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEditCategory(cat)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 bg-background/40 shadow-2xs transition-all hover:bg-muted/50 active:scale-95"
                      title="Chỉnh sửa chuyên mục"
                    >
                      <img src={EDIT_ICON} alt="Sửa" className="h-4 w-4 object-contain" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteCategory(cat.slug)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10 text-destructive shadow-2xs transition-all hover:bg-destructive/20 active:scale-95"
                      title="Xóa chuyên mục"
                    >
                      <img src={DELETE_ICON} alt="Xóa" className="h-4 w-4 object-contain" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Category Form (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-4 sm:p-6 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0">
            <div className="flex items-center justify-between border-b border-border/20 pb-3 mb-4">
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                {editingCategorySlug ? 'Chỉnh sửa chuyên mục' : 'Thêm chuyên mục mới'}
              </h3>
              {editingCategorySlug && (
                <button
                  type="button"
                  onClick={resetCategoryForm}
                  className="text-xs font-semibold text-primary hover:underline active:scale-95"
                >
                  + Tạo mới
                </button>
              )}
            </div>

            <form onSubmit={handleAddNewCategory} className="space-y-3.5">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
                  Tên chuyên mục (Tiếng Việt) *
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className={fieldClass}
                  placeholder="VD: Chăm sóc da mụn..."
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold uppercase text-muted-foreground">
                    Bản dịch đa ngôn ngữ
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateCategoryTranslations}
                    disabled={isGeneratingCategoryTranslations || !newCategoryName.trim()}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline disabled:opacity-50"
                  >
                    {isGeneratingCategoryTranslations ? (
                      <Spinner className="w-3.5 h-3.5" />
                    ) : (
                      <SparklesIcon className="w-3.5 h-3.5" />
                    )}
                    <span>AI dịch tự động</span>
                  </button>
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newCategoryNameEn}
                    onChange={(e) => setNewCategoryNameEn(e.target.value)}
                    className={fieldClass}
                    placeholder="Tên tiếng Anh (English)..."
                  />
                  <input
                    type="text"
                    value={newCategoryNameRu}
                    onChange={(e) => setNewCategoryNameRu(e.target.value)}
                    className={fieldClass}
                    placeholder="Tên tiếng Nga (Русский)..."
                  />
                  <input
                    type="text"
                    value={newCategoryNameCn}
                    onChange={(e) => setNewCategoryNameCn(e.target.value)}
                    className={fieldClass}
                    placeholder="Tên tiếng Trung (中文)..."
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
                  Slug URL *
                </label>
                <input
                  type="text"
                  value={newCategorySlug}
                  onChange={(e) => {
                    setIsCategorySlugManual(true);
                    setNewCategorySlug(generateSlug(e.target.value));
                  }}
                  className={fieldClass}
                  placeholder="cham-soc-da-mun"
                  required
                  disabled={Boolean(editingCategorySlug)}
                />
                <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                  {editingCategorySlug
                    ? 'Slug bị khóa khi sửa để tránh gãy URL bài viết hiện có.'
                    : 'Tự động tạo từ tên tiếng Việt. Có thể chỉnh sửa tay nếu cần.'}
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                {editingCategorySlug && (
                  <button
                    type="button"
                    onClick={resetCategoryForm}
                    className={secondaryButton}
                  >
                    Hủy
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSavingCategory || !newCategoryName.trim()}
                  className={primaryButton}
                >
                  {isSavingCategory ? (
                    <Spinner className="w-4 h-4" />
                  ) : editingCategorySlug ? (
                    'Cập nhật chuyên mục'
                  ) : (
                    'Tạo chuyên mục'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // --- Render Posts List (posts, seo_queue, image_queue) ---
  const totalPosts = filteredPosts.length;
  const totalPostPages = Math.ceil(totalPosts / ITEMS_PER_PAGE);
  const currentPosts = filteredPosts.slice(
    (postsCurrentPage - 1) * ITEMS_PER_PAGE,
    postsCurrentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-4 -mx-3 sm:mx-0 p-3 sm:p-0">
      {/* Unified Filter & Toolbar Card (Apple Glass Standard) */}
      <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/75 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-2.5 sm:p-4 mx-1 sm:mx-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tiêu đề, slug, tóm tắt..."
              className="w-full h-9 rounded-xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.1)] pl-8 pr-7 sm:pr-8 text-xs placeholder:text-muted-foreground/70 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
            />
            <SearchIcon className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 p-0.5 rounded-full text-muted-foreground hover:text-foreground"
              >
                <XCircleIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-xl border-0 bg-background/30 backdrop-blur-xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.08)] px-2 sm:px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/50 max-w-[110px] sm:max-w-[170px] shrink-0"
          >
            <option value="all">Tất cả chuyên mục</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Excel Utility Popover (Section 4 Apple Glass) */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowExcelMenu(!showExcelMenu)}
              className={iconButton}
              title="Tiện ích Excel"
            >
              <img src={OUTPUT_EXCEL_ICON} alt="Excel" className="h-4.5 w-4.5 object-contain" />
            </button>

            {showExcelMenu && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-transparent"
                  onClick={() => setShowExcelMenu(false)}
                />
                <div
                  className="absolute right-0 top-10 z-50 w-52 rounded-2xl border border-border/80 bg-card p-1.5 shadow-2xl transition-all"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="space-y-0.5">
                    <button
                      type="button"
                      onClick={handleExportPosts}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                    >
                      <img src={OUTPUT_EXCEL_ICON} alt="" className="h-4 w-4 object-contain" />
                      <span>Xuất bài viết Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowExcelMenu(false);
                        postFileInputRef.current?.click();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                    >
                      <img src={INPUT_EXCEL_ICON} alt="" className="h-4 w-4 object-contain" />
                      <span>Nhập từ Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadPostTemplate}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left"
                    >
                      <img src={TEMPLATE_EXCEL_ICON} alt="" className="h-4 w-4 object-contain" />
                      <span>Tải file mẫu Excel</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <input
            type="file"
            ref={postFileInputRef}
            onChange={(e) => handleImportFile(e, 'post')}
            accept=".xlsx, .xls"
            className="hidden"
          />

          {/* Add Post Button */}
          <button
            type="button"
            onClick={openNewPost}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-primary px-2.5 sm:px-4 text-xs sm:text-sm font-bold text-primary-foreground shadow-xs backdrop-blur-md transition-all hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 shrink-0"
          >
            <PlusCircleIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Viết bài mới</span>
            <span className="sm:hidden">Viết bài</span>
          </button>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-4 sm:p-5 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0 overflow-hidden">
        {currentPosts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-background/20 p-8 text-center text-xs sm:text-sm text-muted-foreground">
            Không tìm thấy bài viết nào phù hợp với điều kiện tìm kiếm.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-border/50 bg-background/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3.5 py-2.5">Bài viết</th>
                  <th className="px-3.5 py-2.5">Chuyên mục</th>
                  <th className="px-3.5 py-2.5">Tác giả</th>
                  <th className="px-3.5 py-2.5">Ngày đăng</th>
                  <th className="px-3.5 py-2.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {currentPosts.map((post) => {
                  const category = categories.find((c) => c.slug === post.category_slug);
                  return (
                    <tr key={post.slug} className="transition-colors hover:bg-muted/30">
                      <td className="px-3.5 py-3">
                        <div className="flex items-start gap-3">
                          {post.image_path ? (
                            <img
                              src={
                                post.image_path.startsWith('http')
                                  ? post.image_path
                                  : `https://thegioitrimun.vn/r2/${post.image_path.replace(/^\/+/, '')}`
                              }
                              alt={post.title}
                              className="h-12 w-12 shrink-0 rounded-xl object-cover border border-white/50 dark:border-white/10 shadow-2xs"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/50 dark:border-white/10 bg-muted/40 text-xs font-bold text-muted-foreground">
                              TXT
                            </div>
                          )}
                          <div className="min-w-0 max-w-md">
                            <p className="font-bold text-foreground leading-snug line-clamp-2">
                              {post.title}
                            </p>
                            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                              /{post.slug}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                          {category?.name || 'Chưa phân loại'}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {post.author?.avatar_url || post.author?.avatar_path ? (
                            <img
                              src={post.author.avatar_url || post.author.avatar_path}
                              alt={post.author.name || 'Tác giả'}
                              className="h-7 w-7 rounded-full object-cover ring-1 ring-border shadow-xs"
                            />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold ring-1 ring-primary/20">
                              {(post.author?.name || 'A').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-xs font-medium text-foreground">
                            {post.author?.name || 'Ban biên tập'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(post.date).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-3.5 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              void handleEditPost(post);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 bg-background/40 shadow-2xs transition-all hover:bg-muted/50 active:scale-95"
                            title="Chỉnh sửa bài viết"
                          >
                            <img src={EDIT_ICON} alt="Sửa" className="h-4 w-4 object-contain" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeletePost(post.slug)}
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10 text-destructive shadow-2xs transition-all hover:bg-destructive/20 active:scale-95"
                            title="Xóa bài viết"
                          >
                            <img src={DELETE_ICON} alt="Xóa" className="h-4 w-4 object-contain" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPostPages > 1 && (
          <div className="mt-4 pt-3 border-t border-border/20">
            <Pagination
              currentPage={postsCurrentPage}
              totalPages={totalPostPages}
              onPageChange={setPostsCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Mobile Glass Card View */}
      <div className="md:hidden space-y-2.5 mx-1 sm:mx-0">
        {currentPosts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-background/20 p-6 text-center text-xs text-muted-foreground">
            Không tìm thấy bài viết nào phù hợp.
          </div>
        ) : (
          currentPosts.map((post) => {
            const category = categories.find((c) => c.slug === post.category_slug);
            return (
              <div
                key={post.slug}
                className="rounded-xl border border-white/60 dark:border-white/10 bg-background/40 backdrop-blur-xl p-3.5 shadow-2xs space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {category?.name || 'Chưa phân loại'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(post.date).toLocaleDateString('vi-VN')}
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  {post.image_path ? (
                    <img
                      src={
                        post.image_path.startsWith('http')
                          ? post.image_path
                          : `https://thegioitrimun.vn/r2/${post.image_path.replace(/^\/+/, '')}`
                      }
                      alt={post.title}
                      className="h-14 w-14 shrink-0 rounded-xl object-cover border border-white/50 dark:border-white/10 shadow-2xs"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/50 dark:border-white/10 bg-muted/40 text-xs font-bold text-muted-foreground">
                      TXT
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs sm:text-sm font-bold leading-snug text-foreground">
                      {post.title}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                      /{post.slug}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/20 text-xs">
                  <div className="flex items-center gap-1.5">
                    {post.author?.avatar_url || post.author?.avatar_path ? (
                      <img
                        src={post.author.avatar_url || post.author.avatar_path}
                        alt=""
                        className="h-5 w-5 rounded-full object-cover"
                      />
                    ) : null}
                    <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                      {post.author?.name || 'Ban biên tập'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        void handleEditPost(post);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-background/50 px-2.5 py-1 text-xs font-bold text-foreground active:scale-95"
                    >
                      <img src={EDIT_ICON} alt="" className="h-3.5 w-3.5 object-contain" />
                      <span>Sửa</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeletePost(post.slug)}
                      className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive active:scale-95"
                    >
                      <img src={DELETE_ICON} alt="" className="h-3.5 w-3.5 object-contain" />
                      <span>Xóa</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {totalPostPages > 1 && (
          <div className="pt-2">
            <Pagination
              currentPage={postsCurrentPage}
              totalPages={totalPostPages}
              onPageChange={setPostsCurrentPage}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBlogManagementPage;
