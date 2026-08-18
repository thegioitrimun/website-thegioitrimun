import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const exportDir = path.resolve(process.env.D1_EXPORT_DIR || 'output/d1-migration');
const capabilitiesPath = path.join(root, 'd1/cutover-capabilities.json');
const capacityReportPath = path.resolve(process.env.D1_CAPACITY_REPORT || 'output/d1-capacity-report.json');
const cutoverConfigPath = path.resolve(process.env.D1_CUTOVER_CONFIG || 'wrangler.d1.production.jsonc');
const requiredCapabilities = [
    'public_runtime',
    'oauth_google',
    'oauth_apple_disabled_by_product_decision',
    'oauth_cookie_session_csrf_rbac',
    'account_profile',
    'account_wishlist',
    'checkout_email_locale',
    'order_lifecycle',
    'appointment_lifecycle',
    'smtp_outbox_queue',
    'ghtk_outbox_webhook',
    'ingredient_database_and_snapshots',
    'admin_catalog_crud',
    'admin_content_crud',
    'admin_users_and_medical_records',
    'admin_dashboard_and_reports',
    'reviews',
    'discounts_and_taxes',
    'private_storage_objects_copied',
    'frontend_supabase_calls_removed',
    'remote_d1_provisioned',
    'export_validation_passed',
    'remote_import_verification_passed',
    'd1_capacity_under_threshold',
    'oauth_production_callbacks_verified',
    'smtp_connection_verified',
    'rollback_drill_passed',
];

async function loadJson(file) {
    try {
        return JSON.parse(await readFile(file, 'utf8'));
    } catch (error) {
        if (error?.code === 'ENOENT') return null;
        throw error;
    }
}

const capabilities = await loadJson(capabilitiesPath);
const exportValidation = await loadJson(path.join(exportDir, 'validation-report.json'));
const remoteVerification = await loadJson(path.join(exportDir, 'verification-remote.json'));
const privateStorageVerification = await loadJson(path.join(exportDir, 'private-storage-copy-report.json'));
const capacityReport = await loadJson(capacityReportPath);
const errors = [];

if (!capabilities) {
    errors.push(`Missing ${path.relative(root, capabilitiesPath)}`);
} else {
    for (const capability of requiredCapabilities) {
        if (capabilities[capability] !== true) errors.push(`Capability is not complete: ${capability}`);
    }
}

if (String(process.env.REQUIRE_EMAIL_DNS_VERIFIED || '').toLowerCase() === 'true'
    && capabilities?.email_spf_dkim_dmarc_verified !== true) {
    errors.push('Email DNS verification is required by this release but is not complete.');
}
if (String(process.env.REQUIRE_SMTP_SECRET_ROTATED || '').toLowerCase() === 'true'
    && capabilities?.smtp_production_secret_rotated !== true) {
    errors.push('SMTP secret rotation is required by this release but is not complete.');
}

if (!capacityReport?.ok) {
    errors.push('D1 capacity report is absent or exceeds the configured 450 MiB shard threshold.');
} else if (Number(capacityReport.policy?.shardThresholdBytes) !== 450 * 1024 * 1024) {
    errors.push('D1 capacity report does not enforce the 450 MiB shard threshold.');
}

if (!exportValidation?.ok) errors.push('Export validation report is absent or not successful.');
if (!remoteVerification?.ok) errors.push('Remote D1 verification report is absent or not successful.');
if (!privateStorageVerification?.ok) {
    errors.push('Private R2 copy report is absent or not successful.');
} else if (
    Number(privateStorageVerification.expected) !== Number(privateStorageVerification.copied)
    || Number(privateStorageVerification.expected) !== Number(privateStorageVerification.verified)
) {
    errors.push('Private R2 copy count/checksum verification is incomplete.');
}

const frontendBackend = String(process.env.CUTOVER_FRONTEND_BACKEND || '').toLowerCase();
if (frontendBackend !== 'd1') {
    errors.push('CUTOVER_FRONTEND_BACKEND must be explicitly set to d1 for the production build.');
}

try {
    const cutoverConfig = await readFile(cutoverConfigPath, 'utf8');
    if (!/"DATA_BACKEND"\s*:\s*"d1"/i.test(cutoverConfig)) {
        errors.push(`${path.relative(root, cutoverConfigPath)} does not set DATA_BACKEND to d1.`);
    }
    for (const binding of ['APP_DB', 'INCI_DB', 'PRIVATE_RECORDS', 'NOTIFICATION_QUEUE', 'SHIPPING_QUEUE']) {
        if (!new RegExp(`"binding"\\s*:\\s*"${binding}"`).test(cutoverConfig)) {
            errors.push(`${path.relative(root, cutoverConfigPath)} is missing binding ${binding}.`);
        }
    }
    if (/REPLACE_|YOUR_|<[^>]+>/i.test(cutoverConfig)) {
        errors.push(`${path.relative(root, cutoverConfigPath)} still contains placeholder values.`);
    }
    const ghtkEnabled = /"GHTK_ENABLED"\s*:\s*"true"/i.test(cutoverConfig);
    if (ghtkEnabled && capabilities?.ghtk_production_webhook_verified !== true) {
        errors.push('GHTK is enabled but the production webhook has not been verified.');
    }
    if (!/"OAUTH_PROVIDERS"\s*:\s*"google"/i.test(cutoverConfig)) {
        errors.push(`${path.relative(root, cutoverConfigPath)} must configure Google as the only OAuth provider.`);
    }
} catch (error) {
    if (error?.code === 'ENOENT') errors.push(`Missing production D1 config: ${path.relative(root, cutoverConfigPath)}`);
    else throw error;
}

const productionConfig = await readFile(path.join(root, 'wrangler.jsonc'), 'utf8');
if (/"DATA_BACKEND"\s*:\s*"d1"/i.test(productionConfig) && errors.length > 0) {
    errors.unshift('Production DATA_BACKEND is already d1 while cutover checks are failing. Restore it to supabase immediately.');
}

const report = {
    generatedAt: new Date().toISOString(),
    ok: errors.length === 0,
    exportDir,
    capabilities,
    exportValidation: exportValidation?.ok === true,
    remoteVerification: remoteVerification?.ok === true,
    privateStorageVerification: privateStorageVerification?.ok === true,
    capacityVerification: capacityReport?.ok === true,
    capacityReport: path.relative(root, capacityReportPath),
    cutoverConfig: path.relative(root, cutoverConfigPath),
    frontendBackend: frontendBackend || null,
    errors,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.ok) process.exitCode = 1;
