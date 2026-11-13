import { Pool } from 'pg';

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const q = async <T = any>(text: string, params: unknown[] = []) =>
  (await pool.query(text, params)).rows as T[];
