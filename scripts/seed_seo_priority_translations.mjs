#!/usr/bin/env node

const accessToken = process.env.SUPABASE_ACCESS_TOKEN || '';
const projectRef = process.env.SUPABASE_PROJECT_REF || 'ykcrngqhyinczmvwduox';

if (!accessToken) {
  console.error('Missing SUPABASE_ACCESS_TOKEN environment variable.');
  process.exit(1);
}

const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

const PRODUCT_TRANSLATIONS = [
  {
    id: 5,
    name_en: 'La Roche-Posay Anthelios UVMUNE 400 Sunscreen',
    name_ru: 'Солнцезащитный флюид La Roche-Posay Anthelios UVMUNE 400',
    name_cn: '理肤泉 Anthelios UVMUNE 400 防晒乳',
    description_en: 'An advanced broad-spectrum sunscreen with Mexoryl 400 to protect skin against long UVA, UVB, and daily environmental stress in a lightweight fluid texture.',
    description_ru: 'Современный солнцезащитный флюид широкого спектра с фильтром Mexoryl 400, который помогает защитить кожу от длинных UVA, UVB и ежедневных внешних факторов.',
    description_cn: '采用 Mexoryl 400 滤光科技的广谱防晒乳，帮助抵御长波 UVA、UVB 及日常环境刺激，质地轻盈不厚重。',
    key_benefits_en: [
      'High protection against UVA and UVB',
      'Mexoryl 400 filter for long UVA defense',
      'Water, sweat, and sand resistant',
      'Lightweight fluid finish with no greasy feel',
    ],
    key_benefits_ru: [
      'Высокая защита от UVA и UVB',
      'Фильтр Mexoryl 400 для длинных UVA',
      'Устойчивость к воде, поту и песку',
      'Легкий флюид без липкости и жирности',
    ],
    key_benefits_cn: [
      '高效抵御 UVA 与 UVB',
      'Mexoryl 400 帮助防护长波 UVA',
      '耐水、耐汗、耐摩擦',
      '轻盈流动质地，不油腻',
    ],
    origin_en: 'France',
    origin_ru: 'Франция',
    origin_cn: '法国',
    texture_en: 'Lightweight fluid',
    texture_ru: 'Легкий флюид',
    texture_cn: '轻盈乳液',
  },
  {
    id: 301,
    name_en: '100% Pure Manuka Oil - Living Nature',
    name_ru: '100% чистое масло мануки Living Nature',
    name_cn: 'Living Nature 100% 纯麦卢卡精油',
    description_en: 'Certified 100% pure Manuka oil that helps soothe blemish-prone skin, calm visible irritation, and support daily spot care in a concentrated format.',
    description_ru: 'Сертифицированное 100% чистое масло мануки для точечного ухода: помогает успокоить кожу с несовершенствами, снизить заметное раздражение и поддержать восстановление.',
    description_cn: '经认证的 100% 纯麦卢卡精油，适合局部护理，帮助舒缓问题肌、减轻可见刺激，并支持日常修护。',
    key_benefits_en: [
      'Concentrated natural spot care',
      'Helps calm visible redness and irritation',
      'Suitable for blemish-prone skin',
    ],
    key_benefits_ru: [
      'Концентрированный натуральный уход точечного применения',
      'Помогает уменьшить покраснение и раздражение',
      'Подходит для кожи, склонной к несовершенствам',
    ],
    key_benefits_cn: [
      '高浓度天然局部护理',
      '帮助缓解泛红与刺激感',
      '适合易长瑕疵的肌肤',
    ],
    origin_en: 'New Zealand',
    origin_ru: 'Новая Зеландия',
    origin_cn: '新西兰',
    texture_en: 'Oil',
    texture_ru: 'Масло',
    texture_cn: '油状',
  },
  {
    id: 1,
    name_en: 'Klenzit MS 0.1% Acne Gel',
    name_ru: 'Гель от акне Klenzit MS 0,1%',
    name_cn: 'Klenzit MS 0.1% 祛痘凝胶',
    description_en: 'Microsphere adapalene 0.1% gel that helps treat acne, unclog pores, and reduce inflammatory lesions with a gentler release profile.',
    description_ru: 'Гель с микросферическим адапаленом 0,1%, который помогает уменьшать акне, очищать поры и контролировать воспалительные элементы благодаря более мягкому высвобождению.',
    description_cn: '含 0.1% 微球阿达帕林的祛痘凝胶，有助于疏通毛孔、改善粉刺与炎症性痘痘，并降低初期刺激感。',
    key_benefits_en: [
      'Supports treatment of comedonal and inflammatory acne',
      'Normalizes keratinization inside pores',
      'Microsphere technology helps reduce irritation',
      'Helps limit new breakouts',
    ],
    key_benefits_ru: [
      'Подходит для комедонального и воспалительного акне',
      'Нормализует ороговение внутри пор',
      'Микросферическая технология помогает снизить раздражение',
      'Помогает уменьшить появление новых высыпаний',
    ],
    key_benefits_cn: [
      '适合粉刺型与炎症型痘痘护理',
      '帮助改善毛孔角化堵塞',
      '微球技术有助于减轻刺激',
      '帮助减少新生痘痘',
    ],
    origin_en: 'India',
    origin_ru: 'Индия',
    origin_cn: '印度',
    texture_en: 'Gel',
    texture_ru: 'Гель',
    texture_cn: '凝胶',
  },
  {
    id: 2,
    name_en: 'Differin Adapalene Gel 0.1%',
    name_ru: 'Гель Differin Adapalene 0,1%',
    name_cn: 'Differin 阿达帕林凝胶 0.1%',
    description_en: 'FDA-approved adapalene gel that helps clear clogged pores, reduce acne lesions, and support a more stable long-term acne routine.',
    description_ru: 'Гель с адапаленом, одобренный FDA: помогает очищать поры, уменьшать акне и поддерживать более стабильный длительный уход за проблемной кожей.',
    description_cn: '获 FDA 认可的阿达帕林凝胶，有助于疏通毛孔、改善痘痘问题，并建立更稳定的长期祛痘方案。',
    key_benefits_en: [
      'FDA-approved topical adapalene',
      'Helps reduce clogged pores and breakouts',
      'Supports control of swelling and redness',
      'Suitable for long-term acne management',
    ],
    key_benefits_ru: [
      'Топический адапален, одобренный FDA',
      'Помогает уменьшить закупорку пор и высыпания',
      'Поддерживает снижение покраснения и воспаления',
      'Подходит для длительного контроля акне',
    ],
    key_benefits_cn: [
      'FDA 认可的外用阿达帕林',
      '帮助减少毛孔堵塞与痘痘反复',
      '辅助缓解红肿炎症',
      '适合长期痘痘管理',
    ],
    origin_en: 'United States',
    origin_ru: 'США',
    origin_cn: '美国',
    texture_en: 'Gel',
    texture_ru: 'Гель',
    texture_cn: '凝胶',
  },
  {
    id: 3,
    name_en: 'La Roche-Posay Effaclar Purifying Cleanser',
    name_ru: 'Очищающий гель La Roche-Posay Effaclar',
    name_cn: '理肤泉 Effaclar 净肤洁面啫喱',
    description_en: 'Foaming gel cleanser for oily, acne-prone skin that helps remove excess sebum, impurities, and daily buildup without leaving skin tight.',
    description_ru: 'Очищающий пенящийся гель для жирной и склонной к акне кожи: помогает удалять излишки себума и загрязнения, не оставляя ощущения стянутости.',
    description_cn: '适合油性及痘痘肌的起泡洁面啫喱，可帮助带走多余油脂与污垢，同时减少洗后紧绷感。',
    key_benefits_en: [
      'Deep cleansing for oily and acne-prone skin',
      'Helps remove excess sebum',
      'Soap-free and suitable for daily use',
      'Leaves skin clean without over-drying',
    ],
    key_benefits_ru: [
      'Глубокое очищение для жирной и проблемной кожи',
      'Помогает убрать избыток себума',
      'Без мыла, подходит для ежедневного применения',
      'Оставляет кожу чистой без пересушивания',
    ],
    key_benefits_cn: [
      '适合油痘肌的深层清洁',
      '帮助去除多余皮脂',
      '无皂基，适合日常使用',
      '洗后清爽不拔干',
    ],
    origin_en: 'France',
    origin_ru: 'Франция',
    origin_cn: '法国',
    texture_en: 'Foaming gel',
    texture_ru: 'Пенящийся гель',
    texture_cn: '起泡凝胶',
  },
  {
    id: 4,
    name_en: 'Bioderma Sensibio H2O Micellar Water',
    name_ru: 'Мицеллярная вода Bioderma Sensibio H2O',
    name_cn: '贝德玛 Sensibio H2O 舒妍洁肤液',
    description_en: 'Gentle micellar cleanser and makeup remover for sensitive skin that lifts impurities while helping skin feel calm and comfortable.',
    description_ru: 'Деликатная мицеллярная вода для чувствительной кожи: помогает удалять макияж и загрязнения, сохраняя ощущение комфорта.',
    description_cn: '适合敏感肌的温和卸妆洁肤液，帮助带走彩妆与杂质，同时维持肌肤舒适感。',
    key_benefits_en: [
      'Removes makeup and daily impurities effectively',
      'Micellar technology with a gentle skin feel',
      'Helps reduce discomfort and tightness',
      'No rinse required',
    ],
    key_benefits_ru: [
      'Эффективно удаляет макияж и повседневные загрязнения',
      'Мицеллярная технология с мягким воздействием',
      'Помогает уменьшить дискомфорт и стянутость',
      'Не требует смывания',
    ],
    key_benefits_cn: [
      '有效卸除彩妆与日常污垢',
      '温和的 Micellar 洁净科技',
      '帮助缓解紧绷与不适',
      '无需二次冲洗',
    ],
    origin_en: 'France',
    origin_ru: 'Франция',
    origin_cn: '法国',
    texture_en: 'Liquid water',
    texture_ru: 'Жидкая вода',
    texture_cn: '液体水感',
  },
  {
    id: 12,
    name_en: 'Complete Acne Care Bundle: HSN Supplement + AC Gel BHA 2% + Seasonly Blemish Control Serum',
    name_ru: 'Комплекс против акне: HSN + AC Gel BHA 2% + Seasonly Blemish Control Serum',
    name_cn: '全方位祛痘组合：HSN 口服补充剂 + AC Gel BHA 2% + Seasonly 控痘精华',
    description_en: 'A multi-step acne bundle that combines inner support and topical care to help control blemishes, reduce post-acne marks, and improve overall skin texture over time.',
    description_ru: 'Комплексный набор против акне, который сочетает внутреннюю поддержку и наружный уход, помогая контролировать высыпания, уменьшать следы после акне и улучшать текстуру кожи.',
    description_cn: '结合内调与外用护理的多步骤祛痘组合，有助于改善痘痘反复、减淡痘印，并逐步提升肤质稳定度。',
    key_benefits_en: [
      'Supports a more complete acne-care routine',
      'Combines internal and topical support',
      'Helps reduce blemishes and post-acne marks',
      'Suitable for users needing a coordinated regimen',
    ],
    key_benefits_ru: [
      'Поддерживает более полный уход против акне',
      'Сочетает внутреннюю поддержку и наружные средства',
      'Помогает уменьшить высыпания и постакне',
      'Подходит для пользователей, которым нужен комплексный режим',
    ],
    key_benefits_cn: [
      '帮助建立更完整的祛痘护理方案',
      '结合内服支持与外用护理',
      '有助于改善痘痘与痘印问题',
      '适合需要系统性护理的人群',
    ],
    origin_en: 'New Zealand + United States + France',
    origin_ru: 'Новая Зеландия + США + Франция',
    origin_cn: '新西兰 + 美国 + 法国',
    texture_en: 'Bundle',
    texture_ru: 'Набор',
    texture_cn: '组合套装',
  },
  {
    id: 17,
    name_en: 'Harker Herbals GutBiome Balance 130g',
    name_ru: 'Harker Herbals GutBiome Balance 130 г',
    name_cn: 'Harker Herbals GutBiome Balance 肠道益生菌粉 130g',
    description_en: 'A 3-in-1 synbiotic powder with prebiotics, probiotics, and postbiotics to support gut balance, digestive comfort, and daily microbiome care.',
    description_ru: 'Синбиотический порошок 3-в-1 с пребиотиками, пробиотиками и постбиотиками для поддержки баланса кишечной микрофлоры и комфортного пищеварения.',
    description_cn: '结合益生元、益生菌与后生元的 3 合 1 肠道支持粉，帮助维持菌群平衡与日常消化舒适度。',
    key_benefits_en: [
      '3-in-1 synbiotic support',
      'Helps maintain microbiome balance',
      'Supports digestive comfort',
      'Suitable for daily gut-care routines',
    ],
    key_benefits_ru: [
      'Синбиотическая формула 3-в-1',
      'Помогает поддерживать баланс микробиома',
      'Способствует комфортному пищеварению',
      'Подходит для ежедневного ухода за ЖКТ',
    ],
    key_benefits_cn: [
      '3 合 1 Synbiotic 综合支持',
      '帮助维持肠道菌群平衡',
      '支持日常消化舒适',
      '适合日常肠道护理',
    ],
    origin_en: 'New Zealand',
    origin_ru: 'Новая Зеландия',
    origin_cn: '新西兰',
    texture_en: 'Powder',
    texture_ru: 'Порошок',
    texture_cn: '粉末',
  },
];

