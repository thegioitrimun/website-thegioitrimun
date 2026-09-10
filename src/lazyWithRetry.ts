import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * Enhanced React.lazy with automatic single-shot retry on dynamic import failure.
 * When Vite produces new chunk hashes on deployment, clients with stale cached HTML
 * or running sessions requesting obsolete chunk hashes will fail with
 * "Failed to fetch dynamically imported module" or MIME type errors.
 *
 * This wrapper intercepts that failure, marks a single-shot flag in sessionStorage,
 * and reloads the current page so the browser receives the newest HTML and chunk hashes.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
    factory: () => Promise<{ default: T }>,
    chunkName?: string
): LazyExoticComponent<T> {
    return lazy(async () => {
        const retryKey = `chunk_retry_${chunkName || 'page'}`;
        try {
            const component = await factory();
            sessionStorage.removeItem(retryKey);
            return component;
        } catch (error: any) {
            const isChunkLoadFailed =
                error?.name === 'ChunkLoadError' ||
                /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(
                    error?.message || ''
                ) ||
                String(error).includes('MIME type');

            const hasRetried = sessionStorage.getItem(retryKey);
            if (isChunkLoadFailed && !hasRetried) {
                sessionStorage.setItem(retryKey, 'true');
                window.location.reload();
                // Return an unresolved promise to prevent rendering an error while reloading
                return new Promise<{ default: T }>(() => {});
            }
            throw error;
        }
    });
}
