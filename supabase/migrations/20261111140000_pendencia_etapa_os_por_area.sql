-- Pendências de etapa da OS endereçadas à área certa (11/11/2026, pedido do Guilherme)
--
-- "Aguardando o Financeiro" ia para todos com "Bloco financeiro" e "Aguardando o
-- Back-office" para todos com "Emitir a OS" — incluindo a Coordenação e a
-- Diretoria Produção, que recebiam a pendência de toda OS da casa. Agora cada
-- etapa tem uma chave só de cobrança:
--   oss.etapaFinanceiro → Coordenação Administrativo-Financeira (Tiago)
--   oss.etapaBackoffice → Back-office (Viviane)
-- Quem pode abrir, editar e emitir não muda.

update public.areas
   set recursos = array_append(recursos, 'oss.etapaFinanceiro')
 where nome = 'Coordenação Administrativo-Financeira'
   and not ('oss.etapaFinanceiro' = any(recursos));

update public.areas
   set recursos = array_append(recursos, 'oss.etapaBackoffice')
 where nome = 'Back-office'
   and not ('oss.etapaBackoffice' = any(recursos));
