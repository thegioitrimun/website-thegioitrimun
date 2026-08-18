import type { GeminiResponse, Source, ProductCategory, DetailFaqEntry } from '../types';

const GEMINI_TIMEOUT_MS = 45_000;
const USE_D1_API = String(import.meta.env.VITE_DATA_BACKEND || '').toLowerCase() === 'd1';
const Type = {
  OBJECT: 'OBJECT',
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  INTEGER: 'INTEGER',
  ARRAY: 'ARRAY',
} as const;

type GenerateContentResponse = {
  text?: string;
  candidates?: Array<{
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
    } | null;
  }>;
};

type AiAction =
  | 'ask_skin'
  | 'summarize_document'
  | 'generate_product_details'
  | 'generate_product_faq'
  | 'generate_seo_metadata'
  | 'translate_blog_category_en'
  | 'translate_blog_category_all'
  | 'translate_blog_content';

async function requestGemini(action: AiAction, request: Record<string, unknown>): Promise<GenerateContentResponse> {
  const headers = new Headers({ 'Content-Type': 'application/json' });

  if (USE_D1_API) {
    const csrfToken = readCookie('tg_csrf') || await issueD1CsrfToken();
    headers.set('X-CSRF-Token', csrfToken);
  } else {
    const { supabase } = await import('./supabaseClient');
    const { data, error } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (error || !accessToken) {
      const authError = new Error('Bạn cần đăng nhập để sử dụng dịch vụ AI.') as Error & { status?: number };
      authError.status = 401;
      throw authError;
    }
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch('/api/ai/generate', {
    method: 'POST',
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify({ action, request }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const gatewayError = new Error(payload?.error || 'Dịch vụ AI không phản hồi.') as Error & { status?: number };
    gatewayError.status = response.status;
    throw gatewayError;
  }

  return payload as GenerateContentResponse;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(';')) {
    const value = part.trim();
    if (value.startsWith(prefix)) return decodeURIComponent(value.slice(prefix.length));
  }
  return null;
}

async function issueD1CsrfToken(): Promise<string> {
  const response = await fetch('/api/auth/csrf', {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.csrfToken) {
    const error = new Error(payload?.error || 'Không thể khởi tạo phiên bảo mật.') as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return String(payload.csrfToken);
}

function stringifyError(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function getErrorStatus(error: any): number | undefined {
  const candidates = [
    error?.status,
    error?.code,
    error?.error?.code,
    error?.cause?.status,
    error?.cause?.code,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
  }
  const text = stringifyError(error);
  const match = text.match(/\b(429|500|502|503|504)\b/);
  return match ? Number(match[1]) : undefined;
}

function isTransientGeminiError(error: unknown): boolean {
  const text = stringifyError(error).toLowerCase();
  const nonRetryableTokens = [
    'not configured',
    'location is not supported',
    'api key',
    'permission denied',
    'invalid argument',
    'unsupported ai action',
  ];
  if (nonRetryableTokens.some((token) => text.includes(token))) return false;

  const status = getErrorStatus(error);
  if (status && [429, 500, 502, 503, 504].includes(status)) return true;
  return [
    'currently experiencing high demand',
    'unavailable',
    'overloaded',
    'deadline exceeded',
    'timed out',
    'timeout',
    'temporarily unavailable',
    'try again later',
    'resource exhausted',
  ].some((token) => text.includes(token));
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number = GEMINI_TIMEOUT_MS): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Gemini request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([operation, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function buildGeminiUserError(error: unknown, actionLabel: string): Error {
  const status = getErrorStatus(error);
  const text = stringifyError(error);
  const lower = text.toLowerCase();

  if (lower.includes('not configured')) {
    return new Error(`Không thể ${actionLabel} vì dịch vụ AI chưa được cấu hình trên máy chủ.`);
  }

  if (lower.includes('location is not supported')) {
    return new Error(`Không thể ${actionLabel} vì Google không hỗ trợ vị trí hạ tầng đang xử lý yêu cầu.`);
  }

  if (status === 429) {
    return new Error(`Dịch vụ AI đang bị giới hạn tần suất khi ${actionLabel}. Vui lòng thử lại sau ít phút.`);
  }

  if (isTransientGeminiError(error)) {
    return new Error(`Dịch vụ AI của Google đang tạm quá tải hoặc phản hồi chậm khi ${actionLabel}. Hệ thống đã thử lại tự động nhưng chưa thành công. Vui lòng thử lại sau vài phút.`);
  }

  if (lower.includes('api key') || lower.includes('permission denied') || status === 401 || status === 403) {
    return new Error(`Không thể dùng dịch vụ AI để ${actionLabel} vì khóa API hoặc quyền truy cập chưa hợp lệ.`);
  }

  if (status && status >= 400) {
    return new Error(`Không thể ${actionLabel} do dịch vụ AI trả về lỗi ${status}. Vui lòng thử lại sau.`);
  }

  return new Error(`Không thể ${actionLabel} do dịch vụ AI gặp lỗi ngoài dự kiến. Vui lòng thử lại sau.`);
}

// Helper function to retry API calls with exponential backoff
async function withExponentialBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 5,
  baseDelayMs: number = 1200
): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (error: any) {
      if (isTransientGeminiError(error) && attempt < maxRetries - 1) {
        attempt++;
        const delayMs = baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
        console.warn(`Gemini API transient failure. Retrying in ${Math.round(delayMs)}ms... (Attempt ${attempt}/${maxRetries - 1})`, error);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        throw error;
      }
    }
  }
  return operation(); // this line should theoretically never be reached due to the throw in the loop
}

// This function is specifically designed to answer the user's question.
export async function getO2SkinInfo(question: string): Promise<GeminiResponse> {
  try {
    const response: GenerateContentResponse = await withExponentialBackoff(() => withTimeout(requestGemini('ask_skin', {
      contents: question,
      config: {
        tools: [{ googleSearch: {} }],
      },
    })));

    const text = response.text ?? '';
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

    let sources: Source[] = [];
    if (groundingMetadata?.groundingChunks) {
      sources = groundingMetadata.groundingChunks
        .map((chunk: any) => ({ // Using `any` for robustness against API changes
          uri: chunk.web?.uri,
          title: chunk.web?.title,
        }))
        .filter((source): source is Source => !!source.uri && !!source.title);

      // Deduplicate sources based on URI
      const uniqueSources = new Map<string, Source>();
      sources.forEach(source => {
        if (!uniqueSources.has(source.uri)) {
          uniqueSources.set(source.uri, source);
        }
      });
      sources = Array.from(uniqueSources.values());
    }

    return { text, sources };

  } catch (error) {
    console.error("Error fetching data from Gemini API:", error);
    throw buildGeminiUserError(error, 'trả lời câu hỏi');
  }
}

export async function summarizeDocument(base64Content: string, mimeType: string): Promise<string> {
  try {
    const prompt = "Bạn là một trợ lý y tế AI. Dựa vào tài liệu được cung cấp, hãy tóm tắt và trích xuất tất cả thông tin y tế quan trọng (ví dụ: chẩn đoán, triệu chứng, phương pháp điều trị, đơn thuốc, ngày tháng quan trọng, kết quả xét nghiệm). Sắp xếp các thông tin này theo trình tự thời gian nếu có thể. Định dạng kết quả bằng Markdown để dễ đọc, sử dụng tiêu đề, danh sách và in đậm khi cần thiết.";

    const filePart = {
      inlineData: {
        data: base64Content,
        mimeType: mimeType,
      },
    };

    const textPart = {
      text: prompt,
    };

    const response: GenerateContentResponse = await withExponentialBackoff(() => withTimeout(requestGemini('summarize_document', {
      contents: { parts: [filePart, textPart] },
    })));

    return response.text ?? '';

  } catch (error) {
    console.error("Error summarizing document with Gemini API:", error);
    throw buildGeminiUserError(error, 'tạo tóm tắt AI');
  }
}

export async function generateProductDetails(productName: string, categories: ProductCategory[]): Promise<any> {
  const categorySlugs = categories.map(c => c.slug);

  const prompt = `Bạn là một chuyên gia về dược mỹ phẩm và một chuyên gia SEO hàng đầu. Dựa vào tên sản phẩm '${productName}', hãy nghiên cứu và tạo ra đầy đủ thông tin chi tiết cho sản phẩm này.
- **Bảng thành phần chuẩn quốc tế (ingredients - BẮT BUỘC CHUẨN INCI)**: BẮT BUỘC cung cấp danh sách thành phần theo đúng chuẩn INCI quốc tế chính thức (International Nomenclature of Cosmetic Ingredients) đầy đủ và chính xác của sản phẩm này.
  + Viết hoàn toàn bằng tiếng Anh chuẩn INCI (Ví dụ: "Water, Butylene Glycol, Dimethyl Sulfone, Betaine, Caprylic/Capric Triglyceride, Natto Gum, Sodium Hyaluronate, Disodium EDTA, Centella Asiatica Extract, Glycyrrhiza Glabra (Licorice) Root Extract, Polyquaternium-51, Chlorphenesin, Tocopheryl Acetate, Carbomer, Panthenol, Arginine, Luffa Cylindrica Fruit/Leaf/Stem Extract, Beta-Glucan, Althaea Rosea Flower Extract, Aloe Barbadensis Leaf Extract, Hydroxyethylcellulose, Portulaca Oleracea Extract, Lysine HCL, Proline, Sodium Ascorbyl Phosphate, Acetyl Methionine, Theanine, Lavandula Angustifolia (Lavender) Oil, Eucalyptus Globulus Leaf Oil, Pelargonium Graveolens Flower Oil, Citrus Limon (Lemon) Peel Oil, Citrus Aurantium Dulcis (Orange) Peel Oil, Cananga Odorata Flower Oil, Copper Tripeptide-1").
  + Các thành phần phân tách nhau bằng dấu phẩy theo đúng thứ tự nồng độ giảm dần như công bố trên bao bì chính hãng.
  + Tuyệt đối KHÔNG viết bằng tiếng Việt mô tả chung chung (như "Chiết xuất rau má, vitamin C..."), KHÔNG tự ý tóm tắt. Phải là chuỗi danh pháp INCI chuẩn xác.
- **Mô tả chi tiết (long_description)**: TRỌNG TÂM: Nội dung này BẮT BUỘC phải được định dạng phong phú bằng cú pháp Markdown chuẩn SEO. Bạn PHẢI sử dụng các thẻ tiêu đề (## cho H2, ### cho H3) để chia bố cục nội dung cho rõ ràng (VD: ## Thành phần nổi bật, ## Công dụng chính, ## Hướng dẫn sử dụng hiệu quả). Sử dụng in đậm (**text**) để nhấn mạnh các từ khóa quan trọng. Không trả về plain text.
- **FAQ sản phẩm (faq_items)**: Tạo 3-4 câu hỏi thường gặp phục vụ quyết định mua hàng, bảo quản, tần suất sử dụng hoặc loại da phù hợp. Câu trả lời phải ngắn gọn, chính xác, không phóng đại công dụng và không khẳng định điều trị quá mức.
- **Giá bán (price)**: Hãy nghiên cứu giá thị trường tại Việt Nam và đề xuất một mức giá bán lẻ hợp lý bằng đơn vị VND.
- **Số lượng tồn kho (stock_quantity)**: Đặt giá trị mặc định là 10.
- **Chuyên mục (category_slug)**: Chọn slug chuyên mục phù hợp nhất từ danh sách sau: ${categorySlugs.join(', ')}.
- **Nhãn hiệu (brand)**: Xác định nhãn hiệu (thương hiệu) của sản phẩm này.
- Các thông tin còn lại (mô tả ngắn, lợi ích, loại da phù hợp, hướng dẫn sử dụng, kết cấu, dung tích, xuất xứ, lưu ý) hãy điền đầy đủ và chính xác, bằng tiếng Việt.
- **Thông tin SEO**: Vui lòng tạo Tiêu đề SEO (dưới 60 ký tự), Mô tả SEO (dưới 160 ký tự) và 5-7 Từ khóa SEO liên quan nhất.
Hãy trả về kết quả dưới dạng một đối tượng JSON duy nhất tuân thủ schema đã cung cấp.`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      description: { type: Type.STRING, description: "Mô tả ngắn gọn về sản phẩm (tối đa 200 ký tự)." },
      long_description: { type: Type.STRING, description: "Mô tả chi tiết và đầy đủ về sản phẩm, định dạng bằng Markdown (bắt buộc dùng ## H2, ### H3, **in đậm**) chuẩn SEO." },
      price: { type: Type.NUMBER, description: "Giá bán lẻ đề xuất tại Việt Nam, tính bằng VND. Ví dụ: 535000" },
      stock_quantity: { type: Type.INTEGER, description: "Số lượng tồn kho, mặc định là 10." },
      usage_instructions: { type: Type.STRING, description: "Hướng dẫn chi tiết cách sử dụng sản phẩm hàng ngày." },
      ingredients: { 
        type: Type.STRING, 
        description: "BẮT BUỘC là danh sách thành phần theo đúng chuẩn INCI quốc tế chính thức (tiếng Anh chuẩn INCI phân tách bằng dấu phẩy theo thứ tự nồng độ giảm dần, ví dụ: 'Water, Butylene Glycol, Dimethyl Sulfone, Betaine, Caprylic/Capric Triglyceride, Sodium Hyaluronate, Disodium EDTA, Centella Asiatica Extract...'). Tuyệt đối không viết bằng tiếng Việt tóm tắt." 
      },
      key_benefits: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Danh sách các lợi ích chính của sản phẩm (3-5 gạch đầu dòng)." },
      skin_types: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Các loại da phù hợp với sản phẩm (ví dụ: Da dầu, Da khô, Da nhạy cảm)." },
      volume: { type: Type.STRING, description: "Dung tích hoặc khối lượng của sản phẩm (ví dụ: 50ml, 100g)." },
      texture: { type: Type.STRING, description: "Kết cấu của sản phẩm (ví dụ: Gel, Cream, Serum)." },
      origin: { type: Type.STRING, description: "Quốc gia sản xuất." },
      precautions: { type: Type.STRING, description: "Các lưu ý hoặc cảnh báo quan trọng khi sử dụng sản phẩm." },
      faq_items: {
        type: Type.ARRAY,
        description: "Danh sách 3-4 câu hỏi thường gặp phục vụ trang chi tiết sản phẩm.",
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING, description: "Câu hỏi thường gặp của khách hàng." },
            answer: { type: Type.STRING, description: "Câu trả lời ngắn gọn, chính xác, không phóng đại." },
          },
          required: ['question', 'answer'],
        },
      },
      brand: { type: Type.STRING, description: "Nhãn hiệu (thương hiệu) của sản phẩm." },
      category_slug: { type: Type.STRING, enum: categorySlugs, description: "Slug của chuyên mục phù hợp nhất." },
      seo_title: { type: Type.STRING, description: "Tiêu đề chuẩn SEO (dưới 60 ký tự)." },
      seo_description: { type: Type.STRING, description: "Mô tả meta chuẩn SEO (dưới 160 ký tự)." },
      seo_keywords: { type: Type.STRING, description: "5-7 từ khóa SEO cách nhau bằng dấu phẩy." }
    },
    required: [
      'description', 'long_description', 'price', 'stock_quantity',
      'usage_instructions', 'ingredients', 'key_benefits', 'skin_types',
      'volume', 'texture', 'origin', 'precautions', 'faq_items', 'brand', 'category_slug',
      'seo_title', 'seo_description', 'seo_keywords'
    ]
  };

  try {
    const response = await withExponentialBackoff(() => withTimeout(requestGemini('generate_product_details', {
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    })));

    const jsonString = response.text.trim();
    return JSON.parse(jsonString);

  } catch (error) {
    console.error("Error generating product details with Gemini API:", error);
    throw buildGeminiUserError(error, 'tạo chi tiết sản phẩm bằng AI');
  }
}

