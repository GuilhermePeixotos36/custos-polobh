-- =====================================================================
-- LOGS — padrão LSPRO (24/11/2026)
--
-- A tela "Logs" passa a ter três abas (Atividades, Acessos, Erros) e um motor próprio: a tabela
-- `log_evento`, só de inserção, alimentada por três portas (front, falha de login, banco) e pelas
-- Edge Functions (service role, `supabase/functions/_shared/log.ts`). Modelo: skill
-- `logs-padrao-lspro` (migração 236 do DP Corp), adaptado à Pólobh:
--
--  · QUEM LÊ: quem tem o recurso `logs` — exatamente a regra do `useAuth().pode("logs")` do
--    front (Administrador sempre; área com recursos marcados só se `logs` estiver entre eles).
--    Fica numa função só, `public.pode_ver_logs()`. Quando o padrão de Acessos chegar (outra
--    branch), trocar o corpo por `public.tem_permissao('admin.logs', 'ver')` e pronto.
--  · TRILHA EXISTENTE: a `audit_log` (gravada pelo front com `auditar()`, pelas Edges
--    backup-diario e ia-uso) NÃO é migrada nem apagada, e o expurgo novo não toca nela (ela
--    segue com a retenção de 2 anos de `aplicar_retencao_de_dados`). Ela é UNIDA na consulta da
--    aba Atividades — só para quem pode auditar, que hoje é quem a RLS da `audit_log` deixa ler
--    (papel Administrador; `private.pode_auditar_trilha()`).
--  · A policy de INSERT da `audit_log` continua aberta à sessão (`audit_insert`): quem insere é o
--    próprio front. Fechar exige antes levar esses registros para o banco — pendência registrada,
--    não desta leva (lição "fechar INSERT aberto só depois de conferir").
--  · Prazos: erros 90 dias, acessos 12 meses, atividades 5 anos (job `polobh-expurgo-logs`).
--
-- Ensaio antes de aplicar: `supabase/ensaios/20261124120000_logs_padrao.ensaio.sql`
-- (begin … rollback). Reverter: `cron.unschedule('polobh-expurgo-logs')`, drop das funções
-- abaixo e da tabela `log_evento`.
-- =====================================================================

create schema if not exists private;

-- --- Portão de leitura ------------------------------------------------------
-- UM lugar decide quem lê o log; a policy e a consulta chamam esta função.
-- `recurso_da_area(chave, níveis sem área)` é a mesma regra do `pode()` do front: Administrador
-- sempre; área com recursos marcados decide pela lista; sem área, só os níveis passados — e na
-- matriz de fábrica (`PERMISSOES` em src/store/auth.ts) só o Administrador tem `logs`.
-- plpgsql de propósito: o corpo só é resolvido na execução, e trocar para `tem_permissao` do
-- padrão de Acessos é uma linha.
create or replace function public.pode_ver_logs()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return coalesce(public.recurso_da_area('logs', array['Admin']), false);
exception when others then
  return false;   -- na dúvida, ninguém lê
end;
$$;

-- Quem pode ver o antes/depois da trilha antiga (`audit_log`) na aba Atividades. Ver o log não é
-- poder auditar: hoje a `audit_log` só é lida pelo papel Administrador (policy `audit_read`), e a
-- união repete essa regra — uma área que ganhe o recurso `logs` vê os eventos novos, não a trilha.
create or replace function private.pode_auditar_trilha()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return coalesce(public.papel_atual() = 'Admin', false);
exception when others then
  return false;
end;
$$;

