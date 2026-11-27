-- ============================================================================
-- Contrato emitido fecha a coluna "Contrato" da EC               (27/11/2026)
--
-- A emissão do contrato passou a levar a coluna Contrato dos itens da OS a
-- "OK" (ver `OsForm.emitirContrato`), como a emissão da OS já fazia com a
-- coluna OS. Aqui os itens cujo contrato JÁ tinha sido emitido antes desta
-- regra são postos em dia: estavam em "Emitir" com o PDF na pasta do projeto.
--
-- Só toca item de OS viva (não arquivada) com contrato emitido e que ainda
-- pedia emissão. "Emitir Nova Versão" fica como está: é pedido novo.
-- ============================================================================
update public.ec_linhas l
   set contrato_status = 'OK'
 where l.contrato_status = 'Emitir'
   and exists (
     select 1
       from public.os_linhas ol
       join public.oss o on o.id = ol.os_id
      where ol.ec_linha_id = l.id
        and o.status <> 'Arquivada'
        and (o.contrato->>'versaoEmitida') is not null
   );
