-- ============================================================================
-- Clientes: ID sequencial do cadastro                            (27/11/2026)
--
-- O cadastro de clientes virou tela própria (Cadastros › Clientes), ao lado do
-- de fornecedores, e ganha o mesmo ID de exibição ("0007"). O `id` (uuid)
-- continua sendo a chave do sistema; `codigo` é só o número que se lê.
-- Os clientes que já existem são numerados pela ordem de entrada (`criado_em`).
-- ============================================================================

begin;

alter table public.clientes add column if not exists codigo integer;

with numerados as (
  select id,
         coalesce((select max(codigo) from public.clientes), 0)
           + row_number() over (order by criado_em nulls last, nome, id) as n
    from public.clientes
   where codigo is null
)
update public.clientes c
   set codigo = numerados.n
  from numerados
 where numerados.id = c.id;

create sequence if not exists public.clientes_codigo_seq owned by public.clientes.codigo;
select setval('public.clientes_codigo_seq', coalesce((select max(codigo) from public.clientes), 0) + 1, false);

alter table public.clientes alter column codigo set default nextval('public.clientes_codigo_seq');
alter table public.clientes alter column codigo set not null;

create unique index if not exists clientes_codigo_unico on public.clientes (codigo);

comment on column public.clientes.codigo is
  'ID de exibição do cliente (sequencial). O banco numera; o app só lê.';

commit;
