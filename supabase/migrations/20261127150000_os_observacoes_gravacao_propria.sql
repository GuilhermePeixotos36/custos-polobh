-- ============================================================================
-- A conversa da OS grava sozinha                                 (27/11/2026)
--
-- A conversa da EC e a de cada aba do projeto já tinham gravação própria
-- (`salvar_observacoes_ec`, `salvar_conversa_projeto`). A da OS, não: ela só ia
-- ao banco quando a OS INTEIRA era salva. Quem respondia uma observação com a
-- OS em leitura — ou numa OS emitida, que nem se edita — via a resposta na tela
-- e ela nunca chegava ao banco. A pendência continuava com a pessoa, que já
-- tinha respondido, e ninguém do outro lado era avisado.
--
-- Mesma regra das outras conversas: comentar não é editar. Quem enxerga a OS
-- conversa nela, em qualquer status, e `atualizado_em` não é tocado — uma
-- mensagem nova não pode fazer o formulário que outra pessoa tem aberto parecer
-- desatualizado.
-- ============================================================================
create or replace function public.salvar_observacoes_os(
  p_os_id uuid,
  p_observacoes jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_observacoes jsonb;
begin
  if papel_atual() is null then
    raise exception 'Sem permissao para comentar na OS';
  end if;
  if jsonb_typeof(p_observacoes) is distinct from 'array' then
    raise exception 'Observacoes devem ser uma lista';
  end if;

  update oss
     set observacoes = p_observacoes
   where id = p_os_id
   returning observacoes into v_observacoes;

  if v_observacoes is null then
    raise exception 'OS nao encontrada';
  end if;
  return v_observacoes;
end;
$$;

revoke all on function public.salvar_observacoes_os(uuid, jsonb) from public, anon;
grant execute on function public.salvar_observacoes_os(uuid, jsonb) to authenticated;
