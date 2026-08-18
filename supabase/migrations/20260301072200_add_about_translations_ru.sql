-- about_page_content Russian translation columns
ALTER TABLE public.about_page_content
ADD COLUMN header_title_ru text,
ADD COLUMN header_subtitle_ru text,
ADD COLUMN mission_title_ru text,
ADD COLUMN mission_text_ru text,
ADD COLUMN vision_text_ru text,
ADD COLUMN values_title_ru text,
ADD COLUMN values_subtitle_ru text;

-- about_features Russian translation columns
ALTER TABLE public.about_features
ADD COLUMN title_ru text,
ADD COLUMN description_ru text;

-- about_values Russian translation columns
ALTER TABLE public.about_values
ADD COLUMN title_ru text,
ADD COLUMN description_ru text;
