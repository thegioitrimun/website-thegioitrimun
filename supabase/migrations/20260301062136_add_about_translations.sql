-- about_page_content translation columns
ALTER TABLE public.about_page_content
ADD COLUMN header_title_en text,
ADD COLUMN header_subtitle_en text,
ADD COLUMN mission_title_en text,
ADD COLUMN mission_text_en text,
ADD COLUMN vision_text_en text,
ADD COLUMN values_title_en text,
ADD COLUMN values_subtitle_en text,
ADD COLUMN header_title_cn text,
ADD COLUMN header_subtitle_cn text,
ADD COLUMN mission_title_cn text,
ADD COLUMN mission_text_cn text,
ADD COLUMN vision_text_cn text,
ADD COLUMN values_title_cn text,
ADD COLUMN values_subtitle_cn text;

-- about_features translation columns
ALTER TABLE public.about_features
ADD COLUMN title_en text,
ADD COLUMN description_en text,
ADD COLUMN title_cn text,
ADD COLUMN description_cn text;

-- about_values translation columns
ALTER TABLE public.about_values
ADD COLUMN title_en text,
ADD COLUMN description_en text,
ADD COLUMN title_cn text,
ADD COLUMN description_cn text;
