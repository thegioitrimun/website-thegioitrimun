import { access, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'tg-d1-schema-'));
const targets = [
    { name: 'app', migrations: 'd1/app/migrations', importFile: 'output/d1-migration/sql/app-import.sql' },
    { name: 'inci', migrations: 'd1/inci/migrations', importFile: 'output/d1-migration/sql/inci-import.sql' },
];

function sqlite(database, input, label) {
    const result = spawnSync('sqlite3', ['-bail', database], { cwd: root, input, encoding: 'utf8' });
    if (result.status !== 0) {
        process.stderr.write(result.stdout || '');
        process.stderr.write(result.stderr || '');
        throw new Error(`${label} failed.`);
    }
    return result.stdout.trim();
}

function sqliteFile(database, file, label) {
    const result = spawnSync('sqlite3', ['-bail', database, `.read ${file}`], { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) {
        process.stderr.write(result.stdout || '');
        process.stderr.write(result.stderr || '');
        throw new Error(`${label} failed.`);
    }
}

try {
    for (const target of targets) {
        const database = path.join(temporaryDirectory, `${target.name}.sqlite`);
        const directory = path.join(root, target.migrations);
        const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
        for (const file of files) {
            sqlite(database, await readFile(path.join(directory, file), 'utf8'), `${target.name}.${file}`);
        }
        try {
            const importFile = path.join(root, target.importFile);
            await access(importFile);
            sqliteFile(database, importFile, `${target.name}.import`);
        } catch (error) {
            if (error?.code !== 'ENOENT') throw error;
            process.stdout.write(`${target.name}: import file not present; schema-only validation\n`);
        }
        const integrity = sqlite(database, 'PRAGMA integrity_check;', `${target.name}.integrity`);
        const foreignKeys = sqlite(database, 'PRAGMA foreign_key_check;', `${target.name}.foreign-keys`);
        if (integrity !== 'ok') throw new Error(`${target.name}: integrity_check returned ${integrity}`);
        if (foreignKeys) throw new Error(`${target.name}: foreign_key_check returned rows:\n${foreignKeys}`);
        process.stdout.write(`${target.name}: schema and available import are valid\n`);
    }
} finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
}
