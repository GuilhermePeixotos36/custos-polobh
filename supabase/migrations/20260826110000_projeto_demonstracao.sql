-- ============================================================================
-- Projeto de demonstração: "Festival de Inverno Pólobh" — dados REAIS no banco,
-- não mock (pedido do Guilherme, 26/08/2026).
--
-- Serve para conferir, com o sistema rodando, o que só dá para ver com um
-- projeto inteiro preenchido:
--   * a rentabilidade ITEM A ITEM (cada item tem estimado e gasto próprios; o
--     gasto sai do "valor a pagar" das OSs rateado por item, e o subtotal do
--     grupo é só leitura);
--   * as opções de valor por item que a planilha da OS imprime;
--   * o check-list com tarefa atrasada, tarefa de hoje e tarefa futura;
--   * o credenciamento já respondido por um fornecedor;
--   * as pendências (badge vermelho) chegando a quem responde pelo projeto.
--
-- Tudo com ids fixos e `on conflict do nothing`: reaplicar não duplica nada.
-- As datas são relativas a `current_date`, então o projeto continua fazendo
-- sentido em qualquer dia que a migração rodar.
--
-- PARA REMOVER (a cascata leva EC, linhas, OSs, check-list e credenciamentos):
--   delete from projetos where id = '22222222-2222-4222-8222-222222222222';
--   delete from clientes where id = '11111111-1111-4111-8111-111111111111';
--   delete from fornecedores where id in (
--     '66666666-6666-4666-8666-666666666601',
--     '66666666-6666-4666-8666-666666666602');
-- ============================================================================

-- 0) ------------------------------------------------------- correção de tipo
-- `oss.observacoes` nasceu `text` no baseline, mas o app grava e lê uma LISTA de
-- observações (o mesmo formato da EC). Gravar um array numa coluna de texto faz
-- a thread da OS voltar como string e quebrar a leitura — e o motor de
-- pendências junto. Corrigido aqui, preservando o que estiver gravado.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_name = 'oss' and column_name = 'observacoes' and data_type <> 'jsonb'
  ) then
    alter table oss alter column observacoes type jsonb using
      case
        when observacoes is null or btrim(observacoes::text) = '' then '[]'::jsonb
        when btrim(observacoes::text) like '[%' then observacoes::text::jsonb
        else jsonb_build_array(jsonb_build_object(
          'id', gen_random_uuid()::text, 'texto', observacoes::text,
          'autorId', '', 'autorNome', '', 'criadoEm', now(),
          'responsavelNome', '', 'resolvida', false, 'respostas', '[]'::jsonb))
      end;
  end if;
end $$;
alter table oss alter column observacoes set default '[]'::jsonb;
update oss set observacoes = '[]'::jsonb where observacoes is null;

-- 1) ---------------------------------------------------------------- cliente
insert into clientes (id, apelido, nome, razao_social, endereco, cnpj_cpf,
  inscricao_estadual, inscricao_municipal, representante)
values (
  '11111111-1111-4111-8111-111111111111',
  'Instituto Aurora',
  'Instituto Aurora',
  'Instituto Aurora de Cultura Ltda',
  'Rua da Bahia, 1200 — Centro, Belo Horizonte/MG',
  '18.442.331/0001-70',
  'ISENTO',
  '0071433/001-9',
  jsonb_build_object(
    'nome', 'Helena Prado', 'cargo', 'Diretora Executiva',
    'telefones', '(31) 98812-4477', 'email', 'helena.prado@institutoaurora.org.br')
) on conflict (id) do nothing;

-- 2) ------------------------------------------------ fornecedores do projeto
insert into fornecedores (id, razao_social, nome_fantasia, cnpj, perfil_tributario,
  endereco, inscricao_estadual, inscricao_municipal, dados_bancarios, contato, cnaes, contatos)
