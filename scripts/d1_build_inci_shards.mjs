import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DEFAULT_SOURCE = path.join(ROOT, 'output/d1-restore/inci-backup-inspect-20260810.db');
const DEFAULT_OUTPUT = path.join(ROOT, 'output/d1-inci-shards');
const MIGRATION_DIR = path.join(ROOT, 'd1/inci/migrations');

function argument(name, fallback) {
    const prefix = `--${name}=`;
    const value = process.argv.find((item) => item.startsWith(prefix));
    return value ? value.slice(prefix.length) : fallback;
}

function sqlQuote(value) {
    return `'${String(value).replaceAll("'", "''")}'`;
}

function fileSha256(filePath) {
    return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

async function dumpDatabase(databasePath, dumpPath) {
    await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(dumpPath);
        const child = spawn('sqlite3', [databasePath, '.dump'], { stdio: ['ignore', 'pipe', 'pipe'] });
        let stderr = '';
        child.stdout.pipe(output);
        child.stderr.on('data', (chunk) => { stderr += chunk; });
        child.on('error', reject);
        child.on('close', (code) => {
            output.end();
            if (code === 0) resolve();
            else reject(new Error(`sqlite3 dump failed (${code}): ${stderr}`));
        });
    });
}

function applySchema(db) {
    const migrations = fs.readdirSync(MIGRATION_DIR)
        .filter((name) => /^\d+.*\.sql$/.test(name))
        .sort();
    for (const migration of migrations) {
        db.exec(fs.readFileSync(path.join(MIGRATION_DIR, migration), 'utf8'));
    }
}

function insertMembership(db, ids) {
    db.exec('CREATE TEMP TABLE selected_ingredients (ingredient_id TEXT PRIMARY KEY); BEGIN IMMEDIATE;');
    const insert = db.prepare('INSERT INTO selected_ingredients (ingredient_id) VALUES (?)');
    for (const id of ids) insert.run(id);
    db.exec('COMMIT;');
}

function populateShard(db, sourcePath, shardIndex, shardCount, ids, sourceBytes) {
    db.exec('PRAGMA foreign_keys = OFF;');
    db.exec(`ATTACH DATABASE ${sqlQuote(sourcePath)} AS source_db;`);
    insertMembership(db, ids);
    db.exec(`
        BEGIN IMMEDIATE;
        INSERT INTO ingredients SELECT source.* FROM source_db.ingredients source
            JOIN selected_ingredients selected ON selected.ingredient_id = source.id;
        INSERT INTO ingredient_functions SELECT * FROM source_db.ingredient_functions;
        INSERT INTO ingredient_aliases SELECT source.* FROM source_db.ingredient_aliases source
            JOIN selected_ingredients selected ON selected.ingredient_id = source.ingredient_id;
        INSERT INTO ingredient_function_links SELECT source.* FROM source_db.ingredient_function_links source
            JOIN selected_ingredients selected ON selected.ingredient_id = source.ingredient_id;
        INSERT INTO ingredient_skin_effects SELECT source.* FROM source_db.ingredient_skin_effects source
            JOIN selected_ingredients selected ON selected.ingredient_id = source.ingredient_id;
        INSERT INTO analyzer_rules SELECT * FROM source_db.analyzer_rules;
        INSERT INTO ingredient_search_terms SELECT source.* FROM source_db.ingredient_search_terms source
            JOIN selected_ingredients selected ON selected.ingredient_id = source.ingredient_id;
        INSERT INTO ingredient_source_records (source_id, ingredient_id, source_json, created_at, updated_at)
            SELECT source.source_id, source.ingredient_id,
                   CASE WHEN length(source.source_json) > 50000
                        THEN json_object('chunked', 1, 'chunk_count', CAST((length(source.source_json) + 49999) / 50000 AS INTEGER))
                        ELSE source.source_json END,
                   source.created_at, source.updated_at
            FROM source_db.ingredient_source_records source
            JOIN selected_ingredients selected ON selected.ingredient_id = source.ingredient_id;
        WITH RECURSIVE source_rows(source_id, source_json) AS (
            SELECT source.source_id, source.source_json
            FROM source_db.ingredient_source_records source
            JOIN selected_ingredients selected ON selected.ingredient_id = source.ingredient_id
            WHERE length(source.source_json) > 50000
        ), chunks(source_id, source_json, chunk_index, start_at) AS (
            SELECT source_id, source_json, 0, 1 FROM source_rows
            UNION ALL
            SELECT source_id, source_json, chunk_index + 1, start_at + 50000
            FROM chunks WHERE start_at + 50000 <= length(source_json)
        )
        INSERT INTO ingredient_source_record_chunks (source_id, chunk_index, chunk_text)
            SELECT source_id, chunk_index, substr(source_json, start_at, 50000) FROM chunks;
        INSERT INTO ingredient_shard_metadata (
            shard_index, shard_count, ingredient_count, source_record_count, source_bytes, generated_at
        ) SELECT
            ${shardIndex},
            ${shardCount},
            (SELECT COUNT(*) FROM ingredients),
            (SELECT COUNT(*) FROM ingredient_source_records),
            ${sourceBytes},
            ${sqlQuote(new Date().toISOString())};
        COMMIT;
    `);
    db.exec('DETACH DATABASE source_db; PRAGMA foreign_keys = ON; ANALYZE; VACUUM;');
}

