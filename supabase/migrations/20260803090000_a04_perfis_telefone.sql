-- A-04 — Alinha o repositório com o que já estava aplicado em produção.
--
-- A coluna `perfis.telefone` foi criada direto no projeto do Supabase e nunca
-- versionada, então um ambiente novo provisionado pelo repositório nascia sem
-- ela e o login quebrava (store/auth.ts consulta `telefone` no carregarPerfil).
--
-- Idempotente de propósito: em produção a coluna já existe e este arquivo só
-- registra a migração; em ambiente novo, ele cria.

alter table public.perfis
  add column if not exists telefone text not null default '';

comment on column public.perfis.telefone is
  'Telefone do usuário. Preenche o contato da produtora responsável no projeto/EC.';