values
  ('66666666-6666-4666-8666-666666666601', 'Sonora Áudio e Iluminação Ltda', 'Sonora AV',
   '27.556.901/0001-12', 'Simples Nacional', 'Av. Amazonas, 3400 — Nova Suíça, Belo Horizonte/MG',
   'ISENTO', '0044120/002-1',
   jsonb_build_object('tipoConta','PJ','banco','Itaú','agencia','1582','conta','23004-7','chavePix','27556901000112'),
   jsonb_build_object('representante','Ricardo Menezes','telefone','(31) 99145-2280','email','comercial@sonoraav.com.br'),
   '["9001-9/06"]'::jsonb,
   '["Ricardo Menezes · (31) 99145-2280"]'::jsonb),
  ('66666666-6666-4666-8666-666666666602', 'Casa da Cenografia Produções Ltda', 'Casa da Cenografia',
   '31.208.774/0001-55', 'Lucro Presumido/Real', 'Rua Sapucaí, 88 — Floresta, Belo Horizonte/MG',
   'ISENTO', '0098771/003-4',
   jsonb_build_object('tipoConta','PJ','banco','Banco do Brasil','agencia','3077','conta','11902-5','chavePix','contato@casadacenografia.com.br'),
   jsonb_build_object('representante','Tereza Bicalho','telefone','(31) 98770-1133','email','contato@casadacenografia.com.br'),
   '["7490-1/04"]'::jsonb,
   '["Tereza Bicalho · (31) 98770-1133"]'::jsonb)
on conflict (id) do nothing;

-- 3) ---------------------------------------------------------------- projeto
-- O Produtor Responsável é ligado a um usuário REAL do sistema (a pendência
-- precisa ter dono); na falta de qualquer perfil, fica um nome de exemplo.
do $$
declare
  v_responsavel text;
  v_telefone text;
  v_cliente jsonb;
  v_info jsonb;
  v_evento date := current_date + 30;
begin
  select coalesce(nome, ''), coalesce(telefone, '')
    into v_responsavel, v_telefone
    from perfis
   where coalesce(nome, '') <> ''
   order by case papel when 'Direcao' then 1 when 'Producao' then 2 when 'Admin' then 3 else 4 end, criado_em
   limit 1;
  v_responsavel := coalesce(nullif(v_responsavel, ''), 'Produtor Responsável');

  select jsonb_build_object(
    'id', id::text, 'apelido', apelido, 'nome', nome, 'razaoSocial', razao_social,
    'endereco', endereco, 'cnpjCpf', cnpj_cpf, 'inscricaoEstadual', inscricao_estadual,
    'inscricaoMunicipal', inscricao_municipal, 'representante', representante)
    into v_cliente from clientes where id = '11111111-1111-4111-8111-111111111111';

  v_info := jsonb_build_object(
    'titulo', 'Instituto Aurora – Festival de Inverno – 2026',
    'clienteAbreviado', 'Instituto Aurora',
    'nomeProjeto', 'Festival de Inverno',
    'anoProjeto', to_char(v_evento, 'YYYY'),
    'modalidade', 'Cultural',
    'local', 'Teatro Sesiminas',
    'enderecoLocal', 'Rua Padre Marinho, 60 — Santa Efigênia, Belo Horizonte/MG',
    'participantes', 620,
    'produtoraResponsavel', v_responsavel,
    'telefoneProdutora', coalesce(nullif(v_telefone, ''), '(31) 99999-0000'),
    'emailProdutora', 'producao@polobh.com.br',
    'preEvento', to_char(v_evento - 3, 'YYYY-MM-DD'),
    'evento', to_char(v_evento, 'YYYY-MM-DD'),
    'posEvento', to_char(v_evento + 2, 'YYYY-MM-DD'),
    'horario', '20h às 23h',
    'roteiro', '',
    'incentivosFiscais', 'Lei Federal de Incentivo à Cultura (Rouanet) — PRONAC 26 1234',
    'cronograma', jsonb_build_object(
      'montagem', jsonb_build_array(jsonb_build_object('id','cron-mont-1','data', to_char(v_evento - 2, 'YYYY-MM-DD'),'inicio','08:00','fim','18:00')),
      'alinhamentos', jsonb_build_array(jsonb_build_object('id','cron-alin-1','data', to_char(v_evento - 1, 'YYYY-MM-DD'),'inicio','10:00','fim','13:00')),
      'ensaios', jsonb_build_array(jsonb_build_object('id','cron-ens-1','data', to_char(v_evento - 1, 'YYYY-MM-DD'),'inicio','15:00','fim','19:00')),
      'evento', jsonb_build_array(jsonb_build_object('id','cron-eve-1','data', to_char(v_evento, 'YYYY-MM-DD'),'inicio','20:00','fim','23:00')),
      'desmontagem', jsonb_build_array(jsonb_build_object('id','cron-des-1','data', to_char(v_evento + 1, 'YYYY-MM-DD'),'inicio','08:00','fim','14:00'))),
    'cronogramaExtras', '[]'::jsonb,
    'cronogramaOrdem', '["etapa:montagem","etapa:alinhamentos","etapa:ensaios","etapa:evento","etapa:desmontagem"]'::jsonb,
    'etapasOcultas', '[]'::jsonb,
    'roteiros', jsonb_build_object(
      'preEvento', '<p>Reunião de alinhamento com o Instituto Aurora, fechamento do mapa de palco e conferência de acessibilidade (Libras e audiodescrição).</p>',
      'evento', '<p>Abertura às 20h com apresentação do coral; sequência de três atrações; encerramento às 23h com agradecimento institucional.</p>',
      'posEvento', '<p>Desmontagem, conferência de medições dos fornecedores e prestação de contas do incentivo.</p>'),
    'roteirosOcultos', '[]'::jsonb,
    'roteirosExtras', '[]'::jsonb,
    'roteiroOrdem', '["preEvento","evento","posEvento"]'::jsonb);

  insert into projetos (id, nome, cliente, projeto, docs_url, status)
  values ('22222222-2222-4222-8222-222222222222',
          'Instituto Aurora – Festival de Inverno – 2026', v_cliente, v_info, '', 'Ativo')
  on conflict (id) do nothing;

  -- 4) ------------------------------------------------------------------ EC
  insert into ecs (id, numero, projeto_id, template, cliente_id, cliente, projeto, producao,
    responsavel, validade_dias, versao, ativa, status, cancelada_substituida)
  values ('33333333-3333-4333-8333-333333333333',
          'EC – Instituto Aurora – Festival de Inverno – V01',
          '22222222-2222-4222-8222-222222222222', 'Cultural',
          '11111111-1111-4111-8111-111111111111', v_cliente, v_info,
          jsonb_build_object('despesasOperacionais',0,'equipeBH',0,'equipeViagem',0,'transporteBH',0,
            'transporteViagem',0,'alimentacaoBH',0,'alimentacaoViagem',0,'qtdDespesas',0,'qtdEquipeBH',0,
            'qtdEquipeViagem',0,'qtdTransporteBH',0,'qtdTransporteViagem',0,'qtdAlimentacaoBH',0,
            'qtdAlimentacaoViagem',0,
            'honorarios', jsonb_build_object('modo','percentual','percentual',0.15,'valor',0),
            'encargos', jsonb_build_object('modo','percentual','percentual',0.1633,'valor',0)),
          v_responsavel, 30, 1, true, 'Aprovada', false)
  on conflict (id) do nothing;
