-- ============================================================================
-- Check-list: quem inclui, quem exclui, quem mexe na lista padrão   (01/10/2026)
--
-- Pedidos desta rodada:
--   * INCLUIR tarefa no check-list do projeto: todo mundo.
--   * EXCLUIR tarefa (e refazer o check-list): só Coordenação e Direção.
--   * LISTA PADRÃO (o "formulário padrão" de Configurações › Check-list): só
--     Coordenação e Direção alteram.
--   * A Marisa não via o check-list dentro do projeto. A causa provável é a área
--     dela ter sido criada antes de `checklists` / `checklists.editar` existirem
--     na matriz: com a área tendo "algum" recurso marcado, o app não cai mais na
--     matriz padrão do papel, e a aba ficava sem permissão. O passo 4 corrige
--     TODAS as áreas de uma vez.
--
-- Até aqui a RLS decidia pelo PAPEL (Admin/Direção/Produção/Administrativo), e
-- "Coordenação" não é um papel — é uma ÁREA (Coordenação Produção tem papel
-- 'Producao'; Coordenação Administrativo-Financeira tem 'Administrativo'). Para
-- a regra valer no banco, e não só nos botões, entra `tem_recurso()`: a RLS
-- passa a ler a matriz da área do usuário, a mesma que a tela lê.
-- ============================================================================

/* ------------------------------------------------------------------ *
 * 1. Funções responsáveis pela tarefa (vêm da lista padrão).
 * ------------------------------------------------------------------ */
alter table checklist_itens
  add column if not exists funcoes jsonb not null default '[]'::jsonb;

comment on column checklist_itens.funcoes is
  'Funções responsáveis, como a lista da Pólobh as escreve (["Direção de Produção","Back-Office"]). Informativo: quem recebe a pendência é `responsavel`.';

/* ------------------------------------------------------------------ *
 * 2. `tem_recurso(chave)` — o recurso da matriz de áreas, visto pela RLS.
 *
 * Mesma regra de `pode()` em src/store/auth.ts:
 *   - Admin (o desenvolvedor) tem tudo;
 *   - com área que tem recursos marcados, vale a matriz da área;
 *   - sem área (ou área sem nenhum recurso), vale o padrão do papel — e o
 *     padrão de 'Direcao' inclui os dois recursos novos.
 * Conta inativa não tem nada (`ativo`).
 * ------------------------------------------------------------------ */
create or replace function tem_recurso(chave text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce((
    select case
             when p.papel = 'Admin' then true
             when coalesce(cardinality(a.recursos), 0) > 0 then chave = any(a.recursos)
             else p.papel = 'Direcao' and chave in ('checklists.excluir', 'checklists.padrao')
           end
      from perfis p
      left join areas a on a.id = p.area_id
     where p.id = auth.uid() and p.ativo
  ), false)
$function$;

comment on function tem_recurso(text) is
  'A pessoa que pede tem o recurso (da matriz da área dela) — a mesma régua de pode() no aplicativo.';

revoke all on function tem_recurso(text) from public, anon;
grant execute on function tem_recurso(text) to authenticated;

/* ------------------------------------------------------------------ *
 * 3. RLS.
 *
 * Inserir e alterar continua com os quatro papéis (todo mundo inclui tarefa) —
 * as políticas `*_write` de antes já dizem isso e ficam como estão.
 *
 * APAGAR passa a exigir o recurso `checklists.excluir`. Em vez de desmontar a
 * política `*_write` (FOR ALL), entra uma política RESTRITIVA de DELETE: no
 * Postgres as restritivas se combinam com "E" às permissivas, então apagar
 * passa a exigir as duas coisas — o papel de antes E o recurso novo. Sem DROP:
 * nada fica um instante sem política enquanto a migração roda.
 *
 * Apagar o check-list inteiro (refazer na modalidade certa) é a exclusão mais
 * pesada que existe aqui — mesma chave.
 *
 * A lista padrão: a política de escrita troca de regra (papel → recurso).
 * ------------------------------------------------------------------ */
drop policy if exists checklist_itens_delete_restrito on checklist_itens;
create policy checklist_itens_delete_restrito on checklist_itens
  as restrictive for delete
  using (tem_recurso('checklists.excluir'));

drop policy if exists checklists_delete_restrito on checklists;
create policy checklists_delete_restrito on checklists
  as restrictive for delete
  using (tem_recurso('checklists.excluir'));

alter policy checklist_modelos_write on checklist_modelos
  using (tem_recurso('checklists.padrao'))
  with check (tem_recurso('checklists.padrao'));

/* ------------------------------------------------------------------ *
 * 4. As áreas já cadastradas.
 *
 * (a) TODAS passam a ver e editar o check-list — é o que conserta a aba que
 *     "sumia" para a Marisa e faz "incluir tarefa" valer para todo mundo.
 * (b) Coordenação e Direção (pelo nome da área, ou pelo nível 'Direcao')
 *     ganham excluir e lista padrão.
 *
 * Área SEM nenhum recurso marcado fica como está: ela já cai na matriz padrão
 * do papel, e acrescentar um item a uma lista vazia a transformaria numa área
 * de um recurso só — tirando-lhe o acesso a todo o resto.
 *
 * Idempotente: `array_agg(distinct …)` não duplica se a migração rodar de novo.
 * ------------------------------------------------------------------ */
update areas
   set recursos = (
     select array_agg(distinct r order by r)
       from unnest(recursos || array['checklists', 'checklists.editar']) as r
   )
 where cardinality(recursos) > 0;

update areas
   set recursos = (
     select array_agg(distinct r order by r)
       from unnest(recursos || array['checklists.excluir', 'checklists.padrao']) as r
   )
 where cardinality(recursos) > 0
   and (papel_base = 'Direcao' or nome ~* '(dire|coordena)');
