-- ============================================================================
-- A contratação da OS, item a item                       (09/09/2026)
--
-- Divisão de trabalho entre os dois documentos: na EC a produção LEVANTA o
-- preço de cada forma de cobrança (ou responde "Não se aplica"); na OS se FECHA
-- a condição — qual forma vale para cada item, por quanto e com que BV. É a OS
-- que vira contrato com o fornecedor, então é nela que a decisão mora.
--
-- Até aqui a OS só guardava TRÊS totais soltos (`orcamento.valorComBvNf` e
-- companhia), digitados para a OS inteira. Uma OS consolida vários itens, cada
-- um negociado do seu jeito — um sai com nota, outro sem —, e o total não sabia
-- dizer de onde vinha. Agora ele é a soma do que foi definido item a item, e os
-- três campos viraram leitura na tela.
--
-- Formato de `oss.itens` (ver `ItemContratacaoOs`, em src/data/types.ts):
--   [{ ecLinhaId,
--      comBvNf:    { naoSeAplica, valor, justificativaBv },
--      bv:         { modo: "percentual"|"fixo", valor },
--      semBvComNf: { naoSeAplica, valor, justificativaBv },
--      semBvSemNf: { naoSeAplica, valor, justificativaBv } }]
--
-- A justificativa é UMA POR FORMA, e não uma por item como na EC: lá só uma das
-- três valia, aqui as três convivem na mesma tabela e cada uma responde por si.
--
-- OS já gravada vem com `[]` e se preenche sozinha ao ser aberta, a partir dos
-- itens da EC que ela consolida (`sincronizarContratacao`) — nada a migrar.
-- ============================================================================

alter table oss add column if not exists itens jsonb not null default '[]'::jsonb;

comment on column oss.itens is
  'A contratação item a item: qual forma de cobrança vale para cada item da EC, por quanto e com que BV. Ver src/domain/contratacaoOs.ts. OS antiga vem [] e é preenchida a partir da EC ao abrir.';

-- Lista, e não objeto: barra um jsonb de outro formato chegando pela gravação.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'oss_itens_check') then
    alter table oss add constraint oss_itens_check check (jsonb_typeof(itens) = 'array');
  end if;
end $$;
