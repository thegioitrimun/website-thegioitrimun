import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product } from '../types';
import { useToast } from '../hooks/useToast';
import { scheduleDeferredTask } from '../src/browserIdle';
import { isExpectedPageLifecycleAbort } from '../src/browserLifecycle';
import { reportClientError } from '../src/clientMonitoring';
import { createDeferredFunctionProxy, getSupabaseClient, loadApiModule } from '../services/runtimeLoaders';

const api = createDeferredFunctionProxy<typeof import('../services/api')>(loadApiModule);

interface WishlistContextType {
  wishlist: Set<number>;
  loadWishlist: (wishlistProductIds: number[]) => void;
  addToWishlist: (product: Product) => void;
  removeFromWishlist: (productId: number) => void;
  isWishlisted: (productId: number) => boolean;
  clearWishlist: () => void;
}

export const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const [wishlist, setWishlist] = useState<Set<number>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { addToast } = useToast();
  const lastHydratedUserIdRef = useRef<string | null>(null);
  const pendingHydrationUserIdRef = useRef<string | null>(null);
  const hydrationPromiseRef = useRef<Promise<void> | null>(null);

  const loadWishlist = useCallback((wishlistProductIds: number[]) => {
    setWishlist(new Set(wishlistProductIds));
  }, []);
  
  const clearWishlist = useCallback(() => {
    setWishlist(new Set());
  }, []);

  const hydrateWishlistForUser = useCallback(async (userId: string, options?: { force?: boolean }) => {
    if (!options?.force && lastHydratedUserIdRef.current === userId) {
      return;
    }

    if (pendingHydrationUserIdRef.current === userId && hydrationPromiseRef.current) {
      return hydrationPromiseRef.current;
    }

    pendingHydrationUserIdRef.current = userId;
    const promise = (async () => {
      try {
        const wishlistIds = await api.getUserWishlistProductIds(userId);
        loadWishlist(wishlistIds);
        lastHydratedUserIdRef.current = userId;
      } catch (error) {
        if (!isExpectedPageLifecycleAbort(error)) {
          reportClientError({
            type: 'api-error',
            message: error instanceof Error ? error.message : String(error),
            context: 'hydrate wishlist',
            stack: error instanceof Error ? error.stack : undefined,
          });
        }
      } finally {
        pendingHydrationUserIdRef.current = null;
        hydrationPromiseRef.current = null;
      }
    })();

    hydrationPromiseRef.current = promise;
    return promise;
  }, [loadWishlist]);

  // Effect to get current user for API calls
  useEffect(() => {
    let isActive = true;
    let unsubscribe: (() => void) | null = null;

    const initWishlistAuth = async () => {
        try {
          if (await api.isD1BackendEnabled()) {
            const user = await api.getCurrentAuthSession();
            if (!isActive) return;
            if (user?.id) {
              setCurrentUserId(user.id);
              await hydrateWishlistForUser(user.id);
            } else {
              setCurrentUserId(null);
              clearWishlist();
            }
            return;
          }
          const supabase = await getSupabaseClient();
          if (!isActive) return;

          const { data: { session } } = await supabase.auth.getSession();
          if (!isActive) return;
          if (session?.user) {
              setCurrentUserId(session.user.id);
              if (isActive) {
                await hydrateWishlistForUser(session.user.id);
              }
          }

          const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
              setCurrentUserId(session.user.id);
              if (isActive) {
                await hydrateWishlistForUser(session.user.id);
              }
            } else {
              setCurrentUserId(null);
              lastHydratedUserIdRef.current = null;
              pendingHydrationUserIdRef.current = null;
              hydrationPromiseRef.current = null;
              clearWishlist();
            }
          });

          unsubscribe = () => authListener.subscription.unsubscribe();
        } catch (error) {
          if (!isExpectedPageLifecycleAbort(error)) {
            reportClientError({
              type: 'api-error',
              message: error instanceof Error ? error.message : String(error),
              context: 'init wishlist auth',
              stack: error instanceof Error ? error.stack : undefined,
            });
          }
        }
    };

    const shouldPrioritizeAuth = typeof window !== 'undefined' && window.location.pathname !== '/';
    const cancel = scheduleDeferredTask(initWishlistAuth, {
      immediate: shouldPrioritizeAuth,
      delayMs: 260,
      timeout: 1400,
    });

    return () => {
      isActive = false;
      cancel();
      unsubscribe?.();
    };
  }, [clearWishlist, hydrateWishlistForUser]);

  const isWishlisted = useCallback((productId: number) => {
    return wishlist.has(productId);
  }, [wishlist]);

  const addToWishlist = useCallback(async (product: Product) => {
    if (!currentUserId) {
        addToast(t('wishlist.login_required_title', 'Vui lòng đăng nhập'), {
          type: 'info',
          description: t('wishlist.login_required_desc', 'Bạn cần đăng nhập để sử dụng tính năng này.'),
        });
        return;
    }
    if (isWishlisted(product.id)) return;

    setWishlist(prev => new Set(prev).add(product.id));
    try {
      await api.addProductToWishlist(currentUserId, product.id);
    } catch (error) {
      console.error(error);
      addToast(t('common.error'), { type: 'error', description: t('wishlist.add_failed', 'Không thể thêm vào danh sách yêu thích.') });
      // Revert state on error
      setWishlist(prev => {
          const newSet = new Set(prev);
          newSet.delete(product.id);
          return newSet;
      });
    }
  }, [currentUserId, isWishlisted, addToast, t]);

  const removeFromWishlist = useCallback(async (productId: number) => {
    if (!currentUserId) return;
    if (!isWishlisted(productId)) return;

    setWishlist(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
    });
    try {
      await api.removeProductFromWishlist(currentUserId, productId);
    } catch (error) {
      console.error(error);
      addToast(t('common.error'), { type: 'error', description: t('wishlist.remove_failed', 'Không thể xóa khỏi danh sách yêu thích.') });
      // Revert state on error
       setWishlist(prev => new Set(prev).add(productId));
    }
  }, [currentUserId, isWishlisted, addToast, t]);


  return (
    <WishlistContext.Provider value={{ wishlist, loadWishlist, addToWishlist, removeFromWishlist, isWishlisted, clearWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};
