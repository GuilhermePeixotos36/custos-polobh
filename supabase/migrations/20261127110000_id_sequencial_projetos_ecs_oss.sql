-- ============================================================================
-- ID sequencial em Projetos, ECs e OSs                           (27/11/2026)
--
-- Como no cadastro de fornecedores (`20261127100000`): cada projeto, EC e OS
-- ganha um número de exibição que a pessoa lê e cita ("a OS 0137"). O `id`
-- (uuid) continua sendo a chave do sistema; `codigo` é só o que aparece na
-- coluna ID das listas.
--
-- Cada registro tem o seu: uma nova versão de EC ou de OS é outro documento e
-- recebe outro ID. Os que já existem são numerados pela ordem de criação.
--
-- As funções que criam EC e OS (`salvar_ec_completa`, `importar_ec`,
-- `nova_versao_ec`, `nova_versao_ec_com_mapa`, `gerar_nova_versao_os`) inserem
-- com lista de colunas explícita, então o `default` numera sem mexer nelas.
-- ============================================================================

begin;

do $$
declare
  t text;
begin
  foreach t in array array['projetos', 'ecs', 'oss'] loop
    execute format('alter table public.%I add column if not exists codigo integer', t);

    execute format($f$
      with numerados as (
        select id,
               coalesce((select max(codigo) from public.%1$I), 0)
                 + row_number() over (order by criado_em nulls last, id) as n
          from public.%1$I
         where codigo is null
      )
      update public.%1$I x set codigo = numerados.n from numerados where numerados.id = x.id
    $f$, t);

    execute format('create sequence if not exists public.%I owned by public.%I.codigo', t || '_codigo_seq', t);
    execute format('select setval(%L, coalesce((select max(codigo) from public.%I), 0) + 1, false)', 'public.' || t || '_codigo_seq', t);
    execute format('alter table public.%I alter column codigo set default nextval(%L)', t, 'public.' || t || '_codigo_seq');
    execute format('alter table public.%I alter column codigo set not null', t);
    execute format('create unique index if not exists %I on public.%I (codigo)', t || '_codigo_unico', t);
    execute format('comment on column public.%I.codigo is %L', t, 'ID de exibição (sequencial). O banco numera; o app só lê.');
  end loop;
end $$;

commit;
