-- 2026-11-13: notificações, bloqueios, denúncias e redefinição de senha

create table if not exists notifications (
  id bigserial primary key,
  user_id uuid not null references users on delete cascade,   -- quem recebe
  actor_id uuid not null references users on delete cascade,  -- quem fez a ação
  type text not null check (type in ('like','comment','wall','rating','follow')),
  post_id uuid references posts on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (user_id <> actor_id)
);
create index if not exists notifications_user_idx on notifications (user_id, id desc);

create table if not exists blocks (
  blocker_id uuid not null references users on delete cascade,
  blocked_id uuid not null references users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocked_idx on blocks (blocked_id);

create table if not exists reports (
  id bigserial primary key,
  reporter_id uuid not null references users on delete cascade,
  target_type text not null check (target_type in ('user','post','comment','wall')),
  target_id text not null,
  reason text not null check (char_length(reason) between 1 and 500),
  status text not null default 'open' check (status in ('open','reviewed','dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists reports_status_idx on reports (status, created_at);

-- Guarda só o hash do token; o token em si vai no link e expira em 1 hora
create table if not exists password_resets (
  token_hash text primary key,
  user_id uuid not null references users on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists password_resets_user_idx on password_resets (user_id);
