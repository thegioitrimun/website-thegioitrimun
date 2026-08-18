import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCart } from '../contexts/CartContext';
import { CloseIcon, MinusIcon, PlusIcon, ShoppingBagIcon, TrashIcon } from './icons';
import type { View } from '../types';

interface MiniCartProps {
    onNavigate: (view: View) => void;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const MiniCart: React.FC<MiniCartProps> = ({ onNavigate }) => {
    const { t, i18n } = useTranslation();
    const {
        isMiniCartOpen,
        closeMiniCart,
        cartItems,
        total,
        itemCount,
        updateItemQuantity,
        removeFromCart
    } = useCart();

    const [isRendered, setIsRendered] = useState(isMiniCartOpen);
    const previousBodyOverflowRef = useRef('');

    const restoreBodyScroll = useCallback(() => {
        document.body.style.overflow = previousBodyOverflowRef.current;
    }, []);

    const getLocalized = (obj: any, field: string): string => {
        if (!obj) return '';
        const lang = i18n.language;
        if (lang !== 'vi') {
            const v = obj[`${field}_${lang}`];
            if (v) return v;
        }
        return obj[field] || '';
    };

    useEffect(() => {
        if (isMiniCartOpen) {
            setIsRendered(true);
            previousBodyOverflowRef.current = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return restoreBodyScroll;
        } else {
            const timer = setTimeout(() => {
                setIsRendered(false);
                restoreBodyScroll();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isMiniCartOpen, restoreBodyScroll]);

    const handleNavigate = (view: View) => {
        closeMiniCart();
        restoreBodyScroll();
        onNavigate(view);
    };

    if (!isRendered) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-[100]"
            aria-labelledby="mini-cart-title"
            role="dialog"
            aria-modal="true"
        >
            <div
                className={`absolute inset-0 bg-transparent ${isMiniCartOpen ? 'drawer-overlay-enter' : 'drawer-overlay-exit'}`}
                onClick={closeMiniCart}
            ></div>

            <div className={`fixed inset-y-0 right-0 flex max-w-full pl-10 ${isMiniCartOpen ? 'drawer-slide-in-right' : 'drawer-slide-out-right'}`}>
                <div className="relative w-screen max-w-md">
                    <div className="flex h-full flex-col overflow-hidden bg-[rgba(255,255,255,0.7)] text-foreground shadow-[24px_0_48px_-12px_rgba(0,0,0,0.1)] backdrop-blur-2xl border-l border-white/60 dark:bg-[rgba(15,23,34,0.65)] dark:border-white/10 dark:shadow-[24px_0_48px_-12px_rgba(0,0,0,0.5)]">
                        <div className="flex items-center px-4 py-4 sm:px-6 border-b border-border relative">
                            <h2 id="mini-cart-title" className="text-lg font-bold text-foreground w-full text-center">{t('cart.title')} ({itemCount})</h2>
                            <button
                                type="button"
                                className="absolute right-4 sm:right-6 p-2 rounded-md text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
                                onClick={closeMiniCart}
                            >
                                <span className="sr-only">{t('cart.close')}</span>
                                <CloseIcon className="h-6 w-6" aria-hidden="true" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
                            {cartItems.length > 0 ? (
                                <ul role="list" className="-my-6 divide-y divide-border">
                                    {cartItems.map((item) => (
                                        <li key={item.id} className="flex py-6">
                                            <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-md border border-border">
                                                <img src={item.images?.[0]?.image_url} alt={getLocalized(item, 'name')} className="h-full w-full object-cover object-center" />
                                            </div>
                                            <div className="ml-4 flex flex-1 flex-col">
                                                <div>
                                                    <div className="flex justify-between text-base font-medium text-foreground">
                                                        <h3>{getLocalized(item, 'name')}</h3>
                                                        <p className="ml-4">{formatCurrency(item.price * item.quantity)}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-1 items-end justify-between text-sm">
                                                    <div className="flex items-center border border-input rounded-full p-1">
                                                        <button onClick={() => updateItemQuantity(item.id, item.quantity - 1)} className="p-1 rounded-full hover:bg-accent transition-colors btn-press" aria-label={t('cart.decrease')}><MinusIcon className="w-4 h-4" /></button>
                                                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                                                        <button onClick={() => updateItemQuantity(item.id, item.quantity + 1)} className="p-1 rounded-full hover:bg-accent transition-colors btn-press" aria-label={t('cart.increase')}><PlusIcon className="w-4 h-4" /></button>
                                                    </div>
                                                    <div className="flex">
                                                        <button type="button" onClick={() => removeFromCart(item.id)} className="font-medium text-primary hover:text-primary/80">{t('common.delete')}</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-center h-full flex flex-col justify-center items-center">
                                    <ShoppingBagIcon className="w-16 h-16 text-muted-foreground/50" />
                                    <p className="mt-4 text-muted-foreground">{t('cart.empty')}</p>
                                </div>
                            )}
                        </div>

                        {cartItems.length > 0 && (
                            <div className="px-4 py-6 sm:px-6">
                                <div className="flex justify-between text-base font-medium text-foreground">
                                    <p>{t('cart.total')}</p>
                                    <p>{formatCurrency(total)}</p>
                                </div>
                                <p className="mt-0.5 text-sm text-muted-foreground">{t('cart.shipping_note')}</p>
                                <div className="mt-6">
                                    <button onClick={() => handleNavigate({ page: 'checkout' })} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-8 rounded-full transition-all-smooth text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 btn-press">
                                        {t('cart.checkout')}
                                    </button>
                                </div>
                                <div className="mt-4 flex justify-center text-center text-sm text-muted-foreground">
                                    <p>{t('cart.or')}{' '}
                                        <button type="button" onClick={() => handleNavigate({ page: 'cart' })} className="font-medium text-primary hover:text-primary/80">
                                            {t('cart.view_detail')}<span aria-hidden="true"> &rarr;</span>
                                        </button>
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MiniCart;
