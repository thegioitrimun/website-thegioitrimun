import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { PatientProfile } from '../types';
import { UserIcon, PencilIcon } from './icons';
import AnimatedSection from './AnimatedSection';
import { ImageDropzone } from './ImageDropzone';
import Spinner from './Spinner';
import BackIconButton from './BackIconButton';
import VietnamAddressFields from './VietnamAddressFields';
import {
  findProvinceByName,
  findWardByName,
  loadVietnamAdministrativeUnits2025,
} from '../src/vietnamAdministrativeUnits';

interface AdministrativeProfilePageProps {
  patient: PatientProfile;
  onBack: () => void;
  onUpdateProfile: (patient: Partial<PatientProfile> & { id: string }, avatarFile: File | null) => Promise<void>;
}

// Component for displaying a field in view mode
const ProfileField: React.FC<{ label: string; value: string | undefined | null; notSetText: string }> = ({ label, value, notSetText }) => (
  <div>
    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
    <div className="mt-1.5 w-full rounded-2xl border border-white/60 bg-background/40 backdrop-blur-xl px-3.5 py-2.5 text-sm text-foreground min-h-[42px] flex items-center shadow-inner/5 dark:border-white/10">
      {value || <span className="italic text-muted-foreground/70">{notSetText}</span>}
    </div>
  </div>
);

