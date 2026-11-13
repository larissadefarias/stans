// Aplica as migrações de src/db/migrations em ordem, uma vez cada.
// Uso: npm run migrate   (lê DATABASE_URL do .env; nada é impresso sobre a conexão)
import { readdirSync, readFileSync } from 'fs';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const dir = new URL('./src/db/migrations/', import.meta.url);

try {
  await pool.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
  const done = new Set((await pool.query('select name from schema_migrations')).rows.map((r) => r.name));
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(name)) { console.log(`já aplicada: ${name}`); continue; }
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(readFileSync(new URL(name, dir), 'utf8'));
      await client.query('insert into schema_migrations(name) values ($1)', [name]);
      await client.query('commit');
      console.log(`aplicada: ${name}`);
    } catch (e) {
      await client.query('rollback');
      throw new Error(`${name}: ${e.message}`);
    } finally {
      client.release();
    }
  }
} catch (e) {
  console.error('ERRO na migração:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
