-- Segurança para menores e moderação
-- birth_date: obrigatória no cadastro (mínimo 13 anos); contas antigas preenchem ao entrar e não podem trocar depois
-- banned_at: conta banida pela moderação (não entra mais)
-- is_moderator: vê a tela de denúncias
alter table users add column if not exists birth_date date;
alter table users add column if not exists banned_at timestamptz;
alter table users add column if not exists is_moderator boolean not null default false;

update users set is_moderator = true where username = 'lari12345';
