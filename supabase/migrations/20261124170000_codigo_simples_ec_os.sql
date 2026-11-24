-- ============================================================================
-- ID simples da EC e da OS                                       (24/11/2026)
--
-- Pedido do dono do app: "como o nome já é bem completo, apenas o ID simples
-- resolve". O nome da EC ("EC – Cliente – Projeto – V06") e o da OS já dizem
-- de quem é e qual versão; faltava um número CURTO para falar ao telefone e
-- achar na lista — "a EC 12", "a OS 87". As listas mostram a coluna "ID" (#12).
--
-- O que esta migration faz, em `ecs` e em `oss`:
--   1. acrescenta a coluna `codigo` (bigint);
--   2. numera as linhas que já existem em ordem de criação (`criado_em`, e o
--      `id` como desempate), começando em 1 — a EC mais antiga é a #1;
--   3. transforma a coluna em IDENTITY "generated always": cada registro novo
--      recebe o próximo número sozinho, e a sessão NÃO consegue gravar nem
--      alterar o valor (o Postgres recusa INSERT com valor e UPDATE diferente
--      de DEFAULT). Por isso nenhuma RPC muda: todas as que inserem em `ecs` e
--      `oss` (`salvar_ec_completa`, `nova_versao_ec`, `nova_versao_ec_com_mapa`,
--      `importar_ec`, `gerar_nova_versao_os`) listam as colunas, e `codigo`
--      não está entre elas;
--   4. acerta a sequência para continuar depois do maior número dado no passo 2;
--   5. cria a trava de unicidade.
--
-- NÃO mexe no `numero` (o nome) de nenhuma EC ou OS. A numeração sequencial da
-- OS no título é outro assunto e fica para depois.
--
-- O app funciona antes e depois: a leitura é `select *`, e sem a coluna a tela
-- mostra "—" no ID.
--
-- Restaurar back-up depois disto: a coluna é "generated always", então a carga
-- de `ecs`/`oss` com o `codigo` do arquivo precisa de
-- `insert … overriding system value`, seguida do mesmo `setval` do passo 4.
--
-- Pode rodar de novo sem estrago: cada passo confere se já foi feito.
-- ============================================================================

begin;

do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array['ecs', 'oss'] loop
    -- 1. a coluna
    execute format('alter table public.%I add column if not exists codigo bigint', v_tabela);

    -- 2 e 3. numeração das que já existem (da mais antiga para a mais nova) e a identity
    -- "generated always" — só na primeira vez: depois da identity, o próprio UPDATE da coluna
    -- é recusado pelo Postgres, mesmo sem linha nenhuma a mudar.
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = v_tabela and column_name = 'codigo' and is_identity = 'YES'
    ) then
      execute format($f$
        update public.%1$I t
           set codigo = n.ordem
          from (select id, row_number() over (order by criado_em, id) as ordem from public.%1$I) n
         where n.id = t.id
           and t.codigo is null
      $f$, v_tabela);
      execute format('alter table public.%I alter column codigo set not null', v_tabela);
      execute format('alter table public.%I alter column codigo add generated always as identity', v_tabela);
    end if;

    -- 4. a próxima EC/OS recebe o número seguinte ao maior que já existe
    execute format(
      'select setval(pg_get_serial_sequence(%L, %L), coalesce((select max(codigo) from public.%I), 0) + 1, false)',
      'public.' || v_tabela, 'codigo', v_tabela
    );

    -- 5. único
    if not exists (select 1 from pg_constraint where conname = v_tabela || '_codigo_unico') then
      execute format('alter table public.%I add constraint %I unique (codigo)', v_tabela, v_tabela || '_codigo_unico');
    end if;
  end loop;
end $$;

comment on column public.ecs.codigo is
  'ID simples da EC (#12): sequencial, dado pelo banco na criação, não editável. As antigas foram numeradas por criado_em.';
comment on column public.oss.codigo is
  'ID simples da OS (#87): sequencial, dado pelo banco na criação, não editável. As antigas foram numeradas por criado_em.';

commit;