async function main() {
    const sourcePath = path.resolve(argument('source', DEFAULT_SOURCE));
    const outputDir = path.resolve(argument('output', DEFAULT_OUTPUT));
    const shardCount = Number(argument('shards', '2'));
    if (!Number.isInteger(shardCount) || shardCount < 2 || shardCount > 8) {
        throw new Error('--shards must be an integer between 2 and 8.');
    }
    if (!fs.existsSync(sourcePath)) throw new Error(`Source database not found: ${sourcePath}`);
    fs.mkdirSync(outputDir, { recursive: true });

    const source = new DatabaseSync(sourcePath, { readOnly: true });
    const ingredientRows = source.prepare(`
        SELECT i.id,
               COALESCE(SUM(length(r.source_json)), 0) AS source_bytes
        FROM ingredients i
        LEFT JOIN ingredient_source_records r ON r.ingredient_id = i.id
        GROUP BY i.id
        ORDER BY source_bytes DESC, i.id
    `).all();
    source.close();

    const shards = Array.from({ length: shardCount }, () => ({ ids: [], bytes: 0 }));
    for (const row of ingredientRows) {
        const target = shards.reduce((best, current) => current.bytes < best.bytes ? current : best, shards[0]);
        target.ids.push(row.id);
        target.bytes += Number(row.source_bytes || 0);
    }

    const manifest = {
        generatedAt: new Date().toISOString(),
        source: sourcePath,
        sourceSha256: fileSha256(sourcePath),
        shardCount,
        shards: [],
    };

    for (let index = 0; index < shards.length; index += 1) {
        const shard = shards[index];
        const baseName = `inci-shard-${String(index).padStart(2, '0')}`;
        const databasePath = path.join(outputDir, `${baseName}.db`);
        const dumpPath = path.join(outputDir, `${baseName}.sql`);
        fs.rmSync(databasePath, { force: true });
        fs.rmSync(dumpPath, { force: true });

        const db = new DatabaseSync(databasePath);
        applySchema(db);
        populateShard(db, sourcePath, index, shardCount, shard.ids, shard.bytes);
        const counts = Object.fromEntries(['ingredients', 'ingredient_aliases', 'ingredient_search_terms', 'ingredient_source_records', 'ingredient_source_record_chunks']
            .map((table) => [table, Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count)]));
        db.close();
        await dumpDatabase(databasePath, dumpPath);

        manifest.shards.push({
            index,
            database: databasePath,
            databaseBytes: fs.statSync(databasePath).size,
            databaseSha256: fileSha256(databasePath),
            dump: dumpPath,
            dumpBytes: fs.statSync(dumpPath).size,
            dumpSha256: fileSha256(dumpPath),
            sourceBytes: shard.bytes,
            ...counts,
        });
    }

    const manifestPath = path.join(outputDir, 'manifest.json');
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(JSON.stringify({ manifest: manifestPath, shards: manifest.shards }, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
