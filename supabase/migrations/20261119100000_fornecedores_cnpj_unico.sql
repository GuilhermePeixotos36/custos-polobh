-- ============================================================================
-- Um fornecedor por CPF/CNPJ no cadastro                         (19/11/2026)
--
-- O cadastro de fornecedores é alimentado por baixo dos panos — pela EC, pela
-- OS (que desde 18/11 devolve a ele o que foi corrigido) e pela validação do
-- CNPJ na linha da EC. Cada caminho faz "procura; se não achar, insere", e dois
-- deles salvando o MESMO fornecedor novo quase ao mesmo tempo gravavam duas
-- linhas. Depois disso a OS lia uma e a correção caía na outra.
--
-- A comparação é pelos DÍGITOS, como no app (`porCnpj`): "11.222.333/0001-81"
-- e "11222333000181" são o mesmo fornecedor. Documento vazio fica de fora
-- (fornecedor sem CPF/CNPJ informado não é duplicata de ninguém).
--
-- Se já houver duplicados, a migration PARA e diz quais são — nada é apagado
-- ou mesclado aqui; isso se decide antes, com a lista na mão.
-- ============================================================================

begin;

do $$
declare
  v_repetidos text;
begin
  select string_agg(digitos || ' (' || quantos || 'x)', ', ')
    into v_repetidos
    from (
      select regexp_replace(cnpj, '\D', '', 'g') as digitos, count(*) as quantos
        from public.fornecedores
       where regexp_replace(coalesce(cnpj, ''), '\D', '', 'g') <> ''
       group by 1
      having count(*) > 1
    ) d;
  if v_repetidos is not null then
    raise exception 'Fornecedores com o mesmo CPF/CNPJ: %. Resolva antes de criar a trava.', v_repetidos;
  end if;
end $$;

create unique index if not exists fornecedores_documento_unico
  on public.fornecedores ((regexp_replace(cnpj, '\D', '', 'g')))
  where regexp_replace(coalesce(cnpj, ''), '\D', '', 'g') <> '';

commit;
