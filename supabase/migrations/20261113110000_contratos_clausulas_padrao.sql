-- CLÁUSULAS PADRÃO DOS CONTRATOS: quem edita (13/11/2026)
--
-- Configurações › Contratos guarda o texto padrão de cada cláusula dos modelos
-- Corporativo e Cultural em `config_app`, na chave `contrato_clausulas`.
--
-- Quem edita: o Administrador e a Direção de Produção. A tela só mostra a aba a
-- quem tem o recurso `contratos.clausulas` na área; esta migração faz o BANCO
-- repetir a regra — hoje `config_app` aceita gravação de qualquer Direção, e uma
-- chamada direta à API passaria por cima da tela.
--
--  1. A área que revisa o contrato (a que tem `oss.validarContrato`: a Direção
--     de Produção) ganha o recurso. Nenhuma outra área é marcada.
--  2. A política de gravação de `config_app` mantém a regra de sempre
--     (Admin/Direção) para todas as chaves, MENOS esta, que passa a exigir o
--     recurso da área (o Administrador tem tudo, por `recurso_da_area`).

begin;

update public.areas
   set recursos = array(select distinct x from unnest(recursos || array['contratos.clausulas']) as x)
 where 'oss.validarContrato' = any(recursos);

drop policy if exists config_app_write on public.config_app;
create policy config_app_write on public.config_app for all
  using (
    case
      when chave = 'contrato_clausulas' then (select public.recurso_da_area('contratos.clausulas', array[]::text[]))
      else (select public.papel_atual()) in ('Admin', 'Direcao')
    end
  )
  with check (
    case
      when chave = 'contrato_clausulas' then (select public.recurso_da_area('contratos.clausulas', array[]::text[]))
      else (select public.papel_atual()) in ('Admin', 'Direcao')
    end
  );

commit;
