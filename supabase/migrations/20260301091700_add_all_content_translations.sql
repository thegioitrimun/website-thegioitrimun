-- ============================================================
-- Migration: Add translation columns (_en, _ru, _cn) to all
-- remaining content tables for multi-language support
-- ============================================================

-- 1. SERVICES (name, description, long_description, benefits)
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS name_en text,
ADD COLUMN IF NOT EXISTS name_ru text,
ADD COLUMN IF NOT EXISTS name_cn text,
ADD COLUMN IF NOT EXISTS description_en text,
ADD COLUMN IF NOT EXISTS description_ru text,
ADD COLUMN IF NOT EXISTS description_cn text,
ADD COLUMN IF NOT EXISTS long_description_en text,
ADD COLUMN IF NOT EXISTS long_description_ru text,
ADD COLUMN IF NOT EXISTS long_description_cn text,
ADD COLUMN IF NOT EXISTS benefits_en text[],
ADD COLUMN IF NOT EXISTS benefits_ru text[],
ADD COLUMN IF NOT EXISTS benefits_cn text[];

-- 2. PROCEDURE STEPS (title, description)
ALTER TABLE public.procedure_steps
ADD COLUMN IF NOT EXISTS title_en text,
ADD COLUMN IF NOT EXISTS title_ru text,
ADD COLUMN IF NOT EXISTS title_cn text,
ADD COLUMN IF NOT EXISTS description_en text,
ADD COLUMN IF NOT EXISTS description_ru text,
ADD COLUMN IF NOT EXISTS description_cn text;

-- 3. DOCTORS (job_title, specialization, homepage_description)
ALTER TABLE public.doctors
ADD COLUMN IF NOT EXISTS job_title_en text,
ADD COLUMN IF NOT EXISTS job_title_ru text,
ADD COLUMN IF NOT EXISTS job_title_cn text,
ADD COLUMN IF NOT EXISTS specialization_en text,
ADD COLUMN IF NOT EXISTS specialization_ru text,
ADD COLUMN IF NOT EXISTS specialization_cn text,
ADD COLUMN IF NOT EXISTS homepage_description_en text,
ADD COLUMN IF NOT EXISTS homepage_description_ru text,
ADD COLUMN IF NOT EXISTS homepage_description_cn text;

-- 4. HOMEPAGE HERO (title, subtitle)
ALTER TABLE public.homepage_hero
ADD COLUMN IF NOT EXISTS title_en text,
ADD COLUMN IF NOT EXISTS title_ru text,
ADD COLUMN IF NOT EXISTS title_cn text,
ADD COLUMN IF NOT EXISTS subtitle_en text,
ADD COLUMN IF NOT EXISTS subtitle_ru text,
ADD COLUMN IF NOT EXISTS subtitle_cn text;

-- 5. CONTACT PAGE CONTENT (header_title, header_subtitle, form_title, map_placeholder)
ALTER TABLE public.contact_page_content
ADD COLUMN IF NOT EXISTS header_title_en text,
ADD COLUMN IF NOT EXISTS header_title_ru text,
ADD COLUMN IF NOT EXISTS header_title_cn text,
ADD COLUMN IF NOT EXISTS header_subtitle_en text,
ADD COLUMN IF NOT EXISTS header_subtitle_ru text,
ADD COLUMN IF NOT EXISTS header_subtitle_cn text,
ADD COLUMN IF NOT EXISTS form_title_en text,
ADD COLUMN IF NOT EXISTS form_title_ru text,
ADD COLUMN IF NOT EXISTS form_title_cn text,
ADD COLUMN IF NOT EXISTS map_placeholder_en text,
ADD COLUMN IF NOT EXISTS map_placeholder_ru text,
ADD COLUMN IF NOT EXISTS map_placeholder_cn text;

-- 6. FOOTER CONTENT (about_text, copyright_text)
ALTER TABLE public.footer_content
ADD COLUMN IF NOT EXISTS about_text_en text,
ADD COLUMN IF NOT EXISTS about_text_ru text,
ADD COLUMN IF NOT EXISTS about_text_cn text,
ADD COLUMN IF NOT EXISTS copyright_text_en text,
ADD COLUMN IF NOT EXISTS copyright_text_ru text,
ADD COLUMN IF NOT EXISTS copyright_text_cn text;

-- 7. FAQ ITEMS (question, answer)
ALTER TABLE public.faq_items
ADD COLUMN IF NOT EXISTS question_en text,
ADD COLUMN IF NOT EXISTS question_ru text,
ADD COLUMN IF NOT EXISTS question_cn text,
ADD COLUMN IF NOT EXISTS answer_en text,
ADD COLUMN IF NOT EXISTS answer_ru text,
ADD COLUMN IF NOT EXISTS answer_cn text;

-- 8. TESTIMONIALS (name, text)
ALTER TABLE public.testimonials
ADD COLUMN IF NOT EXISTS name_en text,
ADD COLUMN IF NOT EXISTS name_ru text,
ADD COLUMN IF NOT EXISTS name_cn text,
ADD COLUMN IF NOT EXISTS text_en text,
ADD COLUMN IF NOT EXISTS text_ru text,
ADD COLUMN IF NOT EXISTS text_cn text;
