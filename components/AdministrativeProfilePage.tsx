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
    <label className="text-sm font-medium text-muted-foreground">{label}</label>
    <p className="mt-1 block w-full rounded-md border-border bg-muted/50 px-3 py-2 text-foreground sm:text-sm min-h-[40px] flex items-center">
      {value || <span className="italic text-muted-foreground/80">{notSetText}</span>}
    </p>
  </div>
);

// Component for editing a field
const EditableField: React.FC<{ label: string; name: keyof PatientProfile; value: any; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void; type?: string; as?: 'input' | 'textarea' | 'select'; options?: { value: string, label: string }[] }> = ({ label, name, value, onChange, type = 'text', as = 'input', options }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-muted-foreground">{label}</label>
    {as === 'textarea' ? (
      <textarea id={name} name={name} value={value || ''} onChange={onChange} rows={3} className="mt-1 w-full admin-glass-input" />
    ) : as === 'select' ? (
      <select id={name} name={name} value={value || ''} onChange={onChange} className="mt-1 w-full admin-glass-input py-2.5">
        {options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    ) : (
      <input type={type} id={name} name={name} value={value || ''} onChange={onChange} className="mt-1 w-full admin-glass-input" />
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
  }

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
    <div className="bg-background text-foreground transition-colors duration-300 animate-scale-in">
      <div className="container mx-auto px-6 py-12">
        <AnimatedSection className="mb-12">
          <BackIconButton onClick={onBack} label={t('common.back')} className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-full">
                <UserIcon className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-foreground font-heading">{t('profile.title')}</h1>
                <p className="text-lg text-muted-foreground mt-1">{t('profile.subtitle')}</p>
              </div>
            </div>
            {!isEditing && (
              <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-primary text-primary-foreground font-bold py-2 px-5 rounded-full transition-all-smooth shadow-md hover:shadow-lg transform hover:-translate-y-0.5 btn-press">
                <PencilIcon className="w-5 h-5" />
                <span>{t('common.edit')}</span>
              </button>
            )}
          </div>
        </AnimatedSection>

        <AnimatedSection stagger={100}>
          <div className="bg-card p-8 rounded-xl shadow-lg border border-border">
            <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div className="sm:col-span-full flex items-center gap-6">
                <img
                  src={previewUrl || `https://ui-avatars.com/api/?name=${patient.name}&background=random`}
                  alt="Avatar"
                  className="w-24 h-24 rounded-full object-cover"
                />
                {isEditing && (
                  <div className="w-full max-w-xs">
                    <ImageDropzone onFilesSelected={handleFileSelected} helpText={t('profile.avatar_help')} className="h-24" />
                  </div>
                )}
              </div>

              {isEditing ? (
                <>
                  <div className="sm:col-span-3"><EditableField label={t('profile.full_name')} name="name" value={editablePatient.name} onChange={handleChange} /></div>
                  <div className="sm:col-span-3"><EditableField label={t('profile.dob')} name="dob" type="date" value={editablePatient.dob} onChange={handleChange} /></div>
                  <div className="sm:col-span-3"><EditableField label={t('profile.phone')} name="phone" value={editablePatient.phone} onChange={handleChange} /></div>
                  <div className="sm:col-span-3">
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p className="mt-1 block w-full rounded-md border-border bg-muted/50 px-3 py-2 text-muted-foreground sm:text-sm min-h-[40px] flex items-center">{editablePatient.email}</p>
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
                      inputClassName="mt-1 w-full admin-glass-input"
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
              <div className="flex justify-end gap-4 mt-6 pt-6 border-t border-border">
                <button onClick={handleCancel} disabled={isSaving} className="bg-muted hover:bg-muted/80 text-muted-foreground font-bold py-2 px-6 rounded-full transition-all-smooth btn-press">
                  {t('common.cancel')}
                </button>
                <button onClick={handleSaveChanges} disabled={isSaving} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-6 rounded-full transition-all-smooth btn-press flex items-center justify-center min-w-[120px] ml-auto disabled:bg-muted">
                  {isSaving ? <Spinner className="w-5 h-5" /> : t('profile.save_changes')}
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
