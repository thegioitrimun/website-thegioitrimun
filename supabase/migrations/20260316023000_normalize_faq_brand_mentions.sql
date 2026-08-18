UPDATE public.faq_items
SET
  question = CASE
    WHEN question IS NULL THEN NULL
    ELSE replace(replace(replace(replace(replace(question, 'Dr.HappyPi', 'Natural Skin'), 'iSkin Clinic', 'Natural Skin'), 'iSkin.vn', 'Natural Skin'), 'iSkin', 'Natural Skin'), 'Thế Giới Trị Mụn', 'Natural Skin')
  END,
  answer = CASE
    WHEN answer IS NULL THEN NULL
    ELSE replace(replace(replace(replace(replace(answer, 'Dr.HappyPi', 'Natural Skin'), 'iSkin Clinic', 'Natural Skin'), 'iSkin.vn', 'Natural Skin'), 'iSkin', 'Natural Skin'), 'Thế Giới Trị Mụn', 'Natural Skin')
  END,
  question_en = CASE
    WHEN question_en IS NULL THEN NULL
    ELSE replace(replace(replace(replace(replace(question_en, 'Dr.HappyPi', 'Natural Skin'), 'iSkin Clinic', 'Natural Skin'), 'iSkin.vn', 'Natural Skin'), 'iSkin', 'Natural Skin'), 'Thế Giới Trị Mụn', 'Natural Skin')
  END,
  answer_en = CASE
    WHEN answer_en IS NULL THEN NULL
    ELSE replace(replace(replace(replace(replace(answer_en, 'Dr.HappyPi', 'Natural Skin'), 'iSkin Clinic', 'Natural Skin'), 'iSkin.vn', 'Natural Skin'), 'iSkin', 'Natural Skin'), 'Thế Giới Trị Mụn', 'Natural Skin')
  END,
  question_ru = CASE
    WHEN question_ru IS NULL THEN NULL
    ELSE replace(replace(replace(replace(replace(question_ru, 'Dr.HappyPi', 'Natural Skin'), 'iSkin Clinic', 'Natural Skin'), 'iSkin.vn', 'Natural Skin'), 'iSkin', 'Natural Skin'), 'Thế Giới Trị Mụn', 'Natural Skin')
  END,
  answer_ru = CASE
    WHEN answer_ru IS NULL THEN NULL
    ELSE replace(replace(replace(replace(replace(answer_ru, 'Dr.HappyPi', 'Natural Skin'), 'iSkin Clinic', 'Natural Skin'), 'iSkin.vn', 'Natural Skin'), 'iSkin', 'Natural Skin'), 'Thế Giới Trị Mụn', 'Natural Skin')
  END,
  question_cn = CASE
    WHEN question_cn IS NULL THEN NULL
    ELSE replace(replace(replace(replace(replace(question_cn, 'Dr.HappyPi', 'Natural Skin'), 'iSkin Clinic', 'Natural Skin'), 'iSkin.vn', 'Natural Skin'), 'iSkin', 'Natural Skin'), 'Thế Giới Trị Mụn', 'Natural Skin')
  END,
  answer_cn = CASE
    WHEN answer_cn IS NULL THEN NULL
    ELSE replace(replace(replace(replace(replace(answer_cn, 'Dr.HappyPi', 'Natural Skin'), 'iSkin Clinic', 'Natural Skin'), 'iSkin.vn', 'Natural Skin'), 'iSkin', 'Natural Skin'), 'Thế Giới Trị Mụn', 'Natural Skin')
  END;
