// One-time setup. Never rotate existing keys: installed devices depend on them.
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';

const config = process.env.D1_WRANGLER_CONFIG || 'wrangler.d1.production.jsonc';
if (!process.argv.includes('--apply')) {
    throw new Error('Use --apply to provision the admin Web Push keys in Cloudflare.');
}
const list = spawnSync('npx', ['wrangler', 'secret', 'list', '--config', config], { encoding: 'utf8' });
if (list.status !== 0) throw new Error('Cannot inspect Cloudflare secrets. Check wrangler authentication.');
const existing = JSON.parse(list.stdout).map(item => item.name);
const names = ['ADMIN_PUSH_VAPID_PUBLIC_KEY', 'ADMIN_PUSH_VAPID_PRIVATE_KEY'];
if (names.every(name => existing.includes(name))) {
    console.log('Admin Web Push keys already exist; preserved without rotation.');
} else if (names.some(name => existing.includes(name))) {
    throw new Error('Incomplete VAPID pair. Restore the matching key before proceeding; do not rotate automatically.');
} else {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const jwk = privateKey.export({ format: 'jwk' });
    const publicKey = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]).toString('base64url');
    const result = spawnSync('npx', ['wrangler', 'secret', 'bulk', '--config', config], {
        input: JSON.stringify({ ADMIN_PUSH_VAPID_PUBLIC_KEY: publicKey, ADMIN_PUSH_VAPID_PRIVATE_KEY: jwk.d }),
        encoding: 'utf8',
    });
    if (result.status !== 0) throw new Error('Cloudflare did not confirm VAPID setup. Inspect secret names before retrying.');
    console.log('Admin Web Push key pair provisioned in Cloudflare. Private key was never written to disk.');
}
