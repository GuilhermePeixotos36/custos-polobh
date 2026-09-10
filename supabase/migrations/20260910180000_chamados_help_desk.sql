-- ============================================================================
-- Chamados do Help Desk — a conversa acontece DENTRO do app  (10/09/2026)
--
-- Até aqui o chamado era só um e-mail: saía do aplicativo e sumia. Quem abriu
-- não tinha como saber se foi lido; quem dá suporte respondia do seu cliente de
-- e-mail, e a resposta não existia em lugar nenhum do sistema. "Quantos
-- chamados estão abertos?" não tinha resposta.
--
-- Agora o chamado é um registro, com a conversa junto. O e-mail continua saindo
-- — é ele que avisa —, mas deixou de ser o lugar onde a informação mora.
--
-- A BOLA DA VEZ é a mesma ideia das conversas do resto do app (ver
-- `pendenciaDeConversa`): quem respondeu passa a vez ao outro.
--   · Aberto     — esperando o suporte;
--   · Respondido — o suporte falou, esperando quem abriu;
--   · Resolvido  — encerrado, e só quem abriu ou o suporte encerra.
-- O status não é digitado: ele decorre de quem falou por último.
--
-- QUEM É O SUPORTE: o papel Admin. Nesta instalação são as contas de
-- desenvolvimento, que é quem atende. Um dia isso pode virar configuração; hoje
-- seria configuração sem ninguém para configurar.
-- ============================================================================

