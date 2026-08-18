import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const policyPath = path.resolve(process.env.D1_CAPACITY_POLICY || 'd1/capacity-policy.json');
const reportPath = path.resolve(process.env.D1_CAPACITY_REPORT || 'output/d1-capacity-report.json');
const reportOnly = process.argv.includes('--report-only');

const policy = JSON.parse(await readFile(policyPath, 'utf8'));
const result = spawnSync('npx', ['wrangler', 'd1', 'list', '--json'], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
});

if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || 'Unable to list D1 databases.\n');
    process.exit(1);
}

function parseDatabaseList(stdout) {
    const start = stdout.indexOf('[');
    const end = stdout.lastIndexOf(']');
    if (start < 0 || end < start) throw new Error('Wrangler did not return a D1 JSON array.');
    return JSON.parse(stdout.slice(start, end + 1));
}

function mib(bytes) {
    return Number((Number(bytes || 0) / 1024 / 1024).toFixed(2));
}

const databases = parseDatabaseList(result.stdout).map((database) => {
    const bytes = Number(database.file_size);
    let status = 'ok';
    if (!Number.isFinite(bytes)) status = 'unknown';
    else if (bytes > policy.maxDatabaseBytes) status = 'over_hard_limit';
    else if (bytes > policy.shardThresholdBytes) status = 'shard_required';
    else if (bytes >= policy.warningThresholdBytes) status = 'prepare_shard';

    return {
        id: database.uuid,
        name: database.name,
        bytes: Number.isFinite(bytes) ? bytes : null,
        mib: Number.isFinite(bytes) ? mib(bytes) : null,
        status,
        runtime: policy.runtimeDatabases.includes(database.name),
        recommendedAction: status === 'prepare_shard'
            ? 'Provision and validate the next domain shard before this database reaches 450 MiB.'
            : status === 'shard_required' || status === 'over_hard_limit'
                ? 'Stop cutover/writes, compact or archive immutable data, then move new domain records to a new shard.'
                : status === 'unknown'
                    ? 'Investigate missing file_size before cutover.'
                    : null,
    };
});

const totalBytes = databases.reduce((total, database) => total + Number(database.bytes || 0), 0);
const errors = [];
if (databases.length > policy.maxDatabases) {
    errors.push(`D1 database count ${databases.length} exceeds the Free plan limit ${policy.maxDatabases}.`);
}
if (totalBytes > policy.maxAccountBytes) {
    errors.push(`D1 account storage ${mib(totalBytes)} MiB exceeds the configured account limit.`);
}
for (const database of databases) {
    if (database.status === 'unknown') errors.push(`${database.name} has no reliable file_size.`);
    if (database.status === 'shard_required' || database.status === 'over_hard_limit') {
        errors.push(`${database.name} is ${database.mib} MiB and exceeds the 450 MiB shard threshold.`);
    }
}

const report = {
    generatedAt: new Date().toISOString(),
    ok: errors.length === 0,
    policy: {
        plan: policy.plan,
        maxDatabases: policy.maxDatabases,
        maxDatabaseBytes: policy.maxDatabaseBytes,
        shardThresholdBytes: policy.shardThresholdBytes,
        warningThresholdBytes: policy.warningThresholdBytes,
        maxAccountBytes: policy.maxAccountBytes,
    },
    usage: {
        databaseCount: databases.length,
        remainingDatabaseSlots: Math.max(0, policy.maxDatabases - databases.length),
        totalBytes,
        totalMiB: mib(totalBytes),
    },
    databases,
    errors,
};

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.ok && !reportOnly) process.exitCode = 1;
