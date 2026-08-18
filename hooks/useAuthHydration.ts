import { useEffect } from 'react';
import type { AuthMode } from '../components/AuthPage';
import { getAuthModeFromLocation } from '../src/appRouting';
import { scheduleDeferredTask } from '../src/browserIdle';
import { loadApiModule, loadSupabaseClientModule } from '../services/runtimeLoaders';

const USE_D1_AUTH = String(import.meta.env.VITE_DATA_BACKEND || '').toLowerCase() === 'd1';

type UseAuthHydrationOptions = {
    deferInitialBootstrap: boolean;
    fetchUserData: (userId: string) => Promise<void>;
    clearAuthUserState: () => void;
    handlePasswordRecovery: () => void;
    setAuthModeHint: (mode: AuthMode) => void;
};

export const useAuthHydration = ({
    deferInitialBootstrap,
    fetchUserData,
    clearAuthUserState,
    handlePasswordRecovery,
    setAuthModeHint,
}: UseAuthHydrationOptions) => {
    useEffect(() => {
        const syncAuthMode = () => {
            const nextMode = getAuthModeFromLocation();
            setAuthModeHint(nextMode);
            if (nextMode === 'reset-password') {
                handlePasswordRecovery();
            }
        };

        syncAuthMode();
        window.addEventListener('hashchange', syncAuthMode);
        return () => window.removeEventListener('hashchange', syncAuthMode);
    }, [handlePasswordRecovery, setAuthModeHint]);

    useEffect(() => {
        let isActive = true;
        let unsubscribe: (() => void) | null = null;
        let startTimer: number | null = null;
        let hasStarted = false;
        const deferredAuthHydrationTimers = new Set<number>();

        const scheduleAuthHydration = (userId: string) => {
            const timer = window.setTimeout(() => {
                deferredAuthHydrationTimers.delete(timer);
                if (!isActive) return;
                void fetchUserData(userId);
            }, 0);
            deferredAuthHydrationTimers.add(timer);
        };

        const initAuth = async () => {
            if (!isActive || hasStarted) return;
            hasStarted = true;
            if (USE_D1_AUTH) {
                try {
                    const api = await loadApiModule();
                    const user = await api.getCurrentAuthSession();
                    if (!isActive) return;
                    if (user?.id) scheduleAuthHydration(user.id);
                    else clearAuthUserState();
                } catch (error) {
                    console.warn('Could not hydrate D1 OAuth session:', error);
                    if (isActive) clearAuthUserState();
                }
                return;
            }
            const supabaseModule = await loadSupabaseClientModule();
            supabaseModule.installSupabaseResumeRecovery();
            const supabase = supabaseModule.supabase;
            if (!isActive) return;

            const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
                if (!isActive) return;

                if (event === 'PASSWORD_RECOVERY') {
                    handlePasswordRecovery();
                }

                if (event === 'SIGNED_OUT') {
                    clearAuthUserState();
                    return;
                }

                const user = nextSession?.user;
                if (!user) {
                    clearAuthUserState();
                    return;
                }

                if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
                    scheduleAuthHydration(user.id);
                }
            });

            unsubscribe = () => authListener.subscription.unsubscribe();
        };

        let cancel = () => {};
        const scheduleAuthBootstrap = () => {
            if (!deferInitialBootstrap) {
                cancel = scheduleDeferredTask(
                    initAuth,
                    { immediate: true, delayMs: 220, timeout: 1200 },
                );
                return;
            }

            const kickoff = () => {
                if (!isActive || startTimer !== null) return;
                startTimer = window.setTimeout(() => {
                    startTimer = null;
                    void initAuth();
                }, 2500);
            };

            if (document.readyState === 'complete') {
                kickoff();
            } else {
                const onLoad = () => kickoff();
                window.addEventListener('load', onLoad, { once: true });
                cancel = () => window.removeEventListener('load', onLoad);
            }
        };

        scheduleAuthBootstrap();

        return () => {
            isActive = false;
            cancel();
            if (startTimer !== null) {
                window.clearTimeout(startTimer);
            }
            deferredAuthHydrationTimers.forEach((timer) => window.clearTimeout(timer));
            deferredAuthHydrationTimers.clear();
            unsubscribe?.();
        };
    }, [clearAuthUserState, deferInitialBootstrap, fetchUserData, handlePasswordRecovery]);
};
