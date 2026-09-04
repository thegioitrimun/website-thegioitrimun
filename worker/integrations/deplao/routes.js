import { requireCsrf, requireRole } from '../../auth/session.js';
import { hmacSha256Hex, randomToken, sha256, sha256Hex, timingSafeEqual } from '../../platform/crypto.js';
import { apiError, json, methodNotAllowed, readJson, requireD1 } from '../../platform/http.js';
import { createTelegramOutboxStatement, isDeplaoAutomationEnabled, isTelegramOrderAlertsEnabled } from './records.js';

const MAX_BODY_BYTES = 256 * 1024;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const LEASE_MS = 2 * 60 * 1000;
const RESULT_OUTCOMES = new Set(['completed', 'waiting_friend', 'retryable_error', 'permanent_error', 'delivery_unknown']);

function clean(value, max = 1000) {
    return String(value ?? '').trim().slice(0, max);
}

function parseTimestamp(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return NaN;
    return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
}

export function buildDeplaoCanonicalRequest({ timestamp, nonce, method, path, bodyHash }) {
    return [String(timestamp), String(nonce), String(method).toUpperCase(), String(path), String(bodyHash)].join('\n');
}

async function authenticateMachine(request, env, db) {
    if (!isDeplaoAutomationEnabled(env)) {
        throw Object.assign(new Error('Tự động hóa Deplao/Zalo đang tắt trên máy chủ TGTM.'), {
            status: 503,
            code: 'DEPLAO_AUTOMATION_DISABLED',
            expose: true,
        });
    }
    const expectedDeviceId = clean(env.DEPLAO_DEVICE_ID, 200);
    const secret = clean(env.DEPLAO_DEVICE_SECRET, 2000);
    const deviceId = clean(request.headers.get('X-Deplao-Device'), 200);
    const timestamp = clean(request.headers.get('X-Deplao-Timestamp'), 50);
    const nonce = clean(request.headers.get('X-Deplao-Nonce'), 200);
    const signature = clean(request.headers.get('X-Deplao-Signature'), 256).toLowerCase();
    if (!expectedDeviceId || secret.length < 24) {
        throw Object.assign(new Error('Máy chủ TGTM chưa cấu hình Device ID/Shared Secret cho Deplao.'), {
            status: 503,
            code: 'DEPLAO_CREDENTIALS_NOT_CONFIGURED',
            expose: true,
        });
    }
    if (!deviceId || deviceId !== expectedDeviceId || !timestamp || !nonce || !signature) {
        throw Object.assign(new Error('Invalid Deplao machine authentication.'), { status: 401 });
    }
    const timestampMs = parseTimestamp(timestamp);
    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > MAX_CLOCK_SKEW_MS) {
        throw Object.assign(new Error('Deplao request timestamp is outside the allowed window.'), { status: 401 });
    }
    const rawBody = await request.clone().text();
    const path = new URL(request.url).pathname;
    const canonical = buildDeplaoCanonicalRequest({
        timestamp,
        nonce,
        method: request.method,
        path,
        bodyHash: await sha256Hex(rawBody),
    });
    const expected = await hmacSha256Hex(secret, canonical);
    if (!timingSafeEqual(signature, expected)) {
        throw Object.assign(new Error('Invalid Deplao request signature.'), { status: 401 });
    }
    const now = new Date().toISOString();
    try {
        await db.prepare(`INSERT INTO deplao_request_nonces (device_id, nonce, expires_at, created_at)
            VALUES (?, ?, ?, ?)`).bind(deviceId, nonce, new Date(Date.now() + MAX_CLOCK_SKEW_MS).toISOString(), now).run();
    } catch (error) {
        if (/UNIQUE constraint failed/i.test(String(error?.message || error))) {
            throw Object.assign(new Error('Deplao request nonce has already been used.'), { status: 409 });
        }
        throw error;
    }
    return { deviceId, now };
}