export async function generateProductFaqItems(
  productName: string,
  context: {
    description?: string;
    key_benefits?: string[];
    skin_types?: string[];
    usage_instructions?: string;
    ingredients?: string;
    precautions?: string;
  } = {},
): Promise<DetailFaqEntry[]> {
  const prompt = `Bạn là biên tập viên nội dung cho website dược mỹ phẩm. Hãy tạo 3-4 FAQ tiếng Việt cho sản phẩm '${productName}'.

Yêu cầu:
- Chỉ viết các câu hỏi có ích cho quyết định mua hàng hoặc cách dùng thực tế.
- Câu trả lời ngắn, rõ, chính xác, không phóng đại, không hứa hẹn điều trị.
- Tránh lặp ý giữa các câu hỏi.

Ngữ cảnh sản phẩm:
- Mô tả ngắn: ${context.description || 'Chưa có'}
- Lợi ích chính: ${(context.key_benefits || []).join('; ') || 'Chưa có'}
- Loại da phù hợp: ${(context.skin_types || []).join('; ') || 'Chưa có'}
- Hướng dẫn sử dụng: ${context.usage_instructions || 'Chưa có'}
- Thành phần: ${context.ingredients || 'Chưa có'}
- Lưu ý: ${context.precautions || 'Chưa có'}

Trả về JSON duy nhất theo schema đã cung cấp.`;

  const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        question: { type: Type.STRING },
        answer: { type: Type.STRING },
      },
      required: ['question', 'answer'],
    },
  };

  try {
    const response = await withExponentialBackoff(() => withTimeout(requestGemini('generate_product_faq', {
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema,
      },
    })));

    const parsed = JSON.parse((response.text || '[]').trim());
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => ({
        question: typeof item?.question === 'string' ? item.question.trim() : '',
        answer: typeof item?.answer === 'string' ? item.answer.trim() : '',
      }))
      .filter((item) => item.question && item.answer)
      .slice(0, 4);
  } catch (error) {
    console.error("Error generating product FAQs with Gemini API:", error);
    throw buildGeminiUserError(error, 'tạo FAQ sản phẩm bằng AI');
  }
}

