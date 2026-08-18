let browserLifecycleListenersInstalled = false;
let pageTeardownInProgress = false;

const installBrowserLifecycleListeners = () => {
    if (browserLifecycleListenersInstalled || typeof window === 'undefined' || typeof document === 'undefined') {
        return;
    }

    browserLifecycleListenersInstalled = true;

    const markTeardown = () => {
        pageTeardownInProgress = true;
    };

    const clearTeardown = () => {
        pageTeardownInProgress = false;
    };

    window.addEventListener('beforeunload', markTeardown, { capture: true });
    window.addEventListener('pagehide', markTeardown, { capture: true });
    window.addEventListener('pageshow', clearTeardown, { capture: true });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            markTeardown();
        } else if (document.visibilityState === 'visible') {
            clearTeardown();
        }
    });
};

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return `${error.name} ${error.message}`.trim();
    if (typeof error === 'object' && error !== null && 'message' in error) {
        return String((error as { message?: unknown }).message || '');
    }
    return String(error || '');
};

export const isPageTeardownActive = (): boolean => {
    installBrowserLifecycleListeners();
    return pageTeardownInProgress;
};

export const isNavigationAbortLikeError = (error: unknown): boolean => {
    const message = getErrorMessage(error).toLowerCase();
    return message.includes('aborterror')
        || message.includes('aborted')
        || message.includes('request aborted')
        || message.includes('fetch is aborted')
        || message.includes('failed to fetch')
        || message.includes('load failed')
        || message.includes('networkerror')
        || message.includes('network request failed');
};

export const isExpectedPageLifecycleAbort = (error: unknown): boolean => {
    return isPageTeardownActive() && isNavigationAbortLikeError(error);
};