function resultTelegramEvent(outcome) {
    if (outcome === 'completed') return 'deplao.completed';
    if (outcome === 'waiting_friend') return 'deplao.waiting_friend';
    if (outcome === 'delivery_unknown') return 'deplao.delivery_unknown';
    if (outcome === 'permanent_error') return 'deplao.failed';
    return null;
}

function nextAvailableAt(outcome, attempts) {
    const base = outcome === 'waiting_friend' ? 15 * 60 : 30;
    const seconds = Math.min(6 * 60 * 60, base * Math.pow(2, Math.max(0, Number(attempts || 1) - 1)));
    return new Date(Date.now() + seconds * 1000).toISOString();
}

async function heartbeat(request, env) {
    const db = requireD1(env);
    const auth = await authenticateMachine(request, env, db);
    const body = await readJson(request, MAX_BODY_BYTES);
    const previous = await db.prepare('SELECT * FROM deplao_devices WHERE device_id = ? LIMIT 1').bind(auth.deviceId).first();
    const backlog = Math.max(0, Math.trunc(Number(body.backlogCount || 0)));
    const accountId = clean(body.selectedZaloAccountId, 255) || null;
    const connected = body.selectedZaloConnected === true ? 1 : 0;
    await db.prepare(`INSERT INTO deplao_devices (
        device_id, app_version, selected_zalo_account_id, selected_zalo_connected,
        backlog_count, metadata_json, offline_notified_at, last_seen_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
    ON CONFLICT(device_id) DO UPDATE SET
        app_version = excluded.app_version,
        selected_zalo_account_id = excluded.selected_zalo_account_id,
        selected_zalo_connected = excluded.selected_zalo_connected,
        backlog_count = excluded.backlog_count,
        metadata_json = excluded.metadata_json,
        offline_notified_at = NULL,
        last_seen_at = excluded.last_seen_at,
        updated_at = excluded.updated_at`)
        .bind(auth.deviceId, clean(body.appVersion, 100), accountId, connected, backlog,
            JSON.stringify(body.metadata || {}), auth.now, auth.now, auth.now).run();

    if (previous?.offline_notified_at && isTelegramOrderAlertsEnabled(env)) {
        await createTelegramOutboxStatement(db, {
            eventType: 'deplao.device_recovered',
            idempotencyKey: `telegram/deplao.device_recovered/${auth.deviceId}/${previous.offline_notified_at}`,
            payload: { device_id: auth.deviceId, account_id: accountId, backlog_count: backlog },
            now: auth.now,
        }).run();
    }
    const counts = await db.prepare(`SELECT status, COUNT(*) AS count FROM deplao_automation_jobs
        WHERE status NOT IN ('completed', 'failed', 'delivery_unknown', 'expired') GROUP BY status`).all();
    return json({ ok: true, serverTime: auth.now, queue: counts.results || [] });
}

