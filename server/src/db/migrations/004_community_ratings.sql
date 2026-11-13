-- Avaliações ficam só em perfis e comunidades: a tabela dos posts sai.
drop table if exists post_ratings;

-- Avaliações de comunidade (Superfan, Cool, Fire, Boring): mesma regra do perfil, 1 voto por semana por comunidade.
create table if not exists community_ratings (
  id bigserial primary key,
  rater_id uuid not null references users(id) on delete cascade,
  community_id uuid not null references communities(id) on delete cascade,
  type text not null check (type in ('superfan','cool','hot','boring')),
  created_at timestamptz not null default now()
);
create index if not exists community_ratings_rater on community_ratings (rater_id, community_id, created_at desc);
create index if not exists community_ratings_community on community_ratings (community_id);
