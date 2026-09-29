-- ============================================================================
-- A OS tem QUATRO status, e "disparada" não é um deles         (15/09/2026)
--
-- Os selos eram cinco: Rascunho, Emitida, Disparada, Cancelada e Arquivada. O
-- check-list da Pólobh pede quatro — "Rascunho / Emitida / Cancelada /
-- Arquivada" —, e o que sobra explica por quê: "Disparada" não diz em que
-- estado o documento está, diz que um e-mail saiu. São coisas diferentes, e
-- misturá-las criava perguntas sem resposta: uma OS emitida e entregue em mãos
-- ficava para sempre em "Emitida", parecendo menos pronta do que uma que foi
-- por e-mail; e emitir depois de disparar (o que acontece quando o fornecedor
-- pede o PDF antes) não tinha como ser representado.
--
-- Agora o envio é um CARIMBO (`disparada_em`), ao lado do status. A OS fica
-- "Emitida" e a tela mostra "enviada ao fornecedor em 12/09" quando houve envio.
--
-- O status passa a ser o que a EC já fez em 09/09: o menor vocabulário que
-- responde à pergunta do dia a dia — este documento vale, ainda está sendo
-- montado, ou saiu de circulação?
-- ============================================================================

alter table oss add column if not exists disparada_em timestamptz;

comment on column oss.disparada_em is
  'Quando a OS foi enviada ao fornecedor por e-mail. É carimbo de envio, não status: uma OS emitida e entregue em mãos fica sem ele.';

-- As que estavam "Disparada" viram "Emitida" com o carimbo do envio. A data do
-- envio não foi guardada em lugar nenhum até hoje, então o melhor que se tem é
-- a última atualização da linha — que, para essas, foi o próprio disparo.
update oss
   set disparada_em = coalesce(disparada_em, atualizado_em, criado_em),
       status = 'Emitida'
 where status = 'Disparada';

-- O CHECK novo só entra depois da normalização acima, senão ele recusaria as
-- linhas que ainda estivessem com o selo antigo.
alter table oss drop constraint if exists oss_status_check;
alter table oss add constraint oss_status_check
  check (status in ('Rascunho', 'Emitida', 'Cancelada', 'Arquivada'));