-- --- Nome de quem fez --------------------------------------------------------
-- O nome é COPIADO para o log na hora: o log sobrevive à pessoa.
create or replace function private.nome_do_ator(p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v text;
begin
  if p_id is null then
    return '';
  end if;
  select coalesce(nullif(btrim(p.nome), ''), u.email, '')
    into v
    from auth.users u
    left join public.perfis p on p.id = u.id
   where u.id = p_id;
  return coalesce(v, '');
exception when others then
  return '';
end;
$$;

-- --- Situação de quem fez -----------------------------------------------------
-- 'ativo' | 'inativo' | null (sem perfil: não é usuário do app).
-- `registrar_log` usa isto: quem não tem perfil não grava nada, e conta inativa só grava `login`,
-- `logout` e `acesso_negado` (o que ela ainda consegue fazer antes de ser barrada).
create or replace function private.situacao_do_ator(p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v text;
begin
  if p_id is null then
    return null;
  end if;
  select case when p.ativo then 'ativo' else 'inativo' end into v from public.perfis p where p.id = p_id;
  return v;
exception when others then
  return null;
end;
$$;

-- --- Tabela --------------------------------------------------------------
create table if not exists public.log_evento (
  id          bigint generated always as identity primary key,
  em          timestamptz not null default now(),
  categoria   text not null check (categoria in ('atividade', 'acesso', 'erro')),
  nivel       text not null default 'info' check (nivel in ('info', 'aviso', 'erro', 'critico')),
  acao        text not null check (acao ~ '^[a-z_]{1,40}$'),
  resultado   text not null default 'ok' check (resultado in ('ok', 'negado', 'falha')),
  -- Sem FK: o log sobrevive à pessoa. O nome é copiado na hora.
  ator_id     uuid,
  ator_nome   text not null default '',
  alvo_tipo   text,
  alvo_id     text,
  alvo_rotulo text,
  -- Sempre o CAMINHO da rota, sem query string (é o que o filtro "Tela" compara).
  tela        text,
  origem      text not null check (origem in ('app', 'banco', 'edge', 'rotina')),
  mensagem    text not null default '' check (length(mensagem) <= 500),
  detalhe     jsonb,
  -- Lidos dos cabeçalhos da requisição, nunca informados pelo cliente.
  ip          inet,
  user_agent  text check (length(user_agent) <= 300),
  correlacao  uuid,
  app_versao  text
);

create index if not exists log_evento_categoria_em_idx on public.log_evento (categoria, em desc);
create index if not exists log_evento_ator_em_idx on public.log_evento (ator_id, em desc);
create index if not exists log_evento_correlacao_idx on public.log_evento (correlacao) where correlacao is not null;
-- Freio da falha de login por IP.
create index if not exists log_evento_login_falhou_idx on public.log_evento (ip, em desc) where acao = 'login_falhou';

comment on table public.log_evento is 'Atividades, acessos e erros do app. Só inserção; expurgo por private.expurgar_logs().';

alter table public.log_evento enable row level security;

-- Só leitura, e só para quem o portão deixa. Nenhuma policy de escrita: a sessão não escreve.
drop policy if exists log_evento_leitura on public.log_evento;
create policy log_evento_leitura on public.log_evento
  for select to authenticated
  using ((select public.pode_ver_logs()));

revoke all on public.log_evento from anon;
revoke insert, update, delete, truncate on public.log_evento from authenticated;

-- Só inserção: UPDATE nunca; DELETE só dentro do expurgo; TRUNCATE nunca. Vale para todo mundo,
-- inclusive a service role.
create or replace function private.proteger_log_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and coalesce(current_setting('app.logs_expurgo', true), '') = '1' then
    return old;
  end if;
  raise exception 'O log é só de inserção.' using errcode = '42501';
end;
$$;

drop trigger if exists log_evento_proteger on public.log_evento;
create trigger log_evento_proteger
  before update or delete on public.log_evento
  for each row execute function private.proteger_log_evento();

drop trigger if exists log_evento_proteger_truncate on public.log_evento;
create trigger log_evento_proteger_truncate
  before truncate on public.log_evento
  for each statement execute function private.proteger_log_evento();

-- --- Saneamento ----------------------------------------------------------
-- Caractere de controle vira espaço (quebra de linha forjada não cria "linha falsa") e o texto é cortado.
create or replace function private.limpar_texto(p text, p_max integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p is null then null
              else left(regexp_replace(p, '[[:cntrl:]]', ' ', 'g'), p_max) end;
$$;

-- Mensagem de erro costuma carregar dado pessoal: CPF (11 dígitos, com ou sem pontuação) vira ***
-- e o `Key (coluna)=(valor)` do Postgres (violação de unicidade) perde o valor.
-- A MESMA regra mora em `supabase/functions/_shared/log.ts` (mascararMensagem).
create or replace function private.mascarar_mensagem(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p is null then null
              else regexp_replace(
                     regexp_replace(p, '\m\d{3}\.?\d{3}\.?\d{3}-?\d{2}\M', '***', 'g'),
                     'Key \(([^)]*)\)=\(([^)]*)\)', 'Key (\1)=(***)', 'g')
         end;
$$;

-- "ab***@empresa.com.br": duas primeiras letras do usuário e o domínio inteiro.
create or replace function private.mascarar_email(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
           when p is null or position('@' in btrim(p)) < 2 then '***'
           else left(lower(btrim(split_part(btrim(p), '@', 1))), 2) || '***@'
                || left(lower(btrim(substr(btrim(p), position('@' in btrim(p)) + 1))), 100)
         end;
$$;

-- Tira do `detalhe` as chaves que nunca podem entrar (por nome, sem caixa), em objetos e listas,
-- até 5 níveis; mais fundo que isso vira null.
create or replace function private.sanear_detalhe_no(p jsonb, p_nivel integer)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  -- As MESMAS listas moram em `supabase/functions/_shared/log.ts` (o teste
  -- src/lib/logs/logsEdge.test.ts compara as duas). Da Pólobh: `cnpj` e `documento` (cadastro
  -- de fornecedor e cliente), `banco`, `chave_pix` e `chavepix` (dados bancários do fornecedor).
  -- Por CONTÉM (sem caixa): pega `senhaNova`, `x_token`, `cpfDoCliente`…
  v_contem constant text[] := array[
    'senha', 'password', 'token', 'secret', 'authorization', 'cookie', 'cpf', 'salario', 'apikey', 'api_key',
    'cnpj', 'documento'
  ];
  -- Curtas demais para "contém" (pegariam palavra comum): só o nome inteiro.
  v_exatas constant text[] := array['passwd', 'rg', 'pis', 'ctps', 'conta', 'agencia', 'pix', 'banco', 'chave_pix', 'chavepix'];
  v_saida jsonb;
  v_chave text;
  v_valor jsonb;
begin
  if p_nivel > 5 then
    return 'null'::jsonb;
  end if;
  case jsonb_typeof(p)
    when 'object' then
      v_saida := '{}'::jsonb;
      for v_chave, v_valor in select * from jsonb_each(p) loop
        if lower(v_chave) = any (v_exatas)
           or exists (select 1 from unnest(v_contem) as x where lower(v_chave) like '%' || x || '%') then
          continue;
        end if;
        v_saida := v_saida || jsonb_build_object(v_chave, private.sanear_detalhe_no(v_valor, p_nivel + 1));
      end loop;
      return v_saida;
    when 'array' then
      select coalesce(jsonb_agg(private.sanear_detalhe_no(e, p_nivel + 1) order by ord), '[]'::jsonb)
        into v_saida
        from jsonb_array_elements(p) with ordinality as t(e, ord);
      return v_saida;
    else
      return p;
  end case;
end;
$$;

-- `detalhe` só pode ser objeto; acima de 4 KB vira {"cortado": true}.
create or replace function private.sanear_detalhe(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return null;
  end if;
  v := private.sanear_detalhe_no(p, 1);
  if octet_length(v::text) > 4096 then
    return '{"cortado": true}'::jsonb;
  end if;
  return v;
end;
$$;

-- --- Origem da requisição --------------------------------------------------
-- O PostgREST deixa os cabeçalhos da requisição em `request.headers`. Fora de uma requisição
-- (cron, SQL direto) não há cabeçalho: volta null.
create or replace function private.cabecalho_da_requisicao(p_nome text)
returns text
language plpgsql
stable
set search_path = ''
as $$
begin
  return (current_setting('request.headers', true)::jsonb) ->> p_nome;
exception when others then
  return null;
end;
$$;

-- IP de quem chamou: `cf-connecting-ip` quando existe; senão a ÚLTIMA entrada de `x-forwarded-for`
-- (a que o proxy acrescenta; as anteriores o cliente pode forjar). Nunca a primeira.
create or replace function private.ip_da_requisicao()
returns inet
language plpgsql
stable
set search_path = ''
as $$
declare
  v text;
begin
  v := nullif(btrim(coalesce(private.cabecalho_da_requisicao('cf-connecting-ip'), '')), '');
  if v is null then
    select nullif(btrim(t.x), '') into v
      from unnest(string_to_array(coalesce(private.cabecalho_da_requisicao('x-forwarded-for'), ''), ',')) with ordinality as t(x, n)
     order by t.n desc
     limit 1;
  end if;
  return v::inet;
exception when others then
  return null;
end;
$$;

-- --- Gravação central --------------------------------------------------------
-- Todo caminho (front, banco, rotina) passa por aqui. Valida, saneia, freia e NUNCA levanta erro.
create or replace function private.gravar_log(
  p_categoria  text,
  p_nivel      text,
  p_acao       text,
  p_resultado  text,
  p_ator_id    uuid,
  p_ator_nome  text,
  p_tela       text,
  p_mensagem   text,
  p_alvo_tipo  text,
  p_alvo_id    text,
  p_alvo_rotulo text,
  p_detalhe    jsonb,
  p_origem     text,
  p_ip         inet,
  p_user_agent text,
  p_correlacao text,
  p_app_versao text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_categoria is null or p_categoria not in ('atividade', 'acesso', 'erro') then
    return;
  end if;
  if p_acao is null or p_acao !~ '^[a-z_]{1,40}$' then
    return;
  end if;
  if p_origem is null or p_origem not in ('app', 'banco', 'edge', 'rotina') then
    return;
  end if;
  -- Freio: mais de 60 eventos do mesmo ator no último minuto não são gravados (em silêncio).
  if p_ator_id is not null
     and (select count(*) from public.log_evento l where l.ator_id = p_ator_id and l.em > now() - interval '1 minute') >= 60 then
    return;
  end if;

  insert into public.log_evento (
    categoria, nivel, acao, resultado, ator_id, ator_nome, alvo_tipo, alvo_id, alvo_rotulo,
    tela, origem, mensagem, detalhe, ip, user_agent, correlacao, app_versao
  ) values (
    p_categoria,
    case when p_nivel in ('info', 'aviso', 'erro', 'critico') then p_nivel else 'info' end,
    p_acao,
    case when p_resultado in ('ok', 'negado', 'falha') then p_resultado else 'ok' end,
    p_ator_id,
    coalesce(private.limpar_texto(p_ator_nome, 200), ''),
    private.limpar_texto(p_alvo_tipo, 60),
    private.limpar_texto(p_alvo_id, 200),
    private.limpar_texto(p_alvo_rotulo, 300),
    -- A tela perde a query string e o fragmento: filtro e token nunca vão para o log.
    private.limpar_texto(split_part(split_part(p_tela, '?', 1), '#', 1), 200),
    p_origem,
    left(coalesce(private.mascarar_mensagem(private.limpar_texto(p_mensagem, 500)), ''), 500),
    private.sanear_detalhe(p_detalhe),
    p_ip,
    private.limpar_texto(p_user_agent, 300),
    case when p_correlacao ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p_correlacao::uuid end,
    private.limpar_texto(p_app_versao, 40)
  );
exception when others then
  null;
end;
$$;

-- --- Para o front ----------------------------------------------------------------
-- p = { acao, nivel?, resultado?, tela?, mensagem?, detalhe?, alvoTipo?, alvoId?, alvoRotulo?,
--       correlacao?, appVersao? }. Sem usuário autenticado, não grava.
-- LISTA FECHADA: só as SEIS ações que o app manda. A categoria sai da ação, não do corpo — a
-- sessão não consegue forjar "usuario_criado" nem escolher a aba em que o evento aparece.
-- Ação nova do front = linha aqui E em `ACOES_DO_APP` (src/lib/logs/registrarLog.ts).
-- O ator é SEMPRE `auth.uid()`; o cliente não escolhe quem fez, nem IP, nem user-agent, nem origem.
create or replace function public.registrar_log(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_situacao  text;
  v_acao      text;
  v_categoria text;
begin
  if v_uid is null or p is null or jsonb_typeof(p) <> 'object' then
    return;
  end if;
  v_acao := p ->> 'acao';
  v_categoria := case v_acao
    when 'login' then 'acesso'
    when 'logout' then 'acesso'
    when 'acesso_negado' then 'acesso'
    when 'erro_requisicao' then 'erro'
    when 'erro_js' then 'erro'
    when 'exportacao' then 'atividade'
    else null
  end;
  if v_categoria is null then
    return;
  end if;

  v_situacao := private.situacao_do_ator(v_uid);
  if v_situacao is null then
    return;
  end if;
  if v_situacao <> 'ativo' and v_acao not in ('login', 'logout', 'acesso_negado') then
    return;
  end if;

  perform private.gravar_log(
    v_categoria, p ->> 'nivel', v_acao, p ->> 'resultado',
    v_uid, private.nome_do_ator(v_uid), p ->> 'tela', p ->> 'mensagem',
    p ->> 'alvoTipo', p ->> 'alvoId', p ->> 'alvoRotulo',
    case when jsonb_typeof(p -> 'detalhe') = 'object' then p -> 'detalhe' end,
    'app', private.ip_da_requisicao(), private.cabecalho_da_requisicao('user-agent'),
    p ->> 'correlacao', p ->> 'appVersao'
  );
exception when others then
  null;
end;
$$;

-- Falha de login: quem chama ainda não tem sessão (por isso liberada ao `anon`). Ação fixa,
-- e-mail mascarado, freio por IP (20 por minuto) e teto global (120 por minuto). Não aceita mais
-- nada do cliente.
create or replace function public.registrar_falha_de_login(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ip inet := private.ip_da_requisicao();
begin
  -- O teto global existe porque o IP pode ser nulo ou trocado a cada chamada.
  if (select count(*) from public.log_evento l
       where l.acao = 'login_falhou' and l.em > now() - interval '1 minute'
         and l.ip is not distinct from v_ip) >= 20
     or (select count(*) from public.log_evento l
          where l.acao = 'login_falhou' and l.em > now() - interval '1 minute') >= 120 then
    return;
  end if;
  perform private.gravar_log(
    'acesso', 'aviso', 'login_falhou', 'falha', null, '', '/login',
    'Falha de login: ' || private.mascarar_email(left(coalesce(p_email, ''), 254)),
    null, null, null, null, 'app', v_ip, private.cabecalho_da_requisicao('user-agent'), null, null
  );
exception when others then
  null;
end;
$$;

-- Para RPCs e gatilhos do banco (usuário liberado, rotina que falhou…).
--   perform private.registrar_log_interno('acesso', 'info', 'usuario_inativado', 'ok',
--     (select auth.uid()), '/configuracoes', '', 'usuario', v_alvo::text, v_nome_do_alvo, null);
-- Rotina sem usuário: `p_ator_id` null e `p_origem` 'rotina'.
create or replace function private.registrar_log_interno(
  p_categoria   text,
  p_nivel       text,
  p_acao        text,
  p_resultado   text,
  p_ator_id     uuid,
  p_tela        text,
  p_mensagem    text,
  p_alvo_tipo   text,
  p_alvo_id     text,
  p_alvo_rotulo text,
  p_detalhe     jsonb,
  p_origem      text default 'banco'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.gravar_log(
    p_categoria, p_nivel, p_acao, p_resultado, p_ator_id, private.nome_do_ator(p_ator_id), p_tela, p_mensagem,
    p_alvo_tipo, p_alvo_id, p_alvo_rotulo, p_detalhe, coalesce(p_origem, 'banco'),
    private.ip_da_requisicao(), private.cabecalho_da_requisicao('user-agent'), null, null
  );
exception when others then
  null;
end;
$$;

-- --- Consulta -------------------------------------------------------------------
-- p = { aba: 'atividades'|'acessos'|'erros', de, ate, usuarioId?, nivel?, resultado?, tela?,
--       telas?: text[], origem?, busca?, correlacao?, pagina? (máx. 100000), porPagina? (máx. 200),
--       ordem? ('em_desc'|'em_asc') }
-- -> { total, auditoriaIncluida, itens: [...] }. Janela padrão de 7 dias, no máximo 90 por consulta.
-- Filtro, página, ordenação e total são feitos AQUI, não no navegador.
-- Filtro de tela: `tela` casa por igualdade ou como prefixo seguido de "/" (a Pólobh não tem
-- catálogo de telas: o front manda o caminho em `tela` e em `telas`, e "/projetos" acha também
-- "/projetos/<id>"); `telas` (até 50) casa por igualdade com qualquer item.
-- `auditoriaIncluida`: na aba Atividades, se a trilha antiga (`audit_log`) entrou na resposta.
create or replace function public.consultar_logs(p jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_aba      text := coalesce(p ->> 'aba', 'atividades');
  v_cat      text;
  v_ate      timestamptz;
  v_de       timestamptz;
  v_usuario  uuid;
  v_corr     uuid;
  v_nivel    text := nullif(btrim(coalesce(p ->> 'nivel', '')), '');
  v_result   text := nullif(btrim(coalesce(p ->> 'resultado', '')), '');
  v_tela     text := nullif(btrim(coalesce(p ->> 'tela', '')), '');
  v_tela_pref text;
  v_telas    text[];
  v_auditoria boolean;
  v_origem   text := nullif(btrim(coalesce(p ->> 'origem', '')), '');
  v_busca    text := nullif(btrim(coalesce(p ->> 'busca', '')), '');
  v_pagina   integer;
  v_por      integer;
  v_asc      boolean := coalesce(p ->> 'ordem', 'em_desc') = 'em_asc';
  v_resposta jsonb;
begin
  if not public.pode_ver_logs() then
    raise exception 'Você não tem permissão para ver os logs.' using errcode = '42501';
  end if;
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Parâmetros inválidos.' using errcode = '22023';
  end if;
  if v_aba not in ('atividades', 'acessos', 'erros') then
    raise exception 'Aba inválida.' using errcode = '22023';
  end if;
  v_cat := case v_aba when 'atividades' then 'atividade' when 'acessos' then 'acesso' else 'erro' end;

  begin v_ate := (p ->> 'ate')::timestamptz; exception when others then v_ate := null; end;
  begin v_de := (p ->> 'de')::timestamptz; exception when others then v_de := null; end;
  v_ate := coalesce(v_ate, now());
  v_de := coalesce(v_de, v_ate - interval '7 days');
  if v_ate - v_de > interval '90 days' then
    v_de := v_ate - interval '90 days';
  end if;
  if v_de > v_ate then
    v_de := v_ate - interval '7 days';
  end if;

  begin v_usuario := nullif(p ->> 'usuarioId', '')::uuid; exception when others then v_usuario := null; end;
  begin v_corr := nullif(p ->> 'correlacao', '')::uuid; exception when others then v_corr := null; end;
  begin v_pagina := least(100000, greatest(1, coalesce((p ->> 'pagina')::integer, 1))); exception when others then v_pagina := 1; end;
  begin v_por := least(200, greatest(1, coalesce((p ->> 'porPagina')::integer, 50))); exception when others then v_por := 50; end;
  begin
    if jsonb_typeof(p -> 'telas') = 'array' then
      select array_agg(lower(btrim(t.e))) into v_telas
        from (select jsonb_array_elements_text(p -> 'telas') as e limit 50) as t
       where btrim(t.e) <> '';
    end if;
  exception when others then v_telas := null;
  end;
  if v_tela is not null then
    v_tela_pref := replace(replace(replace(lower(v_tela), '\', '\\'), '%', '\%'), '_', '\_') || '/%';
  end if;

  -- A trilha antiga (antes/depois e eventos do `auditar()`) só entra na aba Atividades e só
  -- para quem pode auditar — permissão diferente de ver o log.
  v_auditoria := case when v_aba = 'atividades' then private.pode_auditar_trilha() end;

  -- A busca é texto, nunca padrão: %, _ e \ digitados são comparados ao pé da letra.
  if v_busca is not null then
    v_busca := '%' || replace(replace(replace(v_busca, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  with base as (
    select 'log:' || l.id::text as id, 'log'::text as fonte, l.em, l.categoria, l.nivel, l.acao, l.resultado,
           l.ator_id, l.ator_nome, l.alvo_tipo, l.alvo_id, l.alvo_rotulo, l.tela, l.origem,
           l.mensagem, l.detalhe, host(l.ip) as ip, l.user_agent, l.correlacao
      from public.log_evento l
     where l.categoria = v_cat and l.em >= v_de and l.em <= v_ate

    -- Trilha antiga da Pólobh (`audit_log`, gravada pelo front com `auditar()` e por duas
    -- Edges), mapeada para as 19 colunas de cima. NÃO foi migrada: é lida onde está.
    --   nível     info/aviso/erro (os mesmos nomes);
    --   resultado 'negado' para acesso negado e senha recusada, 'falha' para nível erro;
    --   alvo      tipo = a categoria antiga ("EC", "OS", "Autenticação"…), id = alvo_id;
    --   origem    'app' (quase tudo vem do front).
    union all
    select 'auditoria:' || a.id::text, 'auditoria'::text, a.ts, 'atividade'::text,
           case when a.nivel in ('info', 'aviso', 'erro') then a.nivel else 'info' end,
           a.acao,
           case when a.acao ilike '%negad%' or a.acao ilike '%recusad%' then 'negado'
                when a.nivel = 'erro' then 'falha'
                else 'ok' end,
           a.user_id, coalesce(a.usuario, ''), a.categoria, a.alvo_id, null::text, null::text, 'app'::text,
           a.mensagem,
           nullif(jsonb_strip_nulls(jsonb_build_object('categoria', a.categoria, 'papel', a.papel)), '{}'::jsonb),
           null::text, null::text, null::uuid
      from public.audit_log a
     where v_auditoria and a.ts >= v_de and a.ts <= v_ate
  ), f as (
    select * from base b
     where (v_usuario is null or b.ator_id = v_usuario)
       and (v_nivel is null or b.nivel = v_nivel)
       and (v_result is null or b.resultado = v_result)
       -- Com filtro de tela, a trilha antiga não é filtrada (ela não guarda a tela).
       and ((v_tela is null and v_telas is null)
            or (b.fonte <> 'log' and v_telas is not null)
            or lower(b.tela) = lower(v_tela)
            or lower(b.tela) like v_tela_pref
            or lower(b.tela) = any (v_telas))
       and (v_origem is null or b.origem = v_origem)
       and (v_corr is null or b.correlacao = v_corr)
       and (v_busca is null
            or b.mensagem ilike v_busca or b.acao ilike v_busca or b.ator_nome ilike v_busca
            or coalesce(b.alvo_rotulo, '') ilike v_busca or coalesce(b.alvo_tipo, '') ilike v_busca)
  ), pag as (
    select f.*, row_number() over (
             order by (case when v_asc then f.em end) asc nulls last,
                      (case when not v_asc then f.em end) desc nulls last,
                      f.id) as rn
      from f
     order by rn
     limit v_por offset (v_pagina - 1) * v_por
  )
  select jsonb_build_object(
           'total', (select count(*) from f),
           'auditoriaIncluida', v_auditoria,
           'itens', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', q.id, 'fonte', q.fonte, 'em', q.em, 'categoria', q.categoria, 'nivel', q.nivel,
                      'acao', q.acao, 'resultado', q.resultado, 'atorId', q.ator_id, 'atorNome', q.ator_nome,
                      'alvoTipo', q.alvo_tipo, 'alvoId', q.alvo_id, 'alvoRotulo', q.alvo_rotulo,
                      'tela', q.tela, 'origem', q.origem, 'mensagem', q.mensagem, 'detalhe', q.detalhe,
                      'ip', q.ip, 'userAgent', q.user_agent, 'correlacao', q.correlacao
                    ) order by q.rn)
               from pag q
           ), '[]'::jsonb)
         )
    into v_resposta;

  return v_resposta;
end;
$$;

-- --- Expurgo ---------------------------------------------------------------------
-- Em lotes de 5.000, para não segurar lock. É o ÚNICO caminho que apaga log. Não toca na
-- `audit_log` (a retenção dela é a de `aplicar_retencao_de_dados`, 2 anos).
create or replace function private.expurgar_logs()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_regra record;
  v_linhas integer;
begin
  perform set_config('app.logs_expurgo', '1', true);
  for v_regra in
    select * from (values
      ('erro', interval '90 days'),
      ('acesso', interval '12 months'),
      ('atividade', interval '5 years')
    ) as r (categoria, retencao)
  loop
    loop
      delete from public.log_evento
       where id in (
         select l.id from public.log_evento l
          where l.categoria = v_regra.categoria and l.em < now() - v_regra.retencao
          limit 5000
       );
      get diagnostics v_linhas = row_count;
      exit when v_linhas = 0;
    end loop;
  end loop;
  perform set_config('app.logs_expurgo', '', true);
end;
$$;

-- --- Permissões de execução -------------------------------------------------------
revoke all on function public.pode_ver_logs() from public, anon;
revoke all on function public.registrar_log(jsonb) from public, anon;
revoke all on function public.registrar_falha_de_login(text) from public;
revoke all on function public.consultar_logs(jsonb) from public, anon;
grant execute on function public.pode_ver_logs() to authenticated, service_role;
grant execute on function public.registrar_log(jsonb) to authenticated, service_role;
grant execute on function public.registrar_falha_de_login(text) to anon, authenticated, service_role;
grant execute on function public.consultar_logs(jsonb) to authenticated, service_role;

revoke all on function private.pode_auditar_trilha() from public;
revoke all on function private.nome_do_ator(uuid) from public;
revoke all on function private.situacao_do_ator(uuid) from public;
revoke all on function private.mascarar_mensagem(text) from public;
revoke all on function private.proteger_log_evento() from public;
revoke all on function private.limpar_texto(text, integer) from public;
revoke all on function private.mascarar_email(text) from public;
revoke all on function private.sanear_detalhe_no(jsonb, integer) from public;
revoke all on function private.sanear_detalhe(jsonb) from public;
revoke all on function private.cabecalho_da_requisicao(text) from public;
revoke all on function private.ip_da_requisicao() from public;
revoke all on function private.gravar_log(text, text, text, text, uuid, text, text, text, text, text, text, jsonb, text, inet, text, text, text) from public;
revoke all on function private.registrar_log_interno(text, text, text, text, uuid, text, text, text, text, text, jsonb, text) from public;
revoke all on function private.expurgar_logs() from public;

-- --- Agenda do expurgo (todo dia, 04:30 UTC) -----------------------------------------
-- O projeto já tem pg_cron (retencao-de-dados, backup-diario…). Sem a extensão a migration passa,
-- avisa, e o expurgo fica sem agenda — ligue e rode este bloco de novo.
do $$
declare
  v_job constant text := 'polobh-expurgo-logs';
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise warning 'pg_cron não está ligado: o expurgo dos logs NÃO foi agendado. Ligue a extensão e rode este bloco de novo.';
    return;
  end if;
  perform cron.unschedule(j.jobid) from cron.job j where j.jobname = v_job;
  perform cron.schedule(v_job, '30 4 * * *', 'select private.expurgar_logs()');
end;
$$;
