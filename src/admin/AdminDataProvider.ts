type CachedAdminResource<T> = {
    value: T;
    expiresAt: number;
};

type ReadOptions = {
    maxAgeMs?: number;
    force?: boolean;
};

/**
 * Request-level cache for admin resources. It deduplicates concurrent reads and
 * keeps already visited modules responsive without making admin data global UI state.
 */
export class AdminDataProvider {
    private readonly cache = new Map<string, CachedAdminResource<unknown>>();
    private readonly pending = new Map<string, Promise<unknown>>();

    async read<T>(key: string, loader: () => Promise<T>, options: ReadOptions = {}): Promise<T> {
        const maxAgeMs = Math.max(0, options.maxAgeMs ?? 30_000);
        const cached = this.cache.get(key) as CachedAdminResource<T> | undefined;
        if (!options.force && cached && cached.expiresAt > Date.now()) return cached.value;

        const inFlight = this.pending.get(key) as Promise<T> | undefined;
        if (!options.force && inFlight) return inFlight;

        const request = loader()
            .then((value) => {
                this.cache.set(key, { value, expiresAt: Date.now() + maxAgeMs });
                return value;
            })
            .finally(() => {
                if (this.pending.get(key) === request) this.pending.delete(key);
            });

        this.pending.set(key, request);
        return request;
    }

    peek<T>(key: string): T | undefined {
        return (this.cache.get(key) as CachedAdminResource<T> | undefined)?.value;
    }

    set<T>(key: string, value: T, maxAgeMs = 30_000): void {
        this.cache.set(key, { value, expiresAt: Date.now() + Math.max(0, maxAgeMs) });
    }

    invalidate(prefix?: string): void {
        if (!prefix) {
            this.cache.clear();
            return;
        }
        for (const key of this.cache.keys()) {
            if (key === prefix || key.startsWith(`${prefix}:`)) this.cache.delete(key);
        }
    }

    prefetch<T>(key: string, loader: () => Promise<T>, maxAgeMs = 30_000): void {
        void this.read(key, loader, { maxAgeMs }).catch(() => undefined);
    }
}

export const adminDataProvider = new AdminDataProvider();

