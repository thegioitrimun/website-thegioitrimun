

import React, { useState } from 'react';
import { getO2SkinInfo } from '../services/geminiService';
import { SparklesIcon } from './icons';
import Spinner from './Spinner';
import type { GeminiResponse } from '../types';
import { useToast } from '../hooks/useToast';
import { useTranslation } from 'react-i18next';

const GeminiAI: React.FC = () => {
    const { t } = useTranslation();
    const [question, setQuestion] = useState<string>('');
    const [response, setResponse] = useState<GeminiResponse | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const { addToast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!question.trim() || isLoading) return;

        setIsLoading(true);
        setResponse(null);

        try {
            const result = await getO2SkinInfo(question);
            if (result.sources.length === 0 && result.text.includes("API KEY")) {
                addToast(t('ai.config_error', "Lỗi cấu hình"), { type: 'error', description: result.text });
                setResponse(null);
            } else {
                setResponse(result);
            }
        } catch (err: any) {
            addToast(t('ai.assist_error', 'Lỗi từ trợ lý AI'), {
                type: 'error',
                description: err.message || t('ai.default_error', 'Đã có lỗi xảy ra. Vui lòng thử lại.')
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-card text-card-foreground p-8 rounded-xl shadow-lg border border-border transition-all-smooth max-w-4xl mx-auto">
            <div className="flex items-center mb-6">
                <SparklesIcon className="w-8 h-8 text-primary mr-3" />
                <h3 className="text-2xl font-bold text-card-foreground font-heading">{t('ai.title', 'Trợ lý Da liễu AI')}</h3>
            </div>
            <p className="text-muted-foreground mb-6">
                {t('ai.description', 'Bạn có thắc mắc về các vấn đề da liễu hoặc sản phẩm chăm sóc da? Hãy hỏi trợ lý AI của chúng tôi, được cung cấp bởi công nghệ của Google.')}
                <br />
                <em className="text-sm">{t('ai.example', 'Ví dụ: "O2 Skin trị mụn có tốt không?" hoặc "phân biệt các loại treatment cho da"')}</em>
            </p>

            <form onSubmit={handleSubmit}>
                <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder={t('ai.placeholder', "Nhập câu hỏi của bạn ở đây...")}
                    className="w-full p-3 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-ring transition-all-smooth bg-background text-foreground"
                    rows={3}
                    disabled={isLoading}
                    aria-label={t('ai.question_aria', "Câu hỏi cho trợ lý AI")}
                />
                <button
                    type="submit"
                    disabled={isLoading || !question.trim()}
                    className="mt-4 w-full md:w-auto flex items-center justify-center bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed text-primary-foreground font-bold py-3 px-8 rounded-full transition-all-smooth shadow-lg hover:shadow-xl transform hover:-translate-y-1 btn-press"
                >
                    {isLoading ? <Spinner /> : t('ai.submit', 'Gửi câu hỏi')}
                </button>
            </form>

            {response && (
                <div className="mt-6 animate-scale-in">
                    <h4 className="text-xl font-semibold text-card-foreground mb-3">{t('ai.answer_title', 'Câu trả lời:')}</h4>
                    <div className="max-w-none text-foreground whitespace-pre-wrap leading-relaxed">
                        {response.text}
                    </div>

                    {response.sources && response.sources.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-border">
                            <h5 className="font-semibold text-card-foreground mb-2">{t('ai.sources_title', 'Nguồn tham khảo:')}</h5>
                            <ul className="list-disc list-inside space-y-1">
                                {response.sources.map((source, index) => (
                                    <li key={index}>
                                        <a
                                            href={source.uri}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:text-primary/80 underline hover:no-underline transition-colors"
                                        >
                                            {source.title || source.uri}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default GeminiAI;