import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { UserData, PatientDocument } from '../types';
import { DocumentDuplicateIcon as PageIcon, TrashIcon, SparklesIcon } from './icons';
import AnimatedSection from './AnimatedSection';
import Spinner from './Spinner';
import { ImageDropzone } from './ImageDropzone';
import MarkdownRenderer from './MarkdownRenderer';
import BackIconButton from './BackIconButton';

interface MyMedicalRecordsPageProps {
  user: UserData;
  onBack: () => void;
  onUpload: (file: File) => void;
  onDelete: (documentId: string, filePath: string) => void;
  onGenerateSummary: (doc: PatientDocument) => void;
  summarizingDocId: string | null;
}

const MyMedicalRecordsPage: React.FC<MyMedicalRecordsPageProps> = ({ user, onBack, onUpload, onDelete, onGenerateSummary, summarizingDocId }) => {
  const { t, i18n } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);

  const getDateLocale = () => {
    switch (i18n.language) {
      case 'en': return 'en-US';
      case 'ru': return 'ru-RU';
      case 'cn': return 'zh-CN';
      default: return 'vi-VN';
    }
  };

  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (files && files.length > 0) {
      setIsUploading(true);
      try {
        await onUpload(files[0]);
      } finally {
        setIsUploading(false);
      }
    }
  }, [onUpload]);

  const documentsWithSummary = user.documents.filter(doc => doc.ai_summary).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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
              <h1 className="text-4xl md:text-5xl font-bold text-foreground font-heading">{t('records.title')}</h1>
              <p className="text-lg text-muted-foreground mt-1">{t('records.subtitle')}</p>
            </div>
          </div>
        </AnimatedSection>

        <div className="grid lg:grid-cols-3 gap-12">
          <div className="lg:col-span-1 space-y-8">
            <AnimatedSection>
              <div className="bg-card p-6 rounded-xl shadow-lg border border-border">
                <h2 className="text-xl font-bold mb-4">{t('records.upload_new')}</h2>
                <div className="w-full h-32">
                  {isUploading ? (
                    <div className="flex items-center justify-center h-full">
                      <Spinner />
                    </div>
                  ) : (
                    <ImageDropzone
                      onFilesSelected={handleFilesSelected}
                      accept=".pdf,.png,.jpg,.jpeg,.heic"
                      helpText={t('records.upload_help')}
                    />
                  )}
                </div>
              </div>
            </AnimatedSection>

            <AnimatedSection stagger={100}>
              <div className="bg-card p-6 rounded-xl shadow-lg border border-border">
                <h2 className="text-xl font-bold mb-4">{t('records.uploaded_docs')}</h2>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {user.documents.map(doc => (
                    <div key={doc.id} className="bg-muted/50 p-3 rounded-md flex items-center justify-between gap-2">
                      <a href={doc.public_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium truncate hover:text-primary transition-colors flex-grow" title={doc.file_name}>{doc.file_name}</a>
                      <div className="flex-shrink-0 flex items-center gap-1">
                        <button onClick={() => onGenerateSummary(doc)} disabled={!!doc.ai_summary || !!summarizingDocId} className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed">
                          {summarizingDocId === doc.id ? <Spinner className="animate-spin w-5 h-5 text-primary" /> : <SparklesIcon className="w-5 h-5" />}
                        </button>
                        <button onClick={() => onDelete(doc.id, doc.file_path)} className="p-1.5 text-muted-foreground hover:text-destructive"><TrashIcon className="w-5 h-5" /></button>
                      </div>
                    </div>
                  ))}
                  {user.documents.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">{t('records.no_docs')}</p>}
                </div>
              </div>
            </AnimatedSection>
          </div>

          <div className="lg:col-span-2">
            <AnimatedSection stagger={200}>
              <div className="bg-card p-6 rounded-xl shadow-lg border border-border min-h-[40rem]">
                <h2 className="text-xl font-bold mb-6">{t('records.ai_timeline')}</h2>

                {documentsWithSummary.length > 0 ? (
                  <div className="relative border-l-2 border-primary/20 pl-6 space-y-10">
                    {documentsWithSummary.map(doc => (
                      <div key={doc.id} className="relative">
                        <div className="absolute -left-[33px] top-1.5 w-4 h-4 bg-primary rounded-full border-4 border-card"></div>
                        <p className="font-semibold text-muted-foreground">{new Date(doc.created_at).toLocaleDateString(getDateLocale(), { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        <div className="mt-2 text-muted-foreground prose-sm max-w-none">
                          <MarkdownRenderer content={doc.ai_summary || ''} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20">
                    <SparklesIcon className="w-16 h-16 mx-auto text-muted-foreground/50" />
                    <h3 className="mt-4 text-lg font-semibold text-muted-foreground">{t('records.no_summaries')}</h3>
                    <p className="mt-2 text-muted-foreground">{t('records.no_summaries_desc')}</p>
                  </div>
                )}
              </div>
            </AnimatedSection>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyMedicalRecordsPage;
