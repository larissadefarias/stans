import { Router, type Request } from 'express';
import type { Server } from 'socket.io';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool, q } from './db.js';
import { auth, sign, uidOf } from './auth.js';
import { HttpError } from './util.js';
import { assertNotBlocked, extractTags, isBlockedEitherWay, notify, TagParam } from './social-helpers.js';

export const routes = Router();

const CATEGORIES = ['anime', 'kpop', 'series', 'games', 'music', 'sports', 'teams', 'players'] as const;
const RATING_TYPES = ['superfan', 'cool', 'hot', 'boring'] as const;
const io = (req: Request) => req.app.get('io') as Server;
const userIdByName = async (username: string) => {
  const [u] = await q<{ id: string }>('select id from users where username = $1', [username]);
  if (!u) throw new HttpError(404, 'user_not_found');
  return u.id;
};

/* ───────── Auth ───────── */
const authLimiter = rateLimit({ windowMs: 60_000, limit: 30 });

routes.post('/auth/register', authLimiter, async (req, res) => {
  const b = z.object({
    username: z.string().regex(/^[a-z0-9_]{3,20}$/),
    email: z.string().email(),
    password: z.string().min(8).max(100),
  }).parse(req.body);
  const hash = await bcrypt.hash(b.password, 10);
  const [u] = await q('insert into users(username, email, password_hash, display_name) values($1,$2,$3,$1) returning id, username',
    [b.username, b.email.toLowerCase(), hash]);
  res.status(201).json({ token: sign(u.id), user: u });
});

routes.post('/auth/login', authLimiter, async (req, res) => {
  const b = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
  const [u] = await q('select id, username, password_hash from users where email = $1', [b.email.toLowerCase()]);
  if (!u || !(await bcrypt.compare(b.password, u.password_hash))) throw new HttpError(401, 'invalid_credentials');
  res.json({ token: sign(u.id), user: { id: u.id, username: u.username } });
});

/* ───────── Status e configurações ───────── */
routes.patch('/me/status', auth, async (req, res) => {
  const b = z.object({
    text: z.string().max(80).nullable(),
    emoji: z.string().max(8).nullable().default(null),
    expiresInHours: z.number().int().min(1).max(24 * 30).nullable().default(null), // null = nunca expira
  }).parse(req.body);
  await q(`update users set status_text=$2, status_emoji=$3,
           status_expires_at = case when $4::int is null then null else now() + make_interval(hours => $4::int) end
           where id=$1`, [uidOf(res), b.text, b.emoji, b.expiresInHours]);
  res.status(204).end();
});

routes.patch('/me/settings', auth, async (req, res) => {
  const b = z.object({
    invisible: z.boolean().optional(),
    hideRatings: z.boolean().optional(),
    wallPolicy: z.enum(['everyone', 'following']).optional(),
    bio: z.string().max(300).optional(),
    displayName: z.string().min(1).max(40).optional(),
  }).parse(req.body);
  await q(`update users set invisible=coalesce($2,invisible), hide_ratings=coalesce($3,hide_ratings),
           wall_policy=coalesce($4,wall_policy), bio=coalesce($5,bio), display_name=coalesce($6,display_name) where id=$1`,
    [uidOf(res), b.invisible, b.hideRatings, b.wallPolicy, b.bio, b.displayName]);
  res.status(204).end();
});

