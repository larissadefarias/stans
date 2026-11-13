-- Avaliações nos posts (Superfan, Cool, Hot, Boring): cada fã dá no máximo uma por post e pode trocar ou tirar.
create table if not exists post_ratings (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  type text not null check (type in ('superfan','cool','hot','boring')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_ratings_post_type on post_ratings (post_id, type);
