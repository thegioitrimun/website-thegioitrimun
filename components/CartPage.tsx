import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCart } from '../contexts/CartContext';
import { ArrowLeftIcon, MinusIcon, PlusIcon, ShoppingBagIcon, TrashIcon } from './icons';

interface CartPageProps {
    onNavigate: (view: { page: 'products' } | { page: 'checkout' }) => void;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const CartPage: React.FC<CartPageProps> = ({ onNavigate }) => {
    const { t, i18n } = useTranslation();
    const {
        cartItems,
        updateItemQuantity,
        removeFromCart,
        subtotal,
        total,
        discountAmount,
        appliedDiscount,
        removeDiscount,
        applyDiscountCode
    } = useCart();

    const [discountCode, setDiscountCode] = useState('');
    const [isApplying, setIsApplying] = useState(false);

    const getLocalized = (obj: any, field: string): string => {
        if (!obj) return '';
        const lang = i18n.language;
        if (lang !== 'vi') {
            const v = obj[`${field}_${lang}`];
            if (v) return v;
        }
        return obj[field] || '';
    };

    const handleApplyDiscount = async () => {
        if (!discountCode.trim()) return;
        setIsApplying(true);
        await applyDiscountCode(discountCode);
        setIsApplying(false);
    };

    return (
        <div className="bg-background text-foreground transition-colors duration-300 animate-scale-in">
            <div className="container mx-auto px-6 py-12">
                <div className="mb-8">
                    <button onClick={() => onNavigate({ page: 'products' })} className="flex items-center text-muted-foreground hover:text-primary transition-colors mb-4 btn-press">
                        <ArrowLeftIcon className="w-5 h-5 mr-2" />
                        <span>{t('cart.continue_shopping')}</span>
                    </button>
                    <h1 className="text-4xl md:text-5xl font-bold text-foreground font-heading">{t('cart.your_cart')}</h1>
                </div>

                {cartItems.length === 0 ? (
                    <div className="text-center py-20 bg-card rounded-xl border border-border">
                        <ShoppingBagIcon className="w-20 h-20 mx-auto text-muted-foreground/50" />
                        <h2 className="mt-6 text-2xl font-semibold text-muted-foreground">{t('cart.empty')}</h2>
                        <p className="mt-2 text-muted-foreground">{t('cart.empty_desc')}</p>
                        <button onClick={() => onNavigate({ page: 'products' })} className="mt-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-8 rounded-full transition-all-smooth text-lg shadow-md hover:shadow-lg transform hover:-translate-y-1 btn-press">
                            {t('cart.explore')}
                        </button>
                    </div>
                ) : (
                    <div className="grid lg:grid-cols-12 gap-12">
                        {/* Cart Items */}
                        <div className="lg:col-span-8">
                            <div className="space-y-4">
                                {cartItems.map(item => (
                                    <div key={item.id} className="bg-card p-4 rounded-lg border border-border flex items-center gap-4">
                                        <img src={item.images?.[0]?.image_url} alt={getLocalized(item, 'name')} className="w-24 h-24 object-cover rounded-md flex-shrink-0" />
                                        <div className="flex-grow">
                                            <h3 className="font-bold text-foreground">{getLocalized(item, 'name')}</h3>
                                            <p className="text-sm text-muted-foreground">{formatCurrency(item.price)}</p>
                                            <div className="flex items-center border border-input rounded-full p-1 mt-2 w-fit">
                                                <button onClick={() => updateItemQuantity(item.id, item.quantity - 1)} className="p-1 rounded-full hover:bg-accent transition-colors btn-press" aria-label={t('cart.decrease')}>
                                                    <MinusIcon className="w-4 h-4" />
                                                </button>
                                                <span className="w-10 text-center font-semibold text-sm">{item.quantity}</span>
                                                <button onClick={() => updateItemQuantity(item.id, item.quantity + 1)} className="p-1 rounded-full hover:bg-accent transition-colors btn-press" aria-label={t('cart.increase')}>
                                                    <PlusIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-foreground mb-2">{formatCurrency(item.price * item.quantity)}</p>
                                            <button onClick={() => removeFromCart(item.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors" aria-label={`${t('common.delete')} ${getLocalized(item, 'name')}`}>
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Summary */}
                        <div className="lg:col-span-4">
                            <div className="bg-card p-6 rounded-xl border border-border shadow-lg sticky top-28">
                                <h2 className="text-xl font-bold text-foreground mb-4">{t('cart.summary')}</h2>

                                <div className="mb-4">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={discountCode}
                                            onChange={(e) => setDiscountCode(e.target.value)}
                                            placeholder={t('cart.discount_placeholder')}
                                            className="w-full p-2 border border-input rounded-md bg-background text-sm"
                                            disabled={!!appliedDiscount}
                                        />
                                        {appliedDiscount ? (
                                            <button onClick={removeDiscount} className="text-sm font-semibold text-red-500 hover:text-red-700 whitespace-nowrap">{t('cart.remove_code')}</button>
                                        ) : (
                                            <button onClick={handleApplyDiscount} disabled={isApplying || !discountCode.trim()} className="bg-secondary text-secondary-foreground font-bold py-2 px-4 rounded-md text-sm disabled:opacity-50">
                                                {isApplying ? '...' : t('cart.apply')}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3 mb-6">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('cart.subtotal')}</span>
                                        <span className="font-semibold">{formatCurrency(subtotal)}</span>
                                    </div>
                                    {appliedDiscount && (
                                        <div className="flex justify-between text-green-600 dark:text-green-400">
                                            <span className="text-muted-foreground">{t('cart.discount')} ({appliedDiscount.code})</span>
                                            <span className="font-semibold">- {formatCurrency(discountAmount)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('cart.shipping')}</span>
                                        <span className="font-semibold">{t('cart.free')}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between font-bold text-lg pt-4 border-t border-border">
                                    <span>{t('cart.total')}</span>
                                    <span className="text-primary">{formatCurrency(total)}</span>
                                </div>
                                <button onClick={() => onNavigate({ page: 'checkout' })} className="mt-6 w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-8 rounded-full transition-all-smooth text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 btn-press">
                                    {t('cart.checkout')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CartPage;