async function claimJob(request, env) {
    const db = requireD1(env);
    const auth = await authenticateMachine(request, env, db);
    await readJson(request, MAX_BODY_BYTES);
    await db.prepare(`UPDATE deplao_automation_jobs SET status = 'retrying', lease_owner = NULL,
        lease_token_hash = NULL, lease_expires_at = NULL, available_at = ?,
        last_error = COALESCE(last_error, 'Lease expired before result.'), updated_at = ?
        WHERE status = 'leased' AND lease_expires_at < ?`).bind(auth.now, auth.now, auth.now).run();

    const row = await db.prepare(`SELECT job.* FROM deplao_automation_jobs job
        WHERE job.status IN ('pending', 'retrying', 'waiting_friend')
          AND job.available_at <= ? AND job.expires_at > ?
          AND (job.event_type = 'order.created' OR NOT EXISTS (
            SELECT 1 FROM deplao_automation_jobs earlier
            WHERE earlier.order_id = job.order_id AND earlier.event_type = 'order.created'
              AND earlier.status NOT IN ('completed', 'failed', 'delivery_unknown', 'expired')
          ))
        ORDER BY CASE job.event_type WHEN 'order.created' THEN 0 ELSE 1 END, job.created_at
        LIMIT 1`).bind(auth.now, auth.now).first();
    if (!row) return json({ ok: true, job: null });

    const leaseToken = randomToken(32);
    const leaseHash = await sha256(leaseToken);
    const leaseExpiresAt = new Date(Date.now() + LEASE_MS).toISOString();
    const claimed = await db.prepare(`UPDATE deplao_automation_jobs
        SET status = 'leased', attempts = attempts + 1, lease_owner = ?, lease_token_hash = ?,
            lease_expires_at = ?, updated_at = ?
        WHERE id = ? AND status IN ('pending', 'retrying', 'waiting_friend') AND available_at <= ? AND expires_at > ?`)
        .bind(auth.deviceId, leaseHash, leaseExpiresAt, auth.now, row.id, auth.now, auth.now).run();
    if (!Number(claimed.meta?.changes || 0)) return json({ ok: true, job: null });
    return json({
        ok: true,
        job: {
            id: row.id,
            eventType: row.event_type,
            orderId: row.order_id,
            orderCode: row.order_code,
            attempt: Number(row.attempts || 0) + 1,
            expiresAt: row.expires_at,
            leaseToken,
            leaseExpiresAt,
            payload: JSON.parse(row.payload_json || '{}'),
        },
    });
}

async function recordResult(request, env, jobId) {
    const db = requireD1(env);
    const auth = await authenticateMachine(request, env, db);
    const body = await readJson(request, MAX_BODY_BYTES);
    const outcome = clean(body.outcome, 100);
    if (!RESULT_OUTCOMES.has(outcome)) {
        throw Object.assign(new Error('Invalid Deplao job outcome.'), { status: 400 });
    }
    const leaseToken = clean(body.leaseToken, 2000);
    const job = await db.prepare('SELECT * FROM deplao_automation_jobs WHERE id = ? LIMIT 1').bind(jobId).first();
    if (!job) throw Object.assign(new Error('Deplao job was not found.'), { status: 404 });
    if (job.status === 'completed' && outcome === 'completed') return json({ ok: true, unchanged: true });
    if (job.status !== 'leased' || job.lease_owner !== auth.deviceId || !leaseToken
        || !timingSafeEqual(job.lease_token_hash, await sha256(leaseToken))) {
        throw Object.assign(new Error('Deplao job lease is no longer valid.'), { status: 409 });
    }
    if (!job.lease_expires_at || Date.parse(job.lease_expires_at) < Date.now()) {
        throw Object.assign(new Error('Deplao job lease has expired.'), { status: 409 });
    }

    const lastError = clean(body.error || body.message, 2000) || null;
    const result = body.result && typeof body.result === 'object' ? body.result : {};
    let status;
    let availableAt = auth.now;
    let completedAt = null;
    if (outcome === 'completed') { status = 'completed'; completedAt = auth.now; }
    else if (outcome === 'waiting_friend') { status = 'waiting_friend'; availableAt = nextAvailableAt(outcome, job.attempts); }
    else if (outcome === 'retryable_error') { status = 'retrying'; availableAt = nextAvailableAt(outcome, job.attempts); }
    else if (outcome === 'permanent_error') { status = 'failed'; completedAt = auth.now; }
    else { status = 'delivery_unknown'; completedAt = auth.now; }

    const updated = await db.prepare(`UPDATE deplao_automation_jobs SET status = ?, available_at = ?,
        lease_owner = NULL, lease_token_hash = NULL, lease_expires_at = NULL,
        last_error = ?, result_json = ?, completed_at = ?, updated_at = ?
        WHERE id = ? AND status = 'leased' AND lease_owner = ?`)
        .bind(status, availableAt, lastError, JSON.stringify(result), completedAt, auth.now, job.id, auth.deviceId).run();
    if (!Number(updated.meta?.changes || 0)) throw Object.assign(new Error('Deplao job result raced with another update.'), { status: 409 });

    const telegramEvent = resultTelegramEvent(outcome);
    if (telegramEvent && isTelegramOrderAlertsEnabled(env)) {
        const orderPayload = JSON.parse(job.payload_json || '{}');
        await createTelegramOutboxStatement(db, {
            eventType: telegramEvent,
            orderId: job.order_id,
            idempotencyKey: `telegram/${telegramEvent}/${job.id}`,
            payload: {
                ...orderPayload,
                device_id: auth.deviceId,
                account_id: result.accountId || '',
                friend_request_sent: result.friendRequestSent === true,
                message: body.message || '',
                last_error: lastError,
            },
            now: auth.now,
        }).run();
    }
    return json({ ok: true, status, nextAttemptAt: completedAt ? null : availableAt });
}

