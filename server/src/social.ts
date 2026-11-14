import { createHash, randomBytes } from 'crypto';
import { Router, type Request } from 'express';
import type { Server } from 'socket.io';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool, q } from './db.js';
import { auth, uidOf } from './auth.js';
import { HttpError } from './util.js';
import { assertNotBlocked, notify } from './social-helpers.js';
import { isMinor } from './safety.js';

export const social = Router();
const io = (req: Request) => req.app.get('io') as Server;
const userIdByName = async (username: string) => {
  const [u] = await q<{ id: string }>('select id from users where username = $1', [username]);
  if (!u) throw new HttpError(404, 'user_not_found');
  return u.id;
};

/* ───────── Busca ───────── */
social.get('/search', auth, async (req, res) => {
  const term = z.string().trim().min(1).max(40).parse(req.query.q);
  const like = `%${term.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
  const me = uidOf(res);
  const [users, communities] = await Promise.all([
    q(`select username, display_name as "displayName", avatar_url as "avatarUrl" from users u
       where (username ilike $1 or display_name ilike $1) and u.banned_at is null
       and ($4::boolean or u.birth_date is null or u.birth_date <= current_date - interval '18 years')
       and not exists(select 1 from blocks b where (b.blocker_id=$2 and b.blocked_id=u.id) or (b.blocker_id=u.id and b.blocked_id=$2))
       order by (username ilike $3) desc, username limit 20`, [like, me, `${term}%`, await isMinor(me)]),
    q(`select c.id, c.name, c.category, c.description,
       (select count(*)::int from memberships m where m.community_id=c.id) as members
       from communities c where c.name ilike $1 or c.description ilike $1 order by members desc limit 20`, [like]),
  ]);
  // Hashtags que começam com o termo (sem o #), mais usadas primeiro
  const tagTerm = term.replace(/^#/, '').toLowerCase();
  const tags = /^[\p{L}\p{N}_]{1,30}$/u.test(tagTerm) ? await q<{ tag: string; posts: number }>(
    `select lower(m[1]) as tag, count(distinct p.id)::int as posts
     from posts p, regexp_matches(p.content, '#([[:alnum:]_]{1,30})', 'g') m
     where p.content ilike $1 and lower(m[1]) like $2
     group by 1 order by 2 desc, 1 limit 10`, [`%#${tagTerm}%`, `${tagTerm}%`]) : [];
  res.json({ users, communities, tags });
});

/* Hashtags em alta: as mais usadas nos últimos 7 dias */
social.get('/tags/trending', auth, async (_req, res) => {
  res.json(await q(`select lower(m[1]) as tag, count(distinct p.id)::int as posts
    from posts p, regexp_matches(p.content, '#([[:alnum:]_]{1,30})', 'g') m
    where p.created_at > now() - interval '7 days'
    group by 1 order by 2 desc, 1 limit 12`));
});

/* ───────── Comunidade: detalhes e sala do chat ───────── */
social.get('/communities/:id', auth, async (req, res) => {
  const [c] = await q(`select c.id, c.slug, c.name, c.description, c.category,
      (select count(*)::int from memberships m where m.community_id=c.id) as members,
      (select role from memberships m where m.community_id=c.id and m.user_id=$2) as "myRole"
      from communities c where c.id=$1`, [req.params.id, uidOf(res)]);
  if (!c) throw new HttpError(404, 'not_found');
  const rows = await q<{ type: string; total: number; week: number }>(
    `select type, count(*)::int as total, count(*) filter (where created_at > now() - interval '7 days')::int as week
     from community_ratings where community_id=$1 group by type`, [req.params.id]);
  const [last] = await q<{ at: string }>(`select created_at + interval '7 days' as at from community_ratings
    where rater_id=$1 and community_id=$2 and created_at > now() - interval '7 days'`, [uidOf(res), req.params.id]);
  res.json({
    ...c,
    ratings: Object.fromEntries(rows.map(r => [r.type, { total: r.total, week: r.week }])),
    canRateAt: last?.at ?? null,
  });
});

