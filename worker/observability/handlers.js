export async function handleAdminObservabilityLogs(request, env, ctx, deps) {
    const {
        jsonResponse,
        authorizeObservabilityAccess,
        maybeRunMonitoringRetention,
        clampInteger,
        MAX_MONITORING_LOG_LIMIT,
        DEFAULT_MONITORING_LOG_LIMIT,
        MAX_MONITORING_RECENT_DAYS,
        DEFAULT_MONITORING_RECENT_DAYS,
        listRecentMonitoringLogs,
    } = deps;

    if (!env.R2_IMAGES) {
        return jsonResponse({ error: 'R2 binding is missing.' }, 503, {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        });
    }

    const auth = await authorizeObservabilityAccess(request);
    if (auth.error) return auth.error;

    maybeRunMonitoringRetention(env, ctx, 'admin-observability-view');

    const url = new URL(request.url);
    const limit = clampInteger(url.searchParams.get('limit'), 1, MAX_MONITORING_LOG_LIMIT, DEFAULT_MONITORING_LOG_LIMIT);
    const days = clampInteger(url.searchParams.get('days'), 1, MAX_MONITORING_RECENT_DAYS, DEFAULT_MONITORING_RECENT_DAYS);
    const payload = await listRecentMonitoringLogs(env, { limit, days });

    return jsonResponse(payload, 200, {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
    });
}

export async function handleAdminObservabilitySummary(request, env, ctx, deps) {
    const {
        jsonResponse,
        authorizeObservabilityAccess,
        maybeRunMonitoringRetention,
        clampInteger,
        MAX_MONITORING_RECENT_DAYS,
        DEFAULT_MONITORING_RECENT_DAYS,
        listRecentMonitoringMetricSummary,
    } = deps;

    if (!env.R2_IMAGES) {
        return jsonResponse({ error: 'R2 binding is missing.' }, 503, {
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
        });
    }

    const auth = await authorizeObservabilityAccess(request);
    if (auth.error) return auth.error;

    maybeRunMonitoringRetention(env, ctx, 'admin-observability-summary');

    const url = new URL(request.url);
    const days = clampInteger(url.searchParams.get('days'), 1, MAX_MONITORING_RECENT_DAYS, DEFAULT_MONITORING_RECENT_DAYS);
    const payload = await listRecentMonitoringMetricSummary(env, { days });

    return jsonResponse(payload, 200, {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
    });
}

export async function handleAdminObservabilityCleanup(request, env, deps) {
    const {
        jsonResponse,
        authorizeObservabilityAccess,
        clampInteger,
        MAX_MONITORING_RETENTION_DAYS,
        getMonitoringRetentionDays,
        cleanupMonitoringLogs,
        writePrivateMonitorEvent,
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

    const daysToKeep = clampInteger(payload?.daysToKeep, 1, MAX_MONITORING_RETENTION_DAYS, getMonitoringRetentionDays(env));
    const dryRun = payload?.dryRun !== false;
    const result = await cleanupMonitoringLogs(env, {
        daysToKeep,
        dryRun,
        reason: dryRun ? 'admin-cleanup-preview' : 'admin-cleanup',
    });

    if (!dryRun) {
        await writePrivateMonitorEvent(env, 'observability/cleanup', {
            type: 'manual-retention',
            message: `Deleted ${result.deleted_count} stale monitoring logs`,
            context: `keep=${result.days_to_keep}d`,
            details: JSON.stringify({
                cutoff_iso: result.cutoff_iso,
                matched_count: result.matched_count,
                scanned_objects: result.scanned_objects,
            }),
            path: '/admin/site-management/observability',
            source: auth.user.id,
        });
    }

    return jsonResponse(result, 200, {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
    });
}