end $$;

-- 5) ------------------------------------------------------------ itens da EC
-- Três grupos, seis itens. Valores e opções de cobrança diferentes de propósito:
-- é isso que faz a rentabilidade por item e a planilha da OS mostrarem algo.
insert into ec_linhas (id, ec_id, grupo, item, descricao, descricao_completa,
  valor_polobh, valor_cliente, valor_gasto, valor_com_bv_nf, valor_sem_bv_com_nf, valor_sem_bv_sem_nf,
  opcao_valor, status_aprovacao, fornecedor_razao, fornecedor_cnpj, fornecedor_contato,
  fatura_nf, codigo_servico, pedido_compra, status_os, contrato_status, observacoes, oculto, ordem)
values
  ('44444444-4444-4444-8444-444444444401', '33333333-3333-4333-8333-333333333333',
   'ESTRUTURA E TÉCNICA', 'Sonorização', 'Line array, monitores e mesa digital para 620 pessoas',
   '<p>PA line array com 8 caixas por lado, 4 monitores de palco, mesa digital 32 canais e equipe técnica.</p>',
   42000, 0, 0, 39900, 37500, 35000, 'comBvNf', 'OK',
   'Sonora Áudio e Iluminação Ltda', '27.556.901/0001-12', 'Ricardo Menezes · (31) 99145-2280',
   'Nota Fiscal', '17.02', 'PC-2026-118', 'OK', 'OK', '[]'::jsonb, false, 0),
  ('44444444-4444-4444-8444-444444444402', '33333333-3333-4333-8333-333333333333',
   'ESTRUTURA E TÉCNICA', 'Iluminação cênica', 'Refletores LED, moving heads e mesa de luz',
   '<p>24 refletores LED, 8 moving heads, mesa de luz e operador durante todo o evento.</p>',
   28000, 0, 0, 26600, 25000, 23500, 'comBvNf', 'OK',
   'Sonora Áudio e Iluminação Ltda', '27.556.901/0001-12', 'Ricardo Menezes · (31) 99145-2280',
   'Nota Fiscal', '17.02', 'PC-2026-118', 'OK', 'OK', '[]'::jsonb, false, 1),
  ('44444444-4444-4444-8444-444444444403', '33333333-3333-4333-8333-333333333333',
   'CENOGRAFIA', 'Cenografia do palco', 'Painéis, praticáveis e identidade visual do festival',
   '<p>Painéis cenográficos em madeira, praticáveis 2x1 e aplicação da identidade visual.</p>',
   31500, 0, 0, 29900, 28000, 26000, 'semBvComNf', 'OK',
   'Casa da Cenografia Produções Ltda', '31.208.774/0001-55', 'Tereza Bicalho · (31) 98770-1133',
   'Fatura e Nota Fiscal', '17.02', 'PC-2026-119', 'OK', 'OK', '[]'::jsonb, false, 2),
  ('44444444-4444-4444-8444-444444444404', '33333333-3333-4333-8333-333333333333',
   'CENOGRAFIA', 'Comunicação visual', 'Banners, backdrop e sinalização do evento',
   '<p>Impressão e instalação de banners, backdrop de 6x3 m e sinalização de acessos.</p>',
   9800, 0, 0, 9300, 8800, 8200, 'semBvSemNf', 'Pendente',
   'Casa da Cenografia Produções Ltda', '31.208.774/0001-55', '',
   'Fatura', '17.02', 'Pendente', 'Emitir', 'Pendente', '[]'::jsonb, false, 3),
  ('44444444-4444-4444-8444-444444444405', '33333333-3333-4333-8333-333333333333',
   'PRODUÇÃO', 'Equipe de produção', 'Coordenação, produção de palco e camarim',
   '<p>Coordenação geral, dois produtores de palco e um produtor de camarim.</p>',
   18500, 0, 0, 0, 0, 0, '', 'Pendente', '', '', '', '', 'Pendente', 'Pendente', 'Pendente', 'Pendente',
   '[]'::jsonb, false, 4),
  ('44444444-4444-4444-8444-444444444406', '33333333-3333-4333-8333-333333333333',
   'PRODUÇÃO', 'Acessibilidade', 'Intérpretes de Libras e audiodescrição',
   '<p>Dois intérpretes de Libras em revezamento e audiodescrição ao vivo.</p>',
   0, 7400, 0, 0, 0, 0, '', 'Pendente', '', '', '', '', 'Pendente', 'Não se Aplica', 'Pendente', 'Pendente',
   '[]'::jsonb, false, 5)
