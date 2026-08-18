const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const SAFE_IMAGE_TYPES = new Map([
    ['image/jpeg', new Set(['jpg', 'jpeg'])],
    ['image/png', new Set(['png'])],
    ['image/webp', new Set(['webp'])],
    ['image/avif', new Set(['avif'])],
]);

function hasBytes(bytes, offset, expected) {
    return expected.every((value, index) => bytes[offset + index] === value);
}

function detectImageType(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer.slice(0, 64));
    if (bytes.length >= 3 && hasBytes(bytes, 0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
    if (bytes.length >= 8 && hasBytes(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
        return 'image/png';
    }
    if (
        bytes.length >= 12
        && hasBytes(bytes, 0, [0x52, 0x49, 0x46, 0x46])
        && hasBytes(bytes, 8, [0x57, 0x45, 0x42, 0x50])
    ) {
        return 'image/webp';
    }
    if (bytes.length >= 16 && hasBytes(bytes, 4, [0x66, 0x74, 0x79, 0x70])) {
        const brands = new TextDecoder('ascii').decode(bytes.slice(8, 64));
        if (brands.includes('avif') || brands.includes('avis')) return 'image/avif';
    }
    return null;
}

function getPathExtension(path) {
    const filename = String(path || '').split('/').pop() || '';
    const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
    return match?.[1] || '';
}

function replacePathExtension(path, extension) {
    const normalized = String(path || '');
    return normalized.match(/\.[a-z0-9]+$/i)
        ? normalized.replace(/\.[a-z0-9]+$/i, `.${extension}`)
        : `${normalized}.${extension}`;
}

async function reencodeImageForStorage(env, imageBytes) {
    if (!env.IMAGES) {
        throw new Error('Image sanitization service is not configured.');
    }

    const inputStream = new Blob([imageBytes]).stream();
    const transformed = await env.IMAGES
        .input(inputStream)
        .output({ format: 'image/webp', quality: 90, anim: false });
    const response = transformed.response();
    if (!response.ok || !response.body) {
        throw new Error('Image sanitization failed.');
    }

    const safeBytes = await response.arrayBuffer();
    if (safeBytes.byteLength <= 0 || safeBytes.byteLength > MAX_IMAGE_BYTES) {
        throw new Error('Sanitized image has an invalid size.');
    }
    if (detectImageType(safeBytes) !== 'image/webp') {
        throw new Error('Image sanitizer returned an unexpected format.');
    }
    return safeBytes;
}

function isSafeImageResponseType(contentType) {
    return SAFE_IMAGE_TYPES.has(String(contentType || '').split(';')[0].trim().toLowerCase());
}

async function enforceImageMutationScope(auth, env, bucket, paths, mode) {
    if (auth.role === 'admin' || auth.role === 'master_admin') return null;
    if (auth.role !== 'doctor') return 'Forbidden: insufficient role.';
    if (bucket !== 'avatars' && bucket !== 'blog-images') {
        return 'Doctors may only manage their own avatar and blog images.';
    }

    for (const path of paths) {
        if (bucket === 'avatars' && !String(path).startsWith(`${auth.user.id}/`)) {
            return 'Doctors may only manage their own avatar.';
        }
        const existing = await env.R2_IMAGES.head(`${bucket}/${path}`);
        if (existing && existing.customMetadata?.uploaded_by !== auth.user.id) {
            return mode === 'delete'
                ? 'Doctors may only delete images they uploaded.'
                : 'Doctors may not overwrite images uploaded by another account.';
        }
    }
    return null;
}

const MEDIA_REFERENCE_SOURCES = [
    { table: 'product_images', column: 'image_path', type: 'product', label: 'Sản phẩm' },
    { table: 'product_categories', column: 'image_path', type: 'product-category', label: 'Danh mục sản phẩm' },
    { table: 'product_brands', column: 'logo_path', type: 'product-brand', label: 'Thương hiệu' },
    { table: 'services', column: 'image_path', type: 'service', label: 'Dịch vụ' },
    { table: 'procedure_steps', column: 'image_path', type: 'service-step', label: 'Bước liệu trình' },
    { table: 'blog_posts', column: 'image_path', type: 'blog-post', label: 'Bài viết' },
    { table: 'users', column: 'avatar_url', type: 'user-avatar', label: 'Ảnh đại diện' },
    { table: 'product_order_items', column: 'product_image_path', type: 'order-snapshot', label: 'Ảnh lưu trong đơn hàng' },
];

function mediaReferenceCandidates(bucket, path) {
    const encodedPath = String(path).split('/').map(encodeURIComponent).join('/');
    const encodedBucket = encodeURIComponent(bucket);
    return [
        path,
        `${bucket}/${path}`,
        `/r2/${encodedBucket}/${encodedPath}`,
    ];
}

async function findMediaUsage(db, bucket, path) {
    if (!db?.prepare) return { count: 0, types: [], references: [] };
    const candidates = mediaReferenceCandidates(bucket, path);
    const suffixPattern = `%/r2/${encodeURIComponent(bucket)}/${String(path).split('/').map(encodeURIComponent).join('/')}`;
    const references = [];

    for (const source of MEDIA_REFERENCE_SOURCES) {
        try {
            const result = await db.prepare(`SELECT id, ${source.column} AS reference
                FROM ${source.table}
                WHERE ${source.column} IN (?, ?, ?) OR ${source.column} LIKE ?
                LIMIT 100`)
                .bind(...candidates, suffixPattern).all();
            for (const row of result.results || []) {
                references.push({
                    type: source.type,
                    label: source.label,
                    id: String(row.id || ''),
                    reference: String(row.reference || ''),
                });
            }
        } catch (error) {
            console.warn(`Media usage check skipped for ${source.table}:`, error instanceof Error ? error.message : error);
        }
    }

    try {
        const contentResult = await db.prepare(`SELECT id, content_key AS label
            FROM site_content
            WHERE instr(payload_json, ?) > 0 OR instr(payload_json, ?) > 0 OR instr(payload_json, ?) > 0
            LIMIT 100`).bind(...candidates).all();
        for (const row of contentResult.results || []) {
            references.push({
                type: 'site-content',
                label: 'Nội dung site',
                id: String(row.id || ''),
                reference: String(row.label || ''),
            });
        }
    } catch (error) {
        console.warn('Media usage check skipped for site_content:', error instanceof Error ? error.message : error);
    }

    return {
        count: references.length,
        types: Array.from(new Set(references.map((item) => item.label))),
        references,
    };
}

async function writeMediaAudit(db, auth, action, bucket, paths, metadata = {}) {
    if (!db?.prepare || !auth?.user?.id) return;
    try {
        const now = new Date().toISOString();
        await db.prepare(`INSERT INTO admin_audit_log (
            id, actor_user_id, actor_email, action, entity_type, entity_id,
            request_method, request_path, status, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, 'media_asset', ?, ?, ?, 'succeeded', ?, ?)`)
            .bind(crypto.randomUUID(), auth.user.id, auth.user.email || null, action,
                `${bucket}:${paths.join(',')}`, metadata.method || 'POST', metadata.path || '/api/r2',
                JSON.stringify({ bucket, paths }), now).run();
    } catch (error) {
        console.warn('Media audit entry could not be written:', error instanceof Error ? error.message : error);
    }
}

export async function handleR2ImageUpload(request, env, deps) {
    const {
        jsonResponse,
        authorizeImageMutation,
        isAllowedPublicBucket,
        normalizeObjectPath,
        getStorageUrl,
    } = deps;

    if (!env.R2_IMAGES) {
        return jsonResponse(
            { error: 'R2 binding "R2_IMAGES" is missing. Add the binding in Cloudflare Pages settings first.' },
            503,
        );
    }

    const auth = await authorizeImageMutation(request);
    if (auth.error) return auth.error;

    const form = await request.formData();
    const bucket = String(form.get('bucket') || '').trim();
    const rawPath = form.get('path');
    const file = form.get('file');

    if (!isAllowedPublicBucket(bucket)) {
        return jsonResponse({ error: 'Invalid bucket.' }, 400);
    }
    if (!(file instanceof File)) {
        return jsonResponse({ error: 'Missing file field.' }, 400);
    }
    if (file.size <= 0) {
        return jsonResponse({ error: 'Image file is empty.' }, 400);
    }
    if (file.size > MAX_IMAGE_BYTES) {
        return jsonResponse({ error: 'File too large (max 15MB).' }, 413);
    }

    const requestedPath = normalizeObjectPath(rawPath || file.name);
    if (!requestedPath) {
        return jsonResponse({ error: 'Invalid file path.' }, 400);
    }

    const declaredType = String(file.type || '').split(';')[0].trim().toLowerCase();
    if (!SAFE_IMAGE_TYPES.has(declaredType)) {
        return jsonResponse({ error: 'Only JPEG, PNG, WebP and AVIF images are allowed.' }, 415);
    }

    const extension = getPathExtension(requestedPath);
    if (!SAFE_IMAGE_TYPES.get(declaredType)?.has(extension)) {
        return jsonResponse({ error: 'The image extension does not match its declared type.' }, 415);
    }

    const imageBytes = await file.arrayBuffer();
    const detectedType = detectImageType(imageBytes);
    if (!detectedType || detectedType !== declaredType) {
        return jsonResponse({ error: 'The uploaded file is not a valid image of the declared type.' }, 415);
    }

    let safeImageBytes;
    try {
        safeImageBytes = await reencodeImageForStorage(env, imageBytes);
    } catch (error) {
        const configurationError = error instanceof Error && error.message.includes('not configured');
        return jsonResponse({
            error: configurationError
                ? 'Image sanitization service is not configured.'
                : 'The uploaded image could not be safely decoded and re-encoded.',
        }, configurationError ? 503 : 415);
    }

    const sanitizedPath = normalizeObjectPath(replacePathExtension(requestedPath, 'webp'));
    if (!sanitizedPath) return jsonResponse({ error: 'Invalid sanitized image path.' }, 400);

    const scopeError = await enforceImageMutationScope(auth, env, bucket, [sanitizedPath], 'upload');
    if (scopeError) return jsonResponse({ error: scopeError }, 403);

    const objectKey = `${bucket}/${sanitizedPath}`;
    await env.R2_IMAGES.put(objectKey, safeImageBytes, {
        httpMetadata: {
            contentType: 'image/webp',
            cacheControl: 'public, max-age=31536000, immutable',
        },
        customMetadata: {
            uploaded_by: auth.user.id,
            uploaded_at: new Date().toISOString(),
            original_content_type: detectedType,
            sanitized: 'true',
        },
    });

    if (env.APP_DB?.prepare) {
        const now = new Date().toISOString();
        try {
            await env.APP_DB.prepare(`INSERT INTO media_assets (
                id, bucket, object_key, object_path, public_url, content_type, size_bytes, etag,
                uploaded_by, uploaded_at, last_seen_at, deleted_at, metadata_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'image/webp', ?, NULL, ?, ?, ?, NULL, ?, ?, ?)
            ON CONFLICT(bucket, object_path) DO UPDATE SET object_key=excluded.object_key,
                public_url=excluded.public_url, content_type=excluded.content_type, size_bytes=excluded.size_bytes,
                uploaded_by=excluded.uploaded_by, uploaded_at=excluded.uploaded_at,
                last_seen_at=excluded.last_seen_at, deleted_at=NULL, metadata_json=excluded.metadata_json,
                updated_at=excluded.updated_at`)
                .bind(`${bucket}:${sanitizedPath}`, bucket, objectKey, sanitizedPath,
                    getStorageUrl(sanitizedPath, bucket), safeImageBytes.byteLength, auth.user.id, now, now,
                    JSON.stringify({ original_content_type: detectedType, sanitized: true }), now, now).run();
        } catch (error) {
            console.warn('Media metadata could not be indexed:', error instanceof Error ? error.message : error);
        }
        await writeMediaAudit(env.APP_DB, auth, 'media.upload', bucket, [sanitizedPath], {
            method: request.method,
            path: new URL(request.url).pathname,
        });
    }

    return jsonResponse({
        bucket,
        path: sanitizedPath,
        key: objectKey,
        public_url: getStorageUrl(sanitizedPath, bucket),
    });
}

export async function handleR2ImageDelete(request, env, deps) {
    const {
        jsonResponse,
        authorizeImageMutation,
        isAllowedPublicBucket,
        normalizeObjectPath,
    } = deps;

    if (!env.R2_IMAGES) {
        return jsonResponse(
            { error: 'R2 binding "R2_IMAGES" is missing. Add the binding in Cloudflare Pages settings first.' },
            503,
        );
    }

    const auth = await authorizeImageMutation(request);
    if (auth.error) return auth.error;

    let body;
    try {
        body = await request.json();
    } catch {
        return jsonResponse({ error: 'Invalid JSON body.' }, 400);
    }

    const bucket = String(body?.bucket || '').trim();
    const inputPaths = Array.isArray(body?.paths) ? body.paths : [];

    if (!isAllowedPublicBucket(bucket)) {
        return jsonResponse({ error: 'Invalid bucket.' }, 400);
    }
    if (inputPaths.length === 0) {
        return jsonResponse({ deleted: 0 });
    }

    const sanitized = inputPaths
        .map((value) => normalizeObjectPath(value))
        .filter(Boolean)
        .slice(0, 200);

    const scopeError = await enforceImageMutationScope(auth, env, bucket, sanitized, 'delete');
    if (scopeError) return jsonResponse({ error: scopeError }, 403);

    if (env.APP_DB?.prepare) {
        const inUse = [];
        for (const path of sanitized) {
            const usage = await findMediaUsage(env.APP_DB, bucket, path);
            if (usage.count > 0) inUse.push({ path, usage });
        }
        if (inUse.length > 0) {
            return jsonResponse({
                error: {
                    code: 'MEDIA_IN_USE',
                    message: 'Không thể xóa ảnh đang được sử dụng trong hệ thống.',
                },
                assets: inUse,
            }, 409);
        }
    }

    for (const path of sanitized) {
        await env.R2_IMAGES.delete(`${bucket}/${path}`);
    }

    if (env.APP_DB?.prepare && sanitized.length) {
        const now = new Date().toISOString();
        try {
            await env.APP_DB.prepare(`UPDATE media_assets SET deleted_at = ?, updated_at = ?
                WHERE bucket = ? AND object_path IN (${sanitized.map(() => '?').join(',')})`)
                .bind(now, now, bucket, ...sanitized).run();
        } catch (error) {
            console.warn('Deleted media metadata could not be updated:', error instanceof Error ? error.message : error);
        }
        await writeMediaAudit(env.APP_DB, auth, 'media.delete', bucket, sanitized, {
            method: request.method,
            path: new URL(request.url).pathname,
        });
    }

    return jsonResponse({ deleted: sanitized.length });
}

export async function handleR2ImageList(request, env, deps) {
    const {
        jsonResponse,
        authorizeImageMutation,
        isAllowedPublicBucket,
        normalizeObjectPath,
        getStorageUrl,
    } = deps;

    if (!env.R2_IMAGES) {
        return jsonResponse(
            { error: 'R2 binding "R2_IMAGES" is missing. Add the binding in Cloudflare Pages settings first.' },
            503,
        );
    }

    const auth = await authorizeImageMutation(request);
    if (auth.error) return auth.error;

    let body;
    try {
        body = await request.json();
    } catch {
        return jsonResponse({ error: 'Invalid JSON body.' }, 400);
    }

    const bucket = String(body?.bucket || '').trim();
    const rawPrefix = String(body?.prefix || '').trim();
    const cursor = body?.cursor ? String(body.cursor) : undefined;
    const requestedLimit = Number(body?.limit || 60);
    const limit = Number.isFinite(requestedLimit)
        ? Math.max(1, Math.min(200, Math.round(requestedLimit)))
        : 60;

    if (!isAllowedPublicBucket(bucket)) {
        return jsonResponse({ error: 'Invalid bucket.' }, 400);
    }

    const sanitizedPrefix = rawPrefix ? normalizeObjectPath(rawPrefix) : '';
    if (rawPrefix && !sanitizedPrefix) {
        return jsonResponse({ error: 'Invalid prefix.' }, 400);
    }

    const keyPrefix = sanitizedPrefix
        ? `${bucket}/${sanitizedPrefix.replace(/\/+$/, '')}/`
        : `${bucket}/`;

    const listed = await env.R2_IMAGES.list({
        prefix: keyPrefix,
        cursor,
        limit,
    });

    const items = (listed.objects || []).map((object) => {
        const path = String(object.key || '').replace(new RegExp(`^${bucket}/`), '');
        const uploadedAt =
            object.customMetadata?.uploaded_at ||
            (object.uploaded ? new Date(object.uploaded).toISOString() : null);

        return {
            key: object.key,
            bucket,
            path,
            public_url: getStorageUrl(path, bucket),
            uploaded_at: uploadedAt,
            uploaded_by: object.customMetadata?.uploaded_by || null,
            content_type: object.httpMetadata?.contentType || null,
            size: Number(object.size || 0),
            etag: object.httpEtag || object.etag || null,
        };
    });

    return jsonResponse({
        items,
        cursor: listed.cursor || null,
        truncated: Boolean(listed.truncated),
    });
}

export async function handleR2ImageRead(request, env, path, deps) {
    const {
        normalizeObjectPath,
        isAllowedPublicBucket,
        R2_IMAGE_BASE_URL,
        encodeObjectPath,
    } = deps;
    const match = path.match(/^\/r2\/([^/]+)\/(.+)$/);
    if (!match) return new Response('Not Found', { status: 404 });

    const bucket = decodeURIComponent(match[1]);
    const objectPath = normalizeObjectPath(decodeURIComponent(match[2]));
    if (!isAllowedPublicBucket(bucket) || !objectPath) {
        return new Response('Not Found', { status: 404 });
    }

    let object = null;
    if (env.R2_IMAGES) {
        object = await env.R2_IMAGES.get(`${bucket}/${objectPath}`);
    }
    if (!object) {
        const remoteR2BaseUrl = String(R2_IMAGE_BASE_URL || '').trim();
        const requestUrl = new URL(request.url);
        if (remoteR2BaseUrl) {
            try {
                const remoteBaseUrl = new URL(remoteR2BaseUrl);
                const shouldProxyMissingObject = remoteBaseUrl.origin !== requestUrl.origin;
                if (shouldProxyMissingObject) {
                    const remoteFallbackUrl = new URL(
                        `${remoteBaseUrl.pathname.replace(/\/+$/, '')}/${encodeURIComponent(bucket)}/${encodeObjectPath(objectPath)}`,
                        remoteBaseUrl.origin,
                    );
                    const proxiedResponse = await fetch(new Request(remoteFallbackUrl.toString(), request));
                    if (proxiedResponse.ok) {
                        const headers = new Headers(proxiedResponse.headers);
                        const contentType = headers.get('Content-Type');
                        if (!isSafeImageResponseType(contentType)) {
                            return new Response('Unsupported Media Type', {
                                status: 415,
                                headers: { 'X-Content-Type-Options': 'nosniff' },
                            });
                        }
                        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
                        headers.set('X-Content-Type-Options', 'nosniff');
                        return request.method === 'HEAD'
                            ? new Response(null, { status: 200, headers })
                            : new Response(proxiedResponse.body, { status: proxiedResponse.status, headers });
                    }
                }
            } catch {
                // Fall through to local fallback handling.
            }
        }
        if (bucket === 'blog-images') {
            const fallbackUrl = new URL('/seo/blog-cover-default.jpg', request.url);
            const fallbackResponse = await env.ASSETS.fetch(new Request(fallbackUrl.toString(), request));
            const headers = new Headers(fallbackResponse.headers);
            headers.set('X-Content-Type-Options', 'nosniff');
            return new Response(request.method === 'HEAD' ? null : fallbackResponse.body, {
                status: fallbackResponse.status,
                headers,
            });
        }
        return new Response('Not Found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    if (!isSafeImageResponseType(headers.get('Content-Type'))) {
        return new Response('Unsupported Media Type', {
            status: 415,
            headers: { 'X-Content-Type-Options': 'nosniff' },
        });
    }
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('ETag', object.httpEtag);
    headers.set('X-Content-Type-Options', 'nosniff');

    if (request.method === 'HEAD') {
        return new Response(null, { status: 200, headers });
    }

    return new Response(object.body, { status: 200, headers });
}
