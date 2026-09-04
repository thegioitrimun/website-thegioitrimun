import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProductOrder, SepayPaymentStatus } from '../types';
import * as api from '../services/api';
import { CloseIcon } from './icons';
import Spinner from './Spinner';

interface SepayPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPaid: (status: SepayPaymentStatus) => Promise<void> | void;
    order: ProductOrder | null;
}

const POLL_INTERVAL_MS = 3000;

const formatCurrency = (amount: number) => (
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
);

const formatCountdown = (seconds: number) => {
    const safe = Math.max(0, seconds);
    const minutes = Math.floor(safe / 60).toString().padStart(2, '0');
    const remainder = (safe % 60).toString().padStart(2, '0');
    return `${minutes}:${remainder}`;
};

const SepayPaymentModal: React.FC<SepayPaymentModalProps> = ({ isOpen, onClose, onPaid, order }) => {
    const { t } = useTranslation();
    const payment = order?.payment;
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [isChecking, setIsChecking] = useState(false);
    const [pollError, setPollError] = useState(false);
    const [qrLoadFailed, setQrLoadFailed] = useState(false);
    const [isPaid, setIsPaid] = useState(false);
    const activeRef = useRef(false);
    const inFlightRef = useRef(false);
    const completedRef = useRef(false);

    useEffect(() => {
        activeRef.current = isOpen;
        completedRef.current = false;
        setIsPaid(false);
        setPollError(false);
        setQrLoadFailed(false);
        return () => { activeRef.current = false; };
    }, [isOpen, order?.id]);

    useEffect(() => {
        if (!isOpen || !payment?.expires_at) return;
        const update = () => {
            const remaining = Math.ceil((Date.parse(payment.expires_at) - Date.now()) / 1000);
            if (activeRef.current) setSecondsLeft(Math.max(0, remaining));
        };
        update();
        const timer = window.setInterval(update, 1000);
        return () => window.clearInterval(timer);
    }, [isOpen, payment?.expires_at]);

    const checkPayment = useCallback(async (showLoading = false): Promise<boolean> => {
        if (!order || !payment || inFlightRef.current || completedRef.current) return completedRef.current;
        inFlightRef.current = true;
        if (showLoading && activeRef.current) setIsChecking(true);
        try {
            const status = await api.getSepayPaymentStatus(order.id, payment.status_token);
            if (!activeRef.current) return false;
            setPollError(false);
            if (status.status === 'paid') {
                completedRef.current = true;
                setIsPaid(true);
                await onPaid(status);
                return true;
            }
            return false;
        } catch (error) {
            console.warn('Could not check SePay payment status:', error);
            if (activeRef.current) setPollError(true);
            return false;
        } finally {
            inFlightRef.current = false;
            if (activeRef.current) setIsChecking(false);
        }
    }, [onPaid, order, payment]);

    useEffect(() => {
        if (!isOpen || !order || !payment) return;
        let cancelled = false;
        let timer: number | undefined;
        const poll = async () => {
            const completed = await checkPayment(false);
            if (cancelled || completed || completedRef.current) return;
            const expired = Date.parse(payment.expires_at) <= Date.now();
            if (!expired) timer = window.setTimeout(poll, POLL_INTERVAL_MS);
        };
        void poll();
        return () => {
            cancelled = true;
            if (timer) window.clearTimeout(timer);
        };
    }, [checkPayment, isOpen, order, payment]);

    if (!isOpen || !order || !payment) return null;

    const expired = secondsLeft <= 0;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/65 p-4 animate-fade-in"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sepay-payment-title"
        >
            <div
                className="my-auto flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl animate-scale-in"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">SePay</p>
                        <h2 id="sepay-payment-title" className="mt-1 text-xl font-bold text-foreground">
                            {t('payment.title', 'Thanh toán QR tự động')}
                        </h2>
                    </div>
                    <button onClick={onClose} className="rounded-full p-2 hover:bg-accent" aria-label={t('common.close', 'Đóng')}>
                        <CloseIcon className="h-6 w-6" />
                    </button>
                </div>

                <div className="grid gap-6 p-5 sm:grid-cols-[220px_1fr] sm:p-6">
                    <div className="text-center">
                        <div className="mx-auto flex min-h-[220px] w-[220px] items-center justify-center overflow-hidden rounded-2xl border border-border bg-white p-2">
                            {qrLoadFailed ? (
                                <p className="px-4 text-sm text-slate-600">
                                    {t('payment.qr_error', 'Không tải được QR. Vui lòng chuyển khoản bằng thông tin bên cạnh.')}
                                </p>
                            ) : (
                                <img
                                    src={payment.qr_url}
                                    alt={t('payment.qr_alt', 'Mã QR thanh toán SePay')}
                                    width="204"
                                    height="204"
                                    className="h-auto w-full"
                                    onError={() => setQrLoadFailed(true)}
                                />
                            )}
                        </div>
                        <div className={`mt-3 rounded-full px-3 py-2 text-sm font-bold ${expired ? 'bg-amber-100 text-amber-800' : 'bg-primary/10 text-primary'}`}>
                            {expired
                                ? t('payment.qr_expired', 'QR đã hết thời gian chờ')
                                : `${t('payment.qr_expires_in', 'Thời gian còn lại')}: ${formatCountdown(secondsLeft)}`}
                        </div>
                    </div>

                    <div className="space-y-4 text-sm">
                        <p className="leading-6 text-muted-foreground">
                            {t('payment.scan_qr_prompt', 'Quét QR bằng ứng dụng ngân hàng. Hệ thống sẽ tự xác nhận ngay khi tiền vào tài khoản.')}
                        </p>

                        <dl className="space-y-3 rounded-2xl bg-muted/40 p-4">
                            <div>
                                <dt className="text-xs text-muted-foreground">{t('payment.bank', 'Ngân hàng')}</dt>
                                <dd className="mt-0.5 font-bold text-foreground">{payment.bank.name || payment.bank.code}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground">{t('payment.account_number', 'Số tài khoản')}</dt>
                                <dd className="mt-0.5 break-all font-mono font-bold text-foreground">{payment.bank.account_number}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground">{t('payment.account_holder', 'Chủ tài khoản')}</dt>
                                <dd className="mt-0.5 font-bold text-foreground">{payment.bank.account_holder_name}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground">{t('payment.amount', 'Số tiền')}</dt>
                                <dd className="mt-0.5 text-lg font-black text-primary">{formatCurrency(payment.amount)}</dd>
                            </div>
                        </dl>

                        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 text-center">
                            <p className="text-xs text-muted-foreground">{t('payment.transfer_content', 'Nội dung chuyển khoản bắt buộc')}</p>
                            <p className="mt-1 break-all font-mono text-lg font-black tracking-wide text-primary">{payment.reference}</p>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className={`h-2.5 w-2.5 rounded-full ${pollError ? 'bg-amber-500' : isPaid ? 'bg-emerald-500' : 'bg-primary animate-pulse'}`} />
                            {isPaid
                                ? t('payment.paid', 'Đã nhận thanh toán')
                                : pollError
                                    ? t('payment.reconnecting', 'Đang kết nối lại để kiểm tra giao dịch…')
                                    : t('payment.waiting', 'Đang chờ SePay xác nhận tiền vào…')}
                        </div>
                    </div>
                </div>

                <div className="border-t border-border bg-muted/25 p-4 sm:px-6">
                    <button
                        type="button"
                        onClick={() => { void checkPayment(true); }}
                        disabled={isChecking || isPaid}
                        className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isChecking ? <><Spinner /> {t('payment.checking', 'Đang kiểm tra…')}</> : t('payment.check_now', 'Tôi đã thanh toán – kiểm tra ngay')}
                    </button>
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                        {t('payment.no_manual_confirmation', 'Đơn chỉ được ghi nhận đã thanh toán sau khi SePay xác nhận giao dịch ngân hàng.')}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SepayPaymentModal;