const md = String.raw;

const BLOG_CATEGORY_TRANSLATIONS = [
  {
    slug: 'cham-soc-da',
    name_en: 'Skin care',
    name_ru: 'Уход за кожей',
    name_cn: '皮肤护理',
  },
  {
    slug: 'co-xuong-khop',
    name_en: 'Musculoskeletal health',
    name_ru: 'Здоровье опорно-двигательной системы',
    name_cn: '骨关节健康',
  },
  {
    slug: 'cong-nghe-tham-my',
    name_en: 'Aesthetic technology',
    name_ru: 'Эстетические технологии',
    name_cn: '医美科技',
  },
  {
    slug: 'dieu-tri-mun',
    name_en: 'Acne treatment',
    name_ru: 'Лечение акне',
    name_cn: '痤疮治疗',
  },
  {
    slug: 'lao-hoa-da',
    name_en: 'Skin aging',
    name_ru: 'Возрастные изменения кожи',
    name_cn: '肌肤老化',
  },
  {
    slug: 'meo-thu-thuat',
    name_en: 'Tips and routines',
    name_ru: 'Советы и практики',
    name_cn: '护理技巧',
  },
];

const BLOG_TRANSLATIONS = [
  {
    slug: 'voi-hoa-cot-song-la-gi',
    title_en: 'What is spinal calcification?',
    title_ru: 'Что такое кальцификация позвоночника?',
    title_cn: '什么是脊柱钙化？',
    summary_en: 'Spinal calcification makes joints and ligaments around the spine become stiffer and less flexible. Over time it may irritate nearby nerves, causing pain and limiting daily movement.',
    summary_ru: 'При кальцификации позвоночника связки и суставы вокруг позвоночника становятся более жесткими и менее эластичными. Со временем это может раздражать близлежащие нервы, вызывая боль и ограничение движений.',
    summary_cn: '脊柱钙化会让周围的关节和韧带逐渐变硬、弹性下降，久而久之可能刺激附近神经，导致疼痛和活动受限。',
    content_en: md`## Understand spinal calcification before symptoms get worse

Spinal calcification happens when calcium or other mineral deposits build up around vertebrae, ligaments, or nearby joint structures. It is most often related to age-related wear, but it can also appear earlier after injury, chronic inflammation, repeated overload, or prolonged poor posture.

When these deposits accumulate, the spine gradually becomes less flexible. Ligaments and joints feel stiffer, movement becomes more limited, and nearby nerves may become irritated. This is why some people describe a combination of back pain, neck pain, tingling, or a heavy, rigid feeling after sitting or standing for too long.

## Common signs

- Local pain in the neck, upper back, or lower back
- Morning stiffness or stiffness after long periods of inactivity
- Tingling, burning, or crawling sensations when nerves are irritated
- Reduced range of motion when bending, turning, or straightening
- In more advanced cases, posture changes such as a more rounded or uneven back

Early spinal calcification may cause very few obvious symptoms. Many people only notice it when discomfort becomes persistent or when nerve-related symptoms appear.

## Why it happens

Natural aging is the most common factor, especially after middle age. Several other issues can increase the risk or make progression faster:

- Repetitive spinal strain from lifting, physically demanding work, or poor ergonomics
- Sedentary habits that weaken supporting muscles
- Excess body weight that increases mechanical load on the spine
- Previous trauma
- Inflammatory or degenerative joint disease

## Why diagnosis matters

Spinal calcification can resemble other spinal conditions, including bone spurs, disc problems, spinal stenosis, and nerve compression syndromes. That is why proper assessment matters instead of self-diagnosing from symptoms alone.

Doctors usually combine:

- Clinical history and movement assessment
- X-ray to identify bony and calcified changes
- MRI to evaluate discs, nerves, and soft tissue compression
- CT scan when a more detailed view of bone structure is needed

## Treatment principles

Most cases do not need surgery. Management is usually based on symptom control and preserving mobility:

1. Correct posture during sitting, standing, lifting, and sleeping
2. Exercise and physical therapy to strengthen back and core muscles
3. Pain relief or anti-inflammatory medication when prescribed
4. Weight management and regular movement breaks
5. In selected cases, injections or surgery if there is significant nerve compression or loss of function

## How to slow progression

- Keep an active routine instead of sitting still for long hours
- Build core and back strength with safe, regular exercise
- Avoid lifting with a rounded back
- Maintain a healthy body weight
- Seek assessment early if symptoms keep returning

Spinal calcification often can be managed well when it is recognized early. The practical goal is not always to “erase” every calcified area, but to reduce pain, protect nerve function, and keep daily movement comfortable for as long as possible.`,
    content_ru: md`## Что важно знать о кальцификации позвоночника

Кальцификация позвоночника возникает, когда кальций или другие минеральные отложения откладываются в области позвонков, связок или прилегающих суставных структур. Чаще всего это связано с возрастными изменениями, но состояние может развиваться и раньше после травм, хронического воспаления, повторяющейся нагрузки или длительной неправильной осанки.

По мере накопления отложений позвоночник становится менее гибким. Связки и суставы теряют эластичность, движения ограничиваются, а расположенные рядом нервы могут раздражаться. Поэтому у человека появляются боль в шее или спине, чувство скованности, покалывание или ощущение тяжести после длительного сидения и стояния.

## Частые признаки

- Боль в шее, грудном или поясничном отделе
- Скованность по утрам или после долгого покоя
- Покалывание, жжение или чувство «ползания мурашек» при раздражении нерва
- Снижение объема движений при наклоне, повороте и разгибании
- В более выраженных случаях — изменение осанки

На ранних этапах симптомы могут быть слабо выражены. Многие замечают проблему только тогда, когда дискомфорт становится постоянным или появляются неврологические проявления.

## Почему это происходит

Основной фактор — естественное старение, особенно после среднего возраста. Ускорять процесс могут и другие причины:

- Повторяющаяся нагрузка на позвоночник, тяжелая физическая работа, неправильная эргономика
- Малоподвижный образ жизни и слабость поддерживающих мышц
- Избыточный вес
- Перенесенные травмы
- Воспалительные и дегенеративные заболевания суставов

## Почему нужна диагностика

Кальцификацию позвоночника легко спутать с остеофитами, проблемами межпозвонковых дисков, стенозом позвоночного канала и другими причинами боли. Поэтому важно не ограничиваться самодиагностикой.

Обычно врач использует:

- опрос и клинический осмотр
- рентгенографию для оценки костных и кальцинированных изменений
- МРТ для оценки дисков, нервов и степени сдавления
- КТ при необходимости более детально изучить костные структуры

## Подходы к лечению

В большинстве случаев операция не требуется. Основная задача лечения — уменьшить симптомы и сохранить подвижность:

1. Исправление осанки при сидении, стоянии, сне и подъеме тяжестей
2. Лечебная физкультура и физиотерапия для укрепления мышц спины и корпуса
3. Обезболивающие и противовоспалительные препараты по назначению врача
4. Контроль массы тела и регулярная активность
5. В отдельных случаях — инъекции или операция при выраженном сдавлении нерва и нарушении функции

## Как замедлить прогрессирование

- Не сидеть неподвижно много часов подряд
- Регулярно укреплять мышцы корпуса и спины
- Избегать подъема тяжестей с округленной спиной
- Поддерживать здоровую массу тела
- Обращаться к врачу, если симптомы повторяются или усиливаются

Кальцификация позвоночника хорошо поддается контролю, если ее выявить вовремя. Главная цель лечения — уменьшить боль, защитить нервы и сохранить комфорт движения в повседневной жизни.`,
    content_cn: md`## 先弄清什么是脊柱钙化

脊柱钙化是指钙盐或其他矿物质异常沉积在椎体、韧带或邻近关节结构周围。它最常见于自然老化过程，但也可能在较年轻时因外伤、慢性炎症、长期负荷过重或姿势不良而提前出现。

当这些沉积逐渐累积时，脊柱的柔韧性会下降。周围的韧带和关节会变得僵硬，活动幅度减少，附近神经还可能受到刺激。因此，有些人会出现颈背痛、腰痛、麻刺感，或者久坐久站后明显感觉“发紧、发硬”。

## 常见表现

- 颈部、上背或下背局部疼痛
- 早晨起床或久坐后僵硬明显
- 神经受刺激时出现麻木、灼热或蚁走感
- 弯腰、转身、伸直时活动范围下降
- 严重时可伴随体态改变，例如背部变圆或不对称

早期脊柱钙化往往症状并不明显，很多人是在不适持续存在，或出现神经压迫表现后才发现问题。

## 为什么会发生

最常见的原因是年龄增长带来的退变，尤其在中年以后更常见。以下因素也可能让风险增加或进展更快：

- 长期搬重物、工作负荷大、人体工学不良
- 久坐少动，导致支撑脊柱的肌群变弱
- 体重过重，增加脊柱机械负担
- 既往外伤
- 关节炎症或退行性疾病

## 为什么要做规范检查

脊柱钙化的症状很容易和骨刺、椎间盘问题、椎管狭窄或其他神经压迫混淆。因此，不能只凭感觉判断。

常见检查方式包括：

- 病史询问和活动度评估
- X 光，用来观察骨性改变和钙化位置
- MRI，用来评估椎间盘、神经和软组织受压情况
- CT，在需要时更清楚地观察骨结构

## 治疗原则

大多数情况并不需要手术，核心目标是减轻症状并维持活动能力：

1. 调整坐姿、站姿、睡姿和搬重物方式
2. 通过运动与物理治疗加强背部和核心肌群
3. 在医生指导下使用止痛或抗炎药物
4. 控制体重，并避免长时间保持一个姿势
5. 若已有明显神经压迫或功能受损，才考虑注射治疗或手术

## 如何延缓进展

- 不要长时间久坐不动
- 规律训练核心与背部力量
- 避免弓背搬重物
- 维持健康体重
- 若症状反复或加重，尽早就医评估

脊柱钙化并不等于一定会快速恶化。越早识别、越早建立正确的生活和治疗策略，越有机会减轻疼痛、保护神经功能，并维持日常活动的舒适度。`,
  },
  {
    slug: '10-cach-giup-ban-de-chiu-hon-ngay-tai-nha',
    title_en: '10 ways to feel better at home during a gout flare',
    title_ru: '10 способов почувствовать себя лучше дома при приступе подагры',
    title_cn: '痛风发作时，在家让自己更舒服的 10 个方法',
    summary_en: 'Gout can trigger sudden, intense joint pain. These 10 simple at-home measures focus on comfort, cooling, rest, and self-care while you monitor symptoms and seek medical guidance when needed.',
    summary_ru: 'Подагра может вызывать внезапную и сильную боль в суставах. Эти 10 домашних мер помогают сделать состояние более переносимым за счет покоя, охлаждения и грамотного ухода за собой.',
    summary_cn: '痛风常会带来突发且剧烈的关节疼痛。这 10 个居家方法主要围绕休息、冷敷、减轻不适与自我照护，帮助你更平稳地度过发作期。',
    content_en: md`## A practical at-home guide during a gout flare

Gout is known for sudden, severe joint pain that often wakes people at night or appears early in the morning. The big toe is the classic location, but the ankle, knee, elbow, fingers, and other joints can also be affected. During an acute flare, the skin around the joint may become red, warm, swollen, and extremely tender.

Home measures do not replace medical treatment, but they can reduce discomfort while you monitor symptoms and arrange proper care.

## Recognize a typical flare

Common signs include:

- Sudden severe pain in one joint
- Swelling, warmth, and redness around that area
- Marked stiffness and difficulty moving
- Pain that feels worse at night or early morning

## 10 ways to feel better at home

1. **Use a cold compress.** Wrap ice in a thin towel and place it on the painful joint for about 20 to 30 minutes at a time. Never apply ice directly to the skin.
2. **Warm soaking can help some people relax.** If warmth feels soothing and does not worsen swelling, a short warm foot soak before bed may improve comfort.
3. **Reduce stress.** Stress can worsen sleep, appetite, and self-care. Breathing exercises, meditation, gentle stretching, music, or a calming routine can help.
4. **Rest and elevate the affected joint.** Avoid loading the painful area. Elevation can help reduce swelling.
5. **Limit high-purine foods during flares.** Red meat and certain organ meats can contribute to uric acid burden. Choose lighter protein sources and balanced meals.
6. **Drink enough water.** Hydration supports kidney function and helps the body handle excess uric acid more effectively.
7. **Try simple lemon water if it suits you.** Some people feel it supports hydration and routine self-care, though it is not a substitute for treatment.
8. **Avoid alcohol and fructose-sweetened drinks.** These are common flare triggers and can push uric acid higher.
9. **Work toward a healthy body weight.** Extra weight increases joint stress and may worsen metabolic factors related to gout.
10. **Use medication when prescribed.** Anti-inflammatory treatment or uric-acid-lowering medicine should be guided by a clinician, especially if flares repeat.

## When to seek medical help quickly

See a doctor promptly if:

- The pain is severe and not improving
- You cannot move the joint normally
- You develop fever, chills, or feel generally unwell
- Night pain repeatedly wakes you up
- Symptoms are new, unusual, or more intense than before

## A realistic takeaway

At-home care can make a gout flare easier to tolerate, but long-term control depends on proper diagnosis, trigger management, and a treatment plan that fits your health status. If attacks keep returning, do not just manage the pain repeatedly. That pattern usually means the underlying uric acid problem still needs a clearer plan.`,
    content_ru: md`## Как облегчить состояние дома во время приступа подагры

Подагра часто вызывает внезапную и очень сильную боль в суставе. Приступ нередко начинается ночью или рано утром. Чаще всего страдает большой палец стопы, но боль может появляться и в голеностопе, колене, локте, пальцах и других суставах. Во время обострения кожа вокруг сустава становится горячей, красной, отечной и очень чувствительной.

Домашние меры не заменяют лечение у врача, но могут сделать приступ более переносимым, пока вы наблюдаете за симптомами и организуете медицинскую помощь.

## Как распознать типичный приступ

Основные признаки:

- резкая боль в одном суставе
- выраженный отек, покраснение и чувство жара
- скованность и трудность движения
- усиление боли ночью или под утро

## 10 способов почувствовать себя лучше

1. **Холодный компресс.** Заверните лед в тонкое полотенце и прикладывайте на 20–30 минут. Не кладите лед прямо на кожу.
2. **Теплая ванночка может расслабить.** Если тепло не усиливает отек, короткая теплая ванночка для стоп перед сном иногда приносит облегчение.
3. **Снижайте уровень стресса.** Напряжение ухудшает сон, режим и самоконтроль. Помогают дыхательные упражнения, медитация, мягкая растяжка и спокойные ритуалы.
4. **Дайте суставу покой и приподнимайте его.** Не нагружайте болезненное место, а в положении покоя держите его выше.
5. **Ограничьте продукты с высоким содержанием пуринов.** Особенно это касается красного мяса и некоторых субпродуктов.
6. **Пейте достаточно воды.** Это помогает почкам эффективнее выводить избыток мочевой кислоты.
7. **При желании попробуйте воду с лимоном.** Это не лечение, но для некоторых людей такой напиток помогает поддерживать питьевой режим.
8. **Исключите алкоголь и сладкие напитки с фруктозой.** Они часто провоцируют обострения.
9. **Стремитесь к здоровой массе тела.** Лишний вес усиливает нагрузку на суставы и может ухудшать обменные факторы, связанные с подагрой.
10. **Принимайте лекарства только по назначению врача.** Противовоспалительные и препараты для контроля мочевой кислоты должны подбираться индивидуально.

## Когда нужна быстрая консультация врача

Обратитесь за медицинской помощью, если:

- боль слишком сильная и не уменьшается
- сустав почти не двигается
- появилась температура или выраженная слабость
- ночная боль повторяется снова и снова
- симптомы необычные или значительно тяжелее прежних

## Главная мысль

Домашние меры помогают пережить приступ, но долгосрочный контроль подагры требует точного диагноза, понимания триггеров и полноценного плана лечения. Если приступы повторяются, не стоит ограничиваться только временным снятием боли — обычно это означает, что основная причина все еще не взята под контроль.`,
    content_cn: md`## 痛风发作时的居家应对思路

痛风常见的特点是某个关节突然剧烈疼痛，很多人会在夜间或清晨被痛醒。最典型的部位是大脚趾，但踝关节、膝盖、手肘、手指等部位也可能受累。发作时，关节周围皮肤常会红、肿、热、痛，稍微碰一下都很难受。

居家措施不能替代医生治疗，但在急性发作阶段，可以帮助减轻不适，给你争取更稳定的休息和观察时间。

## 先识别典型表现

常见信号包括：

- 某一个关节突然剧痛
- 局部明显红肿发热
- 关节僵硬，活动困难
- 夜间或清晨疼痛更明显

## 10 个能让你稍微舒服一些的方法

1. **冷敷。** 用毛巾包住冰袋，敷在疼痛关节上，每次约 20 到 30 分钟。不要直接把冰放在皮肤上。
2. **温水泡脚可作为辅助放松。** 如果温热不会让肿胀更严重，睡前短时间泡脚有时会让人更舒服。
3. **减轻压力。** 压力会影响睡眠、饮食和自我照护。深呼吸、冥想、轻柔伸展或听音乐都可能有帮助。
4. **休息并抬高患处。** 让疼痛的关节少负重，休息时适当垫高有助于缓解肿胀。
5. **发作期减少高嘌呤食物。** 尤其是红肉和部分动物内脏，应适当控制。
6. **喝够水。** 充足补水有助于肾脏处理多余尿酸。
7. **如果适合自己，可尝试淡柠檬水。** 它不是治疗手段，但有助于维持饮水习惯。
8. **避免酒精和高果糖饮料。** 这两类饮品常是诱发痛风加重的重要因素。
9. **逐步控制体重。** 体重过高不仅增加关节负担，也会影响与痛风相关的代谢状态。
10. **需要时按医嘱用药。** 消炎止痛药或降尿酸药应由医生判断是否适合。

## 这些情况要尽快就医

如果出现以下情况，不要只在家里硬扛：

- 疼痛非常强烈且迟迟不缓解
- 关节几乎无法活动
- 同时出现发热、发冷或全身不适
- 反复在夜间被痛醒
- 这次症状明显比以往更重或更异常

## 更关键的是长期控制

居家处理的意义主要是让急性发作阶段更容易熬过去，但真正想减少复发，还是要靠明确诊断、管理诱因以及建立适合自己的长期治疗方案。如果痛风一再反复，说明问题不只是“这次很痛”，而是尿酸管理本身还需要更系统的处理。`,
  },
  {
    slug: 'phau-thuat-veo-cot-song-khi-nao-can-va-can-biet-gi',
    title_en: 'Scoliosis surgery: when it is needed and what to know',
    title_ru: 'Операция при сколиозе: когда она нужна и что важно знать',
    title_cn: '脊柱侧弯手术：何时需要，以及你该了解什么',
    summary_en: 'Scoliosis surgery is usually considered only when other treatments are no longer enough. The aim is to stop further curvature, improve alignment, and help the body stay balanced.',
    summary_ru: 'Операцию при сколиозе обычно рассматривают только тогда, когда другие методы уже недостаточно эффективны. Ее цель — остановить дальнейшее искривление, улучшить осанку и сохранить баланс тела.',
    summary_cn: '脊柱侧弯手术通常是在其他治疗方式效果不足时才会考虑，主要目标是阻止继续弯曲、改善脊柱排列，并帮助身体维持平衡。',
    content_en: md`## Scoliosis surgery is usually not the first step

Doctors normally try non-surgical treatment before recommending surgery for scoliosis. Bracing, exercise-based rehabilitation, and regular follow-up are often used first. Surgery becomes a serious option only when the spinal curve is severe, progressing, or starting to affect posture, balance, pain, or function.

For many adults, a curve around 45 degrees or more raises concern, but the decision is not based on one number alone. Age, curve location, growth status, speed of progression, flexibility of the curve, and overall health all matter.

## Main goals of surgery

Spinal surgery for scoliosis generally aims to:

- prevent the curve from worsening
- improve alignment and visible balance
- stabilize the spine
- reduce the long-term burden on posture and daily movement

Correction is often substantial, but the goal is not a mathematically “perfect” spine. The goal is a safer, more balanced, more stable spine.

## Common surgical approaches

Surgeons may use different techniques depending on the pattern of curvature and the person’s anatomy. Broadly, procedures may involve:

- removing selected bone or disc structures when needed for correction
- spinal fusion using screws, rods, and fixation systems to hold the spine in a better position while segments heal together

## When surgery is more likely to be recommended

Situations that often support surgery include:

- a severe curve that keeps progressing
- failure of non-surgical treatment
- a curve typically in the 40 to 70 degree range in suitable patients
- rapid progression, for example more than 10 degrees in a year
- a flexible curve pattern that can still be corrected well

## When surgery may not be suitable

Not every person with scoliosis is a good surgical candidate. Surgery may be more difficult or less suitable in cases such as:

- multiple rigid curves
- marked kyphosis in the thoracic region
- serious lung disease or medical conditions that increase surgical risk
- previous chest or abdominal procedures that complicate access

## What the procedure and recovery usually involve

Before surgery, the team reviews imaging, health status, and the planned correction in detail. During the procedure, fixation hardware is used to guide the spine into a safer alignment and then hold that position while fusion develops.

Operations often last several hours. Recovery is gradual:

1. The first weeks focus on wound care, rest, pain control, and gentle guided movement.
2. The next months focus on protecting the spine, avoiding heavy lifting, and slowly rebuilding function.
3. Later follow-up determines when swimming, strengthening, and eventually sports can resume.

## Nutrition and aftercare matter

Recovery is not only about the operation itself. Adequate calories, protein, fluids, fiber, calcium, and overall medical follow-up all support healing. Constipation, poor appetite, or excessive fatigue after surgery should be discussed early rather than ignored.

## Risks to understand honestly

Like other major spinal procedures, scoliosis surgery carries risks such as:

- nerve injury
- bleeding or vascular injury
- infection
- blood clots
- hardware or fusion-related complications

That does not mean surgery is unsafe for everyone. It means the decision should be individualized, well-planned, and handled by a team that has assessed both benefits and risks carefully.

## A practical conclusion

Scoliosis surgery is usually reserved for situations where the curve is severe, progressing, or no longer manageable by conservative means. The right candidate is not simply “someone with a curved spine,” but someone whose overall pattern, health status, and expected benefit justify a major intervention. If surgery is being discussed, ask clearly about goals, alternatives, expected recovery, and what success should realistically look like in daily life.`,
    content_ru: md`## Операция при сколиозе обычно не является первым шагом

При сколиозе врачи, как правило, сначала используют консервативные методы: наблюдение, лечебную физкультуру, иногда корсет. Операция рассматривается тогда, когда искривление становится выраженным, продолжает прогрессировать или начинает заметно влиять на осанку, баланс, боль и функцию.

Для многих взрослых тревожным ориентиром становится дуга около 45 градусов и более, но решение не принимается только по одному числу. Важны возраст, расположение дуги, скорость прогрессирования, гибкость искривления и общее состояние здоровья.

## Основные цели операции

Хирургическое лечение сколиоза обычно направлено на то, чтобы:

- остановить дальнейшее прогрессирование искривления
- улучшить выравнивание позвоночника
- сохранить баланс тела
- стабилизировать позвоночник в более безопасном положении

Цель операции — не сделать позвоночник «идеально прямым», а получить более устойчивую и функционально выгодную ось тела.

## Какие методы применяются

В зависимости от типа деформации хирург может использовать разные техники. В общих чертах это может включать:

- удаление отдельных костных или дисковых структур, если это необходимо для коррекции
- фиксацию позвоночника винтами, стержнями и системой спондилодеза

## Когда операция более вероятна

К типичным показаниям относятся:

- выраженная дуга, которая продолжает увеличиваться
- отсутствие эффекта от консервативного лечения
- деформация порядка 40–70 градусов у подходящих пациентов
- быстрое нарастание искривления, например более чем на 10 градусов в год
- достаточная подвижность дуги для коррекции

## Когда операция может быть не лучшим вариантом

Хирургическое лечение подходит не всем. Сложности возможны при:

- множественных ригидных дугах
- выраженном грудном кифозе
- тяжелых заболеваниях легких
- предыдущих операциях на грудной или брюшной полости, которые усложняют доступ

## Как проходит операция и восстановление

Перед вмешательством команда оценивает снимки, общее состояние и объем коррекции. Во время операции используются фиксаторы, которые помогают вывести позвоночник в более правильное положение и удерживать его, пока формируется костное сращение.

Восстановление занимает время:

1. В первые недели важны отдых, уход за раной, контроль боли и осторожная активизация.
2. В следующие месяцы нужно избегать тяжелой нагрузки и защищать позвоночник.
3. Лишь позже врач решает, когда можно возвращаться к плаванию, укрепляющим упражнениям и спорту.

## Питание и уход после операции

Для заживления важны не только техника операции, но и достаточное питание: калории, белок, вода, клетчатка, кальций. Если после операции сохраняются выраженная слабость, отсутствие аппетита или запоры, об этом нужно говорить врачу.

## Какие риски нужно понимать

Как и любая крупная операция на позвоночнике, вмешательство может сопровождаться рисками:

- повреждение нервных структур
- кровотечение
- инфекция
- тромбообразование
- проблемы с металлоконструкцией или сращением

Это не означает, что операция обязательно опасна, но решение должно быть максимально взвешенным и персонализированным.

## Практический вывод

Операция при сколиозе — это, как правило, вариант для случаев, когда деформация выражена, прогрессирует или уже плохо контролируется без хирургии. Важно обсуждать не только сам факт операции, но и ее цели, альтернативы, сроки восстановления и ожидаемый результат в повседневной жизни.`,
    content_cn: md`## 脊柱侧弯手术通常不是第一步

面对脊柱侧弯，医生通常会先尝试非手术方式，例如观察随访、支具、康复训练或物理治疗。只有当弯曲程度明显、持续进展，或者已经影响姿势、平衡、疼痛和日常功能时，手术才会被认真纳入考虑。

很多成年人在脊柱弯曲达到约 45 度或以上时会进入重点评估范围，但是否手术不能只看一个数字。年龄、弯曲位置、进展速度、弯曲是否仍有可塑性，以及整体身体状况，都很关键。

## 手术的主要目标

脊柱侧弯手术通常希望达到以下几件事：

- 阻止弯曲继续加重
- 改善脊柱排列和身体平衡
- 让脊柱在更稳定的位置固定下来
- 降低长期姿势失衡带来的负担

手术并不是为了把脊柱“做得绝对笔直”，而是为了获得一个更安全、更平衡、更稳定的结构。

## 常见手术方式

医生会根据弯曲类型和患者情况选择不同方案，常见思路包括：

- 在需要时处理部分骨性或椎间盘结构，以帮助矫正
- 使用螺钉、连接棒等固定系统进行脊柱融合，让脊柱在较理想的位置逐渐稳定愈合

## 哪些情况更可能考虑手术

比较常见的手术指征包括：

- 弯曲明显且还在继续加重
- 非手术治疗效果不足
- 在合适患者中，弯曲大约达到 40 到 70 度
- 一年内进展很快，例如增加超过 10 度
- 弯曲仍有一定可矫正性

## 哪些情况不一定适合手术

并不是所有侧弯都适合直接手术。以下情况可能让手术更复杂，或不一定是首选：

- 多段僵硬侧弯
- 胸段后凸明显
- 严重肺部疾病或其他增加手术风险的慢性病
- 既往胸腹部手术使入路更复杂

## 手术和恢复通常意味着什么

手术前，团队会仔细评估影像、健康状况和矫正目标。手术中会借助固定器械把脊柱调整到更稳定的排列，再通过融合让这一位置长期维持。

恢复是分阶段的：

1. 前几周重点是伤口护理、疼痛控制和循序渐进活动。
2. 随后几个月要避免负重和剧烈活动，让脊柱有时间稳定愈合。
3. 更后期才会在医生评估后逐步恢复游泳、力量训练或运动。

## 术后营养和护理同样重要

恢复不仅靠手术本身。足够的热量、蛋白质、水分、纤维、钙和规律随访都直接影响愈合质量。如果术后食欲差、便秘严重或疲劳明显，应尽早和医生沟通。

## 必须诚实面对的风险

脊柱大手术和其他大型手术一样，可能存在：

- 神经损伤
- 出血或血管损伤
- 感染
- 血栓
- 内固定或融合相关并发症

这并不代表手术一定危险，而是说明是否手术必须建立在充分评估收益与风险的基础上。

## 实际结论

脊柱侧弯手术更像是“在合适时机，为合适患者做的重大决定”，而不是见到侧弯就必须处理。真正重要的是明确手术目标、替代方案、恢复周期，以及术后在日常生活里究竟希望达到什么结果。`,
  },
  {
    slug: 'bap-chan-bieu-tinh-hieu-ve-cang-co-de-xu-ly-va-phong-tranh',
    title_en: 'Calf muscle strain: understand it to treat and prevent it',
    title_ru: 'Растяжение икроножной мышцы: как понять, лечить и предупреждать',
    title_cn: '小腿肌肉拉伤：了解原因，才能更好处理与预防',
    summary_en: 'A calf strain happens when muscle fibers at the back of the lower leg are overstretched or mildly torn. Most cases recover well with the right rest, support, and gradual return to activity.',
    summary_ru: 'Растяжение икроножной мышцы возникает, когда мышечные волокна на задней поверхности голени перерастягиваются или частично повреждаются. Большинство случаев хорошо восстанавливаются при правильном отдыхе и постепенном возвращении к нагрузке.',
    summary_cn: '小腿拉伤是指小腿后侧肌纤维被过度拉伸或轻度撕裂。大多数情况在充分休息、正确护理和循序渐进恢复活动后都能获得良好恢复。',
    content_en: md`## Calf strain is common, but it still needs proper handling

A calf strain happens when muscle fibers at the back of the lower leg are overstretched or partially torn. It often appears after sprinting, jumping, sudden acceleration, abrupt direction changes, or returning to exercise too quickly. The injury can involve the gastrocnemius, the soleus, or both.

Most strains are not dangerous and recover well, but the condition should not be ignored. Continuing activity too early can turn a mild strain into a more serious tear.

## Severity levels

- **Grade 1:** small fiber injury, mild pain, walking is still possible
- **Grade 2:** clearer tissue damage, pain with walking, swelling, sport is difficult, recovery often takes weeks
- **Grade 3:** major tear or rupture, severe pain, bruising, major loss of function, sometimes surgery is needed

## Common symptoms

- sudden pain in the back of the lower leg
- tightness or cramping
- pain that increases with walking, pushing off, or rising onto the toes
- swelling or bruising
- difficulty standing on tiptoe or pointing the foot downward

Some people also describe hearing or feeling a small “pop” at the moment of injury.

## What else can look similar

Not all calf pain is a simple muscle strain. Important alternatives include:

- muscle cramp
- shin splints
- bruising from direct impact
- Achilles tendon injury
- deep vein thrombosis (DVT)

DVT is especially important to rule out if the calf is suddenly swollen, red, hot, and painful, or if there are breathing symptoms or chest pain. That situation needs urgent medical evaluation.

## What doctors may do

Assessment usually starts with the story of the injury and a physical examination. Depending on the findings, doctors may use:

- ultrasound to look for muscle fiber injury or fluid collection
- MRI for deeper tears, bleeding, or diagnostic uncertainty

Imaging is also useful when symptoms do not fit a routine strain or when a more serious cause is possible.

## Early treatment: think RICE

The first line of care is usually based on RICE:

1. **Rest:** stop the activity that caused pain
2. **Ice:** apply cold packs wrapped in cloth for 15 to 20 minutes at a time
3. **Compression:** use a supportive wrap if recommended
4. **Elevation:** raise the leg when resting to reduce swelling

Pain relief medicine may help in selected cases, but it should still be used appropriately and with attention to kidney, stomach, and bleeding risks.

## When to seek medical care promptly

See a clinician if:

- pain remains significant after a week of home care
- swelling, heat, and redness are marked
- you cannot walk normally
- you suspect DVT or Achilles rupture
- symptoms are worsening rather than improving

## How to reduce the chance of another strain

- warm up properly before exercise
- build calf strength and flexibility consistently
- increase training load gradually
- stop pushing through pain
- choose footwear that supports your activity

Calf strain is usually manageable, but the recovery outcome depends heavily on not rushing the return to sport. Early rest, smart reloading, and timely medical review when red flags appear are what keep a common injury from becoming a long interruption.`,
    content_ru: md`## Растяжение икроножной мышцы встречается часто, но требует правильного подхода

Растяжение икроножной мышцы возникает, когда мышечные волокна на задней поверхности голени перерастягиваются или частично рвутся. Это часто случается после спринта, прыжков, резкой смены темпа или слишком быстрого возвращения к нагрузке. Повреждаться может икроножная мышца, камбаловидная мышца или обе сразу.

Большинство таких травм неопасны и хорошо восстанавливаются, но игнорировать их нельзя. Слишком раннее возвращение к активности может превратить легкое растяжение в более серьезный разрыв.

## Степени тяжести

- **1 степень:** минимальное повреждение волокон, умеренная боль, ходьба обычно возможна
- **2 степень:** более заметное повреждение, боль при ходьбе, отек, спорт временно невозможен
- **3 степень:** значительный разрыв, сильная боль, синяк, выраженное снижение функции, иногда требуется операция

## Частые симптомы

- внезапная боль по задней поверхности голени
- чувство стянутости или спазма
- усиление боли при ходьбе, отталкивании или подъеме на носки
- отек или кровоподтек
- трудность встать на носок или направить стопу вниз

Иногда человек ощущает или слышит легкий щелчок в момент травмы.

## Что может маскироваться под растяжение

Боль в икре не всегда означает именно мышечное растяжение. Похожими могут быть:

- мышечный спазм
- shin splints
- ушиб
- повреждение ахиллова сухожилия
- тромбоз глубоких вен

Особенно важно срочно исключить тромбоз, если голень внезапно опухла, стала горячей, красной и болезненной, либо если появились одышка и боль в груди.

## Что делает врач

Обычно врач уточняет механизм травмы и проводит осмотр. При необходимости назначаются:

- УЗИ для оценки мышечных волокон и жидкости вокруг повреждения
- МРТ при подозрении на более глубокий разрыв, кровоизлияние или нетипичную причину боли

## Первая помощь: принцип RICE

В первые часы и дни чаще всего рекомендуют:

1. **Rest — покой:** сразу прекратить болезненную нагрузку
2. **Ice — холод:** прикладывать холод через ткань на 15–20 минут
3. **Compression — компрессия:** использовать эластичный бинт или поддержку при необходимости
4. **Elevation — возвышенное положение:** держать ногу выше для уменьшения отека

В некоторых случаях могут использоваться обезболивающие, но принимать их следует разумно и с учетом возможных противопоказаний.

## Когда нужно обратиться к врачу

Медицинская помощь особенно нужна, если:

- через неделю домашнего ухода боль не уменьшается
- отек, жар и покраснение выражены
- вы не можете нормально ходить
- есть подозрение на тромбоз или разрыв ахиллова сухожилия
- состояние ухудшается, а не улучшается

## Как снизить риск повторной травмы

- полноценно разминаться перед нагрузкой
- регулярно развивать силу и гибкость икроножных мышц
- увеличивать тренировочный объем постепенно
- не тренироваться через боль
- носить подходящую обувь

Растяжение икроножной мышцы обычно хорошо поддается восстановлению, но исход сильно зависит от того, насколько грамотно человек соблюдает покой вначале и насколько постепенно возвращается к нагрузке потом.`,
    content_cn: md`## 小腿拉伤很常见，但处理不能随便

小腿拉伤是指小腿后侧肌纤维被过度拉伸或部分撕裂，常见于冲刺、跳跃、突然变向、突然加速，或者停训后过快恢复运动。受伤的部位可能是腓肠肌、比目鱼肌，或者两者同时受累。

大多数小腿拉伤并不危险，而且恢复效果通常不错，但前提是处理得当。如果刚受伤就继续硬撑训练，原本轻度的损伤很容易变成更严重的撕裂。

## 常见分级

- **1 级：** 只有少量肌纤维受损，疼痛较轻，通常还能走路
- **2 级：** 受损更明显，走路会痛，局部肿胀，短期内很难继续运动
- **3 级：** 大范围撕裂甚至断裂，疼痛剧烈，可能伴随淤青和明显功能受限，部分情况需要手术

## 常见症状

- 小腿后侧突然疼痛
- 发紧、抽扯或痉挛感
- 走路、蹬地、踮脚时疼痛加重
- 局部肿胀或瘀青
- 难以踮脚或做跖屈动作

有些人在受伤瞬间还会感觉到轻微“啪”一声。

## 哪些问题可能和它很像

并不是所有小腿痛都是单纯拉伤，还要注意区分：

- 肌肉痉挛
- 胫骨劳损
- 撞击导致的淤伤
- 跟腱损伤
- 深静脉血栓

如果小腿突然明显肿胀、发红、发热、疼痛，或者同时伴有胸痛、气短，就不能只当成普通拉伤，要尽快就医排除血栓风险。

## 医生通常会怎么判断

医生会先了解受伤经过并检查局部情况，必要时会安排：

- 超声，用来看肌纤维是否有撕裂以及周围是否积液
- MRI，用于评估更深层的撕裂、出血，或在诊断不明确时进一步确认

## 早期处理：记住 RICE

小腿拉伤早期最常见的处理原则是 RICE：

1. **Rest 休息：** 立刻停止诱发疼痛的活动
2. **Ice 冷敷：** 用毛巾包住冰袋，每次 15 到 20 分钟
3. **Compression 加压：** 在合适情况下使用弹力绷带支撑
4. **Elevation 抬高：** 休息时把腿垫高，帮助减轻肿胀

如果疼痛明显，某些情况下可在医生建议下使用止痛药，但仍需注意胃、肾和出血风险。

## 这些情况应尽快就医

- 在家休息一周后疼痛仍没有明显缓解
- 局部红、热、肿很明显
- 已经无法正常走路
- 怀疑跟腱断裂或深静脉血栓
- 症状持续加重

## 如何减少再次受伤

- 运动前做好热身
- 规律训练小腿力量和柔韧性
- 逐步增加训练量，不要突然加码
- 不要硬扛疼痛继续练
- 选择适合活动场景的鞋子

小腿拉伤通常不难恢复，真正决定恢复质量的关键，是前期有没有好好休息，后期有没有按节奏逐步回到运动。`,
  },
  {
    slug: 'lam-thang-lung-ngay-tai-nha-9-bai-tap-don-gian-hieu-qua',
    title_en: 'Straighten your back at home: 9 simple exercises',
    title_ru: 'Как выпрямить спину дома: 9 простых упражнений',
    title_cn: '在家改善驼背：9 个简单有效的练习',
    summary_en: 'Mild postural kyphosis can often be improved with consistent, well-chosen exercises. These simple routines help support posture, spinal mobility, and better daily alignment.',
    summary_ru: 'Легкая сутулость, связанная с осанкой, нередко улучшается при регулярных и правильно подобранных упражнениях. Такие простые практики помогают поддерживать осанку и подвижность позвоночника.',
    summary_cn: '对于因姿势习惯导致的轻度驼背，坚持合适的练习通常能带来改善。这些简单动作有助于支撑体态、提升脊柱灵活度并改善日常站姿坐姿。',
    content_en: md`## Mild postural rounding can improve with consistent work

A mildly rounded upper back is often linked to prolonged poor posture, especially from long hours at a desk or on a phone. In these cases, the spine itself may not be structurally damaged. Instead, the issue is often a combination of stiff chest muscles, weak upper-back muscles, and a habit of letting the shoulders and head drift forward.

That is why exercise can help. The goal is not to “force” the spine straight in one session. The real goal is to improve awareness, strengthen support muscles, and make an upright position easier to maintain every day.

## Why exercise helps

Well-chosen movements can:

- strengthen the upper back, shoulder, and core muscles
- improve spinal mobility
- open the chest
- train better alignment in daily posture

Consistency matters more than intensity. Practicing three to four times per week is usually more useful than doing an intense session once in a while.

## 9 simple exercises to start with

1. **Posture image drill:** Stand tall, gently tuck the chin, and draw the shoulder blades back and down.
2. **Foam roller chest opening:** Lie over a roller placed across the upper back and let the chest open gently.
3. **Seated or standing back extension:** Lift the chest and lengthen upward without forcing the neck.
4. **Scapular squeeze:** Pull the shoulder blades toward each other and hold briefly.
5. **Wall angels:** Stand against a wall and move the arms upward while keeping the ribcage controlled.
6. **Thoracic mobility drill:** Rotate or extend the upper back slowly to restore movement.
7. **Cobra pose:** Lift the chest lightly from the floor to strengthen the back.
8. **Wall push-up:** Use the wall to strengthen shoulders, chest, and trunk in a controlled way.
9. **Plank:** Build deep core support to help stabilize posture.

## Important practice tips

- Start slowly and learn the movement pattern first
- Increase time and repetitions gradually
- Focus on control, breathing, and alignment rather than force
- Stop if you feel sharp pain or neurological symptoms

## When exercise alone is not enough

Not every rounded back is a simple posture problem. Severe kyphosis, pain with breathing, marked stiffness, or inability to stand upright should be assessed by a doctor or physical therapist. Structural spinal conditions need a more specific plan.

## A useful mindset

Improving posture is usually the result of repeated small corrections, not one dramatic stretch. The combination of exercise, ergonomic changes, movement breaks, and body awareness is what creates a visible and sustainable difference over time.`,
    content_ru: md`## Легкая сутулость часто улучшается при регулярной работе

Небольшое округление верхней части спины нередко связано с длительной неправильной осанкой, особенно если человек много сидит за компьютером или телефоном. В таких случаях проблема часто заключается не в грубом структурном дефекте позвоночника, а в сочетании слабых мышц спины, укороченных мышц груди и привычки выводить плечи и голову вперед.

Именно поэтому упражнения могут быть полезны. Их задача не в том, чтобы «силой выпрямить» позвоночник за один день, а в том, чтобы укрепить поддерживающие мышцы, улучшить подвижность и сделать правильное положение тела более естественным.

## Почему упражнения работают

Грамотно подобранные движения помогают:

- укрепить мышцы верхней части спины, плечевого пояса и корпуса
- улучшить подвижность позвоночника
- раскрыть грудную клетку
- закрепить более правильную осанку в быту

Здесь важнее регулярность, чем интенсивность. Тренировки 3–4 раза в неделю обычно полезнее, чем редкие, но чрезмерные нагрузки.

## 9 простых упражнений

1. **Осознанная правильная стойка:** мягко подтянуть подбородок и увести лопатки назад и вниз.
2. **Раскрытие грудного отдела на ролле:** аккуратно раскрывать грудную клетку на валике.
3. **Разгибание грудного отдела сидя или стоя:** вытягиваться вверх без переразгибания шеи.
4. **Сведение лопаток:** короткие удержания для активации мышц между лопатками.
5. **Wall angels:** движение рук вдоль стены с контролем корпуса.
6. **Упражнение на подвижность грудного отдела:** медленные разгибания и ротации.
7. **Поза кобры:** мягкое поднятие груди для укрепления мышц спины.
8. **Отжимания от стены:** щадящее укрепление плеч, груди и корпуса.
9. **Планка:** развитие глубоких мышц корпуса для стабилизации позвоночника.

## Важные правила

- начинайте постепенно
- увеличивайте время и количество повторений по мере адаптации
- следите за дыханием и техникой
- прекращайте упражнение при резкой боли или необычных симптомах

## Когда одних упражнений мало

Если сутулость выраженная, сопровождается сильной болью, ограничением движения, проблемами с дыханием или невозможностью выпрямиться, нужна очная оценка специалиста. Структурные формы кифоза требуют другого подхода.

## Практический вывод

Исправление осанки — это результат множества небольших правильных действий. Упражнения работают лучше всего вместе с хорошей эргономикой, перерывами в сидении и вниманием к тому, как вы стоите, сидите и двигаетесь каждый день.`,
    content_cn: md`## 轻度驼背通常可以通过规律练习改善

很多人出现上背变圆、肩膀前扣，并不一定是脊柱结构真的严重变形，更多时候是长期姿势不良造成的，例如久坐办公、长时间低头看手机、胸前肌群紧张而背部肌群无力。

这也是为什么运动训练会有帮助。练习的目标不是一次性把背“掰直”，而是逐步建立更好的体态控制，强化支撑脊柱的肌群，并让正确姿势在日常生活里更容易维持。

## 为什么练习有效

合适的动作通常可以帮助：

- 加强上背、肩带和核心力量
- 提升胸椎灵活度
- 打开胸廓，改善肩部前扣
- 让站姿和坐姿更稳定

对于姿势性驼背来说，规律性比强度更重要。每周稳定练习 3 到 4 次，通常比偶尔一次练很多更有价值。

## 9 个简单练习

1. **体态想象练习：** 轻收下巴，让肩胛骨向后下方回收。
2. **泡沫轴开胸：** 躺在泡沫轴上，温和打开胸廓。
3. **坐姿或站姿胸椎伸展：** 抬胸向上延展，不要过度仰头。
4. **肩胛后缩：** 主动夹肩胛，短暂停留。
5. **靠墙天使：** 背靠墙缓慢举手，练习肩背控制。
6. **胸椎活动练习：** 做缓慢的伸展和旋转。
7. **眼镜蛇式：** 轻轻抬起上半身，加强背部肌群。
8. **靠墙俯卧撑：** 用较轻负荷训练肩部、胸部和核心。
9. **平板支撑：** 建立深层核心稳定性，帮助支撑脊柱。

## 练习时要记住

- 从慢、从轻开始
- 随着适应逐步增加时间和次数
- 注重呼吸、控制和动作质量，不要靠蛮力
- 如果出现明显刺痛、麻木或异常不适，应停止并评估

## 什么时候不能只靠练习

如果驼背很严重，伴随明显疼痛、活动受限、呼吸不舒服，或者根本无法站直，就不能只靠网上动作自己处理。这类情况更适合由医生或物理治疗师评估，排除结构性后凸等问题。

## 实际上最有用的思路

改善驼背通常不是靠某一个“神奇动作”，而是靠持续的小修正累积起来的结果。练习、坐站姿调整、久坐中断和日常体态意识一起配合，效果才更稳定。`,
  },
];

