import type {
  AboutPageData,
  AuthPageImages,
  BlogCategory,
  BlogPost,
  Doctor,
  FAQItem,
  FooterContent,
  HomepageHero,
  PaymentSettings,
  Product,
  ProductBrand,
  ProductCategory,
  ProductImage,
  Service,
  SiteInfo,
} from '../types';
import { FALLBACK_HOMEPAGE_HERO } from './siteDefaults';
import mockBlogSql from '../mockdata_blog.txt?raw';

const DEFAULT_VAT_RATE = 0.1;
const DEFAULT_BLOG_AUTHOR_ID = 'fallback-editorial-team';
const DEFAULT_BLOG_AUTHOR = {
  id: DEFAULT_BLOG_AUTHOR_ID,
  name: 'Thế Giới Trị Mụn Editorial Team',
  avatar_path: '',
  avatar_url: '/icons/da-lieu-nhiet-doi-phu-quoc-96.png',
};

const r2Url = (bucket: string, path: string) =>
  `/r2/${encodeURIComponent(bucket)}/${String(path)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;

const FALLBACK_PRODUCT_VISUALS = [
  '/seo/og-default.jpg',
  '/seo/blog-cover-health.jpg',
  '/seo/blog-cover-skin-care.jpg',
  '/seo/blog-cover-technology.jpg',
  '/hero/hero-desktop-v2.webp',
];

const fallbackProductVisual = (index: number): string =>
  FALLBACK_PRODUCT_VISUALS[index % FALLBACK_PRODUCT_VISUALS.length];

const FALLBACK_SERVICE_VISUALS = [
  '/hero/hero-desktop-v2.webp',
  '/hero/hero-tablet-v2.webp',
  '/hero/hero-mobile-v2.webp',
  '/seo/blog-cover-health.jpg',
  '/seo/blog-cover-technology.jpg',
];

const KNOWN_MISSING_SERVICE_IMAGE_PATHS = new Set([
  'services/1/Untitleddesign-2.webp',
  'services/2/Untitleddesign-6.webp',
  'services/3/Untitleddesign-4.webp',
  'services/4/Untitleddesign-5.webp',
  'services/5/Untitleddesign-3.webp',
]);

export const getFallbackServiceImageUrl = (serviceKey: number | string): string => {
  const normalizedKey = typeof serviceKey === 'number'
    ? serviceKey
    : Number(String(serviceKey || '').replace(/\D+/g, '')) || 0;
  const index = Math.max(0, normalizedKey - 1) % FALLBACK_SERVICE_VISUALS.length;
  return FALLBACK_SERVICE_VISUALS[index];
};

export const isKnownMissingServiceImagePath = (path?: string | null): boolean =>
  KNOWN_MISSING_SERVICE_IMAGE_PATHS.has(String(path || '').trim());

const cloneJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const toSlug = (value: string): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

const parsePgArray = (value: string): string[] => {
  const trimmed = String(value || '').trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return [];
  return trimmed
    .slice(1, -1)
    .split(/","|","|","|","/g)
    .map((entry) => entry.replace(/^"+|"+$/g, '').trim())
    .filter(Boolean);
};

const FALLBACK_PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    id: 1,
    name: 'Dược phẩm',
    slug: 'duoc-pham',
    description: 'Các sản phẩm thuốc và dược mỹ phẩm đặc trị các vấn đề da liễu, cần tư vấn của Bác sĩ.',
  },
  {
    id: 2,
    name: 'Sản phẩm làm sạch',
    slug: 'san-pham-lam-sach',
    description: 'Tẩy trang, sữa rửa mặt giúp loại bỏ bụi bẩn, bã nhờn và lớp trang điểm.',
  },
  {
    id: 3,
    name: 'Sản phẩm cân bằng',
    slug: 'san-pham-can-bang',
    description: 'Toner, lotion giúp cân bằng độ pH, làm dịu và cấp ẩm tức thì cho da.',
  },
  {
    id: 4,
    name: 'Tinh chất đặc trị',
    slug: 'tinh-chat-dac-tri',
    description: 'Serum, ampoule chứa các hoạt chất nồng độ cao giải quyết các vấn đề chuyên sâu.',
  },
  {
    id: 5,
    name: 'Sản phẩm dưỡng ẩm',
    slug: 'san-pham-duong-am',
    description: 'Kem dưỡng, gel dưỡng giúp khóa ẩm, phục hồi và củng cố hàng rào bảo vệ da.',
  },
  {
    id: 6,
    name: 'Kem chống nắng',
    slug: 'kem-chong-nang',
    description: 'Bảo vệ da toàn diện khỏi tác hại của tia UVA/UVB, ngăn ngừa lão hóa và sạm nám.',
  },
  {
    id: 7,
    name: 'Thực phẩm chức năng',
    slug: 'thuc-pham-chuc-nang',
    description: 'Viên uống bổ sung, hỗ trợ sức khỏe làn da từ bên trong.',
  },
];

const fallbackProductImages = new Map<number, ProductImage[]>([
  [
    1,
    [
      {
        id: 1,
        product_id: 1,
        image_path: '',
        image_url: fallbackProductVisual(0),
        display_order: 0,
        is_primary: true,
      },
    ],
  ],
  [
    2,
    [
      {
        id: 2,
        product_id: 2,
        image_path: '',
        image_url: fallbackProductVisual(1),
        display_order: 0,
        is_primary: true,
      },
    ],
  ],
  [
    3,
    [
      {
        id: 3,
        product_id: 3,
        image_path: '',
        image_url: fallbackProductVisual(2),
        display_order: 0,
        is_primary: true,
      },
      {
        id: 4,
        product_id: 3,
        image_path: '',
        image_url: fallbackProductVisual(3),
        display_order: 1,
        is_primary: false,
      },
      {
        id: 5,
        product_id: 3,
        image_path: '',
        image_url: fallbackProductVisual(4),
        display_order: 2,
        is_primary: false,
      },
    ],
  ],
  [
    4,
    [
      {
        id: 6,
        product_id: 4,
        image_path: '',
        image_url: fallbackProductVisual(1),
        display_order: 0,
        is_primary: true,
      },
    ],
  ],
  [
    5,
    [
      {
        id: 7,
        product_id: 5,
        image_path: '',
        image_url: fallbackProductVisual(2),
        display_order: 0,
        is_primary: true,
      },
      {
        id: 8,
        product_id: 5,
        image_path: '',
        image_url: fallbackProductVisual(3),
        display_order: 1,
        is_primary: false,
      },
    ],
  ],
]);

const fallbackProductsSeed: Product[] = [
  {
    id: 1,
    name: 'Gel Trị Mụn Klenzit MS 0.1%',
    slug: 'gel-tri-mun-klenzit-ms-0-1',
    description:
      'Gel chứa Adapalene 0.1% dạng vi cầu, giúp điều trị mụn trứng cá, mụn ẩn và giảm viêm hiệu quả.',
    long_description: [
      {
        type: 'text',
        content:
          'Gel trị mụn Klenzit-MS chứa Adapalene 0.1% được bào chế dưới dạng vi cầu, giúp hoạt chất thẩm thấu sâu và giải phóng từ từ, giảm thiểu kích ứng. Sản phẩm hiệu quả trong việc bình thường hóa sừng hóa, làm thông thoáng lỗ chân lông và ngăn ngừa hình thành mụn mới.',
      },
    ],
    price: 145000,
    vat_rate: DEFAULT_VAT_RATE,
    stock_quantity: 85,
    category_id: 1,
    low_stock_threshold: 5,
    usage_instructions:
      'Sử dụng 1 lần/ngày vào buổi tối sau khi làm sạch da. Lấy một lượng gel vừa đủ thoa một lớp mỏng lên vùng da bị mụn. Tránh tiếp xúc với mắt và niêm mạc. Bắt buộc sử dụng kem chống nắng vào ban ngày.',
    ingredients: 'Adapalene (dạng vi cầu) 0.1%',
    is_published: true,
    key_benefits: [
      'Điều trị mụn trứng cá (mụn ẩn, mụn viêm)',
      'Bình thường hóa quá trình sừng hóa',
      'Giảm thiểu kích ứng nhờ công nghệ vi cầu',
      'Ngăn ngừa hình thành mụn mới',
    ],
    skin_types: ['Da dầu', 'Da mụn', 'Da hỗn hợp'],
    volume: '15g',
    texture: 'Gel',
    origin: 'Ấn Độ',
    precautions:
      'Có thể gây khô da, đỏ da, bong tróc nhẹ trong thời gian đầu. Tránh sử dụng cho phụ nữ có thai và cho con bú. Không dùng chung với các sản phẩm có tính lột tẩy mạnh khác.',
    images: fallbackProductImages.get(1),
    detail_loaded: true,
    brand: 'Glenmark',
  },
  {
    id: 2,
    name: 'Gel Trị Mụn Differin Adapalene Gel 0.1%',
    slug: 'gel-tri-mun-differin-0-1',
    description:
      '"Tiêu chuẩn vàng" trong điều trị mụn trứng cá, được FDA phê duyệt. Giúp làm sạch lỗ chân lông và ngăn ngừa mụn mới.',
    long_description: [
      {
        type: 'text',
        content:
          'Differin Gel là sản phẩm chứa Adapalene 0.1% đầu tiên được FDA Hoa Kỳ cho phép bán không cần kê đơn. Sản phẩm tác động sâu vào nguyên nhân gây mụn, giúp điều tiết quá trình thay mới tế bào da, ngăn chặn sự bít tắc lỗ chân lông và giảm viêm hiệu quả. An toàn cho việc sử dụng lâu dài để duy trì làn da sạch mụn.',
      },
    ],
    price: 320000,
    vat_rate: DEFAULT_VAT_RATE,
    stock_quantity: 50,
    category_id: 1,
    low_stock_threshold: 5,
    usage_instructions:
      'Thoa một lớp mỏng lên toàn bộ mặt (trừ vùng mắt, môi) mỗi tối sau khi rửa mặt sạch. Có thể gây khô da nhẹ trong thời gian đầu sử dụng, nên kết hợp với kem dưỡng ẩm phục hồi. Luôn dùng kem chống nắng vào ban ngày.',
    ingredients:
      'Adapalene 0.1%, Carbomer 940, Edetate Disodium, Methylparaben, Poloxamer 182, Propylene Glycol.',
    is_published: true,
    key_benefits: [
      'Được FDA phê duyệt điều trị mụn',
      'Giảm đến 87% mụn sau 12 tuần',
      'Ngăn ngừa bít tắc lỗ chân lông',
      'Giảm viêm và sưng đỏ',
    ],
    skin_types: ['Da mụn', 'Da dầu', 'Mọi loại da (cần thận trọng)'],
    volume: '15g',
    texture: 'Gel',
    origin: 'Mỹ',
    precautions:
      'Sản phẩm có thể làm da nhạy cảm hơn với ánh nắng. Không sử dụng trên vùng da bị tổn thương, trầy xước.',
    images: fallbackProductImages.get(2),
    detail_loaded: true,
    brand: 'Galderma',
  },
  {
    id: 3,
    name: 'Sữa Rửa Mặt La Roche-Posay Effaclar',
    slug: 'sua-rua-mat-la-roche-posay-effaclar',
    description:
      'Gel rửa mặt tạo bọt dành cho da dầu mụn, giúp làm sạch sâu, loại bỏ bã nhờn và ngăn ngừa mụn.',
    long_description: [
      {
        type: 'text',
        content:
          'La Roche-Posay Effaclar Purifying Foaming Gel là sản phẩm làm sạch hàng ngày, nhẹ nhàng loại bỏ bụi bẩn và bã nhờn dư thừa. Với Nước khoáng La Roche-Posay làm dịu và Kẽm PCA giúp kiểm soát dầu, sản phẩm mang lại làn da sạch thoáng mà không gây khô căng.',
      },
    ],
    price: 415000,
    vat_rate: DEFAULT_VAT_RATE,
    stock_quantity: 120,
    category_id: 2,
    low_stock_threshold: 5,
    usage_instructions:
      'Làm ẩm da với nước ấm. Lấy một lượng vừa đủ, tạo bọt và massage nhẹ nhàng lên mặt. Rửa sạch lại với nước. Sử dụng 2 lần/ngày, sáng và tối.',
    ingredients:
      'Aqua, Sodium Laureth Sulfate, PEG-8, Coco-Betaine, Hexylene Glycol, Sodium Chloride, Zinc PCA, Citric Acid.',
    is_published: true,
    key_benefits: [
      'Làm sạch sâu cho da dầu mụn',
      'Loại bỏ bã nhờn dư thừa',
      'Không chứa xà phòng, không paraben',
      'Giúp da sạch thoáng, không khô căng',
    ],
    skin_types: ['Da dầu', 'Da mụn', 'Da nhạy cảm'],
    volume: '400ml',
    texture: 'Gel tạo bọt',
    origin: 'Pháp',
    precautions: 'Tránh tiếp xúc trực tiếp với vùng mắt.',
    images: fallbackProductImages.get(3),
    detail_loaded: true,
    brand: 'La Roche-Posay',
  },
  {
    id: 4,
    name: 'Nước Tẩy Trang Bioderma Sensibio H2O',
    slug: 'nuoc-tay-trang-bioderma-sensibio-h2o',
    description:
      'Dung dịch làm sạch và tẩy trang micellar dịu nhẹ, dành cho da nhạy cảm. Best-seller toàn cầu.',
    long_description: [
      {
        type: 'text',
        content:
          'Sensibio H2O là sản phẩm tiên phong trong công nghệ micellar water. Các hạt micelle trong sản phẩm nhẹ nhàng làm sạch, loại bỏ lớp trang điểm và bụi bẩn mà không cần rửa lại với nước. Sản phẩm tôn trọng sự cân bằng của làn da, phù hợp với cả những làn da nhạy cảm nhất.',
      },
    ],
    price: 495000,
    vat_rate: DEFAULT_VAT_RATE,
    stock_quantity: 200,
    category_id: 2,
    low_stock_threshold: 5,
    usage_instructions:
      'Thấm dung dịch ra bông tẩy trang. Nhẹ nhàng lau khắp mặt và mắt để loại bỏ lớp trang điểm và bụi bẩn. Không cần rửa lại với nước.',
    ingredients:
      'Water (Aqua), PEG-6 Caprylic/Capric Glycerides, Cucumis Sativus (Cucumber) Fruit Extract, Mannitol, Xylitol.',
    is_published: true,
    key_benefits: [
      'Làm sạch hiệu quả lớp trang điểm và bụi bẩn',
      'Công nghệ Micellar dịu nhẹ',
      'Làm dịu và giảm cảm giác căng rát',
      'Không cần rửa lại với nước',
    ],
    skin_types: ['Da nhạy cảm', 'Mọi loại da'],
    volume: '500ml',
    texture: 'Dạng lỏng (nước)',
    origin: 'Pháp',
    precautions: 'Chỉ sử dụng ngoài da.',
    images: fallbackProductImages.get(4),
    detail_loaded: true,
    brand: 'Bioderma',
  },
  {
    id: 5,
    name: 'Kem Chống Nắng La Roche-Posay Anthelios UVMUNE 400',
    slug: 'kcn-la-roche-posay-anthelios-uvmune-400',
    description:
      'Kem chống nắng phổ rộng tiên tiến nhất với màng lọc độc quyền, bảo vệ da khỏi tia UVA dài nhất, kết cấu mỏng nhẹ.',
    long_description: [
      {
        type: 'text',
        content:
          'Anthelios UVMUNE 400 là một cuộc cách mạng trong lĩnh vực chống nắng. Với màng lọc Mexoryl 400, sản phẩm bảo vệ da khỏi phổ tia UVA dài nhất (380-400nm) - vốn là tác nhân âm thầm gây lão hóa sâu.',
      },
      {
        type: 'image',
        image_path: 'products/content/uvmune400-tech.webp',
        image_url: r2Url('product-images', 'products/content/uvmune400-tech.webp'),
        caption: 'Công nghệ Mexoryl 400 độc quyền chống lại tia UVA dài.',
      },
      {
        type: 'text',
        content:
          'Công nghệ Netlock giúp tạo lớp màng mỏng nhẹ, kháng nước, kháng cát và không gây cay mắt, mang lại cảm giác thoải mái suốt cả ngày dài.',
      },
    ],
    price: 535000,
    vat_rate: DEFAULT_VAT_RATE,
    stock_quantity: 250,
    category_id: 6,
    low_stock_threshold: 5,
    usage_instructions:
      'Lắc đều trước khi sử dụng. Thoa một lượng vừa đủ lên da ít nhất 15-20 phút trước khi ra nắng. Thoa lại sau mỗi 2 giờ, hoặc sau khi bơi, đổ mồ hôi.',
    ingredients: 'Mexoryl 400, XL-Protect Technology, Netlock Technology, Glycerin.',
    is_published: true,
    key_benefits: [
      'Bảo vệ tối ưu khỏi tia UVA/UVB',
      'Màng lọc Mexoryl 400 chống UVA dài',
      'Kháng nước, mồ hôi và cát',
      'Kết cấu lỏng nhẹ, không nhờn rít',
    ],
    skin_types: ['Mọi loại da', 'Da nhạy cảm'],
    volume: '50ml',
    texture: 'Dạng sữa lỏng (Fluid)',
    origin: 'Pháp',
    precautions: 'Lắc kỹ trước khi sử dụng để đảm bảo các màng lọc được hòa trộn đều.',
    images: fallbackProductImages.get(5),
    detail_loaded: true,
    brand: 'La Roche-Posay',
  },
];

const fallbackServicesSeed: Service[] = [
  {
    id: 1,
    name: 'Trị mụn chuyên sâu',
    slug: 'tri-mun-chuyen-sau',
    description: 'Liệu trình chăm sóc da mụn hiệu quả, an toàn.',
    long_description:
      'Dịch vụ Trị mụn chuyên sâu sử dụng công nghệ hiện đại kết hợp dược mỹ phẩm đặc trị giúp làm sạch nhân mụn, kiểm soát dầu và ngăn ngừa tái phát. Phù hợp với mọi loại da, đặc biệt hiệu quả với da dầu, mụn viêm và mụn ẩn.',
    benefits: [
      'Giảm mụn rõ rệt sau 3-5 lần điều trị',
      'Không gây đau rát hay tổn thương da',
      'Ngăn ngừa mụn quay trở lại',
      'Da sáng khỏe, đều màu hơn',
      'Tư vấn và theo dõi bởi bác sĩ da liễu',
    ],
    icon: 'Acnelcon',
    price: 1800000,
    image_path: '',
    image_url: getFallbackServiceImageUrl(1),
    procedure_steps: [],
    faq_items: [],
  },
  {
    id: 2,
    name: 'Laser Toning trị nám',
    slug: 'laser-toning-tri-nam',
    description: 'Điều trị nám tận gốc bằng công nghệ Laser Toning tiên tiến.',
    long_description:
      'Laser Toning giúp phá vỡ sắc tố melanin gây nám, mang lại làn da sáng đều màu. Phù hợp với người bị nám mảng, nám hỗn hợp lâu năm hoặc sau sinh.',
    benefits: [
      'Cải thiện màu da sau 2-3 buổi đầu tiên',
      'Không xâm lấn, không cần nghỉ dưỡng',
      'An toàn cho cả da nhạy cảm',
      'Hỗ trợ điều trị tàn nhang và đốm nâu',
      'Ngăn nám quay trở lại nếu duy trì chăm sóc',
    ],
    icon: 'LaserIcon',
    price: 0,
    image_path: '',
    image_url: getFallbackServiceImageUrl(2),
    procedure_steps: [],
    faq_items: [],
  },
  {
    id: 3,
    name: 'Peel da sinh học',
    slug: 'peel-da-sinh-hoc',
    description: 'Thay da sinh học giúp tái tạo bề mặt da nhẹ nhàng.',
    long_description:
      'Sử dụng các acid hữu cơ nồng độ thấp để loại bỏ tế bào chết, kích thích tái tạo collagen và tăng cường hấp thụ dưỡng chất.',
    benefits: [
      'Da mịn màng, sáng khỏe rõ rệt',
      'Hỗ trợ điều trị mụn nhẹ và lỗ chân lông to',
      'Giảm dầu và giảm thâm sau mụn',
      'Thích hợp với da nhạy cảm và da lão hóa sớm',
      'Có thể thực hiện định kỳ mỗi tháng',
    ],
    icon: 'PeelIcon',
    price: 0,
    image_path: '',
    image_url: getFallbackServiceImageUrl(3),
    procedure_steps: [],
    faq_items: [],
  },
  {
    id: 4,
    name: 'RF vi điểm điều trị sẹo rỗ',
    slug: 'rf-vi-diem-dieu-tri-seo-ro',
    description: 'Công nghệ RF vi điểm tái tạo da, cải thiện sẹo rỗ rõ rệt.',
    long_description:
      'RF vi điểm tạo vi tổn thương siêu nhỏ để kích thích quá trình chữa lành và tăng sinh collagen, làm đầy sẹo rỗ, thu nhỏ lỗ chân lông.',
    benefits: [
      'Cải thiện 50-70% sẹo sau 3-5 lần',
      'Không cần nghỉ dưỡng dài',
      'Hiệu quả với cả sẹo lâu năm',
      'An toàn, kiểm soát độ sâu chính xác',
      'Kết hợp được với PRP để tăng hiệu quả',
    ],
    icon: 'RFMicroneedling',
    price: 0,
    image_path: '',
    image_url: getFallbackServiceImageUrl(4),
    procedure_steps: [],
    faq_items: [],
  },
  {
    id: 5,
    name: 'Tắm trắng phi thuyền',
    slug: 'tam-trang-phi-thuyen',
    description: 'Liệu trình tắm trắng an toàn bằng công nghệ ánh sáng sinh học.',
    long_description:
      'Sử dụng tinh chất thiên nhiên kết hợp ánh sáng Bio Light kích thích đào thải hắc sắc tố, giúp da trắng hồng từ sâu bên trong mà không gây bắt nắng.',
    benefits: [
      'Hiệu quả ngay sau buổi đầu tiên',
      'Da đều màu, mịn màng rõ rệt',
      'Không gây bong tróc hay đau rát',
      'Thích hợp với da tối màu, da rám nắng',
      'Có thể kết hợp các dưỡng chất tăng cường',
    ],
    icon: 'WhiteningShip',
    price: 0,
    image_path: '',
    image_url: getFallbackServiceImageUrl(5),
    procedure_steps: [],
    faq_items: [],
  },
];

const fallbackBlogCoverForCategory = (categorySlug: string, index: number) => {
  const seoCover = categorySlug === 'cham-soc-da'
    ? '/seo/blog-cover-skin-care.jpg'
    : categorySlug === 'cong-nghe-tham-my'
      ? '/seo/blog-cover-technology.jpg'
      : categorySlug === 'dieu-tri-mun' || categorySlug === 'lao-hoa-da'
        ? '/seo/blog-cover-health.jpg'
        : '/seo/blog-cover-default.jpg';

  const numbered = `/images/blog%20images/Blog%20Image%20${(index % 18) + 1}.webp`;
  return index % 2 === 0 ? numbered : seoCover;
};

const parseMockBlogData = () => {
  const categorySection = mockBlogSql.match(/INSERT INTO public\.blog_categories \(slug, name\) VALUES\s*([\s\S]*?);/);
  const categories: BlogCategory[] = categorySection
    ? [...categorySection[1].matchAll(/\('([^']+)',\s*'([^']+)'\)/g)].map((match) => ({
        slug: match[1],
        name: match[2],
      }))
    : [];

  const postsSection = mockBlogSql.split('INSERT INTO public.blog_posts')[1] || '';
  const postRegex =
    /\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*\$\$([\s\S]*?)\$\$\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*\)(?:,|;)/g;
  const posts: BlogPost[] = [];
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = postRegex.exec(postsSection)) !== null) {
    const [, slug, title, summary, content, authorId, date, categorySlug] = match;
    posts.push({
      slug,
      title,
      summary,
      content: content.trim(),
      detail_loaded: true,
      author_id: authorId || DEFAULT_BLOG_AUTHOR_ID,
      date,
      category_slug: categorySlug,
      image_path: '',
      image_url: fallbackBlogCoverForCategory(categorySlug, index),
      author: DEFAULT_BLOG_AUTHOR,
    });
    index += 1;
  }

  return { categories, posts };
};

const parsedMockBlog = parseMockBlogData();

export const FALLBACK_SITE_INFO: SiteInfo = {
  id: 1,
  clinic_name: 'Thế Giới Trị Mụn',
  logo_light_path: '',
  logo_dark_path: '',
  favicon_path: '',
  logo_light_url: '/icons/da-lieu-nhiet-doi-phu-quoc-512.png',
  logo_dark_url: '/icons/da-lieu-nhiet-doi-phu-quoc-512.png',
  favicon_url: '/icons/da-lieu-nhiet-doi-phu-quoc-48.png?v=clinic-20260730',
};

export const FALLBACK_FOOTER_CONTENT: FooterContent = {
  id: 1,
  about_text: 'Phòng khám chuyên khoa da liễu định hướng chuyên sâu. Mang đến giải pháp chăm sóc da an toàn và hiệu quả cho khách hàng.',
  address: '106 Lê Đình Thám, P Tân Sơn Nhì, Quận Tân Phú, TP HCM',
  phone: '0934086843',
  email: 'thegioitrimun@gmail.com',
  working_hours_weekday: 'Thứ 2 - Thứ 6: 9:00 - 20:00',
  working_hours_weekend: 'Thứ 7 - Chủ Nhật: 9:00 - 18:00',
  copyright_text: `© ${new Date().getFullYear()} Thế Giới Trị Mụn. Bản quyền đã được bảo hộ.`,
  zalo_url: '',
  messenger_url: '',
  floating_contact_enabled: true,
};

export const FALLBACK_PAYMENT_SETTINGS: PaymentSettings = {
  id: 1,
  bank_bin: '970436',
  account_number: '1027290930',
  account_holder_name: 'HO VI DAI PHUC',
};

export const FALLBACK_AUTH_PAGE_IMAGES: AuthPageImages = {
  id: 1,
  login_image_path: '',
  login_image_url: '/hero/hero-desktop-v2.webp',
};

export const FALLBACK_FEATURED_SERVICE_IDS = [1, 3, 5];
export const FALLBACK_FEATURED_DOCTOR_IDS: string[] = [];
export const FALLBACK_FEATURED_POST_SLUGS = [
  '5-sai-lam-khi-rua-mat',
  '7-buoc-cham-soc-da-co-ban-tai-nha',
  'bha-va-aha-la-gi',
  'tac-hai-cua-anh-nang-mat-troi',
];

export const FALLBACK_FAQ_ITEMS: FAQItem[] = [];
export const FALLBACK_DOCTORS: Doctor[] = [];
export const FALLBACK_BRANDS: ProductBrand[] = Array.from(
  new Set(
    fallbackProductsSeed
      .map((product) => String(product.brand || '').trim())
      .filter(Boolean),
  ),
).map((name, index) => ({
  id: index + 1,
  name,
  slug: toSlug(name),
  description: `${name} hiện đang có mặt tại Thế Giới Trị Mụn.`,
}));

export const FALLBACK_ABOUT_PAGE_DATA: AboutPageData = {
  content: {
    id: 1,
    header_title: 'Câu chuyện về Thế Giới Trị Mụn',
    header_subtitle:
      'Chúng tôi kết hợp chuyên môn da liễu, tư duy cá nhân hóa và hệ sinh thái sản phẩm để xây dựng lộ trình điều trị rõ ràng cho từng làn da.',
    image_path: '',
    image_url: '/hero/hero-desktop-v2.webp',
    mission_title: 'Sứ mệnh & Tầm nhìn',
    mission_text:
      'Mang đến giải pháp chăm sóc da an toàn, hiệu quả và có khả năng duy trì dài hạn dựa trên nền tảng y học chứng cứ.',
    vision_text:
      'Trở thành điểm đến tin cậy cho khách hàng cần một lộ trình chăm sóc da rõ ràng, đồng bộ giữa clinic và routine tại nhà.',
    values_title: 'Giá trị cốt lõi',
    values_subtitle: 'Chuyên môn, minh bạch và theo sát tiến triển thật của làn da.',
  },
  reasonsToChoose: [],
  coreValues: [],
};

export const getFallbackHomepageHero = (): HomepageHero => cloneJson(FALLBACK_HOMEPAGE_HERO);
export const getFallbackSiteInfo = (): SiteInfo => cloneJson(FALLBACK_SITE_INFO);
export const getFallbackFooterContent = (): FooterContent => cloneJson(FALLBACK_FOOTER_CONTENT);
export const getFallbackAuthPageImages = (): AuthPageImages => cloneJson(FALLBACK_AUTH_PAGE_IMAGES);
export const getFallbackPaymentSettings = (): PaymentSettings => cloneJson(FALLBACK_PAYMENT_SETTINGS);
export const getFallbackFaqItems = (): FAQItem[] => cloneJson(FALLBACK_FAQ_ITEMS);
export const getFallbackDoctors = (): Doctor[] => cloneJson(FALLBACK_DOCTORS);
export const getFallbackAboutPageData = (): AboutPageData => cloneJson(FALLBACK_ABOUT_PAGE_DATA);
export const getFallbackFeaturedServiceIds = (): number[] => [...FALLBACK_FEATURED_SERVICE_IDS];
export const getFallbackFeaturedDoctorIds = (): string[] => [...FALLBACK_FEATURED_DOCTOR_IDS];
export const getFallbackFeaturedPostSlugs = (): string[] => [...FALLBACK_FEATURED_POST_SLUGS];
export const getFallbackBrands = (): ProductBrand[] => cloneJson(FALLBACK_BRANDS);

// Product data is transactional content. Never fabricate it when the catalog
// API is unavailable: callers must show a loading/error state instead.
export const getFallbackProductCategories = (): ProductCategory[] => [];

export const getFallbackProducts = (_options?: { detailLoaded?: boolean }): Product[] => [];

export const getFallbackHomepageProducts = (featuredCategoryIds: number[] = []): Product[] => {
  const all = getFallbackProducts({ detailLoaded: false });
  if (!featuredCategoryIds.length) return all;

  const featured = all.filter((product) => featuredCategoryIds.includes(product.category_id || -1));
  const featuredIds = new Set(featured.map((product) => product.id));
  return [...featured, ...all.filter((product) => !featuredIds.has(product.id))];
};

export const getFallbackProductByIdOrSlug = (idOrSlug: number | string): Product | null => {
  void idOrSlug;
  return null;
};

export const getFallbackServices = (): Service[] => cloneJson(fallbackServicesSeed);

export const getFallbackBlogCategories = (): BlogCategory[] => cloneJson(parsedMockBlog.categories);

export const getFallbackBlogPosts = (): BlogPost[] => cloneJson(parsedMockBlog.posts);

export const getFallbackBlogPostsLite = (): BlogPost[] =>
  getFallbackBlogPosts().map((post) => ({
    ...post,
    content: '',
    detail_loaded: false,
  }));

export const getFallbackFeaturedBlogPostsLite = (featuredSlugs: string[]): BlogPost[] => {
  const featuredOrder = new Map(featuredSlugs.map((slug, index) => [slug, index]));
  return getFallbackBlogPostsLite()
    .filter((post) => featuredOrder.has(post.slug))
    .sort((a, b) => (featuredOrder.get(a.slug) || 0) - (featuredOrder.get(b.slug) || 0));
};

export const getFallbackBlogPostBySlug = (slug: string): BlogPost | null =>
  getFallbackBlogPosts().find((post) => post.slug === slug) || null;