create table if not exists chamados (
  id uuid primary key default gen_random_uuid(),
  -- Quem abriu. `on delete set null` para o chamado sobreviver ao desligamento
  -- de quem o abriu: o histórico do suporte não pode evaporar com o cadastro.
  aberto_por uuid references auth.users(id) on delete set null,
  -- Nome e e-mail COPIADOS na abertura: é para cá que a resposta vai, e eles
  -- não podem mudar depois nem sumir junto com o usuário.
  autor_nome text not null default '',
  autor_email text not null default '',
  tipo text not null default '',
  assunto text not null default '',
  descricao text not null default '',
  -- Onde a pessoa estava e em que navegador — a metade do chamado que ela não
  -- deveria precisar escrever.
  tela text not null default '',
  ambiente text not null default '',
  status text not null default 'Aberto',
  -- A conversa depois da abertura:
  --   [{ id, texto, autorNome, autorEmail, suporte: bool, criadoEm }]
  mensagens jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table chamados is
  'Chamados abertos pelo Help Desk, com a conversa. Ver src/pages/Suporte.tsx e a RPC responder_chamado.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chamados_status_check') then
    alter table chamados add constraint chamados_status_check
      check (status in ('Aberto', 'Respondido', 'Resolvido'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chamados_mensagens_check') then
    alter table chamados add constraint chamados_mensagens_check
      check (jsonb_typeof(mensagens) = 'array');
  end if;
end $$;

-- A lista do suporte abre pelo mais recente, e a de cada pessoa filtra por ela.
create index if not exists chamados_criado_em_idx on chamados (criado_em desc);
create index if not exists chamados_aberto_por_idx on chamados (aberto_por);

-- ----------------------------------------------------------------------------
-- Quem atende os chamados.
--
-- Função própria, e não `papel_atual() = 'Admin'` espalhado pelas policies: o
-- dia em que o suporte deixar de ser o Admin, muda aqui e vale em todo lugar.
-- ----------------------------------------------------------------------------
create or replace function e_suporte() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(papel_atual(), '') = 'Admin'
$$;

revoke all on function e_suporte() from public, anon;
grant execute on function e_suporte() to authenticated;

alter table chamados enable row level security;

drop policy if exists chamados_read on chamados;
drop policy if exists chamados_insert on chamados;
drop policy if exists chamados_update on chamados;

-- Ler: o seu, e o suporte lê todos. Chamado de um traz o que ele estava
-- fazendo e onde errou — não é assunto de todo mundo.
create policy chamados_read on chamados for select
  using (aberto_por = auth.uid() or e_suporte());

-- Abrir: qualquer pessoa logada, em nome de si mesma.
create policy chamados_insert on chamados for insert
  with check (aberto_por = auth.uid());

-- Atualizar direto na tabela é só do suporte, e serve para encerrar. A CONVERSA
-- não passa por aqui: ela vai pela RPC abaixo, que só sabe acrescentar.
create policy chamados_update on chamados for update
  using (e_suporte()) with check (e_suporte());

-- ----------------------------------------------------------------------------
-- Responder um chamado.
--
-- `security definer` porque quem abriu precisa poder responder de volta sem
-- ganhar permissão de UPDATE na tabela — com ela, poderia reescrever o texto
-- original ou o status de qualquer chamado seu. Aqui a única coisa que
-- acontece é ACRESCENTAR uma mensagem no fim, e o status decorre disso.
--
-- Quem fala passa a vez: suporte respondeu vira "Respondido"; quem abriu
-- respondeu volta para "Aberto". Chamado resolvido reabre quando alguém volta a
-- falar — é o que acontece de verdade quando o problema não estava resolvido.
-- ----------------------------------------------------------------------------
create or replace function responder_chamado(p_chamado_id uuid, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suporte boolean;
  v_dono uuid;
  v_nome text;
  v_email text;
  v_msg jsonb;
  v_linha chamados%rowtype;
begin
  if auth.uid() is null or papel_atual() is null then
    raise exception 'Sem permissao para responder chamado';
  end if;
  if coalesce(btrim(p_texto), '') = '' then
    raise exception 'A resposta nao pode ser vazia';
  end if;
  -- Um limite generoso, mas limite: sem ele a coluna vira depósito.
  if length(p_texto) > 10000 then
    raise exception 'Resposta longa demais';
  end if;

  select aberto_por into v_dono from chamados where id = p_chamado_id;
  if not found then
    raise exception 'Chamado nao encontrado';
  end if;

  v_suporte := e_suporte();
  -- Só quem abriu e o suporte conversam neste chamado.
  if not v_suporte and v_dono is distinct from auth.uid() then
    raise exception 'Este chamado nao e seu';
  end if;

  select coalesce(p.nome, ''), coalesce(u.email, '')
    into v_nome, v_email
    from auth.users u left join perfis p on p.id = u.id
   where u.id = auth.uid();

  v_msg := jsonb_build_object(
    'id', gen_random_uuid(),
    'texto', btrim(p_texto),
    'autorNome', v_nome,
    'autorEmail', v_email,
    'suporte', v_suporte,
    'criadoEm', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );

  update chamados
     set mensagens = mensagens || v_msg,
         -- Quem falou passa a vez ao outro.
         status = case when v_suporte then 'Respondido' else 'Aberto' end,
         atualizado_em = now()
   where id = p_chamado_id
   returning * into v_linha;

  return to_jsonb(v_linha);
end;
$$;

revoke all on function responder_chamado(uuid, text) from public, anon;
grant execute on function responder_chamado(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Encerrar (ou reabrir) um chamado.
--
-- Quem abriu também encerra: é ele quem sabe se resolveu. O suporte encerra
-- porque é ele quem varre a fila.
-- ----------------------------------------------------------------------------
create or replace function encerrar_chamado(p_chamado_id uuid, p_resolvido boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dono uuid;
  v_linha chamados%rowtype;
begin
  if auth.uid() is null or papel_atual() is null then
    raise exception 'Sem permissao';
  end if;
  select aberto_por into v_dono from chamados where id = p_chamado_id;
  if not found then
    raise exception 'Chamado nao encontrado';
  end if;
  if not e_suporte() and v_dono is distinct from auth.uid() then
    raise exception 'Este chamado nao e seu';
  end if;

  update chamados
     set status = case when p_resolvido then 'Resolvido' else 'Aberto' end,
         atualizado_em = now()
   where id = p_chamado_id
   returning * into v_linha;

  return to_jsonb(v_linha);
end;
$$;

revoke all on function encerrar_chamado(uuid, boolean) from public, anon;
grant execute on function encerrar_chamado(uuid, boolean) to authenticated;