export async function generateSEOMetadata(title: string, content: string): Promise<{ meta_description: string; meta_keywords: string; }> {
  const prompt = `Bạn là một chuyên gia SEO hàng đầu. Dựa vào tiêu đề và nội dung bài viết sau, hãy tạo ra một mô tả meta (meta description) và các từ khóa meta (meta keywords) được tối ưu hóa cho SEO.
- **Mô tả meta:** Phải là một bản tóm tắt hấp dẫn, thu hút người dùng nhấp vào, và có độ dài dưới 160 ký tự.
- **Từ khóa meta:** Phải là một danh sách gồm 5-7 từ hoặc cụm từ khóa có liên quan nhất, được phân tách bằng dấu phẩy.
- Hãy trả về kết quả dưới dạng một đối tượng JSON duy nhất tuân thủ schema đã cung cấp.

**Tiêu đề:** ${title}

**Nội dung:**
${content.substring(0, 2000)}...`; // Use first 2000 chars to be concise

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      meta_description: {
        type: Type.STRING,
        description: "Mô tả meta tối ưu SEO, dưới 160 ký tự."
      },
      meta_keywords: {
        type: Type.STRING,
        description: "Chuỗi 5-7 từ khóa liên quan, phân tách bằng dấu phẩy."
      },
    },
    required: ['meta_description', 'meta_keywords']
  };

  try {
    const response = await withExponentialBackoff(() => withTimeout(requestGemini('generate_seo_metadata', {
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    })));

    const jsonString = response.text.trim();
    return JSON.parse(jsonString);

  } catch (error) {
    console.error("Error generating SEO metadata with Gemini API:", error);
    throw buildGeminiUserError(error, 'tạo metadata SEO bằng AI');
  }
}