/* ───────── Perfil e seguir ───────── */
routes.get('/users/:username', auth, async (req, res) => {
  const me = uidOf(res);
  const [u] = await q(`select id, username, display_name, bio, avatar_url, cover_url, hide_ratings, wall_policy, invisible,
      case when status_expires_at is null or status_expires_at > now() then status_text end as status_text,
      case when status_expires_at is null or status_expires_at > now() then status_emoji end as status_emoji
      from users where username=$1`, [req.params.username]);
  if (!u) throw new HttpError(404, 'user_not_found');
  if (u.id !== me) delete u.invisible; // só o próprio fã vê se está invisível
  // Quem me bloqueou some para mim; quem eu bloqueei continua visível (para eu poder desbloquear)
  const [bl] = await q<{ iBlocked: boolean; blockedMe: boolean }>(`select
      exists(select 1 from blocks where blocker_id=$1 and blocked_id=$2) as "iBlocked",
      exists(select 1 from blocks where blocker_id=$2 and blocked_id=$1) as "blockedMe"`, [me, u.id]);
  if (bl.blockedMe) throw new HttpError(404, 'user_not_found');
  const [f] = await q<{ followers: number; following: number; isFollowing: boolean; followsMe: boolean }>(`select
      (select count(*)::int from follows where followee_id=$2) as followers,
      (select count(*)::int from follows where follower_id=$2) as following,
      exists(select 1 from follows where follower_id=$1 and followee_id=$2) as "isFollowing",
      exists(select 1 from follows where follower_id=$2 and followee_id=$1) as "followsMe"`, [me, u.id]);

  const hidden = u.hide_ratings && u.id !== me;
  const rows = hidden ? [] : await q<{ type: string; total: number; week: number }>(
    `select type, count(*)::int as total, count(*) filter (where created_at > now() - interval '7 days')::int as week
     from fan_ratings where target_id=$1 group by type`, [u.id]);
  const [last] = await q<{ at: string }>(
    `select created_at + interval '7 days' as at from fan_ratings
     where rater_id=$1 and target_id=$2 and created_at > now() - interval '7 days'`, [me, u.id]);
  const fandoms = await q(`select c.id, c.slug, c.name, c.category from memberships m
     join communities c on c.id=m.community_id where m.user_id=$1 order by c.name`, [u.id]);

  res.json({
    ...u, fandoms, ...f, iBlocked: bl.iBlocked,
    ratings: hidden ? null : Object.fromEntries(rows.map(r => [r.type, { total: r.total, week: r.week }])),
    canRateAt: last?.at ?? null,
  });
});

routes.post('/users/:username/follow', auth, async (req, res) => {
  const target = await userIdByName(req.params.username as string);
  if (target === uidOf(res)) throw new HttpError(400, 'cannot_follow_self');
  await assertNotBlocked(uidOf(res), target);
  const r = await q('insert into follows values($1,$2) on conflict do nothing returning 1', [uidOf(res), target]);
  if (r.length) await notify(req, target, uidOf(res), 'follow');
  res.status(204).end();
});
routes.delete('/users/:username/follow', auth, async (req, res) => {
  await q('delete from follows where follower_id=$1 and followee_id=$2', [uidOf(res), await userIdByName(req.params.username as string)]);
  res.status(204).end();
});

/* ───────── Avaliações de fã: 1 voto por semana por perfil ───────── */
routes.post('/users/:username/ratings', auth, async (req, res) => {
  const { type } = z.object({ type: z.enum(RATING_TYPES) }).parse(req.body);
  const me = uidOf(res);
  const c = await pool.connect();
  try {
    await c.query('begin');
    const t = (await c.query('select id from users where username=$1', [req.params.username])).rows[0];
    if (!t) throw new HttpError(404, 'user_not_found');
    if (t.id === me) throw new HttpError(400, 'cannot_rate_self');
    if (await isBlockedEitherWay(me, t.id)) throw new HttpError(403, 'blocked');
    const old = await c.query(`select 1 from users where id=$1 and created_at < now() - interval '24 hours'`, [me]);
    if (!old.rowCount) throw new HttpError(403, 'account_too_new');

    // Trava por par (votante, alvo): requisições simultâneas ficam em fila e não furam o limite.
    await c.query('select pg_advisory_xact_lock(hashtext($1))', [me + t.id]);
    const last = await c.query(`select created_at + interval '7 days' as at from fan_ratings
      where rater_id=$1 and target_id=$2 and created_at > now() - interval '7 days'`, [me, t.id]);
    if (last.rowCount) throw new HttpError(429, 'weekly_limit', { retryAt: last.rows[0].at });

    await c.query('insert into fan_ratings(rater_id, target_id, type) values($1,$2,$3)', [me, t.id, type]);
    await c.query('commit');
    await notify(req, t.id, me, 'rating'); // o app mostra "alguém te avaliou", sem dizer quem
    res.status(201).end();
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    c.release();
  }
});

/* ───────── Mural de recados ───────── */
routes.get('/users/:username/wall', auth, async (req, res) => {
  const before = Number(req.query.before) || Number.MAX_SAFE_INTEGER;
  res.json(await q(`select w.id, w.parent_id as "parentId", w.content, w.created_at as "createdAt",
      u.username as "authorUsername", u.avatar_url as "authorAvatar"
      from wall_posts w join users u on u.id=w.author_id
      where w.profile_id=$1 and w.id < $2
      and not exists(select 1 from blocks b where b.blocker_id=$3 and b.blocked_id=w.author_id)
      order by w.id desc limit 30`, [await userIdByName(req.params.username as string), before, uidOf(res)]));
});

