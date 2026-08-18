const origin = String(
    process.env.OAUTH_TEST_ORIGIN || 'https://iskin-clinic-d1-staging.thegioitrimun.workers.dev',
).replace(/\/+$/, '');
const expectedCallback = String(
    process.env.OAUTH_EXPECTED_CALLBACK || `${origin}/api/auth/google/callback`,
);

const response = await fetch(`${origin}/api/auth/google/start?returnTo=%2Ftai-khoan`, {
    redirect: 'manual',
});
const location = response.headers.get('location');
if (response.status !== 302 || !location) {
    throw new Error(`Google OAuth start returned ${response.status} without a redirect.`);
}

const redirect = new URL(location);
const actualCallback = redirect.searchParams.get('redirect_uri');
const report = {
    ok: redirect.hostname === 'accounts.google.com' && actualCallback === expectedCallback,
    origin,
    authorizationHost: redirect.hostname,
    callback: actualCallback,
    expectedCallback,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.ok) process.exitCode = 1;