/* Avaliação de comunidade: anônima, 1 voto por semana por comunidade; o dono não avalia a própria. */
social.post('/communities/:id/ratings', auth, async (req, res) => {
  const { type } = z.object({ type: z.enum(['superfan', 'cool', 'hot', 'boring']) }).parse(req.body);
  const me = uidOf(res);
  const c = await pool.connect();
  try {
    await c.query('begin');
    const t = (await c.query('select id, owner_id from communities where id=$1', [req.params.id])).rows[0];
    if (!t) throw new HttpError(404, 'not_found');
    if (t.owner_id === me) throw new HttpError(400, 'cannot_rate_own_community');
    const old = await c.query(`select 1 from users where id=$1 and created_at < now() - interval '24 hours'`, [me]);
    if (!old.rowCount) throw new HttpError(403, 'account_too_new');
    // Trava por par (votante, comunidade) para requisições simultâneas não furarem o limite
    await c.query('select pg_advisory_xact_lock(hashtext($1))', ['c' + me + t.id]);
    const last = await c.query(`select created_at + interval '7 days' as at from community_ratings
      where rater_id=$1 and community_id=$2 and created_at > now() - interval '7 days'`, [me, t.id]);
    if (last.rowCount) throw new HttpError(429, 'weekly_limit', { retryAt: last.rows[0].at });
    await c.query('insert into community_ratings(rater_id, community_id, type) values($1,$2,$3)', [me, t.id, type]);
    await c.query('commit');
    res.status(201).end();
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    c.release();
  }
});

// Garante que a comunidade tem sala de chat (as comunidades de exemplo foram criadas sem sala) e coloca o membro nela
social.post('/communities/:id/room', auth, async (req, res) => {
  const me = uidOf(res);
  const member = await q('select 1 from memberships where user_id=$1 and community_id=$2', [me, req.params.id]);
  if (!member.length) throw new HttpError(403, 'not_a_member');
  await q(`insert into rooms(kind, community_id) values('community',$1) on conflict (community_id) do nothing`, [req.params.id]);
  const [room] = await q<{ id: string }>('select id from rooms where community_id=$1', [req.params.id]);
  await q('insert into room_members(room_id, user_id) values($1,$2) on conflict do nothing', [room.id, me]);
  io(req).in(`user:${me}`).socketsJoin(room.id);
  res.json({ roomId: room.id });
});

/* ───────── Comentários ───────── */
social.delete('/comments/:id', auth, async (req, res) => {
  // autor do comentário ou autor do post
  const r = await q(`delete from comments k using posts p where k.id=$1 and p.id=k.post_id
    and (k.author_id=$2 or p.author_id=$2) returning 1`, [req.params.id, uidOf(res)]);
  if (!r.length) throw new HttpError(404, 'not_found');
  res.status(204).end();
});

/* ───────── Seguidores ───────── */
social.get('/users/:username/follows', auth, async (req, res) => {
  const kind = z.enum(['followers', 'following']).parse(req.query.kind);
  const id = await userIdByName(req.params.username as string);
  const [col, other] = kind === 'followers' ? ['followee_id', 'follower_id'] : ['follower_id', 'followee_id'];
  res.json(await q(`select u.username, u.display_name as "displayName", u.avatar_url as "avatarUrl"
    from follows f join users u on u.id=f.${other} where f.${col}=$1 order by u.username limit 200`, [id]));
});

/* ───────── Notificações ───────── */
social.get('/notifications', auth, async (req, res) => {
  const before = Number(req.query.before) || Number.MAX_SAFE_INTEGER;
  res.json(await q(`select n.id, n.type, n.post_id as "postId", n.read_at is not null as read, n.created_at as "createdAt",
      a.username as "actorUsername", a.avatar_url as "actorAvatar", c.id as "communityId", c.name as "communityName"
      from notifications n join users a on a.id=n.actor_id
      left join posts p on p.id=n.post_id left join communities c on c.id=p.community_id
      where n.user_id=$1 and n.id < $2 order by n.id desc limit 30`, [uidOf(res), before]));
});

