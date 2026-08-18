type ClientErrorPayload = {
    type: 'window-error' | 'unhandledrejection' | 'api-error';
    message: string;
    context?: string;
    source?: string;
    line?: number;
    column?: number;
    stack?: string;
    details?: string;
};

const CLIENT_MONITOR_ENDPOINT = '/api/monitor/client-error';
const seenFingerprints = new Set<string>();
let isClientMonitoringInstalled = false;

const normalizeUnknown = (value: unknown): string => {
    if (value instanceof Error) return value.message;
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

const buildFingerprint = (payload: ClientErrorPayload) =>
    [payload.type, payload.context || '', payload.message, payload.source || '', payload.line || 0, payload.column || 0]
        .join('|')
        .slice(0, 500);

const sendPayload = (payload: ClientErrorPayload) => {
    if (typeof window === 'undefined') return;

    const fingerprint = buildFingerprint(payload);
    if (seenFingerprints.has(fingerprint)) return;
    seenFingerprints.add(fingerprint);

    const body = JSON.stringify({
        ...payload,
        path: window.location.pathname + window.location.search,
        href: window.location.href,
        userAgent: window.navigator.userAgent,
        occurredAt: new Date().toISOString(),
    });

    try {
        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
            const ok = navigator.sendBeacon(CLIENT_MONITOR_ENDPOINT, new Blob([body], { type: 'application/json' }));
            if (ok) return;
        }
    } catch {
        // Ignore beacon transport errors and fall through to fetch.
    }

    fetch(CLIENT_MONITOR_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body,
        keepalive: true,
    }).catch(() => {
        // Client monitoring should never block UX.
    });
};

export const reportClientError = (payload: ClientErrorPayload) => {
    sendPayload(payload);
};

export const installClientMonitoring = () => {
    if (typeof window === 'undefined' || isClientMonitoringInstalled) return;
    isClientMonitoringInstalled = true;

    window.addEventListener('error', (event) => {
        sendPayload({
            type: 'window-error',
            message: event.message || 'Unknown window error',
            source: event.filename,
            line: event.lineno,
            column: event.colno,
            stack: event.error instanceof Error ? event.error.stack : undefined,
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        sendPayload({
            type: 'unhandledrejection',
            message: normalizeUnknown(reason),
            stack: reason instanceof Error ? reason.stack : undefined,
            details: typeof reason === 'object' && reason !== null ? normalizeUnknown(reason) : undefined,
        });
    });
};
