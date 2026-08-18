PRAGMA foreign_keys = ON;

ALTER TABLE procedure_steps ADD COLUMN title_en TEXT;
ALTER TABLE procedure_steps ADD COLUMN title_ru TEXT;
ALTER TABLE procedure_steps ADD COLUMN title_cn TEXT;
ALTER TABLE procedure_steps ADD COLUMN description_en TEXT;
ALTER TABLE procedure_steps ADD COLUMN description_ru TEXT;
ALTER TABLE procedure_steps ADD COLUMN description_cn TEXT;
ALTER TABLE procedure_steps ADD COLUMN image_path TEXT;
