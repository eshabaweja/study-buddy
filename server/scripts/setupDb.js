// Creates the schema on an empty database: base schema, then each migration in order.
// Safe to re-run: each file is applied once and recorded in the schema_migrations table.
import './../config/loadEnv.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const dir = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.join(dir, '..', 'db');

const client = new pg.Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

await client.connect();
try {
  await client.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  const applied = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const hasUsers = (await client.query("SELECT to_regclass('public.users') AS t")).rows[0].t;

  if (!applied.has('base')) {
    if (hasUsers) {
      // A database that predates this script: we cannot know which migrations it already has.
      console.log(
        'Existing tables found but no migration history. Leaving the schema alone.\n' +
          "If it is fully up to date, record that with: INSERT INTO schema_migrations (name) VALUES ('base') plus one row per file in db/migrations.",
      );
      process.exit(0);
    }
    // pg_dump emits psql meta-commands (\restrict) that the driver cannot run.
    const raw = fs.readFileSync(path.join(dbDir, 'create_database.txt'), 'utf8');
    await client.query(raw.split('\n').filter((l) => !l.startsWith('\\')).join('\n'));
    // The dump blanks search_path; restore it so migrations can use unqualified names.
    await client.query('SET search_path TO public');
    await client.query("INSERT INTO schema_migrations (name) VALUES ('base')");
    console.log('applied create_database.txt');
  }

  const migrations = fs
    .readdirSync(path.join(dbDir, 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  let ran = 0;
  for (const m of migrations) {
    if (applied.has(m)) continue;
    await client.query('BEGIN');
    try {
      await client.query(fs.readFileSync(path.join(dbDir, 'migrations', m), 'utf8'));
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [m]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
    console.log(`applied migrations/${m}`);
    ran += 1;
  }
  if (!ran) console.log('Schema is up to date.');
} finally {
  await client.end();
}