on conflict (id) do nothing;

-- Uma observação endereçada ao Produtor Responsável, para o quadro de pendências
-- (badge vermelho + navegador) nascer com conteúdo de verdade.
update ec_linhas
   set observacoes = jsonb_build_array(jsonb_build_object(
         'id', 'obs-demo-0001',
         'texto', 'Confirmar se a comunicação visual entra pela verba do incentivo ou pelo cliente.',
         'autorId', '', 'autorNome', 'Demonstração',
         'criadoEm', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
         'responsavelNome', coalesce((
            select nome from perfis where coalesce(nome,'') <> ''
             order by case papel when 'Direcao' then 1 when 'Producao' then 2 when 'Admin' then 3 else 4 end, criado_em
             limit 1), 'Produtor Responsável'),
         'resolvida', false, 'respostas', '[]'::jsonb))
 where id = '44444444-4444-4444-8444-444444444404'
   and observacoes = '[]'::jsonb;

-- 6) ------------------------------------------------------------------- OSs
do $$
declare v_evento date := current_date + 30;
begin
  insert into oss (id, numero, slug_credenciamento, ec_id, seq, fornecedor, modalidade, descritivo, entrega,
    cronograma, logistica, infraestrutura, credenciamento, orcamento, contrato, bv, observacoes, status)
  values
    ('55555555-5555-4555-8555-555555555501',
     'EC – Instituto Aurora – Festival de Inverno – OS-01', 'demo-aurora-os01',
     '33333333-3333-4333-8333-333333333333', 1,
     (select jsonb_build_object('id', id::text, 'razaoSocial', razao_social, 'nomeFantasia', nome_fantasia,
        'cnpj', cnpj, 'perfilTributario', perfil_tributario, 'endereco', endereco,
        'inscricaoEstadual', inscricao_estadual, 'inscricaoMunicipal', inscricao_municipal,
        'dadosBancarios', dados_bancarios, 'representante', contato->>'representante',
        'telefone', contato->>'telefone', 'email', contato->>'email', 'cnaes', cnaes, 'contatos', contatos)
        from fornecedores where id = '66666666-6666-4666-8666-666666666601'),
     'Serviço',
     'Sonorização e iluminação cênica do Festival de Inverno, com equipe técnica durante montagem, ensaio e evento.',
     'Instalação, operação e acompanhamento técnico',
     jsonb_build_array(
       jsonb_build_object('etapa','Montagem','data', to_char(v_evento - 2,'YYYY-MM-DD'),'horario','08:00','atividades','Rigging, PA e luz'),
       jsonb_build_object('etapa','Ensaios / Passagem de Som','data', to_char(v_evento - 1,'YYYY-MM-DD'),'horario','15:00','atividades','Passagem de som das atrações'),
       jsonb_build_object('etapa','Evento','data', to_char(v_evento,'YYYY-MM-DD'),'horario','20:00','atividades','Operação de som e luz'),
       jsonb_build_object('etapa','Desmontagem','data', to_char(v_evento + 1,'YYYY-MM-DD'),'horario','08:00','atividades','Retirada de equipamentos')),
     jsonb_build_object('transporteMaterial','Caminhão próprio do fornecedor','transporteEquipe','Van da equipe',
       'hospedagem','Não se aplica','alimentacao','Por conta do fornecedor','estacionamentoCarga','Doca de carga do teatro',
       'estacionamentoEquipe','Estacionamento G2','uniformizacao','Camiseta preta com crachá'),
     jsonb_build_object('energia','220V trifásico, 63A','internet','Wi-Fi do teatro','pontosEletricos','12 pontos no palco',
       'estruturas','Praticáveis 2x1 e torres de PA','servicosApoio','2 carregadores na montagem','artLaudos','ART de estrutura emitida'),
     jsonb_build_object('prazoLimite', to_char(v_evento - 7,'YYYY-MM-DD'), 'linkFormulario', ''),
     jsonb_build_object('valorEc', 70000, 'valorComBvNf', 66500, 'valorSemBvComNf', 62500, 'valorSemBvSemNf', 58500,
       'parcelas', jsonb_build_array(
         jsonb_build_object('descricao','Entrada (50%)','valor', 33250),
         jsonb_build_object('descricao','Saldo após o evento','valor', 33250)),
       'documentoFiscal','Nota Fiscal'),
     jsonb_build_object('contratante','Cliente','descritivoServicos','Sonorização e iluminação cênica',
       'informacoesComplementares','Equipe técnica inclusa em todas as etapas.',
       'valorUnitario', 66500, 'valorTotal', 66500, 'descontoNegociado', 0, 'valorAPagar', 66500,
       'dataContrato', to_char(current_date - 5,'YYYY-MM-DD'), 'rubrica','MC'),
     jsonb_build_object('percentual', 15, 'valor', 9975, 'justificativa', ''),
     '[]'::jsonb, 'Disparada'),
    ('55555555-5555-4555-8555-555555555502',
     'EC – Instituto Aurora – Festival de Inverno – OS-02', 'demo-aurora-os02',
     '33333333-3333-4333-8333-333333333333', 2,
     (select jsonb_build_object('id', id::text, 'razaoSocial', razao_social, 'nomeFantasia', nome_fantasia,
        'cnpj', cnpj, 'perfilTributario', perfil_tributario, 'endereco', endereco,
        'inscricaoEstadual', inscricao_estadual, 'inscricaoMunicipal', inscricao_municipal,
        'dadosBancarios', dados_bancarios, 'representante', contato->>'representante',
        'telefone', contato->>'telefone', 'email', contato->>'email', 'cnaes', cnaes, 'contatos', contatos)
        from fornecedores where id = '66666666-6666-4666-8666-666666666602'),
     'Produto + Serviço',
     'Cenografia do palco e comunicação visual do festival, com montagem e desmontagem.',
     'Instalação e acompanhamento',
     jsonb_build_array(
       jsonb_build_object('etapa','Montagem','data', to_char(v_evento - 2,'YYYY-MM-DD'),'horario','07:00','atividades','Montagem de painéis e praticáveis'),
       jsonb_build_object('etapa','Evento','data', to_char(v_evento,'YYYY-MM-DD'),'horario','19:00','atividades','Acompanhamento cenotécnico')),
     jsonb_build_object('transporteMaterial','Caminhão baú','transporteEquipe','Veículo próprio',
       'hospedagem','Não se aplica','alimentacao','Por conta do fornecedor','estacionamentoCarga','Doca de carga do teatro',
       'estacionamentoEquipe','Estacionamento G2','uniformizacao','Uniforme da empresa'),
     jsonb_build_object('energia','110V para ferramentas','internet','Não se aplica','pontosEletricos','4 pontos nos bastidores',
       'estruturas','Painéis 3x2 e praticáveis','servicosApoio','1 ajudante','artLaudos','Laudo de resistência dos praticáveis'),
     jsonb_build_object('prazoLimite', to_char(v_evento - 7,'YYYY-MM-DD'), 'linkFormulario', ''),
     jsonb_build_object('valorEc', 41300, 'valorComBvNf', 39200, 'valorSemBvComNf', 36800, 'valorSemBvSemNf', 34200,
       'parcelas', jsonb_build_array(jsonb_build_object('descricao','Pagamento único após a montagem','valor', 39200)),
       'documentoFiscal','Fatura e Nota Fiscal'),
     jsonb_build_object('contratante','Cliente','descritivoServicos','Cenografia e comunicação visual',
       'informacoesComplementares','', 'valorUnitario', 39200, 'valorTotal', 39200, 'descontoNegociado', 1200,
       'valorAPagar', 38000, 'dataContrato', to_char(current_date - 3,'YYYY-MM-DD'), 'rubrica','MC'),
     jsonb_build_object('percentual', 12, 'valor', 4704, 'justificativa', 'Fornecedor sem margem para 15% nesta contratação.'),
     '[]'::jsonb, 'Emitida')
  on conflict (id) do nothing;
