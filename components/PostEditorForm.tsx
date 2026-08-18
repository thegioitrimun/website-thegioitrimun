import React, { useState, useEffect } from 'react';
import type { BlogPost, BlogCategory, UserData } from '../types';
import { ImageDropzone } from './ImageDropzone';
import Spinner from './Spinner';
import MarkdownRenderer from './MarkdownRenderer';
import AdminEditorShell from './AdminEditorShell';
import { ArrowLeftIcon, ArrowRightIcon, EyeIcon, PencilIcon, SparklesIcon } from './icons';
import * as geminiService from '../services/geminiService';
import useAdminLocalDraft from '../hooks/useAdminLocalDraft';
import { useTranslation } from 'react-i18next';
import LocalSeoTagsEditor from './LocalSeoTagsEditor';

interface PostEditorFormProps {
    currentUser: UserData;
    post: BlogPost | null;
    categories: BlogCategory[];
    onSave: (post: BlogPost, imageFile: File | null) => Promise<void>;
    onCancel: () => void;
    isContentHydrated?: boolean;
    onRetryLoadDetail?: () => void;
    previousPost?: BlogPost | null;
    nextPost?: BlogPost | null;
    postPositionLabel?: string | null;
    onSelectPreviousPost?: () => void;
    onSelectNextPost?: () => void;
}

const BLOG_LOCALES = [
    { code: 'en', label: 'English' },
    { code: 'ru', label: 'Русский' },
    { code: 'cn', label: '中文' },
] as const;

const createEmptyFormData = (authorId: string, categorySlug: string): Omit<BlogPost, 'date' | 'author'> => ({
    slug: '',
    title: '',
    summary: '',
    content: '',
    title_en: '',
    title_ru: '',
    title_cn: '',
    summary_en: '',
    summary_ru: '',
    summary_cn: '',
    content_en: '',
    content_ru: '',
    content_cn: '',
    author_id: authorId,
    category_slug: categorySlug,
    image_path: '',
    meta_description: '',
    meta_keywords: '',
    canonical_url: '',
    local_seo_tags: [],
});

const mapPostToFormData = (post: BlogPost): Omit<BlogPost, 'date' | 'author'> => ({
    slug: post.slug || '',
    title: post.title || '',
    summary: post.summary || '',
    content: post.content || '',
    title_en: post.title_en || '',
    title_ru: post.title_ru || '',
    title_cn: post.title_cn || '',
    summary_en: post.summary_en || '',
    summary_ru: post.summary_ru || '',
    summary_cn: post.summary_cn || '',
    content_en: post.content_en || '',
    content_ru: post.content_ru || '',
    content_cn: post.content_cn || '',
    author_id: post.author_id,
    category_slug: post.category_slug || '',
    image_path: post.image_path || '',
    meta_description: post.meta_description || '',
    meta_keywords: post.meta_keywords || '',
    canonical_url: post.canonical_url || '',
    local_seo_tags: post.local_seo_tags || [],
});

