-- A área "Produção (legado)" foi substituída pelas áreas novas da Pólobh
-- (Produção, Coordenação Produção, Back-office…). Só some se ninguém a usa.
delete from areas
 where nome = 'Produção (legado)'
   and not exists (select 1 from perfis where perfis.area_id = areas.id);
