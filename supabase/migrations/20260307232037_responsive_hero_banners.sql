-- Add responsive image fields to homepage_hero table
-- Rename the existing image_path column to image_desktop_path for clarity

ALTER TABLE public.homepage_hero
RENAME COLUMN image_path TO image_desktop_path;

ALTER TABLE public.homepage_hero
ADD COLUMN image_tablet_path TEXT,
ADD COLUMN image_mobile_path TEXT;
