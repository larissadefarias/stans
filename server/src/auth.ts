import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';

const SECRET = process.env.JWT_SECRET!;

export const sign = (id: string) => jwt.sign({ sub: id }, SECRET, { expiresIn: '7d' });

export const verify = (token: string): string | null => {
  try { return jwt.verify(token, SECRET).sub as string; } catch { return null; }
};

export function auth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const id = token ? verify(token) : null;
  if (!id) return void res.status(401).json({ error: 'unauthorized' });
  res.locals.uid = id;
  next();
}

export const uidOf = (res: Response) => res.locals.uid as string;
