import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra: object = {}) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (e, _req, res, _next) => {
  if (e instanceof ZodError) return void res.status(400).json({ error: 'invalid_input', issues: e.issues });
  if (e instanceof HttpError) return void res.status(e.status).json({ error: e.message, ...e.extra });
  if (e?.code === '23505') return void res.status(409).json({ error: 'already_exists' });
  console.error(e);
  res.status(500).json({ error: 'internal' });
};
