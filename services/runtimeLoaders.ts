type AnyFunction = (...args: any[]) => any;

let apiModulePromise: Promise<typeof import('./api')> | null = null;
let supabaseClientPromise: Promise<typeof import('./supabaseClient')> | null = null;

export function loadApiModule() {
  if (!apiModulePromise) {
    apiModulePromise = import('./api');
  }
  return apiModulePromise;
}

export function loadSupabaseClientModule() {
  if (!supabaseClientPromise) {
    supabaseClientPromise = import('./supabaseClient');
  }
  return supabaseClientPromise;
}

export async function getSupabaseClient() {
  return (await loadSupabaseClientModule()).supabase;
}

export function createDeferredFunctionProxy<T extends object>(loader: () => Promise<T>): T {
  return new Proxy(Object.create(null), {
    get(_target, prop) {
      return (...args: unknown[]) =>
        loader().then((mod) => {
          const value = mod[prop as keyof T];
          if (typeof value !== 'function') {
            throw new Error(`Deferred module export "${String(prop)}" is not callable.`);
          }
          return (value as AnyFunction)(...args);
        });
    },
  }) as T;
}
