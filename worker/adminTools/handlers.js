async function writeAdminToolAudit(env, request, auth, action, entityType, entityId, metadata = {}) {
    if (!env.APP_DB || !auth?.user?.id) return;
    try {
        const now = new Date().toISOString();
        await env.APP_DB.prepare(`INSERT INTO admin_audit_log (
            id, actor_user_id, actor_email, action, entity_type, entity_id,
            request_method, request_path, status, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'succeeded', ?, ?)`)
            .bind(
                crypto.randomUUID(), auth.user.id, auth.user.email || null, action, entityType,
                entityId || null, request.method, new URL(request.url).pathname,
                JSON.stringify(metadata || {}), now,
            ).run();
    } catch (error) {
        console.warn('Admin tool audit could not be written:', error instanceof Error ? error.message : error);
    }
}

export async function handleAdminEditorDraftRead(request, env, deps) {
    const {
        jsonResponse,
        authorizeAdminEditorAccess,
        buildAdminEditorDraftObjectKey,
        buildAdminDraftResponse,
    } = deps;

    if (!env.R2_IMAGES) {
        return jsonResponse({ error: 'R2 binding is missing.' }, 503, {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        });
    }

    const auth = await authorizeAdminEditorAccess(request);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const draftKey = String(url.searchParams.get('draftKey') || '').trim();
    const objectKey = buildAdminEditorDraftObjectKey(auth.user.id, draftKey);
    if (!objectKey) {
        return jsonResponse({ error: 'Invalid draft key.' }, 400, {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        });
    }

    const object = await env.R2_IMAGES.get(objectKey);
    if (!object) {
        return jsonResponse({ draft: null }, 200, {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        });
    }

    try {
        const payload = JSON.parse(await object.text());
        return jsonResponse(buildAdminDraftResponse(draftKey, payload), 200, {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        });
    } catch (error) {
        return jsonResponse(
            { error: `Could not parse stored draft: ${error instanceof Error ? error.message : String(error)}` },
            500,
            {
                'Cache-Control': 'no-store',
                'X-Robots-Tag': 'noindex, nofollow',
            },
        );
    }
}

export async function handleAdminEditorDraftUpsert(request, env, deps) {
    const {
        jsonResponse,
        authorizeAdminEditorAccess,
        buildAdminEditorDraftObjectKey,
        parseDraftSavedAt,
        MAX_ADMIN_EDITOR_DRAFT_BYTES,
        buildAdminDraftResponse,
    } = deps;

    if (!env.R2_IMAGES) {
        return jsonResponse({ error: 'R2 binding is missing.' }, 503, {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        });
    }

    const auth = await authorizeAdminEditorAccess(request);
    if (auth.error) return auth.error;

    let payload = null;
    try {
        payload = await request.json();
    } catch {
        return jsonResponse({ error: 'Invalid JSON body.' }, 400, {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        });
    }

    const draftKey = String(payload?.draftKey || '').trim();
    const objectKey = buildAdminEditorDraftObjectKey(auth.user.id, draftKey);
    if (!objectKey) {
        return jsonResponse({ error: 'Invalid draft key.' }, 400, {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        });
    }

    const draftPayload = {
        draft_key: draftKey,
        saved_at: parseDraftSavedAt(payload?.savedAt),
        updated_by: auth.user.id,
        data: payload?.data ?? null,
    };
    const serialized = JSON.stringify(draftPayload);
    if (serialized.length > MAX_ADMIN_EDITOR_DRAFT_BYTES) {
        return jsonResponse({ error: 'Draft payload too large.' }, 413, {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        });
    }

    await env.R2_IMAGES.put(objectKey, serialized, {
        httpMetadata: {
            contentType: 'application/json;charset=UTF-8',
            cacheControl: 'no-store',
        },
        customMetadata: {
            updated_by: auth.user.id,
            saved_at: draftPayload.saved_at,
        },
    });
    await writeAdminToolAudit(env, request, auth, 'upsert:editor-draft', 'editor-draft', draftKey, { object_key: objectKey });

    return jsonResponse(buildAdminDraftResponse(draftKey, draftPayload), 200, {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
    });
}

export async function handleAdminEditorDraftDelete(request, env, deps) {
    const {
        jsonResponse,
        authorizeAdminEditorAccess,
        buildAdminEditorDraftObjectKey,
    } = deps;

    if (!env.R2_IMAGES) {
        return jsonResponse({ error: 'R2 binding is missing.' }, 503, {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        });
    }

    const auth = await authorizeAdminEditorAccess(request);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const draftKey = String(url.searchParams.get('draftKey') || '').trim();
    const objectKey = buildAdminEditorDraftObjectKey(auth.user.id, draftKey);
    if (!objectKey) {
        return jsonResponse({ error: 'Invalid draft key.' }, 400, {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        });
    }

    await env.R2_IMAGES.delete(objectKey);
    await writeAdminToolAudit(env, request, auth, 'delete:editor-draft', 'editor-draft', draftKey, { object_key: objectKey });
    return jsonResponse({ deleted: true, draft_key: draftKey }, 200, {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
    });
}