// Component for editing a field
const EditableField: React.FC<{
  label: string;
  name: keyof PatientProfile;
  value: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  type?: string;
  as?: 'input' | 'textarea' | 'select';
  options?: { value: string; label: string }[];
}> = ({ label, name, value, onChange, type = 'text', as = 'input', options }) => (
  <div>
    <label htmlFor={name} className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
    {as === 'textarea' ? (
      <textarea id={name} name={name} value={value || ''} onChange={onChange} rows={3} className="mt-1.5 w-full admin-glass-input resize-y" />
    ) : as === 'select' ? (
      <select id={name} name={name} value={value || ''} onChange={onChange} className="mt-1.5 w-full admin-glass-input py-2.5">
        {options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    ) : (
      <input type={type} id={name} name={name} value={value || ''} onChange={onChange} className="mt-1.5 w-full admin-glass-input" />
    )}
  </div>
);

const AdministrativeProfilePage: React.FC<AdministrativeProfilePageProps> = ({ patient, onBack, onUpdateProfile }) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editablePatient, setEditablePatient] = useState<PatientProfile>(patient);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(patient.avatar_url || null);
  const [isSaving, setIsSaving] = useState(false);
  const [addressValidationError, setAddressValidationError] = useState<string | null>(null);

  useEffect(() => {
    setEditablePatient(patient);
    setPreviewUrl(patient.avatar_url || null);
  }, [patient]);

  const handleFileSelected = (files: File[]) => {
    if (files.length > 0) {
      const file = files[0];
      setAvatarFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditablePatient(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    setAddressValidationError(null);
    try {
      let normalizedPatient = { ...editablePatient, address_district: '' };
      const hasAddress = [
        editablePatient.address_province,
        editablePatient.address_ward,
        editablePatient.address_street,
      ].some((value) => String(value || '').trim());

      if (hasAddress) {
        const administrativeUnits = await loadVietnamAdministrativeUnits2025();
        const province = findProvinceByName(administrativeUnits, editablePatient.address_province || '');
        const ward = findWardByName(province, editablePatient.address_ward || '');

        if (!province || !ward) {
          setAddressValidationError(t('checkout.select_current_ward'));
          return;
        }

        normalizedPatient = {
          ...normalizedPatient,
          address_province: province.name,
          address_ward: ward.name,
          address_street: String(editablePatient.address_street || '').trim(),
        };
      }

      await onUpdateProfile(normalizedPatient, avatarFile);
      setAvatarFile(null);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile', error);
      setAddressValidationError(t('checkout.address_data_error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditablePatient(patient);
    setPreviewUrl(patient.avatar_url || null);
    setAvatarFile(null);
    setAddressValidationError(null);
  };

  const genderOptions = [
    { value: '', label: t('profile.not_set') },
    { value: 'male', label: t('profile.male') },
    { value: 'female', label: t('profile.female') },
    { value: 'other', label: t('profile.other_gender') }
  ];

  const getGenderText = (g: string | undefined | null) => {
    if (g === 'female') return t('profile.female');
    if (g === 'male') return t('profile.male');
    return t('profile.other_gender');
  };

  const notSet = t('profile.not_updated');

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <AnimatedSection>
          <div className="rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-3.5 sm:p-5 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4">
              <BackIconButton onClick={onBack} label={t('common.back')} />
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-inner">
                <UserIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground font-heading tracking-tight">{t('profile.title')}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1">{t('profile.subtitle')}</p>
              </div>
            </div>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border-0 bg-primary hover:bg-primary/90 text-primary-foreground backdrop-blur-xl px-4 py-2 text-sm font-semibold shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 btn-press"
              >
                <PencilIcon className="w-4 h-4" />
                <span>{t('common.edit')}</span>
              </button>
            )}
          </div>
        </AnimatedSection>

        <AnimatedSection stagger={100}>
          <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-4 sm:p-6 mx-1 sm:mx-0">
            <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
              <div className="sm:col-span-full flex flex-col sm:flex-row items-center gap-4 sm:gap-6 pb-6 border-b border-border/40">
                <div className="relative">
                  <img
                    src={previewUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(patient.name || 'User')}&background=random`}
                    alt="Avatar"
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-primary/20 shadow-md"
                  />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h2 className="text-lg sm:text-xl font-bold text-foreground">{patient.name || t('profile.not_updated')}</h2>
                  <p className="text-sm text-muted-foreground">{patient.email}</p>
                  {isEditing && (
                    <div className="mt-3 w-full max-w-sm mx-auto sm:mx-0">
                      <ImageDropzone onFilesSelected={handleFileSelected} helpText={t('profile.avatar_help')} className="h-24" />
                    </div>
                  )}
                </div>
              </div>

              {isEditing ? (
                <>
                  <div className="sm:col-span-3"><EditableField label={t('profile.full_name')} name="name" value={editablePatient.name} onChange={handleChange} /></div>
                  <div className="sm:col-span-3"><EditableField label={t('profile.dob')} name="dob" type="date" value={editablePatient.dob} onChange={handleChange} /></div>
                  <div className="sm:col-span-3"><EditableField label={t('profile.phone')} name="phone" value={editablePatient.phone} onChange={handleChange} /></div>
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Email</label>
                    <div className="mt-1.5 w-full rounded-2xl border border-white/40 bg-background/20 backdrop-blur-md px-3.5 py-2.5 text-sm text-muted-foreground min-h-[42px] flex items-center dark:border-white/10">{editablePatient.email}</div>
                  </div>
                  <div className="sm:col-span-6">
                    <VietnamAddressFields
                      value={{
                        province: editablePatient.address_province || '',
                        ward: editablePatient.address_ward || '',
                        street: editablePatient.address_street || '',
                        district: '',
                      }}
                      onChange={(address) => setEditablePatient((current) => ({
                        ...current,
                        address_province: address.province,
                        address_ward: address.ward,
                        address_street: address.street,
                        address_district: '',
                      }))}
                      inputClassName="mt-1.5 w-full admin-glass-input"
                      layoutClassName="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2"
                    />
                    {addressValidationError ? (
                      <p role="alert" className="mt-3 text-sm font-semibold text-destructive">
                        {addressValidationError}
                      </p>
                    ) : null}
                  </div>
                  <div className="sm:col-span-2"><EditableField as="select" label={t('profile.gender')} name="gender" value={editablePatient.gender} onChange={handleChange} options={genderOptions} /></div>
                  <div className="sm:col-span-2"><EditableField label={t('profile.nationality')} name="nationality" value={editablePatient.nationality} onChange={handleChange} /></div>
                  <div className="sm:col-span-2"><EditableField label={t('profile.citizen_id')} name="citizen_id_number" value={editablePatient.citizen_id_number} onChange={handleChange} /></div>
                  <div className="sm:col-span-3"><EditableField as="textarea" label={t('profile.medical_history')} name="medical_history" value={editablePatient.medical_history} onChange={handleChange} /></div>
                  <div className="sm:col-span-3"><EditableField as="textarea" label={t('profile.allergies')} name="allergies" value={editablePatient.allergies} onChange={handleChange} /></div>
                  <div className="sm:col-span-6"><EditableField as="textarea" label={t('profile.skin_type')} name="skin_type" value={editablePatient.skin_type} onChange={handleChange} /></div>
                </>
              ) : (
                <>
                  <div className="sm:col-span-3"><ProfileField label={t('profile.full_name')} value={patient.name} notSetText={notSet} /></div>
                  <div className="sm:col-span-3"><ProfileField label={t('profile.dob')} value={patient.dob} notSetText={notSet} /></div>
                  <div className="sm:col-span-3"><ProfileField label={t('profile.phone')} value={patient.phone} notSetText={notSet} /></div>
                  <div className="sm:col-span-3"><ProfileField label="Email" value={patient.email} notSetText={notSet} /></div>
                  <div className="sm:col-span-3"><ProfileField label={t('checkout.province')} value={patient.address_province} notSetText={notSet} /></div>
                  <div className="sm:col-span-3"><ProfileField label={t('checkout.ward')} value={patient.address_ward} notSetText={notSet} /></div>
                  <div className="sm:col-span-3"><ProfileField label={t('checkout.street')} value={patient.address_street} notSetText={notSet} /></div>
                  <div className="sm:col-span-2"><ProfileField label={t('profile.gender')} value={getGenderText(patient.gender)} notSetText={notSet} /></div>
                  <div className="sm:col-span-2"><ProfileField label={t('profile.nationality')} value={patient.nationality} notSetText={notSet} /></div>
                  <div className="sm:col-span-2"><ProfileField label={t('profile.citizen_id')} value={patient.citizen_id_number} notSetText={notSet} /></div>
                  <div className="sm:col-span-3"><ProfileField label={t('profile.medical_history')} value={patient.medical_history} notSetText={notSet} /></div>
                  <div className="sm:col-span-3"><ProfileField label={t('profile.allergies')} value={patient.allergies} notSetText={notSet} /></div>
                  <div className="sm:col-span-6"><ProfileField label={t('profile.skin_type')} value={patient.skin_type} notSetText={notSet} /></div>
                </>
              )}
            </div>

            {isEditing && (
              <div className="flex flex-wrap items-center justify-end gap-3 mt-6 pt-6 border-t border-border/40">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-white/60 bg-background/40 hover:bg-background/70 backdrop-blur-xl px-5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-all btn-press dark:border-white/10"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border-0 bg-primary hover:bg-primary/90 text-primary-foreground backdrop-blur-xl px-6 py-2.5 text-sm font-semibold shadow-md hover:shadow-lg transition-all btn-press disabled:opacity-50"
                >
                  {isSaving ? <Spinner className="w-4 h-4 text-primary-foreground" /> : t('profile.save_changes')}
                </button>
              </div>
            )}
          </div>
        </AnimatedSection>
      </div>
    </div>
  );
};

export default AdministrativeProfilePage;
