import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import type { RatingType } from './ratings';

/**
 * URL base da API.
 * 1) Se existir EXPO_PUBLIC_API_URL (em mobile-app/.env.local, ex.: http://192.168.0.10:4000), ela vence.
 * 2) Senão, usa o IP do computador que está rodando o Metro (o mesmo que o Expo Go usa), na porta 4000.
 * 3) Por fim, localhost (navegador/simulador iOS) ou 10.0.2.2 (emulador Android).
 */
const API_PORT = 4000;

function resolveBaseUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host && host !== 'localhost') return `http://${host}:${API_PORT}`;
  return `http://${Platform.OS === 'android' ? '10.0.2.2' : 'localhost'}:${API_PORT}`;
}

export const API_URL = resolveBaseUrl();

let token: string | null = null;
export const setToken = (t: string | null) => { token = t; };

export class ApiError extends Error {
  constructor(public status: number, public code: string, public body: any = {}) {
    super(code);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'unknown', data);
  return data as T;
}

/** Transforma o caminho salvo no banco (/uploads/...) em URL completa para <Image>. */
export const mediaUrl = (path: string | null | undefined) =>
  !path ? null : /^https?:\/\//.test(path) ? path : API_URL + path;

export type ImageKind = 'avatar' | 'cover';
/** Imagem escolhida pelo expo-image-picker (no navegador vem com `file`). */
type PickedImage = { uri: string; mimeType?: string; fileName?: string | null; file?: File };

/** 'avatar' e 'cover' já salvam no perfil; 'post' só sobe o arquivo e devolve a URL para usar no post. */
async function uploadImage(kind: ImageKind | 'post', img: PickedImage) {
  const form = new FormData();
  if (Platform.OS === 'web') {
    form.append('image', img.file ?? (await (await fetch(img.uri)).blob()), img.fileName ?? `${kind}.jpg`);
  } else {
    // No React Native, FormData aceita { uri, name, type } e lê o arquivo do aparelho
    form.append('image', { uri: img.uri, name: img.fileName ?? `${kind}.jpg`, type: img.mimeType ?? 'image/jpeg' } as any);
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}${kind === 'post' ? '/uploads/image' : `/me/${kind}`}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
  } catch {
    throw new ApiError(0, 'network');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'unknown', data);
  return data as { url: string };
}

/* ───────── Tipos (espelham server/src/routes.ts) ───────── */
export type User = { id: string; username: string };
export type Category = 'anime' | 'kpop' | 'series' | 'games' | 'music' | 'sports' | 'teams' | 'players';
export type Community = { id: string; slug: string; name: string; description: string; category: Category; members: number };
export type Profile = {
  id: string; username: string; display_name: string; bio: string | null; avatar_url: string | null;
  cover_url: string | null;
  hide_ratings: boolean; wall_policy: 'everyone' | 'following';
  invisible?: boolean; // só vem no seu próprio perfil
  status_text: string | null; status_emoji: string | null;
  fandoms: { id: string; slug: string; name: string; category: Category }[];
  ratings: Partial<Record<RatingType, { total: number; week: number }>> | null;
  canRateAt: string | null;
  followers: number; following: number; isFollowing: boolean; followsMe: boolean; iBlocked: boolean;
};
export type CommunityDetail = Community & { myRole: 'member' | 'mod' | 'owner' | null };
export type UserSummary = { username: string; displayName: string; avatarUrl: string | null };
export type Comment = { id: string; content: string; createdAt: string; authorUsername: string; authorAvatar: string | null };
export type NotificationType = 'like' | 'comment' | 'wall' | 'rating' | 'follow';
export type Notification = {
  id: number; type: NotificationType; postId: string | null; read: boolean; createdAt: string;
  actorUsername: string; actorAvatar: string | null; communityId: string | null; communityName: string | null;
};
export type Room = {
  id: string; kind: 'community' | 'dm'; communityName: string | null; communityId: string | null;
  peer: string | null; peerAvatar: string | null; lastMessage: string | null; lastAt: string | null; unread: number;
};
export type Message = { id: number; roomId?: string; content: string; createdAt: string; senderUsername: string };
export type ReportTarget = 'user' | 'post' | 'comment' | 'wall';
export type WallPost = {
  id: number; parentId: number | null; content: string; createdAt: string;
  authorUsername: string; authorAvatar: string | null;
};