const PostEditorForm: React.FC<PostEditorFormProps> = ({
    currentUser,
    post,
    categories,
    onSave,
    onCancel,
    isContentHydrated = true,
    onRetryLoadDetail,
    previousPost = null,
    nextPost = null,
    postPositionLabel = null,
    onSelectPreviousPost,
    onSelectNextPost,
}) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Omit<BlogPost, 'date' | 'author'>>(
        createEmptyFormData(currentUser.profile.id, categories[0]?.slug || ''),
    );
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [isGeneratingSEO, setIsGeneratingSEO] = useState(false);
    const [isGeneratingTranslations, setIsGeneratingTranslations] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const draftStorageKey = `admin-editor-draft:post:${post?.slug || 'new'}`;
    const {
        lastSavedAt: postDraftSavedAt,
        hasRestorableDraft: hasRestorablePostDraft,
        restoreDraft: restorePostDraft,
        discardDraft: discardPostDraft,
        clearDraft: clearPostDraft,
        note: postDraftNote,
        remoteStatus: postDraftStatus,
    } = useAdminLocalDraft({
        storageKey: draftStorageKey,
        remoteDraftKey: draftStorageKey,
        value: { formData },
        enabled: hasUnsavedChanges,
        onRestore: (draft) => {
            setFormData(draft.formData);
            setHasUnsavedChanges(true);
        },
    });

    useEffect(() => {
        if (post) {
            setFormData(mapPostToFormData(post));
            setPreviewUrl(post.image_url || null);
        } else {
            setFormData(createEmptyFormData(currentUser.profile.id, categories[0]?.slug || ''));
            setPreviewUrl(null);
        }
        setImageFile(null);
        setHasUnsavedChanges(false);
    }, [post, categories, currentUser]);

    const markDirty = () => setHasUnsavedChanges(true);

    const handleCancelRequest = () => {
        if (hasUnsavedChanges && !window.confirm('Bạn có thay đổi chưa lưu. Rời editor sẽ mất các thay đổi này. Tiếp tục?')) {
            return;
        }
        onCancel();
    };

    const handleImageFileSelected = (files: File[]) => {
        if (files.length > 0) {
            const file = files[0];
            markDirty();
            setImageFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        markDirty();
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const generateSlug = (title: string) => {
        return title
            .toLowerCase()
            .replace(/đ/g, 'd')
            .replace(/ /g, '-')
            .replace(/[^\w-]+/g, '');
    };

    useEffect(() => {
        if (!post) { // only auto-generate slug for new posts
            setFormData(prev => ({ ...prev, slug: generateSlug(prev.title) }))
        }
    }, [formData.title, post]);

    const handleGenerateSEO = async () => {
        if (!formData.title || !formData.content) {
            alert(t('post_form.alert_empty_seo', "Vui lòng nhập tiêu đề và nội dung trước khi tạo SEO."));
            return;
        }
        setIsGeneratingSEO(true);
        try {
            const result = await geminiService.generateSEOMetadata(formData.title, formData.content);
            setFormData(prev => ({
                ...prev,
                meta_description: result.meta_description,
                meta_keywords: result.meta_keywords,
            }));
            setHasUnsavedChanges(true);
        } catch (error) {
            console.error("Error generating SEO", error);
            alert(t('post_form.alert_error_seo', "Không thể tạo metadata SEO."));
        } finally {
            setIsGeneratingSEO(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const finalPostData: BlogPost = {
                ...formData,
                date: post ? post.date : new Date().toISOString().split('T')[0],
            };
            await onSave(finalPostData, imageFile);
            setHasUnsavedChanges(false);
            clearPostDraft();
        } catch (error) {
            console.error("Error saving post", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateTranslations = async () => {
        if (!formData.title || !formData.summary || !formData.content) {
            alert('Vui lòng nhập tiêu đề, tóm tắt và nội dung tiếng Việt trước khi tạo bản dịch.');
            return;
        }

        setIsGeneratingTranslations(true);
        try {
            const translations = await geminiService.generateBlogSeoTranslations({
                title: formData.title,
                summary: formData.summary,
                content: formData.content,
            });
            setFormData(prev => ({
                ...prev,
                ...translations,
            }));
            setHasUnsavedChanges(true);
        } catch (error) {
            console.error("Error generating translations", error);
            alert('Không thể tạo bản dịch SEO cho bài viết.');
        } finally {
            setIsGeneratingTranslations(false);
        }
    };

    return (
        <AdminEditorShell
            testId="admin-blog-post-editor"
            eyebrow="Content editor"
            title={post ? t('post_form.edit_title', 'Chỉnh sửa bài viết') : t('post_form.new_title', 'Tạo bài viết mới')}
            description="Bài viết được chỉnh theo workflow chung: nội dung chính, bản dịch SEO, taxonomy và metadata."
            positionLabel={postPositionLabel}
            isDirty={hasUnsavedChanges}
            isSaving={isLoading || isGeneratingSEO || isGeneratingTranslations}
            sections={[
                { id: 'post-editor-core', label: 'Nội dung chính' },
                { id: 'post-editor-translations', label: 'Bản dịch SEO' },
                { id: 'post-editor-taxonomy', label: 'Phân loại' },
                { id: 'post-editor-seo', label: t('post_form.seo_opt', 'Tối ưu hóa SEO') },
            ]}
            draftState={{
                lastSavedAt: postDraftSavedAt,
                hasRestorableDraft: hasRestorablePostDraft,
                onRestore: restorePostDraft,
                onDiscard: discardPostDraft,
                label: 'Autosave local + server',
                status: postDraftStatus,
                note: `${postDraftNote} Ảnh local mới chọn sẽ không nằm trong autosave.`,
            }}
            headerActions={post ? (
                <>
                    <button
                        type="button"
                        onClick={onSelectPreviousPost}
                        disabled={!previousPost || isLoading || isGeneratingSEO || isGeneratingTranslations}
                        className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                        <span className="max-w-[180px] truncate">{previousPost?.title || 'Bài trước'}</span>
                    </button>
                    <button
                        type="button"
                        onClick={onSelectNextPost}
                        disabled={!nextPost || isLoading || isGeneratingSEO || isGeneratingTranslations}
                        className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <span className="max-w-[180px] truncate">{nextPost?.title || 'Bài sau'}</span>
                        <ArrowRightIcon className="h-4 w-4" />
                    </button>
                </>
            ) : null}
        >
            <form data-testid="admin-blog-post-editor-form" onSubmit={handleSubmit} className="space-y-6 xl:space-y-7">
                <div id="post-editor-core" className="grid grid-cols-1 md:grid-cols-2 gap-6 scroll-mt-28 rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0 p-5 md:p-6">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">{t('post_form.title_label', 'Tiêu đề')}</label>
                        <input type="text" name="title" value={formData.title} onChange={handleChange} className="w-full admin-glass-input" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">{t('post_form.slug', 'Slug (URL)')}</label>
                        <input type="text" name="slug" value={formData.slug} onChange={handleChange} className="w-full admin-glass-input" required />
                    </div>
                </div>

                <div className="scroll-mt-28">
                    <label className="block text-sm font-medium text-foreground mb-1">{t('post_form.cover_image', 'Ảnh đại diện')}</label>
                    <div className="mt-1 flex flex-col md:flex-row items-start gap-4">
                        {previewUrl && <img src={previewUrl} alt="Preview" className="w-48 h-24 object-cover rounded-md flex-shrink-0" />}
                        <div className="w-full flex-grow">
                            <ImageDropzone
                                onFilesSelected={handleImageFileSelected}
                                helpText={t('post_form.upload_image', "Tải lên một ảnh")}
                                className="h-24"
                            />
                        </div>
                    </div>
                </div>

                <div className="scroll-mt-28">
                    <label className="block text-sm font-medium text-foreground mb-1">{t('post_form.summary', 'Tóm tắt')}</label>
                    <textarea name="summary" value={formData.summary} onChange={handleChange} rows={3} className="w-full admin-glass-input" required></textarea>
                </div>

                <div className="scroll-mt-28">
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-foreground">{t('post_form.content_md', 'Nội dung (hỗ trợ Markdown)')}</label>
                        <button type="button" onClick={() => setShowPreview(!showPreview)} className="flex items-center gap-1.5 text-sm text-primary font-semibold p-1 hover:bg-primary/10 rounded-md transition-colors">
                            {showPreview ? <><PencilIcon className="w-4 h-4" /> {t('post_form.edit', 'Soạn thảo')}</> : <><EyeIcon className="w-4 h-4" /> {t('post_form.preview', 'Xem trước')}</>}
                        </button>
                    </div>
                    {!isContentHydrated && post ? (
                        <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                            <p className="font-semibold">Bài viết này chưa nạp đủ nội dung chi tiết.</p>
                            <p className="mt-1 text-amber-900/85">
                                Editor đang hiển thị bản dữ liệu chưa đầy đủ. Hãy tải lại nội dung thật từ database trước khi chỉnh sửa để tránh ghi đè nhầm.
                            </p>
                            {onRetryLoadDetail ? (
                                <button
                                    type="button"
                                    onClick={onRetryLoadDetail}
                                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-400 bg-white px-4 py-2 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100"
                                >
                                    Tải lại nội dung thật
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                    {showPreview ? (
                        <div className="p-4 border border-input rounded-md bg-muted/50 min-h-[240px]">
                            <MarkdownRenderer content={formData.content || t('post_form.content_placeholder', '... Bắt đầu nhập nội dung để xem trước ...')} />
                        </div>
                    ) : (
                        <textarea name="content" value={formData.content} onChange={handleChange} rows={10} className="w-full admin-glass-input font-mono text-sm" placeholder={t('post_form.content_placeholder_raw', '### Tiêu đề phụ\n*   Mục danh sách')} required></textarea>
                    )}
                </div>

                <fieldset id="post-editor-translations" className="space-y-5 rounded-[1.6rem] border border-border/80 bg-secondary/20 p-5 md:p-6 scroll-mt-28">
                    <legend className="px-2 font-semibold text-lg text-primary">Bản dịch SEO ưu tiên</legend>
                    <div className="flex items-center justify-end">
                        <button
                            type="button"
                            onClick={handleGenerateTranslations}
                            disabled={isGeneratingTranslations || !formData.title || !formData.summary || !formData.content}
                            className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isGeneratingTranslations ? <Spinner className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
                            <span>AI tạo bản dịch SEO</span>
                        </button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Nhập bản dịch hoàn chỉnh cho những ngôn ngữ cần index. Nếu để trống, giao diện người dùng vẫn có thể fallback về tiếng Việt nhưng worker SEO sẽ không phát alternate detail page cho locale đó.
                    </p>
                    {BLOG_LOCALES.map(({ code, label }) => (
                        <div key={code} className="space-y-3 rounded-[1.25rem] border border-border bg-background/85 p-4">
                            <h3 className="font-semibold text-foreground">{label}</h3>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Tiêu đề {label}</label>
                                <input
                                    type="text"
                                    name={`title_${code}`}
                                    value={((formData as unknown) as Record<string, string | undefined>)[`title_${code}`] || ''}
                                    onChange={handleChange}
                                    className="w-full admin-glass-input"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Tóm tắt {label}</label>
                                <textarea
                                    name={`summary_${code}`}
                                    value={((formData as unknown) as Record<string, string | undefined>)[`summary_${code}`] || ''}
                                    onChange={handleChange}
                                    rows={3}
                                    className="w-full admin-glass-input"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Nội dung {label} (Markdown)</label>
                                <textarea
                                    name={`content_${code}`}
                                    value={((formData as unknown) as Record<string, string | undefined>)[`content_${code}`] || ''}
                                    onChange={handleChange}
                                    rows={8}
                                    className="w-full admin-glass-input font-mono text-sm"
                                    placeholder="### Heading&#10;Translated body..."
                                />
                            </div>
                        </div>
                    ))}
                </fieldset>

                <div id="post-editor-taxonomy" className="grid grid-cols-1 md:grid-cols-2 gap-6 scroll-mt-28 rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0 p-5 md:p-6">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">{t('post_form.author', 'Tác giả')}</label>
                        <div className="w-full admin-glass-input bg-muted/20 opacity-80 text-muted-foreground">
                            {currentUser.profile.name} ({t('common.you', 'Bạn')})
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">{t('post_form.category', 'Chuyên mục')}</label>
                        <select name="category_slug" value={formData.category_slug} onChange={handleChange} className="w-full admin-glass-input" required>
                            {categories.map(cat => <option key={cat.slug} value={cat.slug}>{cat.name}</option>)}
                        </select>
                    </div>
                </div>

                <fieldset id="post-editor-seo" className="space-y-4 rounded-[1.7rem] bg-card/25 backdrop-blur-2xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border-0 p-5 md:p-6 scroll-mt-28">
                    <legend className="px-2 font-semibold text-lg text-primary">{t('post_form.seo_opt', 'Tối ưu hóa SEO')}</legend>
                    <div className="flex items-center justify-end">
                        <button
                            type="button"
                            onClick={handleGenerateSEO}
                            disabled={isGeneratingSEO}
                            className="flex items-center gap-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-bold py-2 px-4 rounded-md transition-colors btn-press text-sm disabled:opacity-50"
                        >
                            {isGeneratingSEO ? <Spinner className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
                            <span>{t('post_form.auto_generate_ai', 'Tạo tự động với AI')}</span>
                        </button>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Meta Description</label>
                        <textarea name="meta_description" value={formData.meta_description || ''} onChange={handleChange} rows={3} className="w-full admin-glass-input" placeholder={t('post_form.meta_desc_placeholder', "Mô tả ngắn gọn, hấp dẫn cho kết quả tìm kiếm (dưới 160 ký tự)")}></textarea>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Meta Keywords</label>
                        <input type="text" name="meta_keywords" value={formData.meta_keywords || ''} onChange={handleChange} className="w-full admin-glass-input" placeholder="vd: tri mun, cham soc da, da lieu" />
                        <p className="text-xs text-muted-foreground mt-1">{t('post_form.meta_keywords_help', "Các từ khóa phân tách bằng dấu phẩy.")}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Canonical URL</label>
                        <input type="url" name="canonical_url" value={formData.canonical_url || ''} onChange={handleChange} className="w-full admin-glass-input" placeholder={t('post_form.canonical_placeholder', "Để trống nếu đây là bài viết gốc")} />
                        <p className="text-xs text-muted-foreground mt-1">{t('post_form.canonical_help', "Sử dụng nếu bài viết này được sao chép từ một nguồn khác để tránh bị phạt trùng lặp nội dung.")}</p>
                    </div>
                    <LocalSeoTagsEditor
                        value={formData.local_seo_tags}
                        onChange={(tags) => {
                            markDirty();
                            setFormData((prev) => ({ ...prev, local_seo_tags: tags }));
                        }}
                    />
                </fieldset>

                <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-5">
                    <button type="button" onClick={handleCancelRequest} className="bg-muted hover:bg-muted/80 text-muted-foreground font-bold py-2 px-6 rounded-full transition-colors btn-press">
                        {t('common.cancel', 'Hủy')}
                    </button>
                    <button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-6 rounded-full transition-colors btn-press flex items-center justify-center min-w-[120px]" disabled={isLoading || isGeneratingTranslations}>
                        {isLoading ? <Spinner className="w-5 h-5" /> : t('post_form.save', 'Lưu bài viết')}
                    </button>
                </div>
            </form>
        </AdminEditorShell>
    );
};

export default PostEditorForm;
