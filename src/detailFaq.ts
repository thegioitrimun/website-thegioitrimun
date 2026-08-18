import type { DetailFaqEntry } from '../types';

export function normalizeDetailFaqItems(items: unknown): DetailFaqEntry[] {
    if (!Array.isArray(items)) return [];

    return items.map((item) => ({
        question: typeof item?.question === 'string' ? item.question : '',
        answer: typeof item?.answer === 'string' ? item.answer : '',
    }));
}

export function sanitizeDetailFaqItems(items: unknown): DetailFaqEntry[] {
    return normalizeDetailFaqItems(items)
        .map((item) => ({
            question: item.question.trim(),
            answer: item.answer.trim(),
        }))
        .filter((item) => item.question && item.answer);
}
