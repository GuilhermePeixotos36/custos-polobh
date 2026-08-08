-- M-04 — Base para restringir os destinatários de e-mail.
--
-- A função `send-email` valida a sessão, mas aceitava destinatário e HTML
-- prontos do cliente: qualquer um dos quatro papéis podia disparar e-mail
-- arbitrário para endereço arbitrário, saindo do domínio da Pólobh.
--
-- Esta função diz quais dos endereços informados pertencem a alguém que o
-- sistema já conhece (fornecedor cadastrado, fornecedor de uma OS, contato do
-- cliente ou usuário do app). A Edge Function recusa o envio quando aparece
-- endereço fora dessa lista.
--
-- SECURITY DEFINER porque varre auth.users; exposta só ao service_role, que é
-- quem a Edge Function usa. Nenhum papel do app pode chamá-la direto.

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
  );
$$;

revoke all on function emails_conhecidos(text[]) from public, anon, authenticated;
grant execute on function emails_conhecidos(text[]) to service_role;
