import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MedicalRecord, Invoice, Doctor } from '../types';
import {
  MedicalRecordIcon as PageIcon,
  PillIcon,
  ReceiptIcon,
  StethoscopeIcon,
  ChevronDownIcon,
} from './icons';
import AnimatedSection from './AnimatedSection';
import BackIconButton from './BackIconButton';

interface MedicalRecordsPageProps {
  records: MedicalRecord[];
  doctors: Doctor[];
  onBack: () => void;
}

const getPaymentStatusStyles = (status: Invoice['payment_status']) => {
  switch (status) {
    case 'paid':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20';
    case 'unpaid':
      return 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/20';
    case 'partial':
    default:
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20';
  }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const AccordionItem: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-border/40 last:border-b-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center py-3.5 px-3.5 sm:px-5 text-left text-xs sm:text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-primary">{icon}</span>
          <span>{title}</span>
        </div>
        <ChevronDownIcon className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="p-3.5 sm:p-5 bg-background/30 backdrop-blur-md border-t border-border/30">
          {children}
        </div>
      </div>
    </div>
  );
};

const MedicalRecordsPage: React.FC<MedicalRecordsPageProps> = ({ records, doctors, onBack }) => {
  const { t, i18n } = useTranslation();

  const getDateLocale = () => {
    switch (i18n.language) {
      case 'en': return 'en-US';
      case 'ru': return 'ru-RU';
      case 'cn': return 'zh-CN';
      default: return 'vi-VN';
    }
  };

  const getLocalized = (obj: any, field: string): string => {
    if (!obj) return '';
    const lang = i18n.language;
    if (lang !== 'vi') {
      const v = obj[`${field}_${lang}`];
      if (v) return v;
    }
    return obj[field] || '';
  };

  const getPaymentStatusText = (status: Invoice['payment_status']) => {
    switch (status) {
      case 'paid': return t('medical.paid');
      case 'unpaid': return t('medical.unpaid');
      case 'partial': return t('medical.partial');
    }
  };

  const getDoctorName = (id: string) => {
    return doctors.find(d => d.id === id)?.name || t('common.loading');
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Top Header Card */}
        <AnimatedSection>
          <div className="rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-3.5 sm:p-5 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4">
              <BackIconButton onClick={onBack} label={t('common.back')} />
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-inner">
                <PageIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground font-heading tracking-tight">{t('medical.title')}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1">{t('medical.subtitle')}</p>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* Medical Records List */}
        <div className="space-y-4">
          {records.length > 0 ? (
            records
              .sort((a, b) => new Date(b.encounter_date).getTime() - new Date(a.encounter_date).getTime())
              .map((record, index) => (
                <AnimatedSection key={record.id} stagger={index * 50}>
                  <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0 overflow-hidden transition-all">
                    {/* Record Header */}
                    <div className="p-3.5 sm:p-5 bg-muted/25 border-b border-border/40 flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">{t('medical.visit_date')}:</span>
                        <span className="font-bold text-sm sm:text-base text-primary">
                          {new Date(record.encounter_date).toLocaleDateString(getDateLocale(), { year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        {t('booking.doctor_label')}: <strong className="text-foreground">{getDoctorName(record.examining_doctor_id)}</strong>
                      </div>
                    </div>

                    {/* Record Body */}
                    <div className="p-3.5 sm:p-5 space-y-3.5">
                      <div className="rounded-2xl border border-white/60 bg-background/40 backdrop-blur-md p-3.5 sm:p-4 dark:border-white/10">
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t('medical.diagnosis')}</h3>
                        <p className="text-xs sm:text-sm font-medium text-foreground">
                          {record.definitive_diagnoses_icd_codes.join(', ') || record.preliminary_diagnoses_icd_codes.join(', ') || t('medical.none')}
                        </p>
                      </div>

                      {record.clinical_notes && (
                        <div className="rounded-2xl border border-white/50 bg-background/30 backdrop-blur-md p-3.5 sm:p-4 dark:border-white/10">
                          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t('medical.clinical_notes')}</h3>
                          <p className="text-xs sm:text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                            {record.clinical_notes}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Accordion Tabs */}
                    <div className="border-t border-border/40 divide-y divide-border/40">
                      {/* Services */}
                      {record.services && record.services.length > 0 && (
                        <AccordionItem title={t('medical.services_performed')} icon={<StethoscopeIcon className="w-4 h-4" />}>
                          <div className="overflow-x-auto rounded-xl border border-border/40 bg-background/50">
                            <table className="w-full text-xs sm:text-sm text-left">
                              <thead className="text-[10px] sm:text-xs text-muted-foreground uppercase bg-muted/40">
                                <tr>
                                  <th scope="col" className="px-3.5 py-2.5 font-bold">{t('medical.service_name')}</th>
                                  <th scope="col" className="px-3.5 py-2.5 text-right font-bold">{t('medical.unit_price')}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/30">
                                {record.services.map((service, i) => (
                                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                                    <td className="px-3.5 py-2.5 font-medium text-foreground">{getLocalized(service, 'name')}</td>
                                    <td className="px-3.5 py-2.5 text-right text-primary font-semibold">{formatCurrency(service.price)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </AccordionItem>
                      )}

                      {/* Prescription */}
                      {record.prescriptions && record.prescriptions.length > 0 && (
                        <AccordionItem title={t('medical.prescription')} icon={<PillIcon className="w-4 h-4" />}>
                          <div className="overflow-x-auto rounded-xl border border-border/40 bg-background/50">
                            <table className="w-full text-xs sm:text-sm text-left">
                              <thead className="text-[10px] sm:text-xs text-muted-foreground uppercase bg-muted/40">
                                <tr>
                                  <th scope="col" className="px-3 py-2 font-bold">{t('medical.med_name')}</th>
                                  <th scope="col" className="px-3 py-2 font-bold">{t('medical.dosage')}</th>
                                  <th scope="col" className="px-3 py-2 text-right font-bold">{t('checkout.qty')}</th>
                                  <th scope="col" className="px-3 py-2 text-right font-bold">{t('medical.unit_price')}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/30">
                                {record.prescriptions.map((med, i) => (
                                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                                    <td className="px-3 py-2.5 font-medium text-foreground">{med.name}</td>
                                    <td className="px-3 py-2.5 text-muted-foreground">{med.dosage}</td>
                                    <td className="px-3 py-2.5 text-right text-muted-foreground">{med.quantity} {med.unit}</td>
                                    <td className="px-3 py-2.5 text-right text-primary font-semibold">{formatCurrency(med.price)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </AccordionItem>
                      )}

                      {/* Invoice Details */}
                      {record.invoice && (
                        <AccordionItem title={t('medical.invoice_details')} icon={<ReceiptIcon className="w-4 h-4" />}>
                          <div className="rounded-xl border border-border/40 bg-background/50 p-3.5 sm:p-4 text-xs sm:text-sm space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">{t('cart.total')}:</span>
                              <span className="font-bold text-sm sm:text-base text-primary">{formatCurrency(record.invoice.total_amount)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">{t('medical.status')}:</span>
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold backdrop-blur-md ${getPaymentStatusStyles(record.invoice.payment_status)}`}>
                                {getPaymentStatusText(record.invoice.payment_status)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">{t('medical.payment_method')}:</span>
                              <span className="font-medium text-foreground">{record.invoice.payment_method}</span>
                            </div>
                            {record.invoice.payment_date && (
                              <div className="flex justify-between items-center pt-1 border-t border-border/30">
                                <span className="text-muted-foreground">{t('medical.payment_date')}:</span>
                                <span className="font-medium text-foreground">
                                  {new Date(record.invoice.payment_date).toLocaleDateString(getDateLocale())}
                                </span>
                              </div>
                            )}
                          </div>
                        </AccordionItem>
                      )}
                    </div>
                  </div>
                </AnimatedSection>
              ))
          ) : (
            <AnimatedSection>
              <div className="text-center py-16 rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-6 mx-1 sm:mx-0">
                <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-inner mb-4">
                  <PageIcon className="w-8 h-8" />
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-foreground">{t('medical.empty')}</h2>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">{t('medical.empty_desc')}</p>
              </div>
            </AnimatedSection>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicalRecordsPage;
