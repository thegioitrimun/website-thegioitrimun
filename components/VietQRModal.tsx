import React from 'react';
import type { ProductOrder, PaymentSettings } from '../types';
import { CloseIcon } from './icons';
import Spinner from './Spinner';
import { useTranslation } from 'react-i18next';

interface VietQRModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    order: ProductOrder | null;
    paymentSettings: PaymentSettings | null;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const VietQRModal: React.FC<VietQRModalProps> = ({ isOpen, onClose, onConfirm, order, paymentSettings }) => {
    const { t } = useTranslation();
    if (!isOpen || !order || !paymentSettings) return null;

    const { bank_bin, account_number, account_holder_name } = paymentSettings;
    const amount = order.total_price;
    const description = encodeURIComponent(order.order_code || `Thanh toan don hang ${order.id.substring(0, 6)}`);
    const accountName = encodeURIComponent(account_holder_name);

    const qrCodeUrl = `https://api.vietqr.io/image/${bank_bin}-${account_number}-print.png?amount=${amount}&addInfo=${description}&accountName=${accountName}`;

    return (
        <div
            className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-fade-in"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="bg-card rounded-2xl shadow-xl w-full max-w-md m-auto animate-scale-in flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-4 border-b border-border">
                    <h2 className="text-xl font-bold text-foreground">{t('payment.bank_transfer', 'Thanh toán chuyển khoản')}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-accent"><CloseIcon className="w-6 h-6" /></button>
                </div>

                <div className="p-6 text-center flex-grow">
                    <p className="text-muted-foreground mb-4">{t('payment.scan_qr_prompt', 'Vui lòng quét mã QR dưới đây để hoàn tất thanh toán.')}</p>
                    <div className="bg-white p-4 rounded-lg inline-block border border-border">
                        {qrCodeUrl ?
                            <img src={qrCodeUrl} alt="VietQR Code" width="250" height="250" />
                            : <div className="w-[250px] h-[250px] flex items-center justify-center"><Spinner /></div>
                        }
                    </div>

                    <div className="text-left mt-6 space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('payment.bank', 'Ngân hàng:')}</span>
                            <span className="font-semibold">{bank_bin === '970436' ? 'Vietcombank' : (bank_bin === '970415' ? 'Vietinbank' : t('payment.default_bank', 'Ngân hàng'))}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('payment.account_holder', 'Chủ tài khoản:')}</span>
                            <span className="font-semibold">{account_holder_name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('payment.account_number', 'Số tài khoản:')}</span>
                            <span className="font-semibold">{account_number}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('payment.amount', 'Số tiền:')}</span>
                            <span className="font-bold text-primary text-base">{formatCurrency(amount)}</span>
                        </div>
                        <div className="p-3 bg-primary/10 rounded-md text-center">
                            <p className="text-muted-foreground text-xs">{t('payment.transfer_content', 'Nội dung chuyển khoản (bắt buộc):')}</p>
                            <p className="font-bold text-lg text-primary tracking-wider">{order.order_code}</p>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-muted/30 rounded-b-2xl">
                    <button
                        onClick={onConfirm}
                        className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-full hover:bg-primary/90 transition-colors"
                    >
                        {t('payment.confirm_and_complete', 'Xác nhận & Hoàn tất')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VietQRModal;
