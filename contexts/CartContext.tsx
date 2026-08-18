import React, { createContext, useState, useEffect, useContext, ReactNode, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product, CartItem, DiscountCode } from '../types';
import { useToast } from '../hooks/useToast';
import { createDeferredFunctionProxy, getSupabaseClient, loadApiModule } from '../services/runtimeLoaders';

const api = createDeferredFunctionProxy<typeof import('../services/api')>(loadApiModule);

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product, quantity: number) => void;
  updateItemQuantity: (productId: number, quantity: number) => void;
  removeFromCart: (productId: number) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
  isMiniCartOpen: boolean;
  openMiniCart: () => void;
  closeMiniCart: () => void;
  appliedDiscount: DiscountCode | null;
  applyDiscountCode: (code: string) => Promise<boolean>;
  removeDiscount: () => void;
  discountAmount: number;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const item = window.localStorage.getItem('iskin-cart');
      return item ? JSON.parse(item) : [];
    } catch (error) {
      console.error("Failed to parse cart from localStorage", error);
      return [];
    }
  });
  
  const [isMiniCartOpen, setIsMiniCartOpen] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountCode | null>(null);
  const { addToast } = useToast();

  useEffect(() => {
    try {
      window.localStorage.setItem('iskin-cart', JSON.stringify(cartItems));
    } catch (error) {
      console.error("Failed to save cart to localStorage", error);
    }
  }, [cartItems]);

  const openMiniCart = () => setIsMiniCartOpen(true);
  const closeMiniCart = () => setIsMiniCartOpen(false);

  const addToCart = (product: Product, quantity: number) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === product.id);
      if (existingItem) {
        return prevItems.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prevItems, { ...product, quantity }];
    });

    void api.trackFunnelEvent('add_to_cart', {
      product_id: product.id,
      quantity,
      unit_price: product.price,
    });

    openMiniCart();
  };

  const updateItemQuantity = (productId: number, quantity: number) => {
    setCartItems(prevItems => {
        if (quantity <= 0) {
            return prevItems.filter(item => item.id !== productId);
        }
        return prevItems.map(item =>
            item.id === productId ? { ...item, quantity } : item
        );
    });
  };

  const removeFromCart = (productId: number) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== productId));
  };

  const clearCart = () => {
    setCartItems([]);
    setAppliedDiscount(null);
  };

  const itemCount = useMemo(() => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  }, [cartItems]);

  const subtotal = useMemo(() => {
      return cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
  }, [cartItems]);
  
  const applyDiscountCode = useCallback(async (code: string): Promise<boolean> => {
    try {
        let userId: string | null = null;
        if (await api.isD1BackendEnabled()) {
          const session = await api.getCurrentAuthSession();
          userId = session?.id || null;
        } else {
          const supabase = await getSupabaseClient();
          const { data: userData } = await supabase.auth.getUser();
          userId = userData.user?.id || null;
        }
        const discount = await api.getDiscountCode(code, subtotal, userId);
        setAppliedDiscount(discount);

        void api.trackFunnelEvent('apply_discount_code', {
            code: discount.code,
            subtotal,
        });

        addToast(t('cart.discount_applied_title', 'Thành công'), {
          type: 'success',
          description: t('cart.discount_applied_desc', { code: discount.code, defaultValue: `Đã áp dụng mã giảm giá ${discount.code}.` }),
        });
        return true;
    } catch (error: any) {
        setAppliedDiscount(null);

        void api.trackFunnelEvent('apply_discount_code_failed', {
            code: code.trim().toUpperCase(),
            subtotal,
            reason: error?.message || 'unknown_error',
        });

        addToast(t('common.error'), { type: 'error', description: error.message });
        return false;
    }
  }, [addToast, subtotal, t]);
  
  const removeDiscount = useCallback(() => {
    setAppliedDiscount(null);
    addToast(t('cart.discount_removed', 'Đã xóa mã giảm giá'), { type: 'info' });
  }, [addToast, t]);

  useEffect(() => {
    if (!appliedDiscount?.min_purchase_amount) return;
    if (subtotal < appliedDiscount.min_purchase_amount) {
      setAppliedDiscount(null);
      addToast(t('cart.discount_removed_min_purchase', 'Mã giảm giá đã được gỡ vì đơn hàng chưa đạt giá trị tối thiểu.'), { type: 'info' });
    }
  }, [appliedDiscount, subtotal, addToast, t]);
  
  const { discountAmount, total } = useMemo(() => {
    if (!appliedDiscount || subtotal === 0) {
        return { discountAmount: 0, total: subtotal };
    }
    
    let discountValue = 0;
    if (appliedDiscount.type === 'percentage') {
        discountValue = subtotal * (appliedDiscount.value / 100);
    } else { // fixed_amount
        discountValue = appliedDiscount.value;
    }

    if (appliedDiscount.max_discount_amount) {
        discountValue = Math.min(discountValue, appliedDiscount.max_discount_amount);
    }
    
    // Ensure discount doesn't exceed subtotal
    const finalDiscountAmount = Math.min(discountValue, subtotal);
    const finalTotal = subtotal - finalDiscountAmount;

    return { discountAmount: finalDiscountAmount, total: finalTotal };

  }, [appliedDiscount, subtotal]);


  return (
    <CartContext.Provider value={{ 
        cartItems, addToCart, updateItemQuantity, removeFromCart, clearCart, 
        itemCount, subtotal, isMiniCartOpen, openMiniCart, closeMiniCart,
        appliedDiscount, applyDiscountCode, removeDiscount, discountAmount, total
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