routes.post('/users/:username/wall', auth, async (req, res) => {
  const b = z.object({ content: z.string().trim().min(1).max(300), parentId: z.number().int().optional() }).parse(req.body);
  const me = uidOf(res);
  const [p] = await q('select id, wall_policy from users where username=$1', [req.params.username]);
  if (!p) throw new HttpError(404, 'user_not_found');
  if (p.id === me) throw new HttpError(400, 'cannot_post_own_wall'); // mural é só para os outros fãs
  await assertNotBlocked(me, p.id);
  if (p.wall_policy === 'following') {
    const ok = await q('select 1 from follows where follower_id=$1 and followee_id=$2', [p.id, me]);
    if (!ok.length) throw new HttpError(403, 'wall_restricted');
  }
  const [w] = await q('insert into wall_posts(profile_id, author_id, parent_id, content) values($1,$2,$3,$4) returning id',
    [p.id, me, b.parentId ?? null, b.content]);
  await notify(req, p.id, me, 'wall');
  res.status(201).json(w);
});

routes.delete('/wall/:id', auth, async (req, res) => {
  // pode apagar: quem escreveu ou o dono do mural
  const r = await q('delete from wall_posts where id=$1 and (author_id=$2 or profile_id=$2) returning id', [req.params.id, uidOf(res)]);
  if (!r.length) throw new HttpError(404, 'not_found');
  res.status(204).end();
});

/* ───────── Comunidades ───────── */
routes.get('/communities', auth, async (req, res) => {
  const cat = z.enum(CATEGORIES).optional().parse(req.query.category);
  res.json(await q(`select c.id, c.slug, c.name, c.description, c.category,
      (select count(*)::int from memberships m where m.community_id=c.id) as members
      from communities c where ($1::text is null or c.category=$1) order by members desc limit 50`, [cat ?? null]));
});

routes.post('/communities', auth, async (req, res) => {
  const b = z.object({
    slug: z.string().regex(/^[a-z0-9-]{3,40}$/), name: z.string().min(2).max(60),
    description: z.string().max(300).default(''), category: z.enum(CATEGORIES),
  }).parse(req.body);
  const me = uidOf(res);
  const c = await pool.connect();
  try {
    await c.query('begin');
    const comm = (await c.query('insert into communities(slug,name,description,category,owner_id) values($1,$2,$3,$4,$5) returning id',
      [b.slug, b.name, b.description, b.category, me])).rows[0];
    await c.query(`insert into memberships values($1,$2,'owner')`, [me, comm.id]);
    const room = (await c.query(`insert into rooms(kind, community_id) values('community',$1) returning id`, [comm.id])).rows[0];
    await c.query('insert into room_members(room_id, user_id) values($1,$2)', [room.id, me]);
    await c.query('commit');
    io(req).in(`user:${me}`).socketsJoin(room.id);
    res.status(201).json({ id: comm.id, roomId: room.id });
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    c.release();
  }
});

routes.post('/communities/:id/join', auth, async (req, res) => {
  const me = uidOf(res);
  await q('insert into memberships(user_id, community_id) values($1,$2) on conflict do nothing', [me, req.params.id]);
  const rooms = await q<{ id: string }>(`insert into room_members(room_id, user_id)
    select id, $1 from rooms where community_id=$2 on conflict do nothing returning room_id as id`, [me, req.params.id]);
  rooms.forEach(r => io(req).in(`user:${me}`).socketsJoin(r.id));
  res.status(204).end();
});

routes.delete('/communities/:id/join', auth, async (req, res) => {
  const me = uidOf(res);
  const r = await q(`delete from memberships where user_id=$1 and community_id=$2 and role<>'owner' returning 1`, [me, req.params.id]);
  if (!r.length) throw new HttpError(400, 'cannot_leave');
  const gone = await q<{ room_id: string }>(`delete from room_members where user_id=$1
    and room_id in (select id from rooms where community_id=$2) returning room_id`, [me, req.params.id]);
  gone.forEach(g => io(req).in(`user:${me}`).socketsLeave(g.room_id));
  res.status(204).end();
});

