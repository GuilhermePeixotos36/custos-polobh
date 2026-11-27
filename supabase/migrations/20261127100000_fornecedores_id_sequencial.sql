-- ============================================================================
-- Fornecedores: ID sequencial do cadastro                        (27/11/2026)
--
-- O cadastro de fornecedores virou tela própria, e cada fornecedor passa a ter
-- um ID que a pessoa lê e cita ("o 0042"). O `id` (uuid) continua sendo a chave
-- que o resto do sistema usa; `codigo` é só o número de exibição.
--
-- Os fornecedores que já existem são numerados pela ordem em que entraram no
-- cadastro (`criado_em`), para o mais antigo ser o 0001. Daí em diante o banco
-- numera sozinho.
--
-- A trava de duplicidade por CPF/CNPJ já existe (`fornecedores_documento_unico`,
-- 19/11/2026) e não muda.
-- ============================================================================

begin;

alter table public.fornecedores add column if not exists codigo integer;

with numerados as (
  select id,
         coalesce((select max(codigo) from public.fornecedores), 0)
           + row_number() over (order by criado_em nulls last, razao_social, id) as n
    from public.fornecedores
   where codigo is null
)
update public.fornecedores f
   set codigo = numerados.n
  from numerados
 where numerados.id = f.id;

create sequence if not exists public.fornecedores_codigo_seq owned by public.fornecedores.codigo;
select setval('public.fornecedores_codigo_seq', coalesce((select max(codigo) from public.fornecedores), 0) + 1, false);

alter table public.fornecedores alter column codigo set default nextval('public.fornecedores_codigo_seq');
alter table public.fornecedores alter column codigo set not null;

create unique index if not exists fornecedores_codigo_unico on public.fornecedores (codigo);

comment on column public.fornecedores.codigo is
  'ID de exibição do fornecedor (sequencial). O banco numera; o app só lê.';

commit;
