-- Quem edita o quê (07/10/2026).
--
--  · Itens da EC (descrição, valor, status…): só Coordenação Produção e
--    Back-office.
--  · OS, cronograma e demais: Produção (produtor simples), mais Coordenação
--    Produção e Back-office, que mexem nos dois lados.
--
-- As áreas de fábrica Diretoria Produção e Produção perdem `ecs.editar`; a
-- Diretoria Produção perde também `oss.editar`. As áreas administrativo-
-- financeiras mantêm `oss.editar` porque é com ele que concluem a fase do
-- financeiro da OS. Tudo é ajustável em Configurações › Áreas e permissões.
update areas
   set recursos = array_remove(recursos, 'ecs.editar')
 where nome in ('Diretoria Produção', 'Produção');

update areas
   set recursos = array_remove(recursos, 'oss.editar')
 where nome = 'Diretoria Produção';

-- Garante a regra nas duas áreas que podem tudo.
update areas
   set recursos = array_append(recursos, 'ecs.editar')
 where nome in ('Coordenação Produção', 'Back-office')
   and not ('ecs.editar' = any(recursos));

update areas
   set recursos = array_append(recursos, 'oss.editar')
 where nome in ('Produção', 'Coordenação Produção', 'Back-office')
   and not ('oss.editar' = any(recursos));