/* ───────── Posts, feed, curtidas e comentários ───────── */
const postSelect = `select p.id, p.community_id as "communityId", c.name as "communityName", p.content, p.image_url as "imageUrl",
  p.is_spoiler as "isSpoiler", p.tags, p.created_at as "createdAt", u.username as "authorUsername", u.avatar_url as "authorAvatar",
  (select count(*)::int from likes l where l.post_id=p.id) as likes,
  (select count(*)::int from comments k where k.post_id=p.id) as comments,
  exists(select 1 from likes l where l.post_id=p.id and l.user_id=$1) as "likedByMe"
  from posts p join users u on u.id=p.author_id join communities c on c.id=p.community_id`;

// Paginação por cursor: ?cursor=<createdAt>|<id> (sem OFFSET, não repete nem pula posts)
const cursorOf = (raw: unknown) => {
  const [at, id] = typeof raw === 'string' ? raw.split('|') : [];
  return { at: at || '9999-12-31T00:00:00Z', id: id || 'ffffffff-ffff-ffff-ffff-ffffffffffff' };
};

routes.get('/feed', auth, async (req, res) => {
  const cur = cursorOf(req.query.cursor);
  res.json(await q(`${postSelect} where p.community_id in (select community_id from memberships where user_id=$1)
    and not exists(select 1 from blocks b where b.blocker_id=$1 and b.blocked_id=p.author_id)
    and (p.created_at, p.id) < ($2::timestamptz, $3::uuid) order by p.created_at desc, p.id desc limit 20`, [uidOf(res), cur.at, cur.id]));
});

routes.get('/communities/:id/posts', auth, async (req, res) => {
  const cur = cursorOf(req.query.cursor);
  res.json(await q(`${postSelect} where p.community_id=$4 and not exists(select 1 from blocks b where b.blocker_id=$1 and b.blocked_id=p.author_id) and (p.created_at, p.id) < ($2::timestamptz, $3::uuid)
    order by p.created_at desc, p.id desc limit 20`, [uidOf(res), cur.at, cur.id, req.params.id]));
});

// Posts com uma hashtag, de todas as comunidades. Também acha posts antigos pela #tag escrita no texto.
routes.get('/tags/:tag/posts', auth, async (req, res) => {
  const tag = TagParam.parse(req.params.tag).toLowerCase();
  const cur = cursorOf(req.query.cursor);
  res.json(await q(`${postSelect} where ($4 = any(p.tags) or p.content ~* ('#' || $4 || '([^[:alnum:]_]|$)'))
    and not exists(select 1 from blocks b where b.blocker_id=$1 and b.blocked_id=p.author_id)
    and (p.created_at, p.id) < ($2::timestamptz, $3::uuid) order by p.created_at desc, p.id desc limit 20`,
    [uidOf(res), cur.at, cur.id, tag]));
});

routes.post('/communities/:id/posts', auth, async (req, res) => {
  const b = z.object({
    content: z.string().trim().min(1).max(2000),
    imageUrl: z.union([z.string().regex(/^\/uploads\/[\w.-]+$/), z.string().url()]).optional(), // vem de POST /uploads/image
    isSpoiler: z.boolean().default(false), tags: z.array(z.string().max(24)).max(5).default([]),
  }).parse(req.body);
  const member = await q('select 1 from memberships where user_id=$1 and community_id=$2', [uidOf(res), req.params.id]);
  if (!member.length) throw new HttpError(403, 'not_a_member');
  const tags = [...new Set([...b.tags.map(t => t.toLowerCase()), ...extractTags(b.content)])].slice(0, 10);
  const [p] = await q('insert into posts(community_id, author_id, content, image_url, is_spoiler, tags) values($1,$2,$3,$4,$5,$6) returning id',
    [req.params.id, uidOf(res), b.content, b.imageUrl ?? null, b.isSpoiler, tags]);
  res.status(201).json(p);
});

routes.delete('/posts/:id', auth, async (req, res) => {
  // autor, moderador ou dono da comunidade
  const r = await q(`delete from posts p where p.id=$1 and (p.author_id=$2 or exists(
    select 1 from memberships m where m.community_id=p.community_id and m.user_id=$2 and m.role in ('mod','owner'))) returning 1`,
    [req.params.id, uidOf(res)]);
  if (!r.length) throw new HttpError(404, 'not_found');
  res.status(204).end();
});

