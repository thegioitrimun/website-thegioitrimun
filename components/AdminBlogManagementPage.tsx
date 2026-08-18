import React, { useEffect, useRef, useState } from 'react';
import type { AdminBlogSection, AdminNavigationView, BlogPost, BlogCategory, UserData } from '../types';
import { CogIcon, PlusCircleIcon, PencilIcon, TrashIcon, CheckCircleIcon, SparklesIcon } from './icons';
import { useAdminLayoutDispatch } from './AdminLayoutContext';
import AnimatedSection from './AnimatedSection';
import PostEditorForm from './PostEditorForm';
import AdminShell from './AdminShell';
import { AdminMobileCard, AdminMobileList, AdminMobileMeta } from './AdminResponsivePrimitives';
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
const adminActionButtonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/35 hover:text-primary';
const adminPrimaryActionButtonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-primary bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90';

const AdminBlogManagementPage: React.FC<AdminBlogManagementPageProps> = ({
    currentUser, posts, categories, initialSection, onSavePost, onLoadPostDetail, onDeletePost, onSaveCategory, onDeleteCategory, onNavigate, onBack
}) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<ActiveTab>(initialSection || 'posts');
    const [adminView, setAdminView] = useState<AdminView>('list');
    const setSidebarConfig = useAdminLayoutDispatch();
    const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategorySlug, setNewCategorySlug] = useState('');
    const [newCategoryNameEn, setNewCategoryNameEn] = useState('');
    const [newCategoryNameRu, setNewCategoryNameRu] = useState('');
    const [newCategoryNameCn, setNewCategoryNameCn] = useState('');
    const [postsCurrentPage, setPostsCurrentPage] = useState(1);
    const [editingCategorySlug, setEditingCategorySlug] = useState<string | null>(null);
    const [isCategorySlugManual, setIsCategorySlugManual] = useState(false);
    const [isSavingCategory, setIsSavingCategory] = useState(false);
    const [isGeneratingCategoryTranslations, setIsGeneratingCategoryTranslations] = useState(false);
    const [isLoadingPostDetail, setIsLoadingPostDetail] = useState(false);

    const { addToast } = useToast();
    const [isImporting, setIsImporting] = useState(false);
    const postFileInputRef = useRef<HTMLInputElement>(null);
    const categoryFileInputRef = useRef<HTMLInputElement>(null);
    const selectedPostIndex = selectedPost ? posts.findIndex((item) => item.slug === selectedPost.slug) : -1;
    const previousPost = selectedPostIndex > 0 ? posts[selectedPostIndex - 1] : null;
    const nextPost = selectedPostIndex >= 0 && selectedPostIndex < posts.length - 1 ? posts[selectedPostIndex + 1] : null;
    const postPositionLabel = selectedPostIndex >= 0 ? `Bài viết ${selectedPostIndex + 1} / ${posts.length} trong danh sách hiện tại` : null;
    const selectedPostHasFullContent = Boolean(selectedPost?.detail_loaded && String(selectedPost?.content || '').trim().length > 0);
    const seoQueuePosts = posts.filter((post) => {
        const summary = String(post.summary || '').trim();
        const content = String(post.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        return !String(post.meta_description || '').trim()
            || !String(post.meta_keywords || '').trim()
            || summary.length < 80
            || content.length < 420;
    });
    const imageQueuePosts = posts.filter((post) => !String(post.image_path || '').trim());
    const activePostCollection = activeTab === 'seo_queue'
        ? seoQueuePosts
        : activeTab === 'image_queue'
            ? imageQueuePosts
            : posts;
    const currentPostsTitle = activeTab === 'seo_queue'
        ? 'Hàng đợi SEO'
        : activeTab === 'image_queue'
            ? 'Thiếu ảnh đại diện'
            : t('admin.posts_list');
    const workspaceInsights = [
        { label: 'Bài viết', value: String(posts.length), hint: `${categories.length} chuyên mục đang hoạt động` },
        { label: 'Màn hiện tại', value: adminView === 'edit-post' ? 'Đang sửa' : 'Danh sách', hint: 'Đi thẳng giữa các module từ thanh điều hướng trái' },
        { label: 'Chi tiết đầy đủ', value: selectedPostHasFullContent ? 'Sẵn sàng' : 'Theo lượt', hint: 'Editor sẽ cảnh báo nếu bài chưa load full content' },
        { label: 'Hàng đợi', value: `${seoQueuePosts.length + imageQueuePosts.length}`, hint: `${seoQueuePosts.length} bài cần SEO • ${imageQueuePosts.length} bài thiếu cover` },
    ];
    const blogTabs: Array<{ key: ActiveTab; label: string }> = [
        { key: 'posts', label: `${t('admin.manage_posts')} (${posts.length})` },
        { key: 'seo_queue', label: `Hàng đợi SEO (${seoQueuePosts.length})` },
        { key: 'image_queue', label: `Thiếu ảnh (${imageQueuePosts.length})` },
        { key: 'categories', label: `${t('admin.manage_categories')} (${categories.length})` },
    ];
    const blogTaskItems = blogTabs.map((tab) => ({
        key: tab.key,
        label: tab.label,
        view: { page: 'adminBlogManagement', section: tab.key } as AdminNavigationView,
    }));

    useEffect(() => {
        setActiveTab(initialSection || 'posts');
        setAdminView('list');
        setSelectedPost(null);
    }, [initialSection]);

    const openNewPost = () => {
        setSelectedPost(null);
        setAdminView('edit-post');
    };

    const sectionMeta = (() => {
        if (adminView === 'edit-post') {
            return {
                title: selectedPost ? 'Chỉnh sửa bài viết' : 'Tạo bài viết mới',
                description: 'Editor bài viết đang được giữ riêng khỏi taxonomy để tập trung vào nội dung, SEO, ảnh đại diện và điều hướng giữa các bài gần nhau.',
                eyebrow: 'Content editor',
                insights: [
                    { label: 'Bài viết', value: String(posts.length), hint: `${categories.length} chuyên mục đang hoạt động` },
                    { label: 'Màn hiện tại', value: selectedPost ? 'Đang sửa' : 'Tạo mới', hint: 'Đi qua bài trước / sau ngay trong editor' },
                    { label: 'Chi tiết đầy đủ', value: selectedPostHasFullContent ? 'Sẵn sàng' : 'Theo lượt', hint: 'Editor cảnh báo nếu bài chưa load full content' },
                ],
            };
        }

        if (activeTab === 'categories') {
            return {
                title: 'Chuyên mục blog',
                description: 'Taxonomy bài viết được tách khỏi editor để bạn quản lý tên, slug, bản dịch và import/export mà không lẫn vào nội dung bài.',
                eyebrow: 'Editorial taxonomy',
                insights: [
                    { label: 'Chuyên mục', value: String(categories.length), hint: `${posts.length} bài đang phân bổ theo taxonomy này` },
                    { label: 'AI translation', value: 'Bật', hint: 'Có thể tạo bản dịch tên chuyên mục ngay trong form' },
                    { label: 'Màn hiện tại', value: 'Taxonomy', hint: 'Điều hướng task-level qua shell admin mới' },
                ],
            };
        }

        if (activeTab === 'seo_queue') {
            return {
                title: 'Hàng đợi SEO nội dung',
                description: 'Đi thẳng vào nhóm bài đang thiếu meta description, meta keywords hoặc nội dung chưa đủ dày để editorial xử lý nhanh theo hàng đợi.',
                eyebrow: 'SEO queue',
                insights: [
                    { label: 'Bài cần rà', value: String(seoQueuePosts.length), hint: `${imageQueuePosts.length} bài khác đang thiếu ảnh đại diện` },
                    { label: 'Màn hiện tại', value: 'SEO queue', hint: 'Tập trung xử lý metadata và độ dày nội dung' },
                    { label: 'Chuyên mục', value: String(categories.length), hint: 'Taxonomy vẫn giữ tách khỏi queue nội dung' },
                ],
            };
        }

        if (activeTab === 'image_queue') {
            return {
                title: 'Bài viết thiếu ảnh đại diện',
                description: 'Queue này gom các bài chưa có cover để editorial xử lý media nhanh, tránh publish nội dung thiếu ảnh chia sẻ và thumbnail.',
                eyebrow: 'Media queue',
                insights: [
                    { label: 'Bài thiếu ảnh', value: String(imageQueuePosts.length), hint: `${seoQueuePosts.length} bài cũng đang nằm trong queue SEO` },
                    { label: 'Màn hiện tại', value: 'Media queue', hint: 'Ưu tiên những bài cần cover trước khi quảng bá' },
                    { label: 'Bài viết', value: String(posts.length), hint: 'Toàn bộ thư viện editorial hiện có' },
                ],
            };
        }

        return {
            title: t('admin.blog_management_title'),
            description: 'Khu editorial giờ tách rõ bài viết và taxonomy để người viết đi đúng task, không phải tự nhớ đang đứng ở posts hay categories.',
            eyebrow: 'Content & SEO',
            insights: [
                { label: 'Bài viết', value: String(posts.length), hint: `${categories.length} chuyên mục đang hoạt động` },
                { label: 'Màn hiện tại', value: 'Danh sách bài', hint: 'Editor và taxonomy tách thành task riêng' },
                { label: 'Chi tiết đầy đủ', value: selectedPostHasFullContent ? 'Sẵn sàng' : 'Theo lượt', hint: 'Khi mở editor sẽ hydrate nội dung đầy đủ nếu cần' },
            ],
        };
    })();

    const workspaceActions = (
        <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap xl:justify-end">
            {adminView === 'edit-post' ? (
                <button
                    type="button"
                    onClick={() => setAdminView('list')}
                    className={adminActionButtonClass}
                >
                    Về danh sách
                </button>
            ) : activeTab === 'categories' ? (
                <button
                    type="button"
                    onClick={() => onNavigate({ page: 'adminBlogManagement', section: 'posts' })}
                    className={adminActionButtonClass}
                >
                    Mở bài viết
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => onNavigate({ page: 'adminBlogManagement', section: 'categories' })}
                    className={adminActionButtonClass}
                >
                    Mở chuyên mục
                </button>
            )}
            <button
                type="button"
                onClick={openNewPost}
                className={adminPrimaryActionButtonClass}
            >
                <PlusCircleIcon className="h-4 w-4" />
                <span>{t('admin.add_post')}</span>
            </button>
        </div>
    );

    useEffect(() => {
        setSidebarConfig({
            title: sectionMeta.title,
            description: sectionMeta.description,
            icon: <CogIcon className="w-8 h-8" />,
            eyebrow: sectionMeta.eyebrow,
            actions: workspaceActions,
            insights: sectionMeta.insights,
            taskItems: blogTaskItems,
            activeTaskKey: adminView === 'edit-post' ? 'posts' : activeTab,
            hideHeader: adminView === 'edit-post',
        });
    }, [setSidebarConfig, sectionMeta, workspaceActions, adminView, activeTab, blogTaskItems]);

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

    const handleAddNewPost = () => {
        openNewPost();
    };

    const handleSavePostForm = async (post: BlogPost, imageFile: File | null) => {
        const savedPost = await onSavePost(post, imageFile);
        setSelectedPost(savedPost || post);
    };

    const populateCategoryForm = (category: BlogCategory) => {
        setEditingCategorySlug(category.slug);
        setNewCategoryName(category.name || '');
        setNewCategorySlug(category.slug || '');
        setNewCategoryNameEn(category.name_en || '');
        setNewCategoryNameRu(category.name_ru || '');
        setNewCategoryNameCn(category.name_cn || '');
        setIsCategorySlugManual(true);
    };

    const handleEditCategory = (category: BlogCategory) => {
        populateCategoryForm(category);
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
            const generated = await geminiService.generateBlogCategoryTranslations(newCategoryName.trim());
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

    // --- Import/Export Logic ---
    const handleExport = async (data: any[], fileName: string, sheetName: string) => {
        const XLSX = await loadXLSX();
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, fileName);
    };

    const handleExportPosts = async () => {
        const dataToExport = posts.map(p => ({
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
            canonical_url: p.canonical_url
        }));
        await handleExport(dataToExport, "Natural_Skin_Posts_Export.xlsx", "Posts");
    };

    const handleExportCategories = async () => {
        await handleExport(categories, "Natural_Skin_Categories_Export.xlsx", "Categories");
    };

    const handleDownloadPostTemplate = async () => {
        const templateData = [{
            slug: "ten-bai-viet-khong-dau (để trống sẽ tự tạo)",
            title: "Tiêu đề bài viết (Bắt buộc)",
            summary: "Tóm tắt ngắn gọn",
            content: "Nội dung đầy đủ. Sử dụng ### cho tiêu đề phụ.",
            title_en: "Translated English title",
            summary_en: "Translated English summary",
            content_en: "Translated English markdown body",
            title_ru: "Переведенный заголовок",
            summary_ru: "Переведенное краткое описание",
            content_ru: "Переведенный markdown-текст",
            title_cn: "中文标题",
            summary_cn: "中文摘要",
            content_cn: "中文 Markdown 正文",
            category_slug: "slug-cua-chuyen-muc (Bắt buộc)",
            image_path: "blog/ten-anh.webp (Tùy chọn, ảnh phải được tải lên trước)",
            meta_description: "Mô tả SEO dưới 160 ký tự.",
            meta_keywords: "tu khoa 1, tu khoa 2, tu khoa 3",
            canonical_url: "https://nguon-bai-viet.com/url (nếu có)"
        }];
        await handleExport(templateData, "Natural_Skin_Post_Template.xlsx", "Template");
    };

    const handleDownloadCategoryTemplate = async () => {
        const templateData = [{
            slug: "ten-chuyen-muc-khong-dau",
            name: "Tên chuyên mục",
            name_en: "English category name",
            name_ru: "Название категории на русском",
            name_cn: "中文分类名"
        }];
        await handleExport(templateData, "Natural_Skin_Category_Template.xlsx", "Template");
    }

    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>, type: 'post' | 'category') => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        addToast('Đang xử lý tệp...', { type: 'info' });

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
                const categoryExists = categories.some(c => c.slug === row.category_slug);
                if (!categoryExists) {
                    throw new Error(`Chuyên mục với slug '${row.category_slug}' không tồn tại.`);
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
                    canonical_url: row.canonical_url || ''
                };

                await onSavePost(postToSave, null);
                successCount++;
            } catch (err: any) {
                errors.push(`Dòng ${index + 2}: ${err.message}`);
            }
        }
        addToast(t('admin.import_completed'), {
            type: errors.length > 0 ? 'info' : 'success',
            description: `${successCount} ${t('admin.import_success_count')}, ${errors.length} ${t('admin.import_failed_count')}.`
        });
        if (errors.length > 0) {
            console.error("Import errors:", errors);
        }
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
            description: `${successCount} ${t('admin.import_success_count')}, ${errors.length} ${t('admin.import_failed_count')}.`
        });
        if (errors.length > 0) {
            console.error("Import errors:", errors);
        }
    };

    const renderContent = () => {
        if (adminView === 'edit-post') {
            if (isLoadingPostDetail) {
                return (
                    <div className="rounded-xl border border-border bg-card p-8">
                        <div className="flex min-h-[280px] items-center justify-center">
                            <Spinner className="h-8 w-8" />
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
                    onRetryLoadDetail={selectedPost ? () => { void resolvePostDetail(selectedPost); } : undefined}
                    previousPost={previousPost}
                    nextPost={nextPost}
                    postPositionLabel={postPositionLabel}
                    onSelectPreviousPost={previousPost ? () => { void resolvePostDetail(previousPost); } : undefined}
                    onSelectNextPost={nextPost ? () => { void resolvePostDetail(nextPost); } : undefined}
                />
            );
        }

        return (
            <>
                {activeTab !== 'categories' && (
                    <div>

                        <div className="mb-4 rounded-[1.4rem]">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                            <div className="min-w-0">
                                <h3 className="text-xl font-bold">{currentPostsTitle} ({activePostCollection.length})</h3>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 xl:justify-end bg-transparent p-1.5 rounded-[1.25rem]">
                                <button onClick={handleDownloadPostTemplate} className={adminActionButtonClass}>
                                    <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-taifilemau.webp" alt="" className="w-5 h-5 object-contain" />
                                    <span>{t('admin.download_template')}</span>
                                </button>
                                <button onClick={() => postFileInputRef.current?.click()} disabled={isImporting} className={`${adminActionButtonClass} disabled:opacity-50`}>
                                    {isImporting ? <Spinner className="w-5 h-5" /> : <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-inputexcel.webp" alt="" className="w-5 h-5 object-contain" />}
                                    <span>{t('admin.import_excel')}</span>
                                </button>
                                <input type="file" ref={postFileInputRef} onChange={(e) => handleImportFile(e, 'post')} accept=".xlsx, .xls" className="hidden" />
                                <button onClick={handleExportPosts} className={adminActionButtonClass}>
                                    <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-outputexcel.webp" alt="" className="w-5 h-5 object-contain" />
                                    <span>{t('admin.export_excel')}</span>
                                </button>
                                <button onClick={handleAddNewPost} className={adminPrimaryActionButtonClass}>
                                    <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-themmoi.webp" alt="" className="w-5 h-5 object-contain" />
                                    <span>{t('admin.add_post')}</span>
                                </button>
                            </div>
                        </div>
                        </div>

                        {(() => {
                            const totalPosts = activePostCollection.length;
                            const totalPostPages = Math.ceil(totalPosts / ITEMS_PER_PAGE);
                            const currentPosts = activePostCollection.slice(
                                (postsCurrentPage - 1) * ITEMS_PER_PAGE,
                                postsCurrentPage * ITEMS_PER_PAGE
                            );

                            return (
                                <>
                                    <AdminMobileList>
                                        {currentPosts.length === 0 ? (
                                            <AdminMobileCard>
                                                <p className="text-base font-bold text-foreground">Không có bài viết nào trong hàng đợi này.</p>
                                                <p className="mt-2 text-sm leading-6 text-muted-foreground">Đổi bộ lọc hoặc thêm bài viết mới để tiếp tục.</p>
                                            </AdminMobileCard>
                                        ) : currentPosts.map(post => (
                                            <AdminMobileCard key={post.slug}>
                                                <p className="line-clamp-2 text-base font-black leading-6 text-foreground">{post.title}</p>
                                                <div className="mt-3 grid grid-cols-2 gap-2">
                                                    <AdminMobileMeta label={t('admin.table_author')} value={post.author?.name || t('admin.unknown')} />
                                                    <AdminMobileMeta label={t('admin.table_category')} value={categories.find(c => c.slug === post.category_slug)?.name || 'Chưa phân loại'} />
                                                    <AdminMobileMeta label={t('admin.table_date')} value={new Date(post.date).toLocaleDateString()} className="col-span-2" />
                                                </div>
                                                <div className="mt-4 grid grid-cols-2 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => { void handleEditPost(post); }}
                                                        data-testid={`admin-blog-edit-post-${post.slug}`}
                                                        aria-label={`Chỉnh sửa bài viết ${post.title}`}
                                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-3 text-sm font-bold text-foreground transition-colors hover:border-primary/35 hover:text-primary"
                                                    >
                                                        <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="Edit" className="h-4 w-4 object-contain" />
                                                        Sửa
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onDeletePost(post.slug)}
                                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-3 text-sm font-bold text-muted-foreground transition-colors hover:border-destructive/35 hover:text-destructive"
                                                    >
                                                        <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="Delete" className="h-4 w-4 object-contain" />
                                                        Xóa
                                                    </button>
                                                </div>
                                            </AdminMobileCard>
                                        ))}
                                    </AdminMobileList>
                                    <div className="hidden overflow-hidden rounded-[1.25rem] lg:block">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-muted/50 text-muted-foreground uppercase">
                                                    <tr>
                                                        <th className="px-4 py-3">{t('admin.table_title')}</th>
                                                        <th className="px-4 py-3">{t('admin.table_author')}</th>
                                                        <th className="px-4 py-3">{t('admin.table_category')}</th>
                                                        <th className="px-4 py-3">{t('admin.table_date')}</th>
                                                        <th className="px-4 py-3 text-right">{t('admin.table_actions')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {currentPosts.map(post => (
                                                        <tr key={post.slug} className="border-b border-border last:border-0">
                                                            <td className="px-4 py-3 font-medium">{post.title}</td>
                                                            <td className="px-4 py-3">
                                                                <div className="relative group/author inline-flex items-center">
                                                                    {post.author?.avatar_url || post.author?.avatar_path ? (
                                                                        <img
                                                                            src={post.author.avatar_url || post.author.avatar_path}
                                                                            alt={post.author.name || t('admin.unknown')}
                                                                            title={post.author.name || t('admin.unknown')}
                                                                            className="h-8 w-8 rounded-full object-cover ring-2 ring-border transition-transform group-hover/author:scale-110 shadow-sm"
                                                                        />
                                                                    ) : (
                                                                        <div
                                                                            title={post.author?.name || t('admin.unknown')}
                                                                            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs ring-2 ring-primary/20 transition-transform group-hover/author:scale-110 shadow-sm"
                                                                        >
                                                                            {(post.author?.name || 'A').charAt(0).toUpperCase()}
                                                                        </div>
                                                                    )}
                                                                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/author:block whitespace-nowrap rounded-lg bg-popover px-2.5 py-1 text-xs font-semibold text-popover-foreground shadow-lg border border-border/80 z-20">
                                                                        {post.author?.name || t('admin.unknown')}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3">{categories.find(c => c.slug === post.category_slug)?.name}</td>
                                                            <td className="px-4 py-3">{new Date(post.date).toLocaleDateString()}</td>
                                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <div className="relative group inline-flex">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => { void handleEditPost(post); }}
                                                                            data-testid={`admin-blog-edit-post-${post.slug}`}
                                                                            aria-label={`Chỉnh sửa bài viết ${post.title}`}
                                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl transition-all hover:scale-110 hover:bg-card/40 active:scale-95 text-muted-foreground hover:text-primary"
                                                                        >
                                                                            <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="Edit" className="w-5 h-5 object-contain" />
                                                                        </button>
                                                                        <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                                                            Chỉnh sửa
                                                                        </span>
                                                                    </div>
                                                                    <div className="relative group inline-flex">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => onDeletePost(post.slug)}
                                                                            aria-label={`Xóa bài viết ${post.title}`}
                                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl transition-all hover:scale-110 hover:bg-card/40 active:scale-95 text-muted-foreground hover:text-destructive"
                                                                        >
                                                                            <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="Delete" className="w-5 h-5 object-contain" />
                                                                        </button>
                                                                        <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                                                            Xóa bài viết
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <Pagination
                                        currentPage={postsCurrentPage}
                                        totalPages={totalPostPages}
                                        onPageChange={setPostsCurrentPage}
                                    />
                                </>
                            );
                        })()}
                    </div>
                )}

                {activeTab === 'categories' && (
                    <div>
                        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
                            <h3 className="text-xl font-bold">{t('admin.categories_list')} ({categories.length})</h3>
                            <div className="flex flex-wrap items-center gap-2 xl:justify-end bg-transparent p-1.5 rounded-[1.25rem]">
                                <button onClick={handleDownloadCategoryTemplate} className={adminActionButtonClass}>
                                    <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-taifilemau.webp" alt="" className="w-5 h-5 object-contain" />
                                    <span>{t('admin.download_template')}</span>
                                </button>
                                <button onClick={() => categoryFileInputRef.current?.click()} disabled={isImporting} className={`${adminActionButtonClass} disabled:opacity-50`}>
                                    {isImporting ? <Spinner className="w-5 h-5" /> : <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-inputexcel.webp" alt="" className="w-5 h-5 object-contain" />}
                                    <span>{t('admin.import_excel')}</span>
                                </button>
                                <input type="file" ref={categoryFileInputRef} onChange={(e) => handleImportFile(e, 'category')} accept=".xlsx, .xls" className="hidden" />
                                <button onClick={handleExportCategories} className={adminActionButtonClass}>
                                    <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-outputexcel.webp" alt="" className="w-5 h-5 object-contain" />
                                    <span>{t('admin.export_excel')}</span>
                                </button>
                            </div>
                        </div>
                        <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
                            <div className="rounded-[1.25rem] p-3 lg:p-4">
                                <h4 className="text-lg font-bold mb-4">Danh mục hiện có</h4>
                                <ul className="divide-y divide-border/50">
                                    {categories.map(cat => (
                                        <li key={cat.slug} className="py-3.5 first:pt-0 last:pb-0">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate font-bold text-foreground">{cat.name}</p>
                                                    <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{cat.slug}</p>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-1">
                                                    <div className="relative group inline-flex">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEditCategory(cat)}
                                                            aria-label={`Chỉnh sửa chuyên mục ${cat.name}`}
                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl transition-all hover:scale-110 hover:bg-card/40 active:scale-95 text-muted-foreground hover:text-primary"
                                                        >
                                                            <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-edit.webp" alt="Edit" className="w-5 h-5 object-contain" />
                                                        </button>
                                                        <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                                            Chỉnh sửa
                                                        </span>
                                                    </div>
                                                    <div className="relative group inline-flex">
                                                        <button
                                                            type="button"
                                                            onClick={() => onDeleteCategory(cat.slug)}
                                                            aria-label={`Xóa chuyên mục ${cat.name}`}
                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl transition-all hover:scale-110 hover:bg-card/40 active:scale-95 text-muted-foreground hover:text-destructive"
                                                        >
                                                            <img src="https://thegioitrimun.vn/r2/assets/admin-icons/20260718102440-delete.webp" alt="Delete" className="w-5 h-5 object-contain" />
                                                        </button>
                                                        <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                                            Xóa danh mục
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="rounded-[1.25rem] bg-card p-4 shadow-lg sm:p-6">
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <h4 className="text-lg font-bold">{editingCategorySlug ? 'Chỉnh sửa chuyên mục' : t('admin.add_new_category')}</h4>
                                    {editingCategorySlug && (
                                        <button type="button" onClick={resetCategoryForm} className="text-sm font-semibold text-primary hover:underline">
                                            Tạo mới
                                        </button>
                                    )}
                                </div>
                                <form onSubmit={handleAddNewCategory} className="space-y-4">
                                    <div>
                                        <label className="text-sm font-medium">{t('admin.category_name')}</label>
                                        <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="mt-1 w-full admin-glass-input" required />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between gap-3">
                                            <label className="text-sm font-medium">Tên English</label>
                                            <button
                                                type="button"
                                                onClick={handleGenerateCategoryTranslations}
                                                disabled={isGeneratingCategoryTranslations || !newCategoryName.trim()}
                                                className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {isGeneratingCategoryTranslations ? <Spinner className="w-4 h-4" /> : <SparklesIcon className="w-4 h-4" />}
                                                <span>AI tạo bản dịch</span>
                                            </button>
                                        </div>
                                        <input type="text" value={newCategoryNameEn} onChange={e => setNewCategoryNameEn(e.target.value)} className="mt-1 w-full admin-glass-input" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Tên Russian</label>
                                        <input type="text" value={newCategoryNameRu} onChange={e => setNewCategoryNameRu(e.target.value)} className="mt-1 w-full admin-glass-input" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Tên Chinese</label>
                                        <input type="text" value={newCategoryNameCn} onChange={e => setNewCategoryNameCn(e.target.value)} className="mt-1 w-full admin-glass-input" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Slug</label>
                                        <input
                                            type="text"
                                            value={newCategorySlug}
                                            onChange={e => {
                                                setIsCategorySlugManual(true);
                                                setNewCategorySlug(generateSlug(e.target.value));
                                            }}
                                            className="mt-1 w-full admin-glass-input"
                                            placeholder="vi-du-slug"
                                            required
                                            disabled={Boolean(editingCategorySlug)}
                                        />
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {editingCategorySlug
                                                ? 'Slug bị khóa khi sửa để tránh làm gãy URL và chuyên mục của các bài viết đang có.'
                                                : 'Slug sẽ tự tạo từ tên chuyên mục. Bạn vẫn có thể sửa tay nếu cần.'}
                                        </p>
                                    </div>
                                    <button type="submit" disabled={isSavingCategory} className="w-full bg-primary text-primary-foreground font-bold py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors btn-press disabled:cursor-not-allowed disabled:opacity-60">
                                        {isSavingCategory ? <Spinner className="w-5 h-5 mx-auto" /> : (editingCategorySlug ? 'Cập nhật chuyên mục' : t('admin.add_new'))}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    };

    return (
        <AnimatedSection stagger={100}>
            {renderContent()}
        </AnimatedSection>
    );
};

export default AdminBlogManagementPage;