end $$;

-- Vínculo OS <-> itens da EC: é dele que sai o rateio do gasto por item.
insert into os_linhas (os_id, ec_linha_id) values
  ('55555555-5555-4555-8555-555555555501', '44444444-4444-4444-8444-444444444401'),
  ('55555555-5555-4555-8555-555555555501', '44444444-4444-4444-8444-444444444402'),
  ('55555555-5555-4555-8555-555555555502', '44444444-4444-4444-8444-444444444403'),
  ('55555555-5555-4555-8555-555555555502', '44444444-4444-4444-8444-444444444404')
on conflict do nothing;

-- Bloco financeiro (tabela própria, RLS restrita). O `valorAPagar` daqui é o
-- "Gasto (B)" que a rentabilidade rateia entre os itens de cada OS.
insert into os_financeiro (os_id, dados) values
  ('55555555-5555-4555-8555-555555555501', jsonb_build_object(
    'tomador','Cliente','descritivoNf','Sonorização e iluminação cênica — Festival de Inverno',
    'projetoIncentivado','Festival de Inverno do Instituto Aurora',
    'leiIncentivo','Lei Federal de Incentivo à Cultura (Rouanet)','numeroProjetoIncentivado','26 1234',
    'cnae','9001-9/06','codigoServico','17.02',
    'valorUnitario', 66500, 'valorTotal', 66500, 'descontoNegociado', 0, 'valorAPagar', 66500,
    'acertoFinanceiro','50% na assinatura e 50% em até 10 dias após o evento')),
  ('55555555-5555-4555-8555-555555555502', jsonb_build_object(
    'tomador','Cliente','descritivoNf','Cenografia e comunicação visual — Festival de Inverno',
    'projetoIncentivado','Festival de Inverno do Instituto Aurora',
    'leiIncentivo','Lei Federal de Incentivo à Cultura (Rouanet)','numeroProjetoIncentivado','26 1234',
    'cnae','7490-1/04','codigoServico','17.02',
    'valorUnitario', 39200, 'valorTotal', 39200, 'descontoNegociado', 1200, 'valorAPagar', 38000,
    'acertoFinanceiro','Pagamento único em até 15 dias após a montagem'))