export type PostRatingType = 'superfan' | 'cool' | 'hot' | 'boring';
export type Post = {
  id: string; communityId: string; communityName: string; content: string; imageUrl: string | null;
  isSpoiler: boolean; tags: string[]; createdAt: string; authorUsername: string; authorAvatar: string | null;
  likes: number; comments: number; likedByMe: boolean;
  ratings?: Partial<Record<PostRatingType, number>>; myRating?: PostRatingType | null;
};
/** Cursor para a próxima página: depois do último post recebido. */
export const cursorAfter = (posts: Post[]) => {
  const last = posts[posts.length - 1];
  return last ? `${last.createdAt}|${last.id}` : undefined;
};

/* ───────── Endpoints ───────── */
export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('POST', '/auth/login', { email, password }),
  register: (username: string, email: string, password: string) =>
    request<{ token: string; user: User }>('POST', '/auth/register', { username, email, password }),

  communities: (category?: Category) =>
    request<Community[]>('GET', `/communities${category ? `?category=${category}` : ''}`),
  joinCommunity: (id: string) => request<void>('POST', `/communities/${id}/join`),
  leaveCommunity: (id: string) => request<void>('DELETE', `/communities/${id}/join`),

  feed: (cursor?: string) =>
    request<Post[]>('GET', `/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  communityPosts: (id: string, cursor?: string) =>
    request<Post[]>('GET', `/communities/${id}/posts${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  createPost: (communityId: string, content: string, isSpoiler: boolean, imageUrl?: string) =>
    request<{ id: string }>('POST', `/communities/${communityId}/posts`, { content, isSpoiler, imageUrl }),
  comments: (postId: string) => request<Comment[]>('GET', `/posts/${postId}/comments`),
  addComment: (postId: string, content: string) => request<{ id: string }>('POST', `/posts/${postId}/comments`, { content }),
  deleteComment: (id: string) => request<void>('DELETE', `/comments/${id}`),

  community: (id: string) => request<CommunityDetail>('GET', `/communities/${id}`),
  createCommunity: (c: { slug: string; name: string; description: string; category: Category }) =>
    request<{ id: string; roomId: string }>('POST', '/communities', c),
  communityRoom: (id: string) => request<{ roomId: string }>('POST', `/communities/${id}/room`),
  search: (term: string) =>
    request<{ users: UserSummary[]; communities: Community[] }>('GET', `/search?q=${encodeURIComponent(term)}`),
  deletePost: (id: string) => request<void>('DELETE', `/posts/${id}`),
  like: (postId: string) => request<{ liked: boolean }>('POST', `/posts/${postId}/like`),
  ratePost: (postId: string, type: PostRatingType) =>
    request<{ myRating: PostRatingType | null; ratings: Partial<Record<PostRatingType, number>> }>('POST', `/posts/${postId}/rating`, { type }),

  profile: (username: string) => request<Profile>('GET', `/users/${encodeURIComponent(username)}`),
  setStatus: (text: string | null, emoji: string | null, expiresInHours: number | null) =>
    request<void>('PATCH', '/me/status', { text, emoji, expiresInHours }),
  updateSettings: (s: Partial<{
    displayName: string; bio: string; wallPolicy: 'everyone' | 'following'; hideRatings: boolean; invisible: boolean;
  }>) => request<void>('PATCH', '/me/settings', s),
  uploadImage,
  removeImage: (kind: ImageKind) => request<void>('DELETE', `/me/${kind}`),
  rate: (username: string, type: RatingType) =>
    request<void>('POST', `/users/${encodeURIComponent(username)}/ratings`, { type }),

  wall: (username: string, before?: number) =>
    request<WallPost[]>('GET', `/users/${encodeURIComponent(username)}/wall${before ? `?before=${before}` : ''}`),
  postWall: (username: string, content: string, parentId?: number) =>
    request<{ id: number }>('POST', `/users/${encodeURIComponent(username)}/wall`, { content, parentId }),
  deleteWall: (id: number) => request<void>('DELETE', `/wall/${id}`),

  follow: (username: string) => request<void>('POST', `/users/${encodeURIComponent(username)}/follow`),
  unfollow: (username: string) => request<void>('DELETE', `/users/${encodeURIComponent(username)}/follow`),
  follows: (username: string, kind: 'followers' | 'following') =>
    request<UserSummary[]>('GET', `/users/${encodeURIComponent(username)}/follows?kind=${kind}`),
  block: (username: string) => request<void>('POST', `/users/${encodeURIComponent(username)}/block`),
  unblock: (username: string) => request<void>('DELETE', `/users/${encodeURIComponent(username)}/block`),
  blocks: () => request<UserSummary[]>('GET', '/me/blocks'),
  report: (targetType: ReportTarget, targetId: string, reason: string) =>
    request<void>('POST', '/reports', { targetType, targetId, reason }),

  notifications: (before?: number) => request<Notification[]>('GET', `/notifications${before ? `?before=${before}` : ''}`),
  unreadCount: () => request<{ count: number }>('GET', '/notifications/unread-count'),
  markNotificationsRead: () => request<void>('POST', '/notifications/read'),

  forgotPassword: (email: string) => request<void>('POST', '/auth/forgot', { email }),
  resetPassword: (token: string, password: string) => request<void>('POST', '/auth/reset', { token, password }),

  rooms: () => request<Room[]>('GET', '/rooms'),
  messages: (roomId: string, before?: number) =>
    request<Message[]>('GET', `/rooms/${roomId}/messages${before ? `?before=${before}` : ''}`),
  markRoomRead: (roomId: string, lastId: number) => request<void>('POST', `/rooms/${roomId}/read`, { lastId }),
  openDm: (username: string) => request<{ roomId: string }>('POST', `/dm/${encodeURIComponent(username)}`),
};

/** Socket.IO autenticado com o mesmo token (para o chat em tempo real). */
export const connectSocket = (): Socket => io(API_URL, { auth: { token }, transports: ['websocket'] });

/** Mensagens amigáveis para os códigos de erro do servidor. */
export function errorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Algo deu errado. Tente de novo.';
  const map: Record<string, string> = {
    network: `Não consegui falar com o servidor em ${API_URL}. Ele está rodando? Celular e computador estão na mesma rede Wi-Fi?`,
    invalid_credentials: 'E-mail ou senha incorretos.',
    already_exists: 'Esse nome de usuário ou e-mail já está em uso.',
    invalid_input: 'Confira os campos: usuário com 3–20 letras minúsculas, números ou _, e senha com pelo menos 8 caracteres.',
    unauthorized: 'Sua sessão expirou. Entre de novo.',
    user_not_found: 'Fã não encontrado.',
    cannot_rate_self: 'Você não pode avaliar a si mesmo.',
    account_too_new: 'Sua conta precisa ter mais de 24 horas para avaliar outros fãs.',
    weekly_limit: 'Você já avaliou este fã nesta semana.',
    wall_restricted: 'Este fã só aceita recados de quem ele segue.',
    image_too_large: 'A imagem é grande demais (máximo 5 MB).',
    image_invalid_type: 'Use uma imagem JPG, PNG ou WebP.',
    image_required: 'Escolha uma imagem.',
    cannot_post_own_wall: 'O mural é para os outros fãs deixarem recados para você.',
    cannot_leave: 'O dono não pode sair da própria comunidade.',
    not_a_member: 'Entre na comunidade para poder postar.',
    not_found: 'Não encontrado (talvez já tenha sido apagado).',
    too_many_requests: 'Muitas tentativas. Espere um minuto.',
    blocked: 'Não é possível interagir com este fã.',
    cannot_block_self: 'Você não pode bloquear a si mesmo.',
    cannot_follow_self: 'Você não pode seguir a si mesmo.',
    cannot_dm_self: 'Você não pode mandar mensagem para si mesmo.',
    invalid_or_expired_token: 'Código inválido ou expirado. Peça um novo.',
    not_in_room: 'Você não participa desta conversa.',
  };
  if (e.status === 429 && e.code === 'unknown') return map.too_many_requests;
  return map[e.code] ?? `Erro (${e.code}).`;
}