social.get('/notifications/unread-count', auth, async (_req, res) => {
  const [r] = await q<{ n: number }>('select count(*)::int as n from notifications where user_id=$1 and read_at is null', [uidOf(res)]);
  res.json({ count: r.n });
});

social.post('/notifications/read', auth, async (_req, res) => {
  await q('update notifications set read_at=now() where user_id=$1 and read_at is null', [uidOf(res)]);
  res.status(204).end();
});

/* ───────── Bloquear e denunciar ───────── */
social.post('/users/:username/block', auth, async (req, res) => {
  const me = uidOf(res);
  const target = await userIdByName(req.params.username as string);
  if (target === me) throw new HttpError(400, 'cannot_block_self');
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query('insert into blocks(blocker_id, blocked_id) values($1,$2) on conflict do nothing', [me, target]);
    // Bloquear desfaz o "seguir" nos dois sentidos
    await c.query('delete from follows where (follower_id=$1 and followee_id=$2) or (follower_id=$2 and followee_id=$1)', [me, target]);
    await c.query('commit');
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    c.release();
  }
  res.status(204).end();
});

social.delete('/users/:username/block', auth, async (req, res) => {
  await q('delete from blocks where blocker_id=$1 and blocked_id=$2', [uidOf(res), await userIdByName(req.params.username as string)]);
  res.status(204).end();
});

social.get('/me/blocks', auth, async (_req, res) => {
  res.json(await q(`select u.username, u.display_name as "displayName", u.avatar_url as "avatarUrl"
    from blocks b join users u on u.id=b.blocked_id where b.blocker_id=$1 order by b.created_at desc`, [uidOf(res)]));
});

social.post('/reports', auth, rateLimit({ windowMs: 60 * 60_000, limit: 20 }), async (req, res) => {
  const b = z.object({
    targetType: z.enum(['user', 'post', 'comment', 'wall']),
    targetId: z.string().min(1).max(64),
    reason: z.string().trim().min(1).max(500),
  }).parse(req.body);
  await q('insert into reports(reporter_id, target_type, target_id, reason) values($1,$2,$3,$4)',
    [uidOf(res), b.targetType, b.targetId, b.reason]);
  res.status(201).end();
});

/* ───────── Esqueci minha senha ───────── */
const resetLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 5 });
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

social.post('/auth/forgot', resetLimiter, async (req, res) => {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const [u] = await q<{ id: string; username: string }>('select id, username from users where email=$1', [email.toLowerCase()]);
  if (u) {
    const token = randomBytes(32).toString('hex');
    await q('delete from password_resets where user_id=$1', [u.id]);
    await q(`insert into password_resets(token_hash, user_id, expires_at) values($1,$2, now() + interval '1 hour')`, [sha256(token), u.id]);
    // TODO produção: enviar por e-mail (Resend, SES…). Em desenvolvimento o link aparece só neste terminal.
    const appUrl = process.env.APP_URL ?? 'http://localhost:8081';
    console.log(`\n[DEV] Redefinição de senha de @${u.username}: ${appUrl}/reset?token=${token}\n      (no celular: abra o app em "Esqueci minha senha" e cole o código: ${token})\n`);
  }
  // Mesma resposta exista ou não a conta, para não revelar quais e-mails estão cadastrados
  res.status(204).end();
});

social.post('/auth/reset', resetLimiter, async (req, res) => {
  const b = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: z.string().min(8).max(100) }).parse(req.body);
  const [r] = await q<{ user_id: string }>(
    `update password_resets set used_at=now() where token_hash=$1 and used_at is null and expires_at > now() returning user_id`,
    [sha256(b.token)]);
  if (!r) throw new HttpError(400, 'invalid_or_expired_token');
  await q('update users set password_hash=$2 where id=$1', [r.user_id, await bcrypt.hash(b.password, 10)]);
  await q('delete from password_resets where user_id=$1', [r.user_id]);
  res.status(204).end();
});

export { notify };