function sqlString(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlArray(values) {
  if (!Array.isArray(values)) return 'NULL';
  return `ARRAY[${values.map((value) => sqlString(value)).join(', ')}]::text[]`;
}

async function runQuery(query) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(text);
    throw new Error(`Supabase Management API error ${res.status}`);
  }

  return JSON.parse(text);
}

function buildProductUpdate(product) {
  return `
    UPDATE public.products
    SET
      name_en = ${sqlString(product.name_en)},
      name_ru = ${sqlString(product.name_ru)},
      name_cn = ${sqlString(product.name_cn)},
      description_en = ${sqlString(product.description_en)},
      description_ru = ${sqlString(product.description_ru)},
      description_cn = ${sqlString(product.description_cn)},
      key_benefits_en = ${sqlArray(product.key_benefits_en)},
      key_benefits_ru = ${sqlArray(product.key_benefits_ru)},
      key_benefits_cn = ${sqlArray(product.key_benefits_cn)},
      origin_en = ${sqlString(product.origin_en)},
      origin_ru = ${sqlString(product.origin_ru)},
      origin_cn = ${sqlString(product.origin_cn)},
      texture_en = ${sqlString(product.texture_en)},
      texture_ru = ${sqlString(product.texture_ru)},
      texture_cn = ${sqlString(product.texture_cn)},
      updated_at = now()
    WHERE id = ${Number(product.id)};
  `;
}

