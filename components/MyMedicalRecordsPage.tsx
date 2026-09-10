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

const MyMedicalRecordsPage: React.FC<MyMedicalRecordsPageProps> = ({
  user,
  onBack,
  onUpload,
  onDelete,
  onGenerateSummary,
  summarizingDocId
}) => {
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

  const documentsWithSummary = user.documents
    .filter(doc => doc.ai_summary)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Top Header Card */}
        <AnimatedSection>
          <div className="rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-3.5 sm:p-5 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4">
              <BackIconButton onClick={onBack} label={t('common.back')} />
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-inner">
                <PageIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground font-heading tracking-tight">{t('records.title')}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1">{t('records.subtitle')}</p>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Column: Upload & Documents List */}
          <div className="lg:col-span-1 space-y-4 sm:space-y-6">
            {/* Upload Card */}
            <AnimatedSection>
              <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3.5 sm:p-5 mx-1 sm:mx-0">
                <h2 className="text-sm sm:text-base font-bold text-foreground mb-3">{t('records.upload_new')}</h2>
                <div className="w-full">
                  {isUploading ? (
                    <div className="flex flex-col items-center justify-center h-32 rounded-2xl border border-dashed border-primary/30 bg-primary/5">
                      <Spinner className="w-6 h-6 text-primary" />
                      <p className="mt-2 text-xs text-muted-foreground">Đang tải tài liệu...</p>
                    </div>
                  ) : (
                    <ImageDropzone
                      onFilesSelected={handleFilesSelected}
                      accept=".pdf,.png,.jpg,.jpeg,.heic"
                      helpText={t('records.upload_help')}
                      className="min-h-[120px]"
                    />
                  )}
                </div>
              </div>
            </AnimatedSection>

            {/* Uploaded Documents */}
            <AnimatedSection stagger={100}>
              <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-3.5 sm:p-5 mx-1 sm:mx-0">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm sm:text-base font-bold text-foreground">{t('records.uploaded_docs')}</h2>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {user.documents.length}
                  </span>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {user.documents.map(doc => (
                    <div
                      key={doc.id}
                      className="rounded-xl border border-white/50 bg-background/40 backdrop-blur-md p-2.5 sm:p-3 flex items-center justify-between gap-2 hover:bg-background/60 transition-colors dark:border-white/10"
                    >
                      <a
                        href={doc.public_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs sm:text-sm font-medium truncate text-foreground hover:text-primary transition-colors flex-1"
                        title={doc.file_name}
                      >
                        {doc.file_name}
                      </a>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onGenerateSummary(doc)}
                          disabled={!!doc.ai_summary || summarizingDocId === doc.id}
                          className={`p-1.5 rounded-lg transition-colors ${
                            doc.ai_summary
                              ? 'text-emerald-500 cursor-default'
                              : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
                          } disabled:opacity-50`}
                          title={doc.ai_summary ? 'Đã tóm tắt AI' : 'Tạo tóm tắt AI'}
                        >
                          {summarizingDocId === doc.id ? (
                            <Spinner className="w-4 h-4 text-primary" />
                          ) : (
                            <SparklesIcon className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(doc.id, doc.file_path)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                          title={t('common.delete')}
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {user.documents.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">{t('records.no_docs')}</p>
                  )}
                </div>
              </div>
            </AnimatedSection>
          </div>

          {/* Right Column: AI Timeline */}
          <div className="lg:col-span-2">
            <AnimatedSection stagger={200}>
              <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-4 sm:p-6 mx-1 sm:mx-0 min-h-[28rem]">
                <div className="flex items-center gap-2 mb-6">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <SparklesIcon className="w-4 h-4" />
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-foreground">{t('records.ai_timeline')}</h2>
                </div>

                {documentsWithSummary.length > 0 ? (
                  <div className="relative border-l-2 border-primary/30 ml-3 pl-6 space-y-8">
                    {documentsWithSummary.map(doc => (
                      <div key={doc.id} className="relative">
                        <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 bg-primary rounded-full ring-4 ring-card"></div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {new Date(doc.created_at).toLocaleDateString(getDateLocale(), { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                        <div className="mt-2 p-3.5 sm:p-4 rounded-2xl border border-white/60 bg-background/30 backdrop-blur-md dark:border-white/10 prose prose-sm max-w-none text-foreground/90 leading-relaxed">
                          <MarkdownRenderer content={doc.ai_summary || ''} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-inner mb-3">
                      <SparklesIcon className="w-7 h-7" />
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-foreground">{t('records.no_summaries')}</h3>
                    <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">{t('records.no_summaries_desc')}</p>
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