routes.post('/posts/:id/like', auth, async (req, res) => {
  const del = await q('delete from likes where post_id=$1 and user_id=$2 returning 1', [req.params.id, uidOf(res)]);
  if (!del.length) {
    await q('insert into likes values($1,$2)', [req.params.id, uidOf(res)]);
    const [p] = await q<{ author_id: string }>('select author_id from posts where id=$1', [req.params.id]);
    if (p) await notify(req, p.author_id, uidOf(res), 'like', req.params.id as string);
  }
  res.json({ liked: !del.length });
});

routes.get('/posts/:id/comments', auth, async (req, res) => {
  res.json(await q(`select k.id, k.content, k.created_at as "createdAt", u.username as "authorUsername", u.avatar_url as "authorAvatar"
    from comments k join users u on u.id=k.author_id where k.post_id=$1
    and not exists(select 1 from blocks b where b.blocker_id=$2 and b.blocked_id=k.author_id)
    order by k.created_at limit 100`, [req.params.id, uidOf(res)]));
});

routes.post('/posts/:id/comments', auth, async (req, res) => {
  const { content } = z.object({ content: z.string().trim().min(1).max(500) }).parse(req.body);
  const [p] = await q<{ author_id: string }>('select author_id from posts where id=$1', [req.params.id]);
  if (!p) throw new HttpError(404, 'not_found');
  await assertNotBlocked(uidOf(res), p.author_id);
  const [k] = await q('insert into comments(post_id, author_id, content) values($1,$2,$3) returning id', [req.params.id, uidOf(res), content]);
  await notify(req, p.author_id, uidOf(res), 'comment', req.params.id as string);
  res.status(201).json(k);
});

/* ───────── Chat (HTTP: lista, histórico, leitura, dm) ───────── */
routes.get('/rooms', auth, async (req, res) => {
  res.json(await q(`select r.id, r.kind, c.name as "communityName", c.id as "communityId",
      peer.username as peer, peer.avatar_url as "peerAvatar",
      lm.content as "lastMessage", lm.created_at as "lastAt",
      (select count(*)::int from messages m where m.room_id=r.id and m.id > rm.last_read_id and m.sender_id<>$1) as unread
      from room_members rm join rooms r on r.id=rm.room_id left join communities c on c.id=r.community_id
      left join lateral (select u.username, u.avatar_url from room_members o join users u on u.id=o.user_id
        where o.room_id=r.id and o.user_id<>$1 and r.kind='dm' limit 1) peer on true
      left join lateral (select m.content, m.created_at from messages m where m.room_id=r.id order by m.id desc limit 1) lm on true
      where rm.user_id=$1 order by coalesce(lm.created_at, r.created_at) desc`, [uidOf(res)]));
});

const assertMember = async (roomId: string, uid: string) => {
  const m = await q('select 1 from room_members where room_id=$1 and user_id=$2', [roomId, uid]);
  if (!m.length) throw new HttpError(403, 'not_in_room');
};

routes.get('/rooms/:id/messages', auth, async (req, res) => {
  await assertMember(req.params.id as string, uidOf(res));
  const before = Number(req.query.before) || Number.MAX_SAFE_INTEGER;
  res.json(await q(`select m.id, m.content, m.created_at as "createdAt", u.username as "senderUsername"
    from messages m join users u on u.id=m.sender_id where m.room_id=$1 and m.id < $2 order by m.id desc limit 30`, [req.params.id, before]));
});

routes.post('/rooms/:id/read', auth, async (req, res) => {
  const { lastId } = z.object({ lastId: z.number().int() }).parse(req.body);
  await q('update room_members set last_read_id = greatest(last_read_id, $3) where room_id=$1 and user_id=$2', [req.params.id, uidOf(res), lastId]);
  res.status(204).end();
});

routes.post('/dm/:username', auth, async (req, res) => {
  const me = uidOf(res);
  const other = await userIdByName(req.params.username as string);
  if (other === me) throw new HttpError(400, 'cannot_dm_self');
  await assertNotBlocked(me, other);
  const [found] = await q<{ id: string }>(`select r.id from rooms r
    join room_members a on a.room_id=r.id and a.user_id=$1 join room_members b on b.room_id=r.id and b.user_id=$2
    where r.kind='dm' limit 1`, [me, other]);
  if (found) return void res.json({ roomId: found.id });
  const [room] = await q<{ id: string }>(`insert into rooms(kind) values('dm') returning id`);
  await q('insert into room_members(room_id, user_id) values($1,$2),($1,$3)', [room.id, me, other]);
  io(req).in(`user:${me}`).in(`user:${other}`).socketsJoin(room.id);
  res.status(201).json({ roomId: room.id });
});