on conflict (os_id) do nothing;

-- 7) --------------------------------------------- credenciamento respondido
insert into credenciamentos (id, os_id, equipe, veiculos)
values ('88888888-8888-4888-8888-888888888801', '55555555-5555-4555-8555-555555555501',
  jsonb_build_array(
    jsonb_build_object('nome','Ricardo Menezes','cpf','044.512.336-08','funcao','Coordenador técnico'),
    jsonb_build_object('nome','Aline Furtado','cpf','118.907.446-22','funcao','Operadora de som'),
    jsonb_build_object('nome','Diego Nascimento','cpf','092.334.106-71','funcao','Operador de luz')),
  jsonb_build_array(
    jsonb_build_object('modelo','Iveco Daily — baú','placa','QMR7C21'),
    jsonb_build_object('modelo','Fiat Ducato — equipe','placa','RKA4B89')))
on conflict (id) do nothing;

-- 8) ------------------------------------------------------------- check-list
-- Uma tarefa atrasada, uma para hoje e as demais à frente: é o que faz o badge
-- vermelho e o navegador de pendências aparecerem com conteúdo real.
insert into checklists (id, projeto_id, modalidade, modelo_id)
select '77777777-7777-4777-8777-777777777777', '22222222-2222-4222-8222-222222222222', 'Cultural',
       (select id from checklist_modelos where modalidade = 'Cultural')
