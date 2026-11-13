import type { Server } from 'socket.io';
import { q } from './db.js';
import { verify } from './auth.js';

// userId -> sockets abertos. Com mais de uma instância do servidor, isto vai para o Redis.
const online = new Map<string, Set<string>>();

export function attachSocket(io: Server) {
  io.use((s, next) => {
    const uid = verify(String(s.handshake.auth?.token ?? ''));
    if (!uid) return next(new Error('unauthorized'));
    s.data.uid = uid;
    next();
  });

  io.on('connection', async (s) => {
    const uid = s.data.uid as string;
    const rooms = (await q<{ room_id: string }>('select room_id from room_members where user_id=$1', [uid])).map(r => r.room_id);
    s.join([...rooms, `user:${uid}`]);

    // Presença: só fica offline quando a ÚLTIMA conexão do usuário fecha (celular + navegador).
    // Conexões mortas são detectadas pelo ping/pong nativo do Socket.IO.
    const conns = online.get(uid) ?? new Set<string>();
    conns.add(s.id);
    online.set(uid, conns);
    const announce = async (status: 'online' | 'offline') => {
      const [u] = await q<{ invisible: boolean }>('select invisible from users where id=$1', [uid]);
      if (!u?.invisible) rooms.forEach(roomId => io.to(roomId).emit('presence', { userId: uid, status }));
    };
    if (conns.size === 1) void announce('online');

    // Limite de mensagens: 5 de rajada, 1 nova por segundo
    let tokens = 5;
    const refill = setInterval(() => { tokens = Math.min(5, tokens + 1); }, 1000);

    s.on('message:send', async (p: { roomId: string; content: string }, ack?: (r: object) => void) => {
      const content = String(p?.content ?? '').trim();
      if (!content || content.length > 2000 || !s.rooms.has(p.roomId)) return ack?.({ ok: false, error: 'invalid' });
      if (tokens <= 0) return ack?.({ ok: false, error: 'rate_limited' });
      tokens--;
      const [m] = await q(`with ins as (insert into messages(room_id, sender_id, content) values($1,$2,$3) returning *)
        select ins.id, ins.room_id as "roomId", ins.content, ins.created_at as "createdAt", u.username as "senderUsername"
        from ins join users u on u.id=ins.sender_id`, [p.roomId, uid, content]);
      io.to(p.roomId).emit('message:new', m);
      ack?.({ ok: true, id: m.id });
    });

    s.on('typing', (p: { roomId: string }) => {
      if (s.rooms.has(p?.roomId)) s.to(p.roomId).emit('typing', { roomId: p.roomId, userId: uid });
    });

    // Quem está online numa sala (ignora quem está invisível)
    s.on('presence:get', async (roomId: string, ack?: (ids: string[]) => void) => {
      if (!s.rooms.has(roomId)) return;
      const ids = await q<{ user_id: string }>(`select rm.user_id from room_members rm join users u on u.id=rm.user_id
        where rm.room_id=$1 and not u.invisible`, [roomId]);
      ack?.(ids.map(r => r.user_id).filter(id => online.has(id)));
    });

    s.on('disconnect', () => {
      clearInterval(refill);
      conns.delete(s.id);
      if (conns.size === 0) { online.delete(uid); void announce('offline'); }
    });
  });
}
