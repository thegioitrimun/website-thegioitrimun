import { connect } from 'cloudflare:sockets';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64Utf8(value) {
    const bytes = encoder.encode(String(value || ''));
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
}

function encodedWord(value) {
    return `=?UTF-8?B?${base64Utf8(value)}?=`;
}

function sanitizeHeader(value) {
    return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

function normalizeAddress(value) {
    const address = String(value || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error('Invalid email address.');
    return address;
}

function formatMailbox(name, address) {
    return name ? `${encodedWord(sanitizeHeader(name))} <${normalizeAddress(address)}>` : normalizeAddress(address);
}

function dotStuff(value) {
    return String(value || '').replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
}

function withTimeout(promise, timeoutMs, phase) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(Object.assign(new Error(`SMTP timeout during ${phase}.`), { phase })), timeoutMs);
        }),
    ]).finally(() => clearTimeout(timer));
}

class SmtpProtocol {
    constructor(socket, timeoutMs = 12000) {
        this.socket = socket;
        this.reader = socket.readable.getReader();
        this.writer = socket.writable.getWriter();
        this.timeoutMs = timeoutMs;
        this.buffer = '';
    }

    async write(value) {
        await withTimeout(this.writer.write(encoder.encode(value)), this.timeoutMs, 'write');
    }

    async readLine() {
        while (!this.buffer.includes('\n')) {
            const result = await withTimeout(this.reader.read(), this.timeoutMs, 'read');
            if (result.done) throw new Error('SMTP connection closed unexpectedly.');
            this.buffer += decoder.decode(result.value, { stream: true });
        }
        const index = this.buffer.indexOf('\n');
        const line = this.buffer.slice(0, index).replace(/\r$/, '');
        this.buffer = this.buffer.slice(index + 1);
        return line;
    }

    async response(expectedCodes, phase) {
        const lines = [];
        let code = 0;
        while (true) {
            const line = await this.readLine();
            lines.push(line);
            const match = line.match(/^(\d{3})([ -])/);
            if (!match) continue;
            code = Number(match[1]);
            if (match[2] === ' ') break;
        }
        if (!expectedCodes.includes(code)) {
            const error = new Error(`SMTP ${phase} failed (${code}): ${lines.join(' | ')}`);
            error.smtpCode = code;
            error.phase = phase;
            throw error;
        }
        return { code, lines };
    }

    async command(command, expectedCodes, phase) {
        await this.write(`${command}\r\n`);
        return this.response(expectedCodes, phase);
    }

    async close() {
        try { this.writer.releaseLock(); } catch {}
        try { this.reader.releaseLock(); } catch {}
        try { this.socket.close(); } catch {}
    }
}

function buildMimeMessage(message, config) {
    const boundary = `tg-${crypto.randomUUID()}`;
    const from = formatMailbox(config.fromName, config.fromAddress);
    const replyTo = formatMailbox('', config.replyTo || config.fromAddress);
    const to = formatMailbox(message.toName || '', message.to);
    const date = new Date().toUTCString();
    const headers = [
        `Message-ID: <${sanitizeHeader(message.messageId)}>`,
        `Date: ${date}`,
        `From: ${from}`,
        `Reply-To: ${replyTo}`,
        `To: ${to}`,
        `Subject: ${encodedWord(message.subject)}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        'Auto-Submitted: auto-generated',
        'X-Auto-Response-Suppress: All',
    ];
    const textBody = message.text || String(message.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return dotStuff([
        ...headers,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        base64Utf8(textBody).replace(/(.{76})/g, '$1\r\n'),
        `--${boundary}`,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        base64Utf8(message.html || '').replace(/(.{76})/g, '$1\r\n'),
        `--${boundary}--`,
        '',
    ].join('\r\n'));
}

export class SmtpMailer {
    constructor(env) {
        this.config = {
            host: String(env.SMTP_HOST || '').trim(),
            port: Number(env.SMTP_PORT || 465),
            username: String(env.SMTP_USERNAME || '').trim(),
            password: String(env.SMTP_PASSWORD || ''),
            fromName: String(env.SMTP_FROM_NAME || 'Thế Giới Trị Mụn').trim(),
            fromAddress: String(env.SMTP_FROM_ADDRESS || env.SMTP_USERNAME || '').trim(),
            replyTo: String(env.SMTP_REPLY_TO || env.SMTP_FROM_ADDRESS || env.SMTP_USERNAME || '').trim(),
            timeoutMs: Number(env.SMTP_TIMEOUT_MS || 12000),
        };
        if (!this.config.host || !this.config.username || !this.config.password || !this.config.fromAddress) {
            throw Object.assign(new Error('SMTP is not configured.'), { status: 503 });
        }
    }

    async send(message) {
        const recipient = normalizeAddress(message.to);
        const sender = normalizeAddress(this.config.fromAddress);
        const socket = connect(
            { hostname: this.config.host, port: this.config.port },
            { secureTransport: 'on', allowHalfOpen: false },
        );
        const smtp = new SmtpProtocol(socket, this.config.timeoutMs);
        let dataSubmitted = false;
        try {
            await smtp.response([220], 'greeting');
            const ehlo = await smtp.command('EHLO thegioitrimun.vn', [250], 'EHLO');
            const capabilities = ehlo.lines.join('\n').toUpperCase();
            if (capabilities.includes('AUTH PLAIN')) {
                const credentials = btoa(`\0${this.config.username}\0${this.config.password}`);
                await smtp.command(`AUTH PLAIN ${credentials}`, [235], 'AUTH');
            } else if (capabilities.includes('AUTH LOGIN')) {
                await smtp.command('AUTH LOGIN', [334], 'AUTH LOGIN');
                await smtp.command(btoa(this.config.username), [334], 'AUTH username');
                await smtp.command(btoa(this.config.password), [235], 'AUTH password');
            } else {
                throw new Error('SMTP server does not advertise AUTH PLAIN or AUTH LOGIN.');
            }
            await smtp.command(`MAIL FROM:<${sender}>`, [250], 'MAIL FROM');
            await smtp.command(`RCPT TO:<${recipient}>`, [250, 251], 'RCPT TO');
            await smtp.command('DATA', [354], 'DATA');
            await smtp.write(`${buildMimeMessage({ ...message, to: recipient }, this.config)}\r\n.\r\n`);
            dataSubmitted = true;
            const accepted = await smtp.response([250], 'DATA acceptance');
            await smtp.command('QUIT', [221], 'QUIT').catch(() => null);
            return { accepted: true, smtpCode: accepted.code, response: accepted.lines.join(' | ') };
        } catch (error) {
            if (dataSubmitted && !error?.smtpCode) error.deliveryUnknown = true;
            throw error;
        } finally {
            await smtp.close();
        }
    }
}

