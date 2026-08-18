import React, { useState, useEffect } from 'react';
import type { Service, ProcedureStep } from '../types';
import { availableIcons, convertImageToWebP, uploadPublicAsset } from '../services/api';
import { PlusCircleIcon, TrashIcon } from '../components/icons';
import Spinner from './Spinner';
import { ImageDropzone } from './ImageDropzone';
import DetailFaqEditor from './DetailFaqEditor';
import AdminEditorShell from './AdminEditorShell';
import { useTranslation } from 'react-i18next';
import useAdminLocalDraft from '../hooks/useAdminLocalDraft';
import { normalizeDetailFaqItems, sanitizeDetailFaqItems } from '../src/detailFaq';
import { buildServiceStepImagePath } from '../src/imageSeo';
import LocalSeoTagsEditor from './LocalSeoTagsEditor';

interface ServiceEditorFormProps {
    service: Partial<Service> | null;
    onSave: (service: Partial<Service>, imageFile: File | null) => Promise<void> | void;
    onCancel: () => void;
}

const ServiceEditorForm: React.FC<ServiceEditorFormProps> = ({ service, onSave, onCancel }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Partial<Service>>({
        slug: '',
        name: '',
        description: '',
        long_description: '',
        benefits: [],
        icon: availableIcons[0] || '',
        price: 0,
        procedure_steps: [],
        faq_items: [],
        local_seo_tags: [],
    });
    const [benefitsText, setBenefitsText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSlugDirty, setIsSlugDirty] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const draftStorageKey = `admin-editor-draft:service:${service?.id ?? 'new'}`;
    const serviceDraftSnapshot = {
        formData: {
            ...formData,
            faq_items: normalizeDetailFaqItems(formData.faq_items),
            procedure_steps: (formData.procedure_steps || []).map((step) => ({
                id: step.id,
                step_number: step.step_number,
                title: step.title,
                description: step.description,
                image_path: step.image_path || '',
            })),
        },
        benefitsText,
    };
    const {
        lastSavedAt: serviceDraftSavedAt,
        hasRestorableDraft: hasRestorableServiceDraft,
        restoreDraft: restoreServiceDraft,
        discardDraft: discardServiceDraft,
        clearDraft: clearServiceDraft,
        note: serviceDraftNote,
        remoteStatus: serviceDraftStatus,
    } = useAdminLocalDraft({
        storageKey: draftStorageKey,
        remoteDraftKey: draftStorageKey,
        value: serviceDraftSnapshot,
        enabled: hasUnsavedChanges,
        onRestore: (draft) => {
            setFormData({
                ...draft.formData,
                faq_items: normalizeDetailFaqItems(draft.formData.faq_items),
            });
            setBenefitsText(draft.benefitsText || '');
            setHasUnsavedChanges(true);
        },
    });

    const generateSlug = (value: string) =>
        String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/gi, 'd')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .replace(/-{2,}/g, '-');

    useEffect(() => {
        if (service) {
            setFormData({
                id: service.id,
                slug: service.slug || generateSlug(service.name || ''),
                name: service.name || '',
                description: service.description || '',
                long_description: service.long_description || '',
                benefits: service.benefits || [],
                icon: service.icon || availableIcons[0] || '',
                price: service.price || 0,
                image_path: service.image_path,
                procedure_steps: service.procedure_steps?.map(step => ({ ...step })) || [], // Deep copy
                faq_items: normalizeDetailFaqItems(service.faq_items),
                local_seo_tags: service.local_seo_tags || [],
            });
            setBenefitsText((service.benefits || []).join('\n'));
            setPreviewUrl(service.image_url || null);
            setImageFile(null);
            setIsSlugDirty(Boolean(service.slug));
            setHasUnsavedChanges(false);
        } else {
            // Reset for new service
            setFormData({
                slug: '',
                name: '',
                description: '',
                long_description: '',
                benefits: [],
                icon: availableIcons[0] || '',
                price: 0,
                procedure_steps: [],
                faq_items: [],
                local_seo_tags: [],
            });
            setBenefitsText('');
            setPreviewUrl(null);
            setImageFile(null);
            setIsSlugDirty(false);
            setHasUnsavedChanges(false);
        }
    }, [service]);

    const markDirty = () => setHasUnsavedChanges(true);

    const handleCancelRequest = () => {
        if (hasUnsavedChanges && !window.confirm('Bạn có thay đổi chưa lưu. Rời editor sẽ mất các thay đổi này. Tiếp tục?')) {
            return;
        }
        onCancel();
    };

    useEffect(() => {
        if (!service && formData.name && !isSlugDirty) {
            setFormData(prev => ({ ...prev, slug: generateSlug(prev.name || '') }));
        }
    }, [formData.name, isSlugDirty, service]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const finalValue = (e.target as HTMLInputElement).type === 'number' ? (value === '' ? '' : parseFloat(value)) : value;
        if (name === 'slug') {
            setIsSlugDirty(true);
        }
        markDirty();
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleBenefitsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        markDirty();
        setBenefitsText(e.target.value);
        setFormData(prev => ({ ...prev, benefits: e.target.value.split('\n').filter(b => b.trim() !== '') }));
    }

    const handleImageSelected = (files: File[]) => {
        if (files[0]) {
            markDirty();
            setImageFile(files[0]);
            setPreviewUrl(URL.createObjectURL(files[0]));
        }
    };

    const handleStepChange = (index: number, field: keyof Omit<ProcedureStep, 'id'>, value: any) => {
        const newSteps = [...(formData.procedure_steps || [])];
        const step = { ...newSteps[index] };
        (step as any)[field] = value;
        newSteps[index] = step;
        markDirty();
        setFormData(prev => ({ ...prev, procedure_steps: newSteps }));
    };

    const handleStepImageChange = (index: number, file: File | null) => {
        const newSteps = [...(formData.procedure_steps || [])];
        const step = { ...newSteps[index] };
        if (file) {
            const previewUrl = URL.createObjectURL(file);
            (step as any).newImageFile = file; // Store the file object temporarily for upload processing
            step.image_url = previewUrl; // Update preview
        }
        newSteps[index] = step;
        markDirty();
        setFormData(prev => ({ ...prev, procedure_steps: newSteps }));
    };

    const handleStepImageSelected = (index: number, files: File[]) => {
        if (files.length > 0) {
            handleStepImageChange(index, files[0]);
        }
    }

    const addStep = () => {
        const newStep: ProcedureStep = {
            id: Date.now(), // temporary client-side ID
            step_number: (formData.procedure_steps?.length || 0) + 1,
            title: '',
            description: '',
            image_path: ''
        };
        markDirty();
        setFormData(prev => ({ ...prev, procedure_steps: [...(prev.procedure_steps || []), newStep] }));
    };

    const removeStep = (index: number) => {
        const newSteps = formData.procedure_steps?.filter((_, i) => i !== index) || [];
        markDirty();
        setFormData(prev => ({ ...prev, procedure_steps: newSteps }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const serviceToSave = {
            ...formData,
            slug: generateSlug(formData.slug || formData.name || ''),
            faq_items: sanitizeDetailFaqItems(formData.faq_items),
        };

        try {
            if (!serviceToSave.slug) {
                throw new Error(t('service_form.slug_required', 'Không thể lưu dịch vụ khi slug trống.'));
            }

            // Handle image uploads for procedure steps
            if (serviceToSave.procedure_steps) {
                const uploadedSteps = await Promise.all(
                    serviceToSave.procedure_steps.map(async (step) => {
                        const stepWithFile = step as (ProcedureStep & { newImageFile?: File });
                        if (stepWithFile.newImageFile) {
                            const file = stepWithFile.newImageFile;
                            const webpFile = await convertImageToWebP(file);
                            const filePath = buildServiceStepImagePath({
                                slug: serviceToSave.slug,
                                name: serviceToSave.name,
                                stepNumber: step.step_number,
                                suffix: String(step.id),
                                extension: 'webp',
                            });
                            const uploaded = await uploadPublicAsset('site-assets', filePath, webpFile);
                            step.image_path = uploaded.path;
                        }
                        // Clean up temporary fields before saving
                        delete (step as any).newImageFile;
                        delete (step as any).image_url;
                        return step;
                    })
                );
                serviceToSave.procedure_steps = uploadedSteps;
            }
            await onSave(serviceToSave, imageFile);
            setHasUnsavedChanges(false);
            clearServiceDraft();
        } catch (error) {
            console.error("Failed to save service:", error);
            alert(error instanceof Error ? error.message : t('common.unknown_error', "Đã xảy ra lỗi không xác định."));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AdminEditorShell
            eyebrow="Service editor"
            title={service?.id ? t('service_form.edit_title', 'Chỉnh sửa Dịch vụ') : t('service_form.new_title', 'Tạo Dịch vụ mới')}
            description="Editor dịch vụ được chuẩn hóa để đi theo các bước rõ ràng: thông tin cơ bản, chi phí, quy trình và FAQ."
            isDirty={hasUnsavedChanges}
            isSaving={isLoading}
            sections={[
                { id: 'service-editor-basic', label: t('service_form.basic_info', 'Thông tin cơ bản') },
                { id: 'service-editor-cost', label: t('service_form.cost', 'Chi phí') },
                { id: 'service-editor-procedure', label: t('service_form.procedure', 'Quy trình thực hiện') },
                { id: 'service-editor-faq', label: 'FAQ' },
            ]}
            draftState={{
                lastSavedAt: serviceDraftSavedAt,
                hasRestorableDraft: hasRestorableServiceDraft,
                onRestore: restoreServiceDraft,
                onDiscard: discardServiceDraft,
                label: 'Autosave local + server',
                status: serviceDraftStatus,
                note: `${serviceDraftNote} Ảnh đại diện và ảnh bước làm mới chọn sẽ không nằm trong autosave.`,
            }}
        >
            <form onSubmit={handleSubmit} className="space-y-6 xl:space-y-7">

                <fieldset id="service-editor-basic" className="space-y-4 rounded-[1.6rem] border border-border/80 bg-transparent p-5 md:p-6 scroll-mt-28">
                    <legend className="px-2 font-semibold text-lg text-primary">{t('service_form.basic_info', 'Thông tin cơ bản')}</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">{t('service_form.name_label', 'Tên Dịch vụ')}</label>
                            <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border border-input rounded-md bg-background" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">{t('service_form.slug_label', 'Slug đường dẫn')}</label>
                            <input
                                type="text"
                                name="slug"
                                value={formData.slug || ''}
                                onChange={handleChange}
                                className="w-full p-2 border border-input rounded-md bg-background"
                                placeholder="ten-dich-vu"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">{t('service_form.icon_label', 'Icon (Dự phòng)')}</label>
                            <select name="icon" value={formData.icon} onChange={handleChange} className="w-full p-2 border border-input rounded-md bg-background" required>
                                {availableIcons.map(iconName => <option key={iconName} value={iconName}>{iconName}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">{t('service_form.cover_image', 'Ảnh đại diện dịch vụ')}</label>
                        <div className="flex items-start gap-4 mt-2">
                            {previewUrl && (
                                <img src={previewUrl} alt="Service preview" className="w-48 h-auto rounded-md object-cover border border-border flex-shrink-0" />
                            )}
                            <div className="flex-grow w-full">
                                <ImageDropzone onFilesSelected={handleImageSelected} className="h-32" />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">{t('service_form.short_desc', 'Mô tả ngắn')}</label>
                        <textarea name="description" value={formData.description} onChange={handleChange} rows={2} className="w-full p-2 border border-input rounded-md bg-background" required></textarea>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">{t('service_form.long_desc', 'Mô tả chi tiết')}</label>
                        <textarea name="long_description" value={formData.long_description} onChange={handleChange} rows={5} className="w-full p-2 border border-input rounded-md bg-background" required></textarea>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">{t('service_form.benefits', 'Lợi ích (mỗi lợi ích một dòng)')}</label>
                        <textarea value={benefitsText} onChange={handleBenefitsChange} rows={5} className="w-full p-2 border border-input rounded-md bg-background" required></textarea>
                    </div>
                </fieldset>

                <fieldset id="service-editor-cost" className="space-y-4 rounded-[1.6rem] border border-border/80 bg-transparent p-5 md:p-6 scroll-mt-28">
                    <legend className="px-2 font-semibold text-lg text-primary">{t('service_form.cost', 'Chi phí')}</legend>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">{t('service_form.price', 'Giá dịch vụ (VND)')}</label>
                        <input type="number" name="price" value={formData.price || ''} onChange={handleChange} className="w-full p-2 border border-input rounded-md bg-background" placeholder={t('service_form.price_placeholder', "Để trống nếu là giá Liên hệ")} />
                    </div>
                </fieldset>

                <fieldset className="space-y-4 rounded-[1.6rem] border border-border/80 bg-secondary/20 p-5 md:p-6">
                    <legend className="px-2 font-semibold text-lg text-primary">SEO địa phương</legend>
                    <LocalSeoTagsEditor
                        value={formData.local_seo_tags}
                        onChange={(tags) => {
                            markDirty();
                            setFormData((prev) => ({ ...prev, local_seo_tags: tags }));
                        }}
                    />
                </fieldset>

                <fieldset id="service-editor-procedure" className="space-y-4 rounded-[1.6rem] border border-border/80 bg-transparent p-5 md:p-6 scroll-mt-28">
                    <legend className="px-2 font-semibold text-lg text-primary">{t('service_form.procedure', 'Quy trình thực hiện')}</legend>
                    <div className="space-y-6">
                        {formData.procedure_steps?.map((step, index) => (
                            <div key={step.id} className="relative space-y-4 rounded-[1.25rem] border border-border bg-transparent p-4">
                                <h4 className="font-bold text-foreground">{t('service_form.step', 'Bước')} {index + 1}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-1">
                                        <label className="block text-sm font-medium text-foreground mb-1">{t('service_form.step_number', 'Số thứ tự')}</label>
                                        <input type="number" value={step.step_number} onChange={(e) => handleStepChange(index, 'step_number', parseInt(e.target.value))} className="w-full p-2 border border-input rounded-md bg-background" required />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-foreground mb-1">{t('service_form.step_title', 'Tiêu đề bước')}</label>
                                        <input type="text" value={step.title} onChange={(e) => handleStepChange(index, 'title', e.target.value)} className="w-full p-2 border border-input rounded-md bg-background" required />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">{t('service_form.step_desc', 'Mô tả bước')}</label>
                                    <textarea value={step.description} onChange={(e) => handleStepChange(index, 'description', e.target.value)} rows={3} className="w-full p-2 border border-input rounded-md bg-background" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">{t('service_form.step_image', 'Ảnh minh họa')}</label>
                                    <div className="flex items-start gap-4 mt-2">
                                        {step.image_url && <img src={step.image_url} alt="Preview" className="w-24 h-24 object-cover rounded-md border flex-shrink-0" />}
                                        <div className="w-full flex-grow">
                                            <ImageDropzone onFilesSelected={(files) => handleStepImageSelected(index, files)} className="h-24" />
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute top-2 right-2 relative group inline-flex">
                                    <button
                                        type="button"
                                        onClick={() => removeStep(index)}
                                        className="p-1.5 text-muted-foreground hover:text-destructive bg-card/50 rounded-full transition-all hover:scale-110 active:scale-95"
                                        aria-label={`Xóa bước ${index + 1}`}
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                    <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-[11px] font-bold text-popover-foreground shadow-xl backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
                                        Xóa bước
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={addStep} className="mt-4 flex items-center gap-2 bg-primary/10 text-primary text-sm font-bold py-2 px-3 rounded-lg hover:bg-primary/20 transition-colors btn-press">
                        <PlusCircleIcon className="w-5 h-5" />
                        {t('service_form.add_step', 'Thêm bước')}
                    </button>
                </fieldset>

                <div id="service-editor-faq" className="scroll-mt-28">
                <DetailFaqEditor
                    value={normalizeDetailFaqItems(formData.faq_items)}
                    onChange={(items) => {
                        markDirty();
                        setFormData((prev) => ({ ...prev, faq_items: items }));
                    }}
                    title="FAQ dịch vụ"
                    description="FAQ này ưu tiên hiển thị trên trang dịch vụ và trong schema SEO tiếng Việt. Nếu để trống, hệ thống sẽ fallback sang FAQ dựng từ hồ sơ dịch vụ hiện có."
                    addLabel="Thêm câu hỏi cho dịch vụ"
                />
                </div>

                <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-5">
                    <button type="button" onClick={handleCancelRequest} className="bg-muted hover:bg-muted/80 text-muted-foreground font-bold py-2 px-6 rounded-full transition-colors btn-press" disabled={isLoading}>
                        {t('common.cancel', 'Hủy')}
                    </button>
                    <button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-6 rounded-full transition-colors btn-press flex items-center gap-2" disabled={isLoading}>
                        {isLoading && <Spinner className="w-5 h-5 -ml-1 mr-1" />}
                        {isLoading ? t('common.saving', 'Đang lưu...') : t('service_form.save', 'Lưu Dịch vụ')}
                    </button>
                </div>
            </form>
        </AdminEditorShell>
    );
};

export default ServiceEditorForm;
