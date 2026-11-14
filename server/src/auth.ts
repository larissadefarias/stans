import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { q } from './db.js';

const SECRET = process.env.JWT_SECRET!;

export const sign = (id: string) => jwt.sign({ sub: id }, SECRET, { expiresIn: '7d' });

export const verify = (token: string): string | null => {
  try { return jwt.verify(token, SECRET).sub as string; } catch { return null; }
};

export async function auth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const id = token ? verify(token) : null;
  if (!id) return void res.status(401).json({ error: 'unauthorized' });
  // Conta apagada ou banida pela moderação perde o acesso na hora (mesmo com token válido)
  const [u] = await q<{ banned: boolean }>('select banned_at is not null as banned from users where id=$1', [id]);
  if (!u) return void res.status(401).json({ error: 'unauthorized' });
  if (u.banned) return void res.status(403).json({ error: 'banned' });
  res.locals.uid = id;
  next();
}

export const uidOf = (res: Response) => res.locals.uid as string;
