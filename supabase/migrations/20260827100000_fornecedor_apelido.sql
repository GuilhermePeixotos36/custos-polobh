-- ============================================================================
-- Apelido do fornecedor (pedido do Guilherme, 27/08/2026).
--
-- É o nome curto pelo qual a casa chama o fornecedor, e entra no TÍTULO DA OS:
--   OS – {Apelido do Cliente} – {Projeto} – {Ano} – {Apelido do Fornecedor} – (NN) em DD MM AA
--
-- Não dá para usar o `nome_fantasia` no lugar: aquele vem do cadastro na Receita
-- ("SOM & LUZ PRODUÇÕES LTDA - ME") e é longo demais para um título. Aqui quem
-- escolhe é a Pólobh — mesma ideia do `apelido` que os clientes já têm.
--
-- Nasce preenchido com o nome fantasia de quem já está cadastrado: é o palpite
-- mais próximo do apelido, e evita título de OS sem o fornecedor até alguém
-- passar em cada ficha. Quem não tem nome fantasia fica em branco, e o título
-- cai na razão social (ver `apelidoFornecedor`).
-- ============================================================================

alter table public.fornecedores
  add column if not exists apelido text;

comment on column public.fornecedores.apelido is
  'Nome curto do fornecedor, escolhido pela Pólobh — entra no título da OS. Diferente do nome fantasia, que vem da Receita.';

update public.fornecedores
set apelido = nullif(btrim(nome_fantasia), '')
where apelido is null;
