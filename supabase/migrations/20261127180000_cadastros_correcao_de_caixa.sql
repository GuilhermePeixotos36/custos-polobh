-- ============================================================================
-- Cadastros: correção única da caixa dos textos já gravados        (27/11/2026)
--
-- O app passou a (1) manter de pé as siglas ("MRV", "BH", "LMG"), (2) deixar
-- minúsculo o conector no meio do endereço ("Avenida do Contorno"), (3) dar a
-- inicial à palavra entre parênteses e (4) gravar o tipo societário sempre como
-- "Ltda.". Isso vale para o que for digitado daqui em diante; esta migration
-- acerta o que JÁ estava gravado.
--
-- Cada UPDATE confere o texto ANTIGO: se o registro foi editado nesse meio
-- tempo, a linha simplesmente não é tocada. Rodar duas vezes não faz mal.
--
-- Fica de fora, de propósito:
--   · acentos ("Producoes", "Brasilia") e erros de digitação ("Ldta");
--   · nomes de projeto e de OS já gravados, e as cópias dentro de ECs e OS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tipo societário no fim da razão social / nome fantasia: "Ltda."
-- ----------------------------------------------------------------------------
update public.fornecedores
   set razao_social = regexp_replace(razao_social, '\s+ltda\.?\s*$', ' Ltda.', 'i')
 where razao_social ~* '\sltda\.?\s*$' and razao_social !~ '\sLtda\.$';

update public.fornecedores
   set nome_fantasia = regexp_replace(nome_fantasia, '\s+ltda\.?\s*$', ' Ltda.', 'i')
 where nome_fantasia ~* '\sltda\.?\s*$' and nome_fantasia !~ '\sLtda\.$';

update public.clientes
   set razao_social = regexp_replace(razao_social, '\s+ltda\.?\s*$', ' Ltda.', 'i')
 where razao_social ~* '\sltda\.?\s*$' and razao_social !~ '\sLtda\.$';

-- ----------------------------------------------------------------------------
-- 2. Siglas rebaixadas na razão social
-- ----------------------------------------------------------------------------
update public.fornecedores
   set razao_social = replace(razao_social, 'By Mhb Hotelaria', 'By MHB Hotelaria')
 where id = '926a1956-ccaf-42e5-a464-782e98821711' and razao_social like '%By Mhb Hotelaria%';

update public.fornecedores
   set razao_social = replace(razao_social, 'Grupo M2br', 'Grupo M2BR')
 where id = '35439bad-f6c8-46f4-8f77-64b52056772b' and razao_social like 'Grupo M2br%';

-- ----------------------------------------------------------------------------
-- 3. Endereços dos fornecedores
-- ----------------------------------------------------------------------------
update public.fornecedores
   set endereco = 'Rua dos Timbiras, 1660 - Lourdes - Belo Horizonte - MG - CEP: 30140-061'
 where id = '926a1956-ccaf-42e5-a464-782e98821711'
   and endereco = 'Rua Dos Timbiras, 1660 - Lourdes - Belo Horizonte - MG - CEP: 30140-061';

update public.fornecedores
   set endereco = 'Rodovia LMG 800 Km 7,9, S/N - Sala Vip Internacional Sala Restaurante Internacsetor Area I e III Term. 2 - Aeroporto - Confins - MG - CEP: 33500900'
 where id = '35461cbc-d1cf-4abd-9567-35ed15f5b0e8'
   and endereco = 'Rodovia Lmg 800 Km 7,9, S/N - Sala Vip Internacional Sala Restaurante Internacsetor Area I e Iii Term. 2 - Aeroporto - Confins - MG - CEP: 33500900';

update public.fornecedores
   set endereco = 'QNL 1 Bloco D, S/N - Apt 232 - Taguatinga Norte (Taguatinga) - Brasilia - DF - CEP: 72150114'
 where id = '8d22007b-04da-43aa-95fd-1fbfb9fbda54'
   and endereco = 'Qnl 1 Bloco D, S/N - Apt 232 - Taguatinga Norte (taguatinga) - Brasilia - DF - CEP: 72150114';

update public.fornecedores
   set endereco = 'Rua Asteca (Sao Benedito) - Santa Luzia - MG - CEP: 33120-440'
 where id = '9ba48911-70fd-47fc-80dc-d50f28b7fc42'
   and endereco = 'Rua Asteca (sao Benedito) - Santa Luzia - MG - CEP: 33120-440';

-- ----------------------------------------------------------------------------
-- 4. Endereços dos clientes — e a cópia deles nos projetos ATIVOS
-- ----------------------------------------------------------------------------
update public.clientes
   set endereco = replace(endereco, 'Avenida Do Contorno', 'Avenida do Contorno')
 where id = '6331d88e-f0c2-47ce-884f-fab6e1850026' and endereco like 'Avenida Do Contorno%';

update public.clientes
   set endereco = replace(endereco, 'Ribeirao Preto-Sp', 'Ribeirao Preto-SP')
 where id = 'c07b601f-8d41-4608-b5fb-560647b16eb5' and endereco like '%Ribeirao Preto-Sp';

update public.projetos
   set cliente = jsonb_set(cliente, '{endereco}', to_jsonb(replace(cliente->>'endereco', 'Avenida Do Contorno', 'Avenida do Contorno')))
 where status = 'Ativo'
   and cliente->>'id' = '6331d88e-f0c2-47ce-884f-fab6e1850026'
   and cliente->>'endereco' like 'Avenida Do Contorno%';

-- ----------------------------------------------------------------------------
-- 5. Local do projeto ATIVO: "Arena Mrv" -> "Arena MRV"
-- ----------------------------------------------------------------------------
update public.projetos
   set projeto = jsonb_set(projeto, '{local}', '"Arena MRV"')
 where status = 'Ativo' and projeto->>'local' = 'Arena Mrv';
