-- ============================================================================
-- CONSUMO DE IA (05/11/2026)
--
-- Cada chamada de IA do app (revisão de texto, leitura de orçamento) grava
-- aqui os tokens gastos e o custo estimado em dólar, com quem pediu e o modelo
-- que respondeu. Quem grava é só o servidor (funções com a chave de serviço);
-- quem lê é a Direção, o Administrativo e o Admin, na tela Configurações >
-- Consumo de IA. A mesma chamada também entra no `audit_log` (categoria "IA").
--
-- O custo é ESTIMADO pela tabela de preços do modelo (ver
-- `supabase/functions/_shared/ia-uso.ts`); a conta oficial é a do painel da
-- OpenAI.
-- ============================================================================

create table if not exists ia_uso (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  user_id uuid,
  usuario text,
  funcao text not null,            -- 'revisao' | 'leitura_orcamento' | 'diagnostico'
  modelo text,
  tokens_entrada integer not null default 0,
  tokens_saida integer not null default 0,
  custo_usd numeric(12, 6) not null default 0,
  sucesso boolean not null default true,
  erro text,
  duracao_ms integer,
  itens integer                    -- textos revisados ou arquivos lidos
);

create index if not exists ia_uso_criado_em_idx on ia_uso (criado_em desc);

alter table ia_uso enable row level security;
drop policy if exists ia_uso_read on ia_uso;
create policy ia_uso_read on ia_uso for select
  using ((select papel_atual()) = any (array['Admin'::text, 'Direcao'::text, 'Administrativo'::text]));
revoke insert, update, delete, truncate on ia_uso from anon, authenticated;

-- Prazo de guarda: o consumo segue o mesmo prazo do registro de ações (2 anos).
create or replace function aplicar_retencao_de_dados()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_cred bigint;
  n_audit bigint;
  n_email bigint;
  n_vigia bigint;
  n_ia bigint;
begin
  delete from credenciamentos where enviado_em < now() - interval '180 days';
  get diagnostics n_cred = row_count;
  delete from audit_log where ts < now() - interval '2 years';
  get diagnostics n_audit = row_count;
  delete from emails where criado_em < now() - interval '2 years';
  get diagnostics n_email = row_count;
  delete from vigia_alertas where coalesce(ultimo_alerta_em, primeiro_em) < now() - interval '1 year';
  get diagnostics n_vigia = row_count;
  delete from ia_uso where criado_em < now() - interval '2 years';
  get diagnostics n_ia = row_count;
  return jsonb_build_object('credenciamentos', n_cred, 'audit_log', n_audit, 'emails', n_email,
    'vigia_alertas', n_vigia, 'ia_uso', n_ia);
end;
$$;
revoke all on function aplicar_retencao_de_dados() from public, anon, authenticated;

-- Vigia do banco: avisa quando o gasto de IA do dia passa de US$ 2 (dez vezes
-- o uso normal) ou quando várias chamadas falham seguidas.
do $vigia$
declare
  f text;
begin
  f := pg_get_functiondef('public.vigia_banco_checar(timestamptz)'::regprocedure);
  if position('ia-custo' in f) = 0 then
    f := replace(f, E'  return r;\nend;', $novo$
  for x in select coalesce(sum(custo_usd), 0) custo, count(*) n from ia_uso where criado_em > now() - interval '24 hours' having coalesce(sum(custo_usd), 0) > 2 loop
    r := r || jsonb_build_object('chave', 'ia-custo:' || current_date, 'gravidade', 'media',
      'titulo', 'Gasto de IA acima do normal',
      'detalhe', format('US$ %s em %s chamadas nas últimas 24 horas (o normal é menos de US$ 0,20 por dia).', round(x.custo, 2), x.n));
  end loop;
  for x in select count(*) n, max(erro) erro from ia_uso where criado_em > p_desde and not sucesso having count(*) >= 3 loop
    r := r || jsonb_build_object('chave', 'ia-falhas:' || date_trunc('hour', now()), 'gravidade', 'media',
      'titulo', 'Revisões por IA falhando',
      'detalhe', format('%s chamadas de IA falharam desde a última conferência. Último erro: %s', x.n, left(coalesce(x.erro, ''), 300)));
  end loop;

  return r;
end;$novo$);
    execute f;
  end if;
end
$vigia$;
