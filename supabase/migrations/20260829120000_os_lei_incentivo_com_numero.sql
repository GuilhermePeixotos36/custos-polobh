-- ============================================================================
-- Lei de Incentivo à Cultura: um campo só, com o número do projeto dentro
-- (pedido do Guilherme, 29/08/2026).
--
-- O formulário da nota tinha DOIS campos para a mesma informação:
--   · `leiIncentivo`            — "Lei Federal de Incentivo à Cultura (Rouanet)"
--   · `numeroProjetoIncentivado`— "26 1234"
--
-- Separar não pagava o que custava. A lei e o número nunca aparecem um sem o
-- outro (nem na nota, nem no contrato: o texto do objeto costurava os dois de
-- volta com "sob o número"), e o PROJETO já guarda os dois juntos numa string
-- só — `info.incentivosFiscais`, "Lei Federal de Incentivo à Cultura (Rouanet)
-- — PRONAC 26 1234". Ou seja: a EC sabia a resposta inteira e a OS obrigava a
-- redigitá-la em duas partes.
--
-- Agora `leiIncentivo` carrega a frase completa e nasce preenchido com o que
-- está no Projeto. `numeroProjetoIncentivado` deixa de existir.
--
-- Esta migração junta o que já foi digitado, para nenhuma OS antiga perder o
-- número: "<lei> — <número>", pulando a parte que estiver vazia (concat_ws não
-- emenda separador em valor nulo). Só depois a chave velha é removida.
-- ============================================================================

update os_financeiro
set dados = (dados - 'numeroProjetoIncentivado')
  || jsonb_build_object(
       'leiIncentivo',
       coalesce(
         nullif(
           btrim(
             concat_ws(
               ' — ',
               nullif(btrim(coalesce(dados ->> 'leiIncentivo', '')), ''),
               nullif(btrim(coalesce(dados ->> 'numeroProjetoIncentivado', '')), '')
             )
           ),
           ''
         ),
         ''
       )
     )
where dados ? 'numeroProjetoIncentivado';

comment on column os_financeiro.dados is
  'Bloco financeiro da OS (RLS por papel). `leiIncentivo` traz a lei COM o número do projeto na mesma string — o campo `numeroProjetoIncentivado` foi absorvido por ele em 29/08/2026.';
