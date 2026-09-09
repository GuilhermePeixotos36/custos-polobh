-- ============================================================================
-- A conversa de cada ABA do projeto                          (10/09/2026)
--
-- O sistema tinha conversa em dois lugares: no ITEM da EC (o acerto de um
-- custo, com a pessoa certa), na EC inteira e na OS. Faltava o corredor de cada
-- ETAPA — "@Marisa o fornecedor do palco não respondeu o credenciamento", "o
-- cronograma mudou, avisa a produção".
--
-- Sem isso, esse tipo de recado ou não era escrito, ou era escrito no lugar
-- errado: numa observação de item que nada tem a ver com o assunto, só porque
-- era o único campo de texto por perto. Quem ia procurar depois não achava.
--
-- Cinco abas ganham conversa: EC, OS, Fornecedores, Cronograma e Credenciamento.
-- "Dados Gerais" e "Check-list" ficam de fora de propósito — a primeira é o
-- cadastro do evento e a segunda já é feita de tarefas com dono e prazo, que é
-- uma forma melhor de cobrar do que um comentário.
--
-- FORMATO: um objeto com a aba na chave, a lista de observações no valor —
-- `{"ec": [...], "credenciamento": [...]}`. Mesmo formato de observação usado
-- em toda parte, então o @menção, o "resolvida" e as pendências funcionam sem
-- nada de novo.
--
-- A gravação é por CHAVE (`jsonb_set`), e não do objeto inteiro: duas pessoas
-- conversando em abas diferentes do mesmo projeto ao mesmo tempo não podem
-- apagar a mensagem uma da outra.
-- ============================================================================

alter table projetos add column if not exists conversas jsonb not null default '{}'::jsonb;

comment on column projetos.conversas is
  'Conversa geral de cada aba do projeto: {"<aba>": [observacoes]}. Interna — nunca sai em documento, e-mail ou planilha. Gravada só por salvar_conversa_projeto.';

-- Objeto, e não lista: barra um jsonb de outro formato chegando pela gravação.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projetos_conversas_check') then
    alter table projetos add constraint projetos_conversas_check check (jsonb_typeof(conversas) = 'object');
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Quem vê o projeto pode conversar nele.
--
-- Mesma razão de `salvar_observacoes_ec`: comentar não é editar. A escrita
-- direta em `projetos` é de quem pode editar o projeto; a conversa é de todo
-- perfil válido, que é o mesmo critério da leitura.
--
-- `atualizado_em` NÃO é tocado: uma mensagem nova não pode fazer o formulário
-- que outra pessoa tem aberto parecer desatualizado.
-- ----------------------------------------------------------------------------
create or replace function salvar_conversa_projeto(
  p_projeto_id uuid,
  p_aba text,
  p_observacoes jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversas jsonb;
begin
  if papel_atual() is null then
    raise exception 'Sem permissao para comentar no projeto';
  end if;
  if jsonb_typeof(p_observacoes) is distinct from 'array' then
    raise exception 'Observacoes devem ser uma lista';
  end if;
  -- Aba fechada: a chave vira caminho de jsonb, e chave livre encheria a coluna
  -- de lixo que nenhuma tela leria.
  if p_aba not in ('ec', 'os', 'fornecedores', 'cronograma', 'credenciamento') then
    raise exception 'Aba % nao tem conversa', p_aba;
  end if;

  update projetos
     set conversas = jsonb_set(coalesce(conversas, '{}'::jsonb), array[p_aba], p_observacoes, true)
   where id = p_projeto_id
   returning conversas into v_conversas;

  if v_conversas is null then
    raise exception 'Projeto nao encontrado';
  end if;
  return v_conversas;
end;
$$;

revoke all on function salvar_conversa_projeto(uuid, text, jsonb) from public, anon;
grant execute on function salvar_conversa_projeto(uuid, text, jsonb) to authenticated;
