-- CONTRATO: telefone da empresa do grupo e razão social da Pólobh corrigida (11/11/2026)
--
-- 1) O contrato lança sozinho o telefone do CONTRATANTE, e o cadastro das
--    empresas do grupo não tinha onde guardá-lo.
-- 2) A razão social da Pólobh estava "Polobh Promocoes LTDA" (sem cedilha e sem
--    til, e com LTDA em caixa alta). Pedido da Pólobh: "Polobh Promoções Ltda.".
--    Só a grafia muda — CNPJ e inscrições seguem como estão (o contrato os
--    apresenta com a pontuação completa).

alter table public.empresas_grupo add column if not exists telefone text not null default '';

update public.empresas_grupo
   set razao_social = 'Polobh Promoções Ltda.'
 where id = 'polobh' and razao_social = 'Polobh Promocoes LTDA';