on conflict (projeto_id) do nothing;

-- As tarefas se ligam ao check-list DO PROJETO (e não a um id fixo): se o app já
-- tiver gerado a lista ao abrir o projeto, elas entram nessa mesma lista em vez
-- de apontar para um check-list que não existe.
insert into checklist_itens (id, checklist_id, origem_modelo_item_id, titulo, descricao, etapa, status,
  data_limite, data_manual, concluido_em, concluido_por, responsavel, observacoes, oculto, ordem)
select v.id, c.id, v.origem, v.titulo, '', v.etapa, v.status, v.prazo, false, v.concluido, v.por, '',
       '[]'::jsonb, v.oculto, v.ordem
  from checklists c
  cross join (values
    ('99999999-9999-4999-8999-999999999901'::uuid, 'mi-02', 'Montar a Estimativa de Custos (EC)',
     'PRÉ-PRODUÇÃO', 'Concluído', (current_date - 20)::date, (now() - interval '20 days')::timestamptz,
     'Demonstração', true, 1),
    ('99999999-9999-4999-8999-999999999902'::uuid, 'mi-04', 'Registrar a aprovação da EC e liberar as contratações',
     'PRÉ-PRODUÇÃO', 'Concluído', (current_date - 12)::date, (now() - interval '12 days')::timestamptz,
     'Demonstração', true, 3),
    -- Atrasada: vence antes de hoje e ninguém concluiu.
    ('99999999-9999-4999-8999-999999999903'::uuid, 'mi-08', 'Coletar documentação e contratos dos fornecedores',
     'CONTRATAÇÕES', 'Em andamento', (current_date - 2)::date, null::timestamptz, '', false, 7),
    -- Para hoje: entra no quadro de pendências junto com a atrasada.
    ('99999999-9999-4999-8999-999999999904'::uuid, 'mi-12', 'Enviar o credenciamento aos fornecedores',
     'CONTRATAÇÕES', 'Pendente', current_date::date, null::timestamptz, '', false, 11),
    -- À frente: aparece na Agenda, mas não acende badge.
    ('99999999-9999-4999-8999-999999999905'::uuid, 'mi-13', 'Confirmar o cronograma de montagem com todos os fornecedores',
     'PRÉ-EVENTO', 'Pendente', (current_date + 20)::date, null::timestamptz, '', false, 12),
    ('99999999-9999-4999-8999-999999999906'::uuid, 'mi-19', 'Realização do evento',
     'EVENTO', 'Pendente', (current_date + 30)::date, null::timestamptz, '', false, 18)
  ) as v(id, origem, titulo, etapa, status, prazo, concluido, por, oculto, ordem)
 where c.projeto_id = '22222222-2222-4222-8222-222222222222'
on conflict (id) do nothing;