async function adminStatus(request, env) {
    const db = requireD1(env);
    await requireRole(db, request, ['admin', 'master_admin']);
    const [counts, devices, telegramCounts, jobs] = await Promise.all([
        db.prepare('SELECT status, COUNT(*) AS count FROM deplao_automation_jobs GROUP BY status ORDER BY status').all(),
        db.prepare('SELECT * FROM deplao_devices ORDER BY last_seen_at DESC LIMIT 10').all(),
        db.prepare('SELECT status, COUNT(*) AS count FROM telegram_order_outbox GROUP BY status ORDER BY status').all(),
        db.prepare(`SELECT id, event_type, order_id, order_code, status, attempts, available_at, expires_at,
            lease_owner, lease_expires_at, last_error, result_json, completed_at, created_at, updated_at
            FROM deplao_automation_jobs ORDER BY created_at DESC LIMIT 50`).all(),
    ]);
    return json({
        config: {
            automationEnabled: isDeplaoAutomationEnabled(env),
            telegramEnabled: isTelegramOrderAlertsEnabled(env),
            deviceConfigured: Boolean(env.DEPLAO_DEVICE_ID && env.DEPLAO_DEVICE_SECRET),
            telegramConfigured: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_ADMIN_CHAT_ID),
            queueConfigured: Boolean(env.TELEGRAM_QUEUE),
        },
        jobs: counts.results || [],
        telegram: telegramCounts.results || [],
        devices: devices.results || [],
        recentJobs: jobs.results || [],
    });
}

async function retryAdminJob(request, env, jobId) {
    const db = requireD1(env);
    const session = await requireRole(db, request, ['admin', 'master_admin']);
    await requireCsrf(db, request, session);
    const now = new Date().toISOString();
    const result = await db.prepare(`UPDATE deplao_automation_jobs SET status = 'retrying', available_at = ?,
        expires_at = CASE WHEN expires_at < ? THEN ? ELSE expires_at END,
        lease_owner = NULL, lease_token_hash = NULL, lease_expires_at = NULL,
        last_error = NULL, completed_at = NULL, updated_at = ?
        WHERE id = ? AND status IN ('failed', 'delivery_unknown', 'expired')`)
        .bind(now, now, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), now, jobId).run();
    if (!Number(result.meta?.changes || 0)) {
        throw Object.assign(new Error('Job is not in a retryable terminal state.'), { status: 409 });
    }
    return json({ ok: true });
}

