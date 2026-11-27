-- O nome da OS passa a trazer o fornecedor por extenso (27/11/2026):
--   "Cliente – Projeto – Item – Nome Fantasia – (Razão Social) – OS (NN) em DD MM AA"
-- Antes o fornecedor entrava só pelo apelido reduzido. A regra nova mora em
-- `numeroOs` (src/domain/calc.ts); aqui as OS que já existem são postas nela.
--
-- Do nome atual ficam o começo (cliente, projeto e item) e o fim ("OS (NN) em data");
-- só o trecho do fornecedor — o último antes de " – OS (" — é trocado pelo que a própria
-- OS guarda do fornecedor. Nome fora do padrão (sem " – OS (") não é tocado.
update public.oss o
   set numero = regexp_replace(
         o.numero,
         '^(.*) – [^–]+ – (OS \(\d+\).*)$',
         '\1 – ' || replace(n.forn, '\', '\\') || ' – \2')
  from (
    select id,
           concat_ws(' – ',
             nullif(btrim(fornecedor->>'nomeFantasia'), ''),
             case when btrim(coalesce(fornecedor->>'razaoSocial', '')) <> ''
                  then '(' || btrim(fornecedor->>'razaoSocial') || ')' end) as forn
      from public.oss
  ) n
 where n.id = o.id
   and n.forn <> ''
   and o.numero ~ '^.* – [^–]+ – OS \(\d+\)'
   -- já no formato novo: não repete
   and o.numero !~ ' – \([^–]*\) – OS \(\d+\)';
