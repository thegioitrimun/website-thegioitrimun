import assert from 'node:assert/strict';
import test from 'node:test';

import { handleAiGenerate } from '../worker/aiGateway/handlers.js';

function jsonResponse(payload, status = 200, headers = {}) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers },
    });
}

function requestBody() {
    return {
        action: 'generate_product_details',
        request: {
            contents: 'Tạo thông tin cho sản phẩm thử nghiệm.',
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'OBJECT',
                    properties: {
                        description: { type: 'STRING' },
                        price: { type: 'NUMBER' },
                    },
                    required: ['description', 'price'],
                },
            },
        },
    };
}

const deps = {
    jsonResponse,
    authorizeAuthenticatedRequest: async () => ({ user: { id: 'admin-1' } }),
    authorizeRequestByRole: async () => ({ user: { id: 'admin-1' } }),
};

test('AI gateway falls back to Workers AI when Gemini rejects the Worker location', async (t) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({
        error: { message: 'User location is not supported for the API use.' },
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    t.after(() => { globalThis.fetch = originalFetch; });

    let capturedModel;
    let capturedRequest;
    const response = await handleAiGenerate(new Request('https://example.com/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody()),
    }), {
        GEMINI_API_KEY: 'server-only-key',
        AI_RATE_LIMITER: { limit: async () => ({ success: true }) },
        AI: {
            async run(model, request) {
                capturedModel = model;
                capturedRequest = request;
                return { response: { description: 'Nội dung dự phòng', price: 125000 } };
            },
        },
    }, deps);

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(JSON.parse(payload.text), {
        description: 'Nội dung dự phòng',
        price: 125000,
    });
    assert.equal(capturedModel, '@cf/meta/llama-3.3-70b-instruct-fp8-fast');
    assert.equal(capturedRequest.response_format.type, 'json_schema');
    assert.equal(capturedRequest.response_format.json_schema.type, 'object');
    assert.equal(capturedRequest.response_format.json_schema.properties.description.type, 'string');
    assert.equal(capturedRequest.messages[0].role, 'system');
});

test('AI gateway keeps the original Gemini error when no safe fallback is available', async (t) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({
        error: { message: 'User location is not supported for the API use.' },
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    t.after(() => { globalThis.fetch = originalFetch; });

    const body = requestBody();
    body.action = 'summarize_document';
    body.request.contents = {
        parts: [{ inlineData: { data: 'cGRm', mimeType: 'application/pdf' } }, { text: 'Tóm tắt.' }],
    };
    const response = await handleAiGenerate(new Request('https://example.com/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }), {
        GEMINI_API_KEY: 'server-only-key',
        AI_RATE_LIMITER: { limit: async () => ({ success: true }) },
        AI: { run: async () => { throw new Error('Must not be called'); } },
    }, deps);

    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /location is not supported/i);
});

test('AI gateway can use Workers AI directly when the Gemini key is unavailable', async () => {
    const response = await handleAiGenerate(new Request('https://example.com/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody()),
    }), {
        AI_RATE_LIMITER: { limit: async () => ({ success: true }) },
        AI: {
            async run() {
                return { response: { description: 'Cloudflare AI', price: 99000 } };
            },
        },
    }, deps);

    assert.equal(response.status, 200);
    assert.equal(JSON.parse((await response.json()).text).description, 'Cloudflare AI');
});
