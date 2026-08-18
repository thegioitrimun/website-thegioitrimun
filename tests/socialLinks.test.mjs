import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getExternalUrlError,
  normalizeExternalUrl,
  normalizeFooterSocialUrls,
} from '../src/socialLinks.js';

test('normalizes social URLs to absolute HTTPS URLs', () => {
  assert.equal(normalizeExternalUrl('facebook.com/thegioimun'), 'https://facebook.com/thegioimun');
  assert.equal(normalizeExternalUrl('http://instagram.com/thegioimun'), 'https://instagram.com/thegioimun');
  assert.equal(normalizeExternalUrl('//youtube.com/@thegioimun'), 'https://youtube.com/@thegioimun');
});

test('rejects unsafe and malformed external URLs', () => {
  assert.equal(normalizeExternalUrl('javascript:alert(1)'), '');
  assert.equal(normalizeExternalUrl('data:text/html,test'), '');
  assert.equal(normalizeExternalUrl('https://user:secret@example.com'), '');
  assert.match(getExternalUrlError('javascript:alert(1)'), /URL không hợp lệ/);
});

test('normalizes every supported footer social URL without changing other fields', () => {
  const normalized = normalizeFooterSocialUrls({
    about_text: 'Giới thiệu',
    facebook_url: 'facebook.com/thegioimun',
    messenger_url: 'm.me/thegioimun',
    instagram_url: '',
  });

  assert.equal(normalized.about_text, 'Giới thiệu');
  assert.equal(normalized.facebook_url, 'https://facebook.com/thegioimun');
  assert.equal(normalized.messenger_url, 'https://m.me/thegioimun');
  assert.equal(normalized.instagram_url, '');
});
