-- Cadastro da Pólobh (13/11/2026, pedido da Marisa): o acento no nome da empresa
-- e o endereço no padrão da casa, com "CEP:" antes do número.
--
--   Rua/Avenida Nome, Número - Complemento - Bairro - Cidade - UF - CEP: 00000-000

update public.empresas_grupo
   set razao_social = 'Pólobh Promoções Ltda.',
       endereco = 'Avenida Aggeo Pio Sobrinho, 265 - Buritis - Belo Horizonte - MG - CEP: 30575-834'
 where id = 'polobh';
