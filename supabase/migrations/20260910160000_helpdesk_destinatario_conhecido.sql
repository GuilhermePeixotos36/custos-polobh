-- ============================================================================
-- O endereço do Help Desk é um destinatário conhecido      (10/09/2026)
--
-- O chamado de Help Desk NÃO ESTAVA SAINDO — e não por causa da homologação,
-- mas por esta função. `send-email` recusa qualquer destinatário que o sistema
-- não conheça (fornecedor, contato de cliente ou usuário do app: M-04), e o
-- endereço de suporte não é nenhum dos três. Todo chamado morria com 403,
-- "Destinatário não reconhecido".
--
-- A trava de homologação piorava o quadro: ela reescreve o destino para a caixa
-- de teste, que também não é conhecida — de modo que, com as duas ligadas,
-- e-mail NENHUM conseguia sair do sistema.
--
-- Aqui entra a terceira fonte: o endereço gravado em `config_app.helpdesk`.
-- Ele é escolhido por quem administra (a política de escrita de `config_app` é
-- Admin/Direção), não por quem dispara — a função continua fechada, e continua
-- sem aceitar endereço vindo do cliente. A caixa de TESTE entra pelo mesmo
-- motivo: enquanto a homologação estiver ligada, é para lá que todo o resto vai,
-- e recusá-la é recusar o próprio mecanismo de homologação.
-- ============================================================================

create or replace function emails_conhecidos(p_emails text[])
returns text[]
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(array_agg(distinct e), '{}'::text[])
  from unnest(p_emails) as e
  where lower(trim(e)) in (
    select lower(contato->>'email')       from fornecedores where nullif(contato->>'email','')       is not null
    union
    select lower(fornecedor->>'email')    from oss          where nullif(fornecedor->>'email','')    is not null
    union
    select lower(representante->>'email') from clientes     where nullif(representante->>'email','') is not null
    union
    select lower(email)                   from auth.users   where nullif(email,'')                   is not null
    union
    -- O suporte do sistema, definido em Configurações › Geral.
    select lower(valor->>'email')         from config_app   where chave = 'helpdesk'
                                                              and nullif(valor->>'email','')         is not null
    union
    -- A caixa de homologação: destino de tudo enquanto a virada não acontece.
    select 'gpxautomacao@outlook.com'
  );
$$;

revoke all on function emails_conhecidos(text[]) from public, anon, authenticated;
grant execute on function emails_conhecidos(text[]) to service_role;
