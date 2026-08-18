import { createClient } from '@supabase/supabase-js'

const DEFAULT_SUPABASE_URL = 'https://ykcrngqhyinczmvwduox.supabase.co'
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Tk-pvnzWINmKS6xe-5aKkA_aWr5DIVc'
const SUPABASE_FETCH_TIMEOUT_MS = 12000
const SUPABASE_FUNCTION_FETCH_TIMEOUT_MS = 60000
const SESSION_FRESHNESS_WINDOW_SECONDS = 60
const SESSION_FRESHNESS_COOLDOWN_MS = 15000
const RESUME_RECOVERY_COOLDOWN_MS = 10000

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL
const supabasePublishableKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_PUBLISHABLE_KEY

const fetchWithTimeout: typeof fetch = async (input, init) => {
    const controller = new AbortController()
    const url = typeof input === 'string'
        ? input
        : input instanceof Request
            ? input.url
            : String(input)
    const timeoutMs = url.includes('/functions/v1/')
        ? SUPABASE_FUNCTION_FETCH_TIMEOUT_MS
        : SUPABASE_FETCH_TIMEOUT_MS
    const timeoutId = window.setTimeout(() => {
        controller.abort(new DOMException('Supabase request timed out', 'AbortError'))
    }, timeoutMs)

    const incomingSignal = init?.signal
    const abortFromIncomingSignal = () => controller.abort(incomingSignal?.reason)

    if (incomingSignal) {
        if (incomingSignal.aborted) {
            abortFromIncomingSignal()
        } else {
            incomingSignal.addEventListener('abort', abortFromIncomingSignal, { once: true })
        }
    }

    try {
        return await fetch(input, { ...init, signal: controller.signal })
    } finally {
        window.clearTimeout(timeoutId)
        incomingSignal?.removeEventListener?.('abort', abortFromIncomingSignal)
    }
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
    global: {
        fetch: fetchWithTimeout,
    },
})

let ensureSessionFreshPromise: Promise<void> | null = null
let refreshSessionPromise: Promise<void> | null = null
let resumeRecoveryPromise: Promise<void> | null = null
let lastFreshnessCheckAt = 0
let lastResumeRecoveryAt = 0
let resumeRecoveryInstalled = false

type EnsureSessionFreshOptions = {
    force?: boolean
}

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return `${error.name} ${error.message}`.trim()
    if (typeof error === 'object' && error !== null && 'message' in error) {
        return String((error as { message?: unknown }).message || '')
    }
    return String(error || '')
}

export function isSupabaseAuthError(error: unknown): boolean {
    const err = error as { status?: number; code?: string; message?: string; name?: string } | null | undefined
    const message = getErrorMessage(error).toLowerCase()
    return message.includes('jwt')
        || message.includes('invalid token')
        || message.includes('expired token')
        || err?.status === 401
        || err?.status === 403
        || err?.code === 'PGRST301'
}

export function isSupabaseRetryableError(error: unknown): boolean {
    const err = error as { status?: number; code?: string; message?: string; name?: string } | null | undefined
    const message = getErrorMessage(error).toLowerCase()
    return err?.name === 'AbortError'
        || err?.status === 0
        || err?.status === 408
        || err?.status === 429
        || err?.status === 502
        || err?.status === 503
        || err?.status === 504
        || message.includes('aborterror')
        || message.includes('aborted')
        || message.includes('timeout')
        || message.includes('timed out')
        || message.includes('failed to fetch')
        || message.includes('load failed')
        || message.includes('networkerror')
        || message.includes('network request failed')
        || message.includes('fetch failed')
}

export function markSessionFreshnessStale() {
    lastFreshnessCheckAt = 0
}

export async function refreshSessionSafely(): Promise<void> {
    if (refreshSessionPromise) {
        return refreshSessionPromise
    }

    refreshSessionPromise = (async () => {
        markSessionFreshnessStale()
        const { error } = await supabase.auth.refreshSession()
        if (error) {
            throw error
        }
        lastFreshnessCheckAt = Date.now()
    })().finally(() => {
        refreshSessionPromise = null
    })

    return refreshSessionPromise
}

// Keep session refresh serialized to avoid auth-token lock contention.
export async function ensureSessionFresh(options: EnsureSessionFreshOptions = {}) {
    if (ensureSessionFreshPromise) {
        return ensureSessionFreshPromise
    }

    if (!options.force && Date.now() - lastFreshnessCheckAt < SESSION_FRESHNESS_COOLDOWN_MS) {
        return
    }

    ensureSessionFreshPromise = (async () => {
        try {
            const { data, error } = await supabase.auth.getSession();
            if (error) {
                throw error
            }

            const session = data?.session;
            if (!session) {
                lastFreshnessCheckAt = Date.now()
                return;
            }

            const expiresAt = session.expires_at ?? 0;
            const now = Math.floor(Date.now() / 1000);
            if (expiresAt - now < SESSION_FRESHNESS_WINDOW_SECONDS) {
                await refreshSessionSafely();
            }

            lastFreshnessCheckAt = Date.now()
        } catch (error) {
            console.error('Error refreshing session:', error);
        }
    })().finally(() => {
        ensureSessionFreshPromise = null
    })

    return ensureSessionFreshPromise
}

export async function recoverSupabaseAfterResume(options: { force?: boolean; reason?: string } = {}): Promise<void> {
    if (resumeRecoveryPromise) {
        return resumeRecoveryPromise
    }

    const now = Date.now()
    if (!options.force && now - lastResumeRecoveryAt < RESUME_RECOVERY_COOLDOWN_MS) {
        return
    }

    lastResumeRecoveryAt = now
    markSessionFreshnessStale()

    resumeRecoveryPromise = (async () => {
        try {
            const authWithLifecycle = supabase.auth as typeof supabase.auth & {
                startAutoRefresh?: () => void
            }
            authWithLifecycle.startAutoRefresh?.()
            await ensureSessionFresh({ force: true })
        } catch (error) {
            console.warn(`[supabase:resume] Session recovery failed${options.reason ? ` after ${options.reason}` : ''}:`, error)
        }
    })().finally(() => {
        resumeRecoveryPromise = null
    })

    return resumeRecoveryPromise
}

export function installSupabaseResumeRecovery() {
    if (resumeRecoveryInstalled || typeof window === 'undefined' || typeof document === 'undefined') {
        return
    }

    resumeRecoveryInstalled = true

    const recover = (reason: string, force = false) => {
        if (document.visibilityState === 'hidden') {
            markSessionFreshnessStale()
            return
        }
        void recoverSupabaseAfterResume({ force, reason })
    }

    document.addEventListener('visibilitychange', () => {
        recover('visibilitychange', document.visibilityState === 'visible')
    })
    window.addEventListener('pageshow', (event) => {
        recover(event.persisted ? 'pageshow-bfcache' : 'pageshow')
    })
    window.addEventListener('focus', () => recover('focus'))
    window.addEventListener('online', () => recover('online', true))
}

export async function checkSupabaseAuthHealth(): Promise<boolean> {
    try {
        const [authResponse, publicDataResponse] = await Promise.all([
            fetchWithTimeout(`${supabaseUrl}/auth/v1/settings`, {
                headers: {
                    apikey: supabasePublishableKey,
                },
            }),
            fetchWithTimeout(`${supabaseUrl}/rest/v1/site_info?select=id&limit=1`, {
                headers: {
                    apikey: supabasePublishableKey,
                    Authorization: `Bearer ${supabasePublishableKey}`,
                },
            }),
        ])
        return authResponse.ok && publicDataResponse.ok
    } catch {
        return false
    }
}
