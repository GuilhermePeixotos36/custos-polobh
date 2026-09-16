-- ============================================================================
-- A OS caminha em FASES, e cada fase tem quem a edite         (15/09/2026)
--
-- Até aqui a OS era um formulário só: quem podia editar, editava tudo, do
-- descritivo do fornecedor ao acerto financeiro, em qualquer ordem, e "estava
-- pronta" era uma conversa de corredor. O check-list da Pólobh desenha o
-- caminho que a casa já faz na prática, em três entregas:
--
--   1. PRODUÇÃO monta a OS — itens, cronograma, logística, observações — e
--      aperta "Enviar OS para Conclusão Financeiro";
--   2. o FINANCEIRO preenche emissão, faturamento, acertos e contrato, e aperta
--      "Enviar OS para Emissão Back-Office";
--   3. o BACK-OFFICE emite: a OS vira "Emitida" e o item da EC que ela consolida
--      passa de "Emitir" para "OK".
--
-- Cada passagem gera uma pendência para quem recebe o bastão — é o que faz o
-- trabalho aparecer no quadro de quem vai fazê-lo, em vez de no e-mail de
-- alguém.
--
-- DUAS COLUNAS, e não uma tabela de histórico: a fase é o estado de agora, e
-- quem fez cada passagem já fica na trilha de auditoria (`logs`). Uma tabela a
-- mais custaria RLS, leitura e manutenção para responder o que a auditoria já
-- responde.
--
-- `fase` é texto com CHECK — não enum: acrescentar uma fase num enum exige
-- ALTER TYPE e trava de tabela; aqui é trocar o CHECK.
-- ============================================================================

alter table oss
  add column if not exists fase text not null default 'producao',
  add column if not exists fase_em timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'oss_fase_check') then
    alter table oss add constraint oss_fase_check
      check (fase in ('producao', 'financeiro', 'backoffice', 'emitida'));
  end if;
end $$;

comment on column oss.fase is
  'Em que etapa do fluxo a OS está: producao → financeiro → backoffice → emitida. Quem edita o quê em cada uma está na tela (ver OsForm) e a passagem gera pendência para quem recebe.';
comment on column oss.fase_em is
  'Quando a OS entrou na fase atual — é o que a tela mostra em "com o financeiro desde…".';

-- OS já emitida nasce na última fase: sem isto, todo documento que já saiu da
-- casa apareceria como "aguardando a produção terminar".
update oss set fase = 'emitida', fase_em = coalesce(atualizado_em, criado_em)
 where fase = 'producao' and status in ('Emitida', 'Disparada');

-- ---------------------------------------------------------------------------
-- Emitir a OS fecha o item na EC
--
-- "Acho que é aqui que a gente pode encaixar um sistema para alterar o status
-- da OS até que ela fique Emitida e transforme, no controle da EC, o status de
-- Pendente para OK" — check-list de 15/09. É o fecho do ciclo EC → OS → EC.
--
-- Pela tela não daria: quem emite é o Back-office, que não tem escrita em
-- `ec_linhas` (a policy pede o papel de quem mexe em estimativa). Mesma razão
-- da `devolver_dados_fiscais_para_ec`, e as duas escrevem apenas o que a OS
-- decidiu, apenas nos itens que ela consolida.
--
-- Só sobe de "Emitir"/"Emitir Nova Versão" para "OK": um item marcado como
-- "Não se Aplica" não vira OK porque uma OS de outro fornecedor foi emitida.
-- ---------------------------------------------------------------------------
create or replace function marcar_itens_da_os_como_emitidos(p_os_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ec_id uuid;
  v_linhas uuid[];
  v_afetadas integer := 0;
begin
  select ec_id into v_ec_id from oss where id = p_os_id;
  if v_ec_id is null then
    raise exception 'OS não encontrada ou sem acesso: %', p_os_id;
  end if;

  select array_agg(ec_linha_id) into v_linhas
  from os_linhas where os_id = p_os_id and ec_linha_id is not null;

  if v_linhas is null or array_length(v_linhas, 1) is null then
    return 0;
  end if;

  update ec_linhas
     set status_os = 'OK'
   where id = any(v_linhas)
     and ec_id = v_ec_id
     and status_os in ('Emitir', 'Emitir Nova Versão');

  get diagnostics v_afetadas = row_count;
  return v_afetadas;
end;
$$;

revoke all on function marcar_itens_da_os_como_emitidos(uuid) from public;
grant execute on function marcar_itens_da_os_como_emitidos(uuid) to authenticated;

comment on function marcar_itens_da_os_como_emitidos(uuid) is
  'Fecha na EC os itens que esta OS consolida: status_os de Emitir/Emitir Nova Versão para OK. Chamada quando a OS é emitida.';
