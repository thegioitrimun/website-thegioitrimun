const disabledMessage = 'Supabase client is disabled in the Cloudflare D1 frontend build.';

const disabledClient: any = new Proxy(function disabledSupabaseClient() {}, {
    get() {
        return disabledClient;
    },
    apply() {
        throw new Error(disabledMessage);
    },
});

// D1 builds retain the old API module for rollback compatibility, but any
// accidental runtime access to a Supabase-only branch must fail closed.
export const supabase = disabledClient;

export function isSupabaseAuthError(): boolean {
    return false;
}

export function isSupabaseRetryableError(): boolean {
    return false;
}

export function markSessionFreshnessStale(): void {}

export async function refreshSessionSafely(): Promise<void> {}

export async function ensureSessionFresh(): Promise<void> {}

export async function recoverSupabaseAfterResume(): Promise<void> {}

export function installSupabaseResumeRecovery(): void {}

export async function checkSupabaseAuthHealth(): Promise<boolean> {
    return false;
}
