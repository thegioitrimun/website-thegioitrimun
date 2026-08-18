const LOCALES = new Set(['vi', 'en', 'ru', 'cn']);

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function money(value, locale) {
    const localeTag = locale === 'cn' ? 'zh-CN' : locale === 'ru' ? 'ru-RU' : locale === 'en' ? 'en-US' : 'vi-VN';
    return new Intl.NumberFormat(localeTag, { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
        .format(Number(value || 0));
}

const COPY = {
    vi: {
        created: 'Đơn hàng đã được tiếp nhận', processing: 'Đơn hàng đang được chuẩn bị', shipped: 'Đơn hàng đang được giao',
        completed: 'Đơn hàng đã giao thành công', cancelled: 'Đơn hàng đã hủy', refunded: 'Đơn hàng đã được hoàn tiền',
        appointment: 'Thông tin lịch hẹn', code: 'Mã đơn', total: 'Tổng thanh toán', status: 'Trạng thái', items: 'Sản phẩm',
        address: 'Địa chỉ nhận hàng', payment: 'Phương thức thanh toán', tracking: 'Tra cứu đơn hàng', review: 'Đánh giá sản phẩm',
        customer: 'Khách hàng', phone: 'Số điện thoại', unitPrice: 'Đơn giá', quantity: 'Số lượng', lineTotal: 'Thành tiền',
        productTax: 'Thuế sản phẩm', subtotal: 'Tạm tính', discount: 'Giảm giá', taxable: 'Giá tính thuế', tax: 'Thuế sản phẩm',
        shipping: 'Phí vận chuyển', shippingNet: 'Phí vận chuyển trước thuế', shippingTax: 'Thuế vận chuyển', sku: 'SKU',
        support: 'Cần hỗ trợ? Hãy trả lời trực tiếp email này.',
    },
    en: {
        created: 'Order received', processing: 'Order is being prepared', shipped: 'Order is on the way',
        completed: 'Order delivered', cancelled: 'Order cancelled', refunded: 'Order refunded',
        appointment: 'Appointment update', code: 'Order code', total: 'Total', status: 'Status', items: 'Items',
        address: 'Delivery address', payment: 'Payment method', tracking: 'Track order', review: 'Review products',
        customer: 'Customer', phone: 'Phone', unitPrice: 'Unit price', quantity: 'Quantity', lineTotal: 'Line total',
        productTax: 'Product tax', subtotal: 'Subtotal', discount: 'Discount', taxable: 'Taxable amount', tax: 'Product tax',
        shipping: 'Shipping fee', shippingNet: 'Shipping before tax', shippingTax: 'Shipping tax', sku: 'SKU',
        support: 'Need help? Reply directly to this email.',
    },
    ru: {
        created: 'Заказ принят', processing: 'Заказ готовится', shipped: 'Заказ отправлен',
        completed: 'Заказ доставлен', cancelled: 'Заказ отменен', refunded: 'Возврат оформлен',
        appointment: 'Информация о записи', code: 'Номер заказа', total: 'Итого', status: 'Статус', items: 'Товары',
        address: 'Адрес доставки', payment: 'Способ оплаты', tracking: 'Отследить заказ', review: 'Оценить товары',
        customer: 'Клиент', phone: 'Телефон', unitPrice: 'Цена за единицу', quantity: 'Количество', lineTotal: 'Сумма',
        productTax: 'Налог на товар', subtotal: 'Подытог', discount: 'Скидка', taxable: 'Налогооблагаемая сумма', tax: 'Налог на товар',
        shipping: 'Доставка', shippingNet: 'Доставка без налога', shippingTax: 'Налог на доставку', sku: 'SKU',
        support: 'Нужна помощь? Ответьте на это письмо.',
    },
    cn: {
        created: '订单已收到', processing: '订单准备中', shipped: '订单配送中',
        completed: '订单已送达', cancelled: '订单已取消', refunded: '订单已退款',
        appointment: '预约更新', code: '订单号', total: '总计', status: '状态', items: '商品',
        address: '收货地址', payment: '支付方式', tracking: '查询订单', review: '评价商品',
        customer: '客户', phone: '电话', unitPrice: '单价', quantity: '数量', lineTotal: '金额',
        productTax: '商品税', subtotal: '小计', discount: '折扣', taxable: '计税金额', tax: '商品税',
        shipping: '运费', shippingNet: '税前运费', shippingTax: '运费税', sku: 'SKU',
        support: '需要帮助？请直接回复此邮件。',
    },
};

function frame(title, inner, support) {
    return `<!doctype html><html><body style="margin:0;padding:0;background:#f3f7f5;font-family:Arial,Helvetica,sans-serif;color:#172033"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f7f5"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:760px"><tr><td style="padding:8px 8px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td><div style="color:#218b76;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Thế Giới Trị Mụn</div><div style="color:#667085;font-size:13px;margin-top:5px">Chăm sóc da có cơ sở</div></td><td align="right" style="color:#218b76;font-size:24px;font-weight:700">TG</td></tr></table></td></tr><tr><td style="background:#fff;border:1px solid #dce6e2;border-radius:22px;overflow:hidden"><div style="height:6px;background:#218b76;font-size:0;line-height:0">&nbsp;</div><div style="padding:30px 28px 26px"><h1 style="margin:0 0 24px;font-size:30px;line-height:1.2;letter-spacing:-.3px">${escapeHtml(title)}</h1>${inner}<p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #e8efec;color:#667085;font-size:13px;line-height:1.6">${escapeHtml(support)}</p></div></td></tr><tr><td align="center" style="padding:18px 8px 4px;color:#98a2b3;font-size:12px">Thế Giới Trị Mụn · thegioitrimun.vn</td></tr></table></td></tr></table></body></html>`;
}

function percent(value) {
    const rate = Number(value || 0);
    if (!Number.isFinite(rate) || rate <= 0) return '0%';
    return `${Number.isInteger(rate * 100) ? rate * 100 : (rate * 100).toFixed(2)}%`;
}

function imageUrl(value) {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    if (/^https?:\/\//i.test(normalized)) return normalized;
    if (normalized.startsWith('/')) return `https://thegioitrimun.vn${normalized}`;
    return `https://thegioitrimun.vn/r2/product-images/${normalized.replace(/^\/+/, '')}`;
}

function productImage(item) {
    const url = imageUrl(item.image_url || item.image_path);
    if (!url) return '<div style="width:64px;height:64px;border-radius:12px;background:#e8f2ef;color:#218b76;text-align:center;line-height:64px;font-size:12px;font-weight:700">TGTM</div>';
    return `<img src="${escapeHtml(url)}" width="64" height="64" alt="${escapeHtml(item.name || 'Sản phẩm')}" style="display:block;width:64px;height:64px;object-fit:cover;border-radius:12px;border:1px solid #e4ece9;background:#f3f7f5">`;
}

function summaryRow(label, value, emphasis = false) {
    return `<tr><td style="padding:7px 0;color:#667085;font-size:14px;line-height:1.4">${escapeHtml(label)}</td><td align="right" style="padding:7px 0;color:${emphasis ? '#218b76' : '#172033'};font-size:${emphasis ? '20px' : '14px'};line-height:1.4;font-weight:${emphasis ? '700' : '600'}">${escapeHtml(value)}</td></tr>`;
}

export function renderEmail(eventType, payload, requestedLocale) {
    const locale = LOCALES.has(requestedLocale) ? requestedLocale : 'vi';
    const copy = COPY[locale];
    const key = String(eventType || '').split('.')[1] || 'created';
    if (eventType === 'order.lookup_otp') {
        const titles = {
            vi: 'Mã xác minh tra cứu đơn hàng',
            en: 'Order lookup verification code',
            ru: 'Код подтверждения заказа',
            cn: '订单查询验证码',
        };
        const descriptions = {
            vi: 'Dùng mã này để xem đơn hàng của bạn. Không chia sẻ mã với người khác.',
            en: 'Use this code to view your order. Do not share it with anyone.',
            ru: 'Используйте этот код для просмотра заказа. Никому не сообщайте его.',
            cn: '使用此验证码查看订单，请勿向他人透露。',
        };
        const expiry = {
            vi: `Mã hết hạn sau ${Number(payload.expires_minutes || 10)} phút.`,
            en: `The code expires in ${Number(payload.expires_minutes || 10)} minutes.`,
            ru: `Код действует ${Number(payload.expires_minutes || 10)} минут.`,
            cn: `验证码将在 ${Number(payload.expires_minutes || 10)} 分钟后过期。`,
        };
        const title = titles[locale];
        const body = `<p>${escapeHtml(descriptions[locale])}</p><p style="margin:24px 0;font-size:34px;font-weight:800;letter-spacing:.2em">${escapeHtml(payload.otp)}</p><p>${escapeHtml(expiry[locale])}</p><p><strong>${escapeHtml(copy.code)}:</strong> ${escapeHtml(payload.order_code || '')}</p>`;
        return { subject: title, html: frame(title, body, copy.support) };
    }
    if (eventType === 'admin.report') {
        const title = `Báo cáo ${escapeHtml(payload.report_name || payload.preset || '')}`;
        const productRows = (payload.top_products || []).map((item) => `<li>${escapeHtml(item.name)}: ${escapeHtml(item.quantity)} sản phẩm · ${escapeHtml(money(item.revenue, locale))}</li>`).join('');
        const provinceRows = (payload.top_provinces || []).map((item) => `<li>${escapeHtml(item.province)}: ${escapeHtml(item.order_count)} đơn · ${escapeHtml(money(item.revenue, locale))}</li>`).join('');
        const body = `<p><strong>${escapeHtml(payload.period_start)}</strong> – <strong>${escapeHtml(payload.period_end)}</strong></p>
            <p>Đơn hàng: <strong>${escapeHtml(payload.order_count)}</strong> · Doanh thu sản phẩm: <strong>${escapeHtml(money(payload.product_revenue, locale))}</strong></p>
            <p>Lịch dịch vụ: <strong>${escapeHtml(payload.appointment_count)}</strong> · Doanh thu dịch vụ: <strong>${escapeHtml(money(payload.service_revenue, locale))}</strong></p>
            <h2 style="font-size:17px">5 sản phẩm bán chạy</h2><ol>${productRows}</ol>
            <h2 style="font-size:17px">5 địa phương nhiều đơn</h2><ol>${provinceRows}</ol>`;
        return { subject: title, html: frame(title, body, copy.support) };
    }
    if (eventType.startsWith('appointment.')) {
        const title = `${copy.appointment}: ${escapeHtml(payload.status || key)}`;
        const body = `<p><strong>${escapeHtml(payload.service_name || '')}</strong></p><p>${escapeHtml(payload.date || '')} ${escapeHtml(payload.time || '')}</p>`;
        return { subject: title, html: frame(title, body, copy.support) };
    }

    const title = copy[key] || copy.created;
    const items = Array.isArray(payload.items) ? payload.items : [];
    const rows = items.map((item) => {
        const quantity = Number(item.quantity || 0);
        const unitPrice = Number(item.price_at_purchase || 0);
        const lineTotal = Number(item.line_total ?? unitPrice * quantity);
        const lineTax = Number(item.tax_amount || 0);
        const sku = item.sku ? `<div style="margin-top:4px;color:#98a2b3;font-size:12px">${escapeHtml(copy.sku)}: ${escapeHtml(item.sku)}</div>` : '';
        const tax = lineTax > 0
            ? `<div style="margin-top:5px;color:#667085;font-size:12px">${escapeHtml(copy.productTax)} ${escapeHtml(percent(item.vat_rate))}: ${escapeHtml(money(lineTax, locale))}</div>`
            : '';
        return `<tr><td style="padding:15px 0;border-bottom:1px solid #e8efec"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="76" valign="top" style="padding-right:12px">${productImage(item)}</td><td valign="top" style="padding-right:10px"><div style="font-size:15px;line-height:1.4;font-weight:700;color:#172033">${escapeHtml(item.name || `#${item.product_id}`)}</div>${sku}<div style="margin-top:7px;color:#667085;font-size:13px;line-height:1.5">${escapeHtml(copy.unitPrice)}: ${escapeHtml(money(unitPrice, locale))} · ${escapeHtml(copy.quantity)}: ${escapeHtml(quantity)}</div>${tax}</td><td width="125" valign="top" align="right" style="font-size:15px;line-height:1.4;font-weight:700;color:#172033">${escapeHtml(money(lineTotal, locale))}</td></tr></table></td></tr>`;
    }).join('');
    const tracking = payload.tracking_code ? `<div style="margin:14px 0;padding:12px 14px;border-radius:12px;background:#eef8f5;color:#218b76;font-size:14px"><strong>GHTK:</strong> ${escapeHtml(payload.tracking_code)}</div>` : '';
    const reasonText = payload.reason || payload.cancellation_reason;
    const reason = reasonText ? `<div style="margin:14px 0;padding:12px 14px;border-radius:12px;background:#fff6f3;color:#c65d45;font-size:14px"><strong>${escapeHtml(copy.status)}:</strong> ${escapeHtml(reasonText)}</div>` : '';
    const refund = payload.refund_amount ? `<div style="margin:14px 0;padding:12px 14px;border-radius:12px;background:#eef8f5;color:#218b76;font-size:14px"><strong>${escapeHtml(copy.refunded)}:</strong> ${escapeHtml(money(payload.refund_amount, locale))}</div>` : '';
    const address = payload.shipping_address ? `<div style="padding:14px 16px;border-radius:14px;background:#f7faf9"><div style="margin-bottom:5px;color:#667085;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.7px">${escapeHtml(copy.address)}</div><div style="color:#172033;font-size:14px;line-height:1.55">${escapeHtml(payload.shipping_address)}</div></div>` : '';
    const paymentLabels = { cod: 'COD', bank_transfer: locale === 'en' ? 'Bank transfer' : locale === 'cn' ? '银行转账' : locale === 'ru' ? 'Банковский перевод' : 'Chuyển khoản ngân hàng' };
    const paymentValue = paymentLabels[payload.payment_method] || payload.payment_method;
    const payment = payload.payment_method ? `<div style="padding:14px 16px;border-radius:14px;background:#f7faf9"><div style="margin-bottom:5px;color:#667085;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.7px">${escapeHtml(copy.payment)}</div><div style="color:#172033;font-size:14px;font-weight:700">${escapeHtml(paymentValue)}</div></div>` : '';
    const trackingUrl = escapeHtml(payload.tracking_url || 'https://thegioitrimun.vn/tra-cuu-don-hang');
    const actionLabel = key === 'completed' ? copy.review : copy.tracking;
    const action = ['created', 'processing', 'shipped', 'completed'].includes(key)
        ? `<p style="margin:24px 0 0"><a href="${trackingUrl}" style="display:inline-block;padding:13px 22px;border-radius:999px;background:#218b76;color:#fff;text-decoration:none;font-weight:700;font-size:14px">${escapeHtml(actionLabel)}</a></p>`
        : '';
    const customer = payload.customer_name || payload.customer_phone
        ? `<div style="margin:0 0 18px"><div style="color:#667085;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.7px">${escapeHtml(copy.customer)}</div><div style="margin-top:5px;color:#172033;font-size:15px;font-weight:700">${escapeHtml(payload.customer_name || '')}</div>${payload.customer_phone ? `<div style="margin-top:3px;color:#667085;font-size:13px">${escapeHtml(copy.phone)}: ${escapeHtml(payload.customer_phone)}</div>` : ''}</div>`
        : '';
    const detailGrid = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px"><tr><td width="49%" valign="top" style="padding-right:6px">${address}</td><td width="49%" valign="top" style="padding-left:6px">${payment}</td></tr></table>`;
    const summaryRows = [
        summaryRow(copy.subtotal, money(payload.subtotal_price ?? payload.total_price, locale)),
        Number(payload.discount_amount || 0) > 0 ? summaryRow(copy.discount, `- ${money(payload.discount_amount, locale)}`) : '',
        summaryRow(copy.taxable, money(payload.taxable_amount ?? payload.subtotal_price ?? 0, locale)),
        summaryRow(`${copy.tax} (${percent(payload.tax_rate)})`, money(payload.tax_amount, locale)),
        summaryRow(copy.shipping, money(payload.shipping_fee, locale)),
        Number(payload.shipping_tax_amount || 0) > 0 ? summaryRow(`${copy.shippingTax} (${percent(payload.shipping_tax_rate)})`, money(payload.shipping_tax_amount, locale)) : '',
    ].join('');
    const inner = `<div style="margin-bottom:24px;padding:16px 18px;border:1px solid #e4ece9;border-radius:16px;background:#fbfdfc"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td><div style="color:#667085;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.7px">${escapeHtml(copy.code)}</div><div style="margin-top:5px;color:#218b76;font-size:18px;font-weight:700">${escapeHtml(payload.order_code || payload.order_id)}</div></td><td align="right" valign="top"><div style="display:inline-block;padding:6px 10px;border-radius:999px;background:#e7f5ef;color:#218b76;font-size:12px;font-weight:700">${escapeHtml(title)}</div></td></tr></table></div>${customer}${detailGrid}${tracking}${reason}${refund}<h2 style="margin:26px 0 10px;font-size:18px;line-height:1.3;color:#172033">${escapeHtml(copy.items)}</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 0 8px;color:#98a2b3;font-size:12px;text-transform:uppercase;letter-spacing:.6px">${escapeHtml(copy.items)}</td><td align="right" style="padding:0 0 8px;color:#98a2b3;font-size:12px;text-transform:uppercase;letter-spacing:.6px">${escapeHtml(copy.lineTotal)}</td></tr>${rows}</table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;padding-top:10px;border-top:1px solid #dce6e2">${summaryRows}<tr><td colspan="2" style="padding-top:12px;border-top:1px solid #e8efec">&nbsp;</td></tr>${summaryRow(copy.total, money(payload.grand_total ?? payload.total_price, locale), true)}</table>${action}`;
    return { subject: `${title} - ${payload.order_code || payload.order_id}`, html: frame(title, inner, copy.support) };
}
