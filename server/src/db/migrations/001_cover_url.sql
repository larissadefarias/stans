-- 2026-11-13: capa do perfil (foto de perfil já usa users.avatar_url)
alter table users add column if not exists cover_url text;
