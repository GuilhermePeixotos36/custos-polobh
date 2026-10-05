-- ============================================================================
-- Limpar o banco — ferramenta exclusiva do desenvolvedor   (01/10/2026)
--
-- Pedido: "arrumar jeito de limpar o banco em que só o dev possa fazer isso,
-- com uma senha do dev, que eu consiga trocar depois, e que só apareça pra mim".
--
-- Três travas, uma em cima da outra:
--   1. PAPEL: só 'Admin' — o papel do desenvolvedor, que não pertence a área
--      nenhuma da Pólobh. Nenhuma área pode receber 'Admin' (PAPEIS_AREA).
--   2. SENHA PRÓPRIA, diferente da senha de login: quem pegar o notebook do dev
--      com a sessão aberta ainda não apaga nada. Guardada só como hash bcrypt,
--      numa tabela que NINGUÉM lê pela API (RLS ligada e sem política).
--   3. Confirmação digitada na tela ("LIMPAR").
--
-- Não existe senha padrão no código: a primeira chamada de `dev_definir_senha`
-- (pelo Admin, sem senha atual) cria a senha; daí em diante trocar exige a atual.
--
-- O que a limpeza apaga: projetos e tudo o que pende deles (EC, OS, check-list,
-- credenciamento, travas de edição). Opcionalmente: clientes e fornecedores; e o
-- histórico (logs, e-mails, chamados, registros de back-up).
-- O que NUNCA apaga: usuários, perfis, áreas, empresas do grupo, configurações e
-- as listas padrão do check-list — sem eles o sistema não abre.
-- Arquivos já enviados aos buckets (anexos) não saem por SQL; ficam órfãos e
-- podem ser apagados pelo painel do Supabase › Storage.
-- ============================================================================

create table if not exists dev_segredo (
  id int primary key default 1 check (id = 1),
  hash text not null,
  atualizado_em timestamptz not null default now()
);

comment on table dev_segredo is
  'Hash (bcrypt) da senha de manutenção do desenvolvedor. Sem política de RLS: só as funções dev_* leem.';

alter table dev_segredo enable row level security;
revoke all on table dev_segredo from public, anon, authenticated;

create or replace function e_dev()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(papel_atual() = 'Admin', false)
$function$;

/** Há senha cadastrada? (A tela decide entre "criar senha" e "trocar senha".) */
create or replace function dev_senha_definida()
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  if not e_dev() then
    raise exception 'Acesso restrito ao desenvolvedor.' using errcode = '42501';
  end if;
  return exists (select 1 from dev_segredo);
end
$function$;

/** Cria (primeira vez) ou troca a senha de manutenção. */
create or replace function dev_definir_senha(atual text, nova text)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  guardado text;
begin
  if not e_dev() then
    raise exception 'Acesso restrito ao desenvolvedor.' using errcode = '42501';
  end if;
  if coalesce(length(nova), 0) < 8 then
    raise exception 'A senha nova precisa ter pelo menos 8 caracteres.';
  end if;
  select hash into guardado from dev_segredo where id = 1;
  if guardado is not null and crypt(coalesce(atual, ''), guardado) <> guardado then
    raise exception 'Senha atual incorreta.' using errcode = '28P01';
  end if;
  insert into dev_segredo (id, hash, atualizado_em)
  values (1, crypt(nova, gen_salt('bf', 10)), now())
  on conflict (id) do update set hash = excluded.hash, atualizado_em = now();

  insert into audit_log (nivel, categoria, acao, mensagem, usuario, papel, user_id)
  select 'aviso', 'Configuração', 'dev.senha',
         case when guardado is null then 'Senha de manutenção criada' else 'Senha de manutenção trocada' end,
         p.nome, p.papel, auth.uid()
    from perfis p where p.id = auth.uid();
end
$function$;

/**
 * Apaga os dados de movimento. Tudo numa transação só: ou limpa tudo, ou nada.
 * Devolve quantas linhas saíram de cada tabela.
 */
create or replace function dev_limpar_banco(senha text, cadastros boolean default false, historico boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  guardado text;
  resultado jsonb := '{}'::jsonb;
  n bigint;
  tabela text;
  tabelas text[] := array[
    'credenciamentos', 'os_financeiro', 'os_linhas', 'oss',
    'ec_linhas', 'ecs', 'checklist_itens', 'checklists',
    'edicoes_abertas', 'projetos'
  ];
begin
  if not e_dev() then
    raise exception 'Acesso restrito ao desenvolvedor.' using errcode = '42501';
  end if;
  select hash into guardado from dev_segredo where id = 1;
  if guardado is null then
    raise exception 'Defina a senha de manutenção antes de limpar o banco.';
  end if;
  -- (Não dá para registrar a tentativa errada no log: o `raise` desfaz a
  -- transação inteira, inclusive o registro.)
  if crypt(coalesce(senha, ''), guardado) <> guardado then
    raise exception 'Senha de manutenção incorreta.' using errcode = '28P01';
  end if;

  if cadastros then tabelas := tabelas || array['clientes', 'fornecedores']; end if;
  if historico then tabelas := tabelas || array['emails', 'chamados', 'backups', 'audit_log']; end if;

  foreach tabela in array tabelas loop
    -- `where true`: o Supabase recusa DELETE sem WHERE (safeupdate).
    execute format('delete from %I where true', tabela);
    get diagnostics n = row_count;
    resultado := resultado || jsonb_build_object(tabela, n);
  end loop;

  -- O registro da limpeza fica, mesmo quando o histórico foi apagado.
  insert into audit_log (nivel, categoria, acao, mensagem, usuario, papel, user_id)
  select 'aviso', 'Configuração', 'dev.limpar',
         'Banco limpo pelo desenvolvedor: ' || resultado::text, p.nome, p.papel, auth.uid()
    from perfis p where p.id = auth.uid();

  return resultado;
end
$function$;

revoke all on function e_dev() from public, anon;
revoke all on function dev_senha_definida() from public, anon;
revoke all on function dev_definir_senha(text, text) from public, anon;
revoke all on function dev_limpar_banco(text, boolean, boolean) from public, anon;
grant execute on function e_dev() to authenticated;
grant execute on function dev_senha_definida() to authenticated;
grant execute on function dev_definir_senha(text, text) to authenticated;
grant execute on function dev_limpar_banco(text, boolean, boolean) to authenticated;