export async function handleAdminProductContentReviewRead(request, env, deps) {
    const {
        jsonResponse,
        authorizeObservabilityAccess,
        parseProductContentReviewIds,
        buildProductContentReviewObjectKey,
        normalizeProductContentReviewRecord,
    } = deps;

    if (!env.R2_IMAGES) {
        return jsonResponse({ error: 'R2 binding is missing.' }, 503, {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        });
    }

    const auth = await authorizeObservabilityAccess(request);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const productIds = parseProductContentReviewIds(url);
    if (!productIds.length) {
        return jsonResponse({ reviews: [] }, 200, {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        });
    }

    const reviews = [];
    for (const productId of productIds) {
        const objectKey = buildProductContentReviewObjectKey(productId);
        if (!objectKey) continue;
        const object = await env.R2_IMAGES.get(objectKey);
        if (!object) continue;

        try {
            const payload = normalizeProductContentReviewRecord(JSON.parse(await object.text()));
            if (payload) reviews.push(payload);
        } catch (error) {
            console.warn(`Could not parse product content review ${productId}:`, error);
        }
    }

    return jsonResponse({ reviews }, 200, {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
    });
}

export async function handleAdminProductContentReviewUpsert(request, env, deps) {
    const {
        jsonResponse,
        authorizeObservabilityAccess,
        buildProductContentReviewObjectKey,
        PRODUCT_CONTENT_REVIEW_STATUSES,
        normalizeProductContentReviewRecord,
        MAX_PRODUCT_CONTENT_REVIEW_BYTES,
    } = deps;

    if (!env.R2_IMAGES) {
        return jsonResponse({ error: 'R2 binding is missing.' }, 503, {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        });
    }

    const auth = await authorizeObservabilityAccess(request);
    if (auth.error) return auth.error;

    let payload = null;
    try {
        payload = await request.json();
    } catch {
        return jsonResponse({ error: 'Invalid JSON body.' }, 400, {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        });
    }

    const productId = Number(payload?.product_id || payload?.productId);
    const objectKey = buildProductContentReviewObjectKey(productId);
    if (!objectKey) {
        return jsonResponse({ error: 'Invalid product id.' }, 400, {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        });
    }

    const reviewStatus = PRODUCT_CONTENT_REVIEW_STATUSES.has(payload?.review_status)
        ? payload.review_status
        : 'needs_review';
    const contentSignature = String(payload?.content_signature || '').trim();
    if (!contentSignature) {
        return jsonResponse({ error: 'Missing content signature.' }, 400, {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        });
    }

    const nowIso = new Date().toISOString();
    const reviewPayload = normalizeProductContentReviewRecord({
        product_id: productId,
        review_status: reviewStatus,
        review_notes: payload?.review_notes,
        rewrite_brief: payload?.rewrite_brief,
        audit_score: payload?.audit_score,
        blocker_count: payload?.blocker_count,
        warning_count: payload?.warning_count,
        issues: payload?.issues,
        content_signature: contentSignature,
        reviewed_at: payload?.reviewed_at || nowIso,
        reviewed_by: auth.user.id,
        reviewed_by_label: auth.user.email || auth.user.phone || auth.user.id,
        updated_at: nowIso,
    });

    if (!reviewPayload) {
        return jsonResponse({ error: 'Invalid review payload.' }, 400, {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        });
    }

    const serialized = JSON.stringify(reviewPayload);
    if (serialized.length > MAX_PRODUCT_CONTENT_REVIEW_BYTES) {
        return jsonResponse({ error: 'Review payload too large.' }, 413, {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        });
    }

    await env.R2_IMAGES.put(objectKey, serialized, {
        httpMetadata: {
            contentType: 'application/json;charset=UTF-8',
            cacheControl: 'no-store',
        },
        customMetadata: {
            reviewed_by: reviewPayload.reviewed_by,
            reviewed_at: reviewPayload.reviewed_at,
            review_status: reviewPayload.review_status,
        },
    });
    await writeAdminToolAudit(env, request, auth, 'upsert:product-content-review', 'product', String(productId), {
        object_key: objectKey,
        review_status: reviewPayload.review_status,
    });

    return jsonResponse({ review: reviewPayload }, 200, {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
    });
}