export async function generateEnglishBlogCategoryName(categoryName: string): Promise<string> {
  const prompt = `Bạn là một biên tập viên SEO song ngữ. Hãy dịch tên chuyên mục blog tiếng Việt sau sang tiếng Anh ngắn gọn, tự nhiên, phù hợp để hiển thị trên website chăm sóc da và sức khỏe.

- Chỉ trả về tên chuyên mục tiếng Anh.
- Không thêm dấu ngoặc kép.
- Không thêm giải thích.
- Viết theo Title Case nếu phù hợp.

Tên chuyên mục tiếng Việt: ${categoryName}`;

  try {
    const response: GenerateContentResponse = await withExponentialBackoff(() => withTimeout(requestGemini('translate_blog_category_en', {
      contents: prompt,
    })));

    return String(response.text || '').trim().replace(/^["']|["']$/g, '');
  } catch (error) {
    console.error("Error generating English blog category name with Gemini API:", error);
    throw buildGeminiUserError(error, 'tạo tên chuyên mục tiếng Anh');
  }
}

export async function generateBlogCategoryTranslations(categoryName: string): Promise<{ name_en: string; name_ru: string; name_cn: string; }> {
  const prompt = `Bạn là một biên tập viên SEO song ngữ cho website chăm sóc da và sức khỏe. Hãy dịch tên chuyên mục blog tiếng Việt sau sang 3 ngôn ngữ:

- English: ngắn gọn, tự nhiên, phù hợp hiển thị menu/category.
- Russian: giữ nghĩa rõ ràng, tự nhiên.
- Chinese: dùng tiếng Trung giản thể, ngắn gọn, dễ hiểu.

Yêu cầu:
- Chỉ trả về JSON đúng schema.
- Không thêm giải thích.

Tên chuyên mục tiếng Việt: ${categoryName}`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      name_en: { type: Type.STRING, description: "Tên chuyên mục tiếng Anh." },
      name_ru: { type: Type.STRING, description: "Tên chuyên mục tiếng Nga." },
      name_cn: { type: Type.STRING, description: "Tên chuyên mục tiếng Trung giản thể." },
    },
    required: ['name_en', 'name_ru', 'name_cn'],
  };

  try {
    const response: GenerateContentResponse = await withExponentialBackoff(() => withTimeout(requestGemini('translate_blog_category_all', {
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema,
      },
    })));

    const parsed = JSON.parse(String(response.text || '{}'));
    return {
      name_en: String(parsed.name_en || '').trim().replace(/^["']|["']$/g, ''),
      name_ru: String(parsed.name_ru || '').trim().replace(/^["']|["']$/g, ''),
      name_cn: String(parsed.name_cn || '').trim().replace(/^["']|["']$/g, ''),
    };
  } catch (error) {
    console.error("Error generating blog category translations with Gemini API:", error);
    throw buildGeminiUserError(error, 'tạo bản dịch chuyên mục');
  }
}

export async function generateBlogSeoTranslations(input: { title: string; summary: string; content: string; }): Promise<{
  title_en: string;
  summary_en: string;
  content_en: string;
  title_ru: string;
  summary_ru: string;
  content_ru: string;
  title_cn: string;
  summary_cn: string;
  content_cn: string;
}> {
  const prompt = `Bạn là biên tập viên SEO đa ngôn ngữ cho website chăm sóc da và sức khỏe. Hãy dịch bài blog tiếng Việt sau sang 3 ngôn ngữ: English, Russian, Chinese.

Yêu cầu:
- Giữ nguyên ý nghĩa và cấu trúc.
- Nội dung markdown phải được giữ đúng định dạng markdown.
- Tiêu đề và tóm tắt phải tự nhiên, phù hợp SEO.
- Không thêm giải thích.
- Chỉ trả về JSON đúng schema.

Tiêu đề: ${input.title}

Tóm tắt:
${input.summary}

Nội dung Markdown:
${input.content}`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      title_en: { type: Type.STRING },
      summary_en: { type: Type.STRING },
      content_en: { type: Type.STRING },
      title_ru: { type: Type.STRING },
      summary_ru: { type: Type.STRING },
      content_ru: { type: Type.STRING },
      title_cn: { type: Type.STRING },
      summary_cn: { type: Type.STRING },
      content_cn: { type: Type.STRING },
    },
    required: [
      'title_en',
      'summary_en',
      'content_en',
      'title_ru',
      'summary_ru',
      'content_ru',
      'title_cn',
      'summary_cn',
      'content_cn',
    ],
  };

  try {
    const response: GenerateContentResponse = await withExponentialBackoff(() => withTimeout(requestGemini('translate_blog_content', {
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema,
      },
    })));

    const parsed = JSON.parse(String(response.text || '{}'));
    return {
      title_en: String(parsed.title_en || '').trim(),
      summary_en: String(parsed.summary_en || '').trim(),
      content_en: String(parsed.content_en || '').trim(),
      title_ru: String(parsed.title_ru || '').trim(),
      summary_ru: String(parsed.summary_ru || '').trim(),
      content_ru: String(parsed.content_ru || '').trim(),
      title_cn: String(parsed.title_cn || '').trim(),
      summary_cn: String(parsed.summary_cn || '').trim(),
      content_cn: String(parsed.content_cn || '').trim(),
    };
  } catch (error) {
    console.error("Error generating blog SEO translations with Gemini API:", error);
    throw buildGeminiUserError(error, 'tạo bản dịch SEO bài viết');
  }
}
