import type { Request } from 'express';
import { z } from 'zod';
import type { Server } from 'socket.io';
import { q } from './db.js';
import { HttpError } from './util.js';

export type NotificationType = 'like' | 'comment' | 'wall' | 'rating' | 'follow';

/** true se qualquer um dos dois bloqueou o outro */
export async function isBlockedEitherWay(a: string, b: string) {
  const r = await q('select 1 from blocks where (blocker_id=$1 and blocked_id=$2) or (blocker_id=$2 and blocked_id=$1) limit 1', [a, b]);
  return r.length > 0;
}

export async function assertNotBlocked(a: string, b: string) {
  if (await isBlockedEitherWay(a, b)) throw new HttpError(403, 'blocked');
}

/** Cria a notificação e avisa em tempo real quem está conectado. Ignora a si mesmo e bloqueios. */
export async function notify(req: Request, userId: string, actorId: string, type: NotificationType, postId: string | null = null) {
  if (userId === actorId) return;
  if (await isBlockedEitherWay(userId, actorId)) return;
  // Evita spam: curtir/descurtir várias vezes o mesmo post não gera várias notificações
  if (type === 'like') {
    const dup = await q(`select 1 from notifications where user_id=$1 and actor_id=$2 and type='like' and post_id=$3
      and created_at > now() - interval '1 day' limit 1`, [userId, actorId, postId]);
    if (dup.length) return;
  }
  await q('insert into notifications(user_id, actor_id, type, post_id) values($1,$2,$3,$4)', [userId, actorId, type, postId]);
  (req.app.get('io') as Server).to(`user:${userId}`).emit('notification:new', { type });
}

/* ───────── Hashtags ───────── */
// Letras (com acento), números e _; até 30 caracteres. Ex.: "Amei o show #BTS #kpop_2026" -> ['bts', 'kpop_2026']
const TAG_RE = /#([\p{L}\p{N}_]{1,30})/gu;
export const extractTags = (text: string) =>
  [...new Set([...text.matchAll(TAG_RE)].map(m => m[1].toLowerCase()))].slice(0, 10);
// Tag recebida na URL: só os mesmos caracteres (vai dentro de uma regex no SQL, então nada de símbolos)
export const TagParam = z.string().regex(/^[\p{L}\p{N}_]{1,30}$/u);
