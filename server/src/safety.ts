import { Router, type Request } from 'express';
import type { Server } from 'socket.io';
import { z } from 'zod';
import { q } from './db.js';
import { auth, uidOf } from './auth.js';
import { HttpError } from './util.js';

/* ───────── Idade ───────── */
export const MIN_AGE = 13;
export const ADULT_AGE = 18;

/** Valida "AAAA-MM-DD" e devolve a idade em anos completos. */
export function ageOf(birthDate: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) throw new HttpError(400, 'invalid_birth_date');
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) throw new HttpError(400, 'invalid_birth_date');
  const now = new Date();
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() + 1 < mo || (now.getUTCMonth() + 1 === mo && now.getUTCDate() < d)) age--;
  if (age < 0 || age > 120) throw new HttpError(400, 'invalid_birth_date');
  if (age < MIN_AGE) throw new HttpError(403, 'too_young');
  return age;
}

/** Menor de idade? Conta antiga sem data conta como menor (mais protegida) até preencher. */
export async function isMinor(userId: string) {
  const [u] = await q<{ minor: boolean }>(
    `select birth_date is null or birth_date > current_date - interval '${ADULT_AGE} years' as minor from users where id=$1`, [userId]);
  return u?.minor ?? true;
}

/* ───────── Filtro de palavrões e ofensas ───────── */
// Comparação sem acento e com "leetspeak" desfeito (p0rr4 -> porra). Palavras inteiras ou começo de palavra.
const EXACT = new Set([
  'cu', 'cus', 'fdp', 'vsf', 'tnc', 'pqp', 'krl', 'crl', 'kct', 'pnc', 'vtnc', 'puta', 'putas', 'puto', 'putos',
  'foda', 'fodase', 'merda', 'bosta', 'caralho', 'porra', 'viado', 'viadinho', 'bicha', 'sapatao', 'traveco',
  'shit', 'fuck', 'bitch', 'dick', 'cunt', 'whore', 'slut', 'pussy',
]);
const STEMS = [
  'caralh', 'porra', 'merd', 'bucet', 'xoxot', 'xerec', 'piroc', 'punhet', 'fod', 'fud', 'putari', 'arrombad', 'cuzao',
  'cuzinh', 'viad', 'boiol', 'estupr', 'pedofil', 'vagabund', 'piranh', 'retardad', 'macumbeir',
  'fuck', 'shit', 'nigg', 'fagg', 'bitch', 'whor', 'slut',
];
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };

const normalize = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[013457@$]/g, (c) => LEET[c] ?? c);

export function hasOffensive(text: string) {
  return normalize(text).split(/[^a-z]+/).some((w) => w && (EXACT.has(w) || STEMS.some((s) => w.startsWith(s))));
}

/** Recusa o texto com palavrão/ofensa (o app mostra "Esse texto tem palavras não permitidas"). */
export function assertClean(...texts: (string | null | undefined)[]) {
  if (texts.some((t) => t && hasOffensive(t))) throw new HttpError(400, 'offensive_content');
}

/* ───────── Mensagens privadas ───────── */
// Só entre quem se segue mutuamente e sem bloqueio em nenhum dos lados.
export async function canDm(a: string, b: string) {
  const [r] = await q<{ ok: boolean }>(`select
      exists(select 1 from follows where follower_id=$1 and followee_id=$2)
      and exists(select 1 from follows where follower_id=$2 and followee_id=$1)
      and not exists(select 1 from blocks where (blocker_id=$1 and blocked_id=$2) or (blocker_id=$2 and blocked_id=$1)) as ok`, [a, b]);
  return r.ok;
}

/** Numa sala privada (dm), o remetente ainda pode falar com a outra pessoa? Salas de comunidade sempre podem. */
export async function canSendInRoom(roomId: string, senderId: string) {
  const [peer] = await q<{ user_id: string }>(`select o.user_id from rooms r join room_members o on o.room_id=r.id
    where r.id=$1 and r.kind='dm' and o.user_id<>$2 limit 1`, [roomId, senderId]);
  return !peer || canDm(senderId, peer.user_id);
}

/* ───────── Rotas: conta e moderação ───────── */
export const safety = Router();
const io = (req: Request) => req.app.get('io') as Server;

// Dados da minha conta que o app precisa logo ao entrar
safety.get('/me', auth, async (_req, res) => {
  const [u] = await q(`select id, username, is_moderator as "isModerator", birth_date is null as "needsBirthDate",
      (birth_date is null or birth_date > current_date - interval '${ADULT_AGE} years') as "isMinor"
      from users where id=$1`, [uidOf(res)]);
  if (!u) throw new HttpError(404, 'user_not_found');
  res.json(u);
});

