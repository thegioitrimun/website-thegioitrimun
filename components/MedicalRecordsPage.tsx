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
      return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
    case 'unpaid':
      return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
    case 'partial':
    default:
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
  }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const AccordionItem: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-border/80 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center py-4 text-left text-lg font-semibold text-foreground hover:bg-accent/50 px-4 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <span className="text-primary">{icon}</span>
          <span>{title}</span>
        </div>
        <ChevronDownIcon className={`w-6 h-6 text-muted-foreground transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ease-custom-bezier ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="p-4 bg-muted/30">
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
    <div className="bg-background text-foreground transition-colors duration-300 animate-scale-in">
      <div className="container mx-auto px-6 py-12">
        <AnimatedSection className="mb-12">
          <BackIconButton onClick={onBack} label={t('common.back')} className="mb-4" />
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <PageIcon className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground font-heading">{t('medical.title')}</h1>
              <p className="text-lg text-muted-foreground mt-1">{t('medical.subtitle')}</p>
            </div>
          </div>
        </AnimatedSection>

        <div className="space-y-8">
          {records.length > 0 ? (
            records
              .sort((a, b) => new Date(b.encounter_date).getTime() - new Date(a.encounter_date).getTime())
              .map((record, index) => (
                <AnimatedSection key={record.id} stagger={index * 100}>
                  <div className="bg-card text-card-foreground rounded-xl shadow-lg border border-border transition-all-smooth overflow-hidden">
                    <div className="p-6">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 pb-4 border-b border-border">
                        <h2 className="text-xl font-bold text-primary">
                          {t('medical.visit_date')}: {new Date(record.encounter_date).toLocaleDateString(getDateLocale())}
                        </h2>
                        <p className="text-muted-foreground mt-2 sm:mt-0">{t('booking.doctor_label')}: <span className="font-semibold text-foreground">{getDoctorName(record.examining_doctor_id)}</span></p>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">{t('medical.diagnosis')}</h3>
                          <p className="text-muted-foreground">{record.definitive_diagnoses_icd_codes.join(', ') || record.preliminary_diagnoses_icd_codes.join(', ') || t('medical.none')}</p>
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">{t('medical.clinical_notes')}</h3>
                          <p className="text-muted-foreground whitespace-pre-wrap">{record.clinical_notes}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/20 border-t border-border/80">
                      <AccordionItem title={t('medical.services_performed')} icon={<StethoscopeIcon className="w-6 h-6" />}>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground uppercase">
                              <tr>
                                <th scope="col" className="px-4 py-2">{t('medical.service_name')}</th>
                                <th scope="col" className="px-4 py-2 text-right">{t('medical.unit_price')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {record.services.map((service, i) => (
                                <tr key={i} className="border-b border-border/50 last:border-b-0">
                                  <td className="px-4 py-3 font-medium text-foreground">{getLocalized(service, 'name')}</td>
                                  <td className="px-4 py-3 text-right">{formatCurrency(service.price)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </AccordionItem>

                      <AccordionItem title={t('medical.prescription')} icon={<PillIcon className="w-6 h-6" />}>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground uppercase">
                              <tr>
                                <th scope="col" className="px-4 py-2">{t('medical.med_name')}</th>
                                <th scope="col" className="px-4 py-2">{t('medical.dosage')}</th>
                                <th scope="col" className="px-4 py-2 text-right">{t('checkout.qty')}</th>
                                <th scope="col" className="px-4 py-2 text-right">{t('medical.unit_price')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {record.prescriptions.map((med, i) => (
                                <tr key={i} className="border-b border-border/50 last:border-b-0">
                                  <td className="px-4 py-3 font-medium text-foreground">{med.name}</td>
                                  <td className="px-4 py-3 text-muted-foreground">{med.dosage}</td>
                                  <td className="px-4 py-3 text-right">{med.quantity} {med.unit}</td>
                                  <td className="px-4 py-3 text-right">{formatCurrency(med.price)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </AccordionItem>

                      {record.invoice && <AccordionItem title={t('medical.invoice_details')} icon={<ReceiptIcon className="w-6 h-6" />}>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-2">
                          <dt className="font-semibold text-foreground">{t('cart.total')}:</dt>
                          <dd className="text-right font-bold text-lg text-primary">{formatCurrency(record.invoice.total_amount)}</dd>

                          <dt className="font-semibold text-foreground">{t('medical.status')}:</dt>
                          <dd className="text-right">
                            <span className={`text-xs font-semibold mr-2 px-2.5 py-1 rounded-full ${getPaymentStatusStyles(record.invoice.payment_status)}`}>
                              {getPaymentStatusText(record.invoice.payment_status)}
                            </span>
                          </dd>

                          <dt className="font-semibold text-foreground">{t('medical.payment_method')}:</dt>
                          <dd className="text-right text-muted-foreground">{record.invoice.payment_method}</dd>

                          {record.invoice.payment_date && <>
                            <dt className="font-semibold text-foreground">{t('medical.payment_date')}:</dt>
                            <dd className="text-right text-muted-foreground">{new Date(record.invoice.payment_date).toLocaleDateString(getDateLocale())}</dd>
                          </>}
                        </dl>
                      </AccordionItem>}
                    </div>

                  </div>
                </AnimatedSection>
              ))
          ) : (
            <AnimatedSection>
              <div className="text-center py-16 bg-card rounded-xl border border-border">
                <PageIcon className="w-16 h-16 mx-auto text-muted-foreground/50" />
                <h2 className="mt-4 text-xl font-semibold text-muted-foreground">{t('medical.empty')}</h2>
                <p className="mt-2 text-muted-foreground">{t('medical.empty_desc')}</p>
              </div>
            </AnimatedSection>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicalRecordsPage;