export async function maintainDeplaoAutomation(env) {
    if (!env.APP_DB) return { skipped: true };
    const db = env.APP_DB;
    const now = new Date().toISOString();
    const expired = await db.prepare(`SELECT id, order_id, order_code, payload_json FROM deplao_automation_jobs
        WHERE status NOT IN ('completed', 'failed', 'delivery_unknown', 'expired') AND expires_at <= ? LIMIT 100`).bind(now).all();
    for (const job of expired.results || []) {
        const changed = await db.prepare(`UPDATE deplao_automation_jobs SET status = 'expired', completed_at = ?,
            lease_owner = NULL, lease_token_hash = NULL, lease_expires_at = NULL,
            last_error = 'Job expired after 7 days.', updated_at = ?
            WHERE id = ? AND status NOT IN ('completed', 'failed', 'delivery_unknown', 'expired')`)
            .bind(now, now, job.id).run();
        if (Number(changed.meta?.changes || 0) && isTelegramOrderAlertsEnabled(env)) {
            await createTelegramOutboxStatement(db, {
                eventType: 'deplao.expired', orderId: job.order_id,
                idempotencyKey: `telegram/deplao.expired/${job.id}`,
                payload: { ...JSON.parse(job.payload_json || '{}'), last_error: 'Quá 7 ngày mà chưa thể gửi cho khách.' }, now,
            }).run();
        }
    }

    const pending = await db.prepare(`SELECT COUNT(*) AS count FROM deplao_automation_jobs
        WHERE status NOT IN ('completed', 'failed', 'delivery_unknown', 'expired')`).first();
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const offline = await db.prepare(`SELECT * FROM deplao_devices
        WHERE last_seen_at < ? AND offline_notified_at IS NULL LIMIT 10`).bind(cutoff).all();
    for (const device of offline.results || []) {
        const changed = await db.prepare(`UPDATE deplao_devices SET offline_notified_at = ?, updated_at = ?
            WHERE device_id = ? AND offline_notified_at IS NULL`).bind(now, now, device.device_id).run();
        if (Number(changed.meta?.changes || 0) && isTelegramOrderAlertsEnabled(env)) {
            await createTelegramOutboxStatement(db, {
                eventType: 'deplao.device_offline',
                idempotencyKey: `telegram/deplao.device_offline/${device.device_id}/${now.slice(0, 13)}`,
                payload: {
                    device_id: device.device_id,
                    account_id: device.selected_zalo_account_id,
                    backlog_count: Number(pending?.count || 0),
                    message: 'Không nhận heartbeat trong hơn 15 phút.',
                }, now,
            }).run();
        }
    }
    const retention = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    await Promise.all([
        db.prepare('DELETE FROM deplao_request_nonces WHERE expires_at < ?').bind(now).run(),
        db.prepare(`DELETE FROM deplao_automation_jobs WHERE completed_at < ?
            AND status IN ('completed', 'failed', 'delivery_unknown', 'expired')`).bind(retention).run(),
        db.prepare(`DELETE FROM telegram_order_outbox WHERE accepted_at < ? AND status = 'accepted'`).bind(retention).run(),
    ]);
    return { skipped: false, expired: (expired.results || []).length };
}

export async function maybeHandleDeplaoRoute(route) {
    const { request, env, path } = route;
    try {
        if (path === '/api/integrations/deplao/heartbeat') {
            if (request.method !== 'POST') return methodNotAllowed(['POST']);
            return await heartbeat(request, env);
        }
        if (path === '/api/integrations/deplao/jobs/claim') {
            if (request.method !== 'POST') return methodNotAllowed(['POST']);
            return await claimJob(request, env);
        }
        const resultMatch = path.match(/^\/api\/integrations\/deplao\/jobs\/([^/]+)\/result$/);
        if (resultMatch) {
            if (request.method !== 'POST') return methodNotAllowed(['POST']);
            return await recordResult(request, env, decodeURIComponent(resultMatch[1]));
        }
        if (path === '/api/admin/integrations/deplao/status') {
            if (request.method !== 'GET') return methodNotAllowed(['GET']);
            return await adminStatus(request, env);
        }
        const retryMatch = path.match(/^\/api\/admin\/integrations\/deplao\/jobs\/([^/]+)\/retry$/);
        if (retryMatch) {
            if (request.method !== 'POST') return methodNotAllowed(['POST']);
            return await retryAdminJob(request, env, decodeURIComponent(retryMatch[1]));
        }
        return null;
    } catch (error) {
        if (Number(error?.status) === 503 && error?.expose === true) {
            return json({
                error: {
                    code: String(error?.code || 'SERVICE_UNAVAILABLE'),
                    message: String(error?.message || 'Dịch vụ Deplao/Zalo hiện chưa sẵn sàng.'),
                },
            }, 503);
        }
        return apiError(error, 'Could not process Deplao integration request.');
    }
}
