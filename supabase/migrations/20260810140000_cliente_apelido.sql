-- Apelido do cliente é um dado cadastral, reutilizado nos novos projetos.
alter table public.clientes
  add column if not exists apelido text not null default '';

-- Reaproveita apelidos já preenchidos em projetos anteriores quando o cliente
-- correspondente for identificado pelo mesmo CNPJ/CPF.
update public.clientes as c
set apelido = (
  select trim(p.projeto ->> 'clienteAbreviado') as apelido
  from public.projetos as p
  where regexp_replace(coalesce(p.cliente ->> 'cnpjCpf', ''), '\D', '', 'g') = regexp_replace(coalesce(c.cnpj_cpf, ''), '\D', '', 'g')
    and trim(coalesce(p.projeto ->> 'clienteAbreviado', '')) <> ''
  order by p.atualizado_em desc nulls last
  limit 1
)
where c.apelido = ''
  and coalesce(c.cnpj_cpf, '') <> ''
  and exists (
    select 1
    from public.projetos as p
    where regexp_replace(coalesce(p.cliente ->> 'cnpjCpf', ''), '\D', '', 'g') = regexp_replace(coalesce(c.cnpj_cpf, ''), '\D', '', 'g')
      and trim(coalesce(p.projeto ->> 'clienteAbreviado', '')) <> ''
  );
