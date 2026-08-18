import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_TIMEOUT_MS = 45_000
const MAX_PRODUCT_NAME_LENGTH = 300
const ALLOWED_ROLES = new Set(['admin', 'master_admin', 'doctor'])

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  })

const readBearerToken = (request: Request) => {
  const authorization = request.headers.get('authorization') || ''
  return authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : ''
}

const stripJsonFence = (value: string) =>
  value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

const buildResponseSchema = (categorySlugs: string[]) => ({
  type: 'OBJECT',
  properties: {
    description: { type: 'STRING', description: 'Mô tả ngắn gọn về sản phẩm, tối đa 200 ký tự.' },
    long_description: { type: 'STRING', description: 'Mô tả chi tiết bằng Markdown, có H2, H3 và nội dung in đậm phù hợp.' },
    price: { type: 'NUMBER', description: 'Giá bán lẻ đề xuất tại Việt Nam bằng VND.' },
    stock_quantity: { type: 'INTEGER', description: 'Số lượng tồn kho mặc định là 10.' },
    usage_instructions: { type: 'STRING', description: 'Hướng dẫn sử dụng rõ ràng.' },
    ingredients: { type: 'STRING', description: 'Danh sách thành phần INCI hoặc thành phần chính nếu có nguồn đáng tin cậy.' },
    key_benefits: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Danh sách 3-5 lợi ích chính.' },
    skin_types: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Các loại da phù hợp.' },
    volume: { type: 'STRING', description: 'Dung tích hoặc khối lượng.' },
    texture: { type: 'STRING', description: 'Kết cấu sản phẩm.' },
    origin: { type: 'STRING', description: 'Quốc gia sản xuất.' },
    precautions: { type: 'STRING', description: 'Lưu ý an toàn khi sử dụng.' },
    faq_items: {
      type: 'ARRAY',
      description: 'Ba đến bốn câu hỏi thường gặp.',
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          answer: { type: 'STRING' },
        },
        required: ['question', 'answer'],
      },
    },
    brand: { type: 'STRING', description: 'Tên thương hiệu.' },
    category_slug: {
      type: 'STRING',
      ...(categorySlugs.length > 0 ? { enum: categorySlugs } : {}),
      description: 'Slug chuyên mục phù hợp nhất.',
    },
    seo_title: { type: 'STRING', description: 'Tiêu đề SEO dưới 60 ký tự.' },
    seo_description: { type: 'STRING', description: 'Mô tả SEO dưới 160 ký tự.' },
    seo_keywords: { type: 'STRING', description: 'Năm đến bảy từ khóa, phân cách bằng dấu phẩy.' },
  },
  required: [
    'description',
    'long_description',
    'price',
    'stock_quantity',
    'usage_instructions',
    'ingredients',
    'key_benefits',
    'skin_types',
    'volume',
    'texture',
    'origin',
    'precautions',
    'faq_items',
    'brand',
    'category_slug',
    'seo_title',
    'seo_description',
    'seo_keywords',
  ],
})

const buildPrompt = (productName: string, categorySlugs: string[]) => `Bạn là biên tập viên dược mỹ phẩm và chuyên gia SEO cho website Thế Giới Trị Mụn.

Hãy tạo bản nháp thông tin tiếng Việt cho sản phẩm: "${productName}".

Yêu cầu:
- Không bịa tuyên bố điều trị, chứng nhận, thành phần hoặc xuất xứ. Nếu không xác minh chắc chắn, ghi rõ là cần kiểm tra trên bao bì chính hãng.
- Mô tả chi tiết phải dùng Markdown với các mục ## Tổng quan, ## Công dụng, ## Thành phần, ## Cách dùng và ## Lưu ý.
- Tạo 3-4 FAQ ngắn, hữu ích cho quyết định mua và cách sử dụng.
- Giá là giá bán lẻ tham khảo tại Việt Nam bằng VND; tồn kho mặc định là 10.
- Chọn category_slug trong danh sách: ${categorySlugs.join(', ') || 'chua-phan-loai'}.
- SEO title dưới 60 ký tự, SEO description dưới 160 ký tự.
- Chỉ trả về một đối tượng JSON đúng schema, không thêm giải thích ngoài JSON.`

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED', error: 'Method not allowed.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY')?.trim()
  if (!supabaseUrl || !serviceRoleKey || !geminiApiKey) {
    return jsonResponse({ code: 'AI_NOT_CONFIGURED', error: 'AI service is not configured.' }, 503)
  }

  const token = readBearerToken(request)
  if (!token) return jsonResponse({ code: 'UNAUTHORIZED', error: 'Missing bearer token.' }, 401)

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData.user?.id) {
    return jsonResponse({ code: 'UNAUTHORIZED', error: 'Invalid access token.' }, 401)
  }

  const { data: patient, error: roleError } = await supabaseAdmin
    .from('patients')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle()
  if (roleError || !ALLOWED_ROLES.has(String(patient?.role || ''))) {
    return jsonResponse({ code: 'FORBIDDEN', error: 'Forbidden: insufficient role.' }, 403)
  }

  let body: { productName?: unknown }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ code: 'INVALID_JSON', error: 'Invalid JSON body.' }, 400)
  }

  const productName = typeof body.productName === 'string' ? body.productName.trim() : ''
  if (!productName || productName.length > MAX_PRODUCT_NAME_LENGTH) {
    return jsonResponse({ code: 'INVALID_PRODUCT_NAME', error: 'Product name is missing or too long.' }, 400)
  }

  const { data: categories } = await supabaseAdmin
    .from('product_categories')
    .select('slug')
    .order('name', { ascending: true })
    .limit(100)
  const categorySlugs = (categories || [])
    .map((category) => String(category.slug || '').trim())
    .filter(Boolean)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)
  let upstream: Response
  try {
    upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: buildPrompt(productName, categorySlugs) }] }],
          generation_config: {
            response_mime_type: 'application/json',
            response_schema: buildResponseSchema(categorySlugs),
          },
        }),
        signal: controller.signal,
      },
    )
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError'
    return jsonResponse({
      code: timedOut ? 'AI_TIMEOUT' : 'AI_UNAVAILABLE',
      error: timedOut ? 'AI request timed out.' : 'AI service is unavailable.',
    }, 503)
  } finally {
    clearTimeout(timeoutId)
  }

  const upstreamPayload = await upstream.json().catch(() => null)
  if (!upstream.ok) {
    const status = [400, 429, 500, 502, 503, 504].includes(upstream.status) ? upstream.status : 502
    return jsonResponse({
      code: upstream.status === 429 ? 'AI_RATE_LIMITED' : 'AI_UPSTREAM_ERROR',
      error: upstreamPayload?.error?.message || 'AI service returned an error.',
    }, status)
  }

  const text = upstreamPayload?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: unknown }) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
  if (!text) return jsonResponse({ code: 'AI_EMPTY_RESPONSE', error: 'AI returned an empty response.' }, 502)

  try {
    const generatedPayload = JSON.parse(stripJsonFence(text))
    return jsonResponse({ draft: { generated_payload: generatedPayload } })
  } catch {
    return jsonResponse({ code: 'AI_INVALID_RESPONSE', error: 'AI returned invalid JSON.' }, 502)
  }
})