// Contas antigas informam a data de nascimento uma única vez
safety.post('/me/birth-date', auth, async (req, res) => {
  const { birthDate } = z.object({ birthDate: z.string() }).parse(req.body);
  const age = ageOf(birthDate);
  const r = await q(`update users set birth_date=$2,
      wall_policy = case when $3 then 'following' else wall_policy end
      where id=$1 and birth_date is null returning 1`, [uidOf(res), birthDate, age < ADULT_AGE]);
  if (!r.length) throw new HttpError(409, 'birth_date_already_set');
  res.status(204).end();
});

const modOnly = async (uid: string) => {
  const [u] = await q<{ is_moderator: boolean }>('select is_moderator from users where id=$1', [uid]);
  if (!u?.is_moderator) throw new HttpError(403, 'not_moderator');
};

// Denúncias com uma prévia do que foi denunciado
safety.get('/mod/reports', auth, async (req, res) => {
  await modOnly(uidOf(res));
  const status = z.enum(['open', 'reviewed', 'dismissed']).default('open').parse(req.query.status);
  res.json(await q(`select r.id, r.target_type as "targetType", r.target_id as "targetId", r.reason, r.status,
      r.created_at as "createdAt", ru.username as reporter,
      case r.target_type when 'post' then p.content when 'comment' then k.content when 'wall' then w.content end as content,
      p.image_url as "imageUrl",
      coalesce(pu.username, ku.username, wu.username, tu.username) as "targetUser",
      coalesce(pu.banned_at, ku.banned_at, wu.banned_at, tu.banned_at) is not null as "targetBanned",
      (select count(*)::int from reports x where x.target_type=r.target_type and x.target_id=r.target_id) as "timesReported"
    from reports r join users ru on ru.id=r.reporter_id
    left join posts p on r.target_type='post' and p.id::text=r.target_id left join users pu on pu.id=p.author_id
    left join comments k on r.target_type='comment' and k.id::text=r.target_id left join users ku on ku.id=k.author_id
    left join wall_posts w on r.target_type='wall' and w.id::text=r.target_id left join users wu on wu.id=w.author_id
    left join users tu on r.target_type='user' and (tu.id::text=r.target_id or tu.username=r.target_id)
    where r.status=$1 order by r.created_at ${status === 'open' ? 'asc' : 'desc'} limit 100`, [status]));
});

// Decide uma denúncia: ignorar, apagar o conteúdo ou banir quem fez (banir também apaga o conteúdo)
safety.post('/mod/reports/:id', auth, async (req, res) => {
  const me = uidOf(res);
  await modOnly(me);
  const { action } = z.object({ action: z.enum(['dismiss', 'remove', 'ban']) }).parse(req.body);
  const [r] = await q<{ target_type: string; target_id: string }>('select target_type, target_id from reports where id=$1', [req.params.id]);
  if (!r) throw new HttpError(404, 'not_found');

  const table = { post: 'posts', comment: 'comments', wall: 'wall_posts' }[r.target_type];
  let authorId: string | null = null;
  if (table) {
    const [t] = await q<{ author_id: string }>(`select author_id from ${table} where id::text=$1`, [r.target_id]);
    authorId = t?.author_id ?? null;
  } else {
    const [u] = await q<{ id: string }>('select id from users where id::text=$1 or username=$1', [r.target_id]);
    authorId = u?.id ?? null;
  }

  if (action === 'ban') {
    if (!authorId) throw new HttpError(404, 'not_found');
    if (authorId === me) throw new HttpError(400, 'cannot_ban_self');
    const [t] = await q<{ is_moderator: boolean }>('select is_moderator from users where id=$1', [authorId]);
    if (t?.is_moderator) throw new HttpError(400, 'cannot_ban_moderator');
    await q('update users set banned_at=now() where id=$1 and banned_at is null', [authorId]);
    io(req).in(`user:${authorId}`).disconnectSockets(true); // derruba o chat aberto
  }
  if ((action === 'remove' || action === 'ban') && table) await q(`delete from ${table} where id::text=$1`, [r.target_id]);

  // Todas as denúncias abertas do mesmo alvo saem da fila juntas
  await q(`update reports set status=$3 where target_type=$1 and target_id=$2 and status='open'`,
    [r.target_type, r.target_id, action === 'dismiss' ? 'dismissed' : 'reviewed']);
  res.status(204).end();
});

safety.post('/mod/users/:username/unban', auth, async (req, res) => {
  await modOnly(uidOf(res));
  const r = await q('update users set banned_at=null where username=$1 returning 1', [req.params.username]);
  if (!r.length) throw new HttpError(404, 'user_not_found');
  res.status(204).end();
});
