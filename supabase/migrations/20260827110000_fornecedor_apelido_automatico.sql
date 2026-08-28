-- ============================================================================
-- O apelido do fornecedor passa a ser GERADO pelo sistema.
--
-- A migração anterior (20260827100000) criou a coluna e a semeou com o nome
-- fantasia. Só que nome fantasia também vem inchado da Receita ("Som & Luz
-- Produções Ltda"), e o pedido era outro: que o próprio sistema reduza o nome
-- do fornecedor a um apelido curto e reconhecível, sem ninguém digitar.
--
-- Quem faz isso agora é `gerarApelidoFornecedor` (src/domain/fornecedor.ts):
-- tira a forma jurídica, o recheio corporativo e a descrição de atividade,
-- preservando o que identifica. "SOM & LUZ PRODUÇÕES LTDA" → "Som & Luz";
-- "LSPRO LOCACOES, SERVICOS E EVENTOS LTDA" → "LSPRO".
--
-- Aqui só desfazemos a semeadura: o campo volta a ficar vazio, e vazio é o
-- sinal de "gera sozinho". Preenchido, ele continua valendo — é a saída para
-- quando a redução automática não agradar.
-- ============================================================================

update public.fornecedores
set apelido = null
where apelido is not null
  and btrim(apelido) = btrim(coalesce(nome_fantasia, ''));

comment on column public.fornecedores.apelido is
  'Apelido escolhido À MÃO para o fornecedor. Vazio = o sistema gera a partir do nome (ver gerarApelidoFornecedor); é o apelido que entra no título da OS.';
