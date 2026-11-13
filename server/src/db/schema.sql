create extension if not exists pgcrypto;

create table users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  email text unique not null,
  password_hash text not null,
  display_name text,
  bio text not null default '',
  avatar_url text,
  cover_url text,                           -- capa do perfil
  status_text text,
  status_emoji text,
  status_expires_at timestamptz,            -- null = não expira
  invisible boolean not null default false, -- modo invisível (presença)
  hide_ratings boolean not null default false,
  wall_policy text not null default 'everyone' check (wall_policy in ('everyone','following')),
  created_at timestamptz not null default now()
);

create table follows (
  follower_id uuid not null references users on delete cascade,
  followee_id uuid not null references users on delete cascade,
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create table communities (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]{3,40}$'),
  name text not null,
  description text not null default '',
  category text not null check (category in ('anime','kpop','series','games','music','sports','teams','players')),
  owner_id uuid not null references users,
  created_at timestamptz not null default now()
);

create table memberships (
  user_id uuid not null references users on delete cascade,
  community_id uuid not null references communities on delete cascade,
  role text not null default 'member' check (role in ('member','mod','owner')),
  primary key (user_id, community_id)
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities on delete cascade,
  author_id uuid not null references users on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  image_url text,
  is_spoiler boolean not null default false,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index on posts (community_id, created_at desc, id desc);

create table likes (
  post_id uuid not null references posts on delete cascade,
  user_id uuid not null references users on delete cascade,
  primary key (post_id, user_id)
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts on delete cascade,
  author_id uuid not null references users on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);
create index on comments (post_id, created_at);

-- Mural de recados
create table wall_posts (
  id bigserial primary key,
  profile_id uuid not null references users on delete cascade,
  author_id uuid not null references users on delete cascade,
  parent_id bigint references wall_posts on delete cascade,
  content text not null check (char_length(content) between 1 and 300),
  created_at timestamptz not null default now()
);
create index on wall_posts (profile_id, id desc);

-- Avaliações de fã (1 por semana por par, garantido na rota com advisory lock)
create table fan_ratings (
  id bigserial primary key,
  rater_id uuid not null references users on delete cascade,
  target_id uuid not null references users on delete cascade,
  type text not null check (type in ('superfan','cool','hot','boring')),
  created_at timestamptz not null default now(),
  check (rater_id <> target_id)
);
create index on fan_ratings (rater_id, target_id, created_at desc);
create index on fan_ratings (target_id);

-- Chat: uma sala por comunidade + salas privadas (dm)
create table rooms (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('community','dm')),
  community_id uuid unique references communities on delete cascade,
  created_at timestamptz not null default now()
);
create table room_members (
  room_id uuid not null references rooms on delete cascade,
  user_id uuid not null references users on delete cascade,
  last_read_id bigint not null default 0,
  primary key (room_id, user_id)
);
create table messages (
  id bigserial primary key,
  room_id uuid not null references rooms on delete cascade,
  sender_id uuid not null references users on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on messages (room_id, id desc);

create table post_ratings (
  post_id uuid not null references posts on delete cascade,
  user_id uuid not null references users on delete cascade,
  type text not null check (type in ('superfan','cool','hot','boring')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index on post_ratings (post_id, type);
