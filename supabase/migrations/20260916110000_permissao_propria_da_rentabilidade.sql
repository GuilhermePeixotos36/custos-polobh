-- ============================================================================
-- A rentabilidade sai de dentro do "bloco financeiro"        (15/09/2026)
--
-- Até aqui, quem via valor via margem: a aba "Rentabilidade por item" da EC
-- dividia a permissão `financeiro` com os valores Pólobh, os valores do cliente
-- e o financeiro da OS. São coisas diferentes, e a Pólobh separou as duas no
-- check-list: a aba deve ficar com a Diretoria e as Coordenações (Produção e
-- Administrativo-Financeiro), enquanto quem lança custo e emite OS continua
-- vendo valor sem ver quanto a casa ganha em cada item.
--
-- O recurso novo é `rentabilidade` (ver `Recurso`, em src/store/auth.ts).
-- `areas.recursos` é um text[] livre, então nada muda no schema — o que esta
-- migração faz é decidir QUEM JÁ TEM.
--
-- O critério: só as áreas de DIREÇÃO (papel_base 'Direcao' ou 'Admin') que já
-- enxergavam o financeiro. Numa área de Produção ou Administrativa, herdar a
-- margem seria manter exatamente o que o pedido desfaz — e conceder demais, num
-- dado sensível, é pior do que conceder de menos: quem ficar sem e precisar
-- pede, e a Direção libera em Configurações › Áreas, sem desenvolvedor.
--
-- A matriz definitiva dos sete perfis da Pólobh (Diretoria Produção, Coordenação
-- Produção, Produção, Back-office, Direção/Coordenação/Assistência
-- Administrativo-Financeira) será cadastrada por lá quando a Pólobh fechar quem
-- vê o quê em cada tela.
-- ============================================================================

update areas
   set recursos = array_append(recursos, 'rentabilidade')
 where 'financeiro' = any(recursos)
   and not ('rentabilidade' = any(recursos))
   and papel_base in ('Direcao', 'Admin');

comment on column areas.recursos is
  'Telas/recursos liberados na interface (chaves do tipo `Recurso` em src/store/auth.ts). Inclui `rentabilidade`, separado de `financeiro` em 15/09/2026.';
