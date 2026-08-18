import React, { useState, useEffect } from 'react';
import type { DoctorDetail, DoctorProfile } from '../types';
import { useTranslation } from 'react-i18next';
import AdminEditorShell from './AdminEditorShell';
import useAdminLocalDraft from '../hooks/useAdminLocalDraft';

interface DoctorFormProps {
    doctor: DoctorDetail; // Always has a patient profile
    onSave: (doctorProfile: DoctorProfile) => void;
    onCancel: () => void;
}

const DoctorForm: React.FC<DoctorFormProps> = ({ doctor, onSave, onCancel }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<DoctorProfile>({
        id: '',
        username: '',
        job_title: '',
        specialization: '',
        qualification: '',
        homepage_description: '',
        practice_license_code: ''
    });
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const draftStorageKey = `admin-editor-draft:doctor:${doctor?.id || 'new'}`;
    const {
        lastSavedAt: doctorDraftSavedAt,
        hasRestorableDraft: hasRestorableDoctorDraft,
        restoreDraft: restoreDoctorDraft,
        discardDraft: discardDoctorDraft,
        clearDraft: clearDoctorDraft,
        note: doctorDraftNote,
        remoteStatus: doctorDraftStatus,
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
        if (doctor) {
            setFormData(doctor.doctor_profile || {
                id: doctor.id,
                username: `${doctor.email.split('@')[0]}-${Math.random().toString(36).substring(2, 6)}`,
                job_title: '',
                specialization: '',
                qualification: '',
                homepage_description: '',
                practice_license_code: ''
            });
            setHasUnsavedChanges(false);
        }
    }, [doctor]);

    const handleCancelRequest = () => {
        if (hasUnsavedChanges && !window.confirm('Bạn có thay đổi chưa lưu. Rời editor sẽ mất các thay đổi này. Tiếp tục?')) {
            return;
        }
        onCancel();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setHasUnsavedChanges(true);
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        setHasUnsavedChanges(false);
        clearDoctorDraft();
    };

    return (
        <AdminEditorShell
            eyebrow="Doctor profile editor"
            title={t('doctor_form.title', 'Hồ sơ Chuyên môn Bác sĩ')}
            description={`${t('doctor_form.edit_for', 'Chỉnh sửa thông tin cho:')} ${doctor.name}`}
            isDirty={hasUnsavedChanges}
            sections={[
                { id: 'doctor-editor-account', label: 'Tài khoản & chứng chỉ' },
                { id: 'doctor-editor-profile', label: 'Hồ sơ chuyên môn' },
                { id: 'doctor-editor-homepage', label: 'Hiển thị trang chủ' },
            ]}
            draftState={{
                lastSavedAt: doctorDraftSavedAt,
                hasRestorableDraft: hasRestorableDoctorDraft,
                onRestore: restoreDoctorDraft,
                onDiscard: discardDoctorDraft,
                label: 'Autosave local + server',
                status: doctorDraftStatus,
                note: doctorDraftNote,
            }}
        >

            <form onSubmit={handleSubmit} className="space-y-5 md:space-y-7">
                {/* Section 1: Tài khoản & chứng chỉ */}
                <section id="doctor-editor-account" className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl p-5 shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] md:p-7 scroll-mt-28">
                    <div className="mb-6">
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">THÔNG TIN ĐỊNH DANH</p>
                        <h2 className="mt-1 text-xl font-bold text-foreground md:text-2xl">Tài khoản & Chứng chỉ hành nghề</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                        <div>
                            <label htmlFor="username" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                {t('doctor_form.username', 'Username (Tên định danh)')} <span className="text-primary">*</span>
                            </label>
                            <input
                                id="username"
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                className="w-full rounded-2xl border border-border/70 bg-background/85 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 backdrop-blur-md transition-all shadow-sm"
                                required
                            />
                            <p className="mt-1.5 text-xs text-muted-foreground">
                                {t('doctor_form.username_help', 'Dùng để định danh bác sĩ trong hệ thống. Tên đăng nhập mặc định là email.')}
                            </p>
                        </div>

                        <div>
                            <label htmlFor="practice_license_code" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                {t('doctor_form.license_code', 'Mã chứng chỉ hành nghề')}
                            </label>
                            <input
                                id="practice_license_code"
                                type="text"
                                name="practice_license_code"
                                value={formData.practice_license_code || ''}
                                onChange={handleChange}
                                placeholder="VD: CCHN-12345/BYT"
                                className="w-full rounded-2xl border border-border/70 bg-background/85 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 backdrop-blur-md transition-all shadow-sm"
                            />
                        </div>

                        <div>
                            <label htmlFor="job_title" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                {t('doctor_form.job_title', 'Chức danh')}
                            </label>
                            <input
                                id="job_title"
                                type="text"
                                name="job_title"
                                value={formData.job_title || ''}
                                onChange={handleChange}
                                className="w-full rounded-2xl border border-border/70 bg-background/85 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 backdrop-blur-md transition-all shadow-sm"
                                placeholder={t('doctor_form.job_title_placeholder', 'VD: Bác sĩ CKI, Thạc sĩ Bác sĩ...')}
                            />
                        </div>

                        <div>
                            <label htmlFor="specialization" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                {t('doctor_form.specialization', 'Chuyên khoa')}
                            </label>
                            <input
                                id="specialization"
                                type="text"
                                name="specialization"
                                value={formData.specialization || ''}
                                onChange={handleChange}
                                className="w-full rounded-2xl border border-border/70 bg-background/85 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 backdrop-blur-md transition-all shadow-sm"
                                placeholder={t('doctor_form.specialization_placeholder', 'VD: Chuyên khoa Da liễu & Thẩm mỹ Da')}
                            />
                        </div>
                    </div>
                </section>

                {/* Section 2: Hồ sơ chuyên môn */}
                <section id="doctor-editor-profile" className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl p-5 shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] md:p-7 scroll-mt-28">
                    <div className="mb-6">
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">CHUYÊN MÔN & KINH NGHIỆM</p>
                        <h2 className="mt-1 text-xl font-bold text-foreground md:text-2xl">Bằng cấp & Quá trình công tác</h2>
                    </div>
                    <div>
                        <label htmlFor="qualification" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                            {t('doctor_form.qualification', 'Bằng cấp & Kinh nghiệm')}
                        </label>
                        <textarea
                            id="qualification"
                            name="qualification"
                            value={formData.qualification || ''}
                            onChange={handleChange}
                            rows={4}
                            className="w-full rounded-2xl border border-border/70 bg-background/85 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 backdrop-blur-md transition-all shadow-sm leading-relaxed"
                            placeholder={t('doctor_form.qualification_placeholder', 'Liệt kê các bằng cấp, chứng chỉ và kinh nghiệm làm việc...')}
                        />
                    </div>
                </section>

                {/* Section 3: Hiển thị trang chủ */}
                <section id="doctor-editor-homepage" className="rounded-[1.7rem] bg-card/25 backdrop-blur-2xl p-5 shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] md:p-7 scroll-mt-28">
                    <div className="mb-6">
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">TRUYỀN THÔNG & WEBSITE</p>
                        <h2 className="mt-1 text-xl font-bold text-foreground md:text-2xl">Mô tả trên Trang chủ</h2>
                    </div>
                    <div>
                        <label htmlFor="homepage_description" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                            {t('doctor_form.homepage_desc', 'Mô tả hiển thị trên trang chủ')}
                        </label>
                        <textarea
                            id="homepage_description"
                            name="homepage_description"
                            value={formData.homepage_description || ''}
                            onChange={handleChange}
                            rows={4}
                            className="w-full rounded-2xl border border-border/70 bg-background/85 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 backdrop-blur-md transition-all shadow-sm leading-relaxed"
                            placeholder={t('doctor_form.homepage_desc_placeholder', 'Một đoạn mô tả ngắn gọn để hiển thị trên trang chủ...')}
                        />
                    </div>
                </section>

                {/* Bottom Actions Card */}
                <div className="flex flex-wrap items-center justify-end gap-3 rounded-[1.7rem] bg-card/25 backdrop-blur-2xl p-5 shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] md:px-7">
                    <button
                        type="button"
                        onClick={handleCancelRequest}
                        className="rounded-full border border-border bg-background/90 px-6 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-muted shadow-sm"
                    >
                        {t('common.cancel', 'Hủy')}
                    </button>
                    <button
                        type="submit"
                        className="rounded-full bg-primary hover:bg-primary/90 px-8 py-2.5 text-sm font-bold text-primary-foreground shadow-md transition-all"
                    >
                        {t('doctor_form.save', 'Lưu hồ sơ')}
                    </button>
                </div>
            </form>
        </AdminEditorShell>
    );
};

export default DoctorForm;