function buildBlogUpdate(post) {
  return `
    UPDATE public.blog_posts
    SET
      title_en = ${sqlString(post.title_en)},
      title_ru = ${sqlString(post.title_ru)},
      title_cn = ${sqlString(post.title_cn)},
      summary_en = ${sqlString(post.summary_en)},
      summary_ru = ${sqlString(post.summary_ru)},
      summary_cn = ${sqlString(post.summary_cn)},
      content_en = ${sqlString(post.content_en)},
      content_ru = ${sqlString(post.content_ru)},
      content_cn = ${sqlString(post.content_cn)},
      updated_at = now()
    WHERE slug = ${sqlString(post.slug)};
  `;
}

function buildBlogCategoryUpdate(category) {
  return `
    UPDATE public.blog_categories
    SET
      name_en = ${sqlString(category.name_en)},
      name_ru = ${sqlString(category.name_ru)},
      name_cn = ${sqlString(category.name_cn)}
    WHERE slug = ${sqlString(category.slug)};
  `;
}

async function main() {
  const query = `
    BEGIN;
    ${PRODUCT_TRANSLATIONS.map(buildProductUpdate).join('\n')}
    ${BLOG_CATEGORY_TRANSLATIONS.map(buildBlogCategoryUpdate).join('\n')}
    ${BLOG_TRANSLATIONS.map(buildBlogUpdate).join('\n')}
    COMMIT;

    SELECT
      (SELECT count(*)::int FROM public.products WHERE name_en IS NOT NULL AND description_en IS NOT NULL) AS products_en_ready,
      (SELECT count(*)::int FROM public.products WHERE name_ru IS NOT NULL AND description_ru IS NOT NULL) AS products_ru_ready,
      (SELECT count(*)::int FROM public.products WHERE name_cn IS NOT NULL AND description_cn IS NOT NULL) AS products_cn_ready,
      (SELECT count(*)::int FROM public.blog_posts WHERE title_en IS NOT NULL AND summary_en IS NOT NULL) AS blogs_en_ready,
      (SELECT count(*)::int FROM public.blog_posts WHERE title_ru IS NOT NULL AND summary_ru IS NOT NULL) AS blogs_ru_ready,
      (SELECT count(*)::int FROM public.blog_posts WHERE title_cn IS NOT NULL AND summary_cn IS NOT NULL) AS blogs_cn_ready,
      (SELECT count(*)::int FROM public.blog_posts WHERE title_en IS NOT NULL AND summary_en IS NOT NULL AND content_en IS NOT NULL) AS blogs_en_content_ready,
      (SELECT count(*)::int FROM public.blog_posts WHERE title_ru IS NOT NULL AND summary_ru IS NOT NULL AND content_ru IS NOT NULL) AS blogs_ru_content_ready,
      (SELECT count(*)::int FROM public.blog_posts WHERE title_cn IS NOT NULL AND summary_cn IS NOT NULL AND content_cn IS NOT NULL) AS blogs_cn_content_ready,
      (SELECT count(*)::int FROM public.blog_categories WHERE name_en IS NOT NULL) AS blog_categories_en_ready,
      (SELECT count(*)::int FROM public.blog_categories WHERE name_ru IS NOT NULL) AS blog_categories_ru_ready,
      (SELECT count(*)::int FROM public.blog_categories WHERE name_cn IS NOT NULL) AS blog_categories_cn_ready;
  `;

  const rows = await runQuery(query);
  console.log(JSON.stringify({
    productsSeeded: PRODUCT_TRANSLATIONS.length,
    blogCategoriesSeeded: BLOG_CATEGORY_TRANSLATIONS.length,
    blogsSeeded: BLOG_TRANSLATIONS.length,
    coverage: rows[0] || {},
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
