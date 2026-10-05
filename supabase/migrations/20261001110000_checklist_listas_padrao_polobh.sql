-- ============================================================================
-- Listas padrão do check-list da Pólobh — Culturais e Corporativos   (01/10/2026)
--
-- GERADO por scripts/gerar-listas-padrao-checklist.mjs a partir das planilhas em
-- reference/ ("Check-List Projetos Culturais/Corporativos - 01 10 26.xlsx").
-- Não edite à mão: ajuste a planilha (ou o script) e gere de novo. A lista
-- também pode ser editada pela Coordenação em Configurações › Check-list.
--
-- SUBSTITUI as listas provisórias das sementes iniciais. Os check-lists já
-- gerados não são tocados — as tarefas deles seguem como estão; no projeto, o
-- aviso "trazer para este projeto" é que oferece as novas, se alguém quiser.
-- As tarefas de agora têm ids próprios ("cul-…", "cor-…"), então não colidem com
-- as provisórias ("mi-…").
--
-- Prazos: ver ModoPrazoChecklist em src/data/types.ts. As tarefas "semanas
-- antes do evento" se adaptam à janela entre a criação do projeto e o evento.
-- ============================================================================

insert into checklist_modelos (modalidade, nome, itens, atualizado_em)
values ('Cultural', 'Projetos Culturais', $json$[
 {
  "id": "cul-01-01",
  "titulo": "Contratação Artística - Documentação Contrato",
  "descricao": "",
  "etapa": "ETAPA 1 · CONTRATAÇÃO ARTÍSTICA",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 11
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 0
 },
 {
  "id": "cul-01-02",
  "titulo": "Contratação Artística - Ficha Técnica",
  "descricao": "",
  "etapa": "ETAPA 1 · CONTRATAÇÃO ARTÍSTICA",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 11
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 1
 },
 {
  "id": "cul-01-03",
  "titulo": "Contratação Artística - Release Nacional",
  "descricao": "",
  "etapa": "ETAPA 1 · CONTRATAÇÃO ARTÍSTICA",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 11
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 2
 },
 {
  "id": "cul-01-04",
  "titulo": "Contratação Artística - Fotos Divulgação",
  "descricao": "",
  "etapa": "ETAPA 1 · CONTRATAÇÃO ARTÍSTICA",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 11
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 3
 },
 {
  "id": "cul-01-05",
  "titulo": "Contratação Artística - Vídeos Divulgação",
  "descricao": "",
  "etapa": "ETAPA 1 · CONTRATAÇÃO ARTÍSTICA",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 11
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 4
 },
 {
  "id": "cul-01-06",
  "titulo": "Contratação Artística - Vídeos Brutos",
  "descricao": "",
  "etapa": "ETAPA 1 · CONTRATAÇÃO ARTÍSTICA",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 11
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 5
 },
 {
  "id": "cul-01-07",
  "titulo": "Contratação Artística - Trilha Spot",
  "descricao": "",
  "etapa": "ETAPA 1 · CONTRATAÇÃO ARTÍSTICA",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 11
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 6
 },
 {
  "id": "cul-01-08",
  "titulo": "Contratação Artística - Minuta / Assinatura Contrato",
  "descricao": "",
  "etapa": "ETAPA 1 · CONTRATAÇÃO ARTÍSTICA",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 11
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 7
 },
 {
  "id": "cul-01-09",
  "titulo": "Contratação Artística - Dados Faturamento",
  "descricao": "",
  "etapa": "ETAPA 1 · CONTRATAÇÃO ARTÍSTICA",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 11
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 8
 },
 {
  "id": "cul-01-10",
  "titulo": "Contratação Artística - OS",
  "descricao": "",
  "etapa": "ETAPA 1 · CONTRATAÇÃO ARTÍSTICA",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 11
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 9
 },
 {
  "id": "cul-01-11",
  "titulo": "Contratação Artística - Declaração Representação Artística",
  "descricao": "",
  "etapa": "ETAPA 1 · CONTRATAÇÃO ARTÍSTICA",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 11
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 10
 },
 {
  "id": "cul-01-12",
  "titulo": "Contratação Artística - NF's Referência Notas Fiscais",
  "descricao": "",
  "etapa": "ETAPA 1 · CONTRATAÇÃO ARTÍSTICA",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 11
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 11
 },
 {
  "id": "cul-01-13",
  "titulo": "Contratação Artística - Roteiro Libras e Audiodescrição",
  "descricao": "",
  "etapa": "ETAPA 1 · CONTRATAÇÃO ARTÍSTICA",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 11
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 12
 },
 {
  "id": "cul-01-14",
  "titulo": "Contratação Artística - Vídeos Convite",
  "descricao": "",
  "etapa": "ETAPA 1 · CONTRATAÇÃO ARTÍSTICA",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 11
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 13
 },
 {
  "id": "cul-02-01",
  "titulo": "Teatro - ITC / Termo de Referência",
  "descricao": "",
  "etapa": "ETAPA 2 · TEATRO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 10
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 14
 },
 {
  "id": "cul-02-02",
  "titulo": "Teatro - Minuta / Assinatura Contrato / Acordos",
  "descricao": "",
  "etapa": "ETAPA 2 · TEATRO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 10
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 15
 },
 {
  "id": "cul-02-03",
  "titulo": "Teatro - Declaração Acessibilidade Física",
  "descricao": "",
  "etapa": "ETAPA 2 · TEATRO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 10
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 16
 },
 {
  "id": "cul-02-04",
  "titulo": "Teatro - Abertura Vendas e Associações Sympla",
  "descricao": "",
  "etapa": "ETAPA 2 · TEATRO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 10
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 17
 },
 {
  "id": "cul-02-05",
  "titulo": "Teatro - Vinheta Abertura (Ficha Técnica)",
  "descricao": "",
  "etapa": "ETAPA 2 · TEATRO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 10
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 18
 },
 {
  "id": "cul-02-06",
  "titulo": "Teatro - Vinheta Créditos Pólobh",
  "descricao": "",
  "etapa": "ETAPA 2 · TEATRO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 10
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 19
 },
 {
  "id": "cul-02-07",
  "titulo": "Teatro - Merchandising Patrocinadores - Banners / Vídeos",
  "descricao": "",
  "etapa": "ETAPA 2 · TEATRO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 10
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 20
 },
 {
  "id": "cul-03-01",
  "titulo": "Briefing",
  "descricao": "",
  "etapa": "ETAPA 3 · ABERTURA DO PROJETO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 9
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 21
 },
 {
  "id": "cul-03-02",
  "titulo": "Abertura Pasta Dropbox I App",
  "descricao": "",
  "etapa": "ETAPA 3 · ABERTURA DO PROJETO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 9
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 22
 },
 {
  "id": "cul-03-03",
  "titulo": "Cadastrar SCE Centro de Resultados",
  "descricao": "",
  "etapa": "ETAPA 3 · ABERTURA DO PROJETO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 9
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 23
 },
 {
  "id": "cul-03-04",
  "titulo": "Definição Produção Responsável / Equipe",
  "descricao": "",
  "etapa": "ETAPA 3 · ABERTURA DO PROJETO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 9
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 24
 },
 {
  "id": "cul-03-05",
  "titulo": "Reunião Discussão Projeto",
  "descricao": "",
  "etapa": "ETAPA 3 · ABERTURA DO PROJETO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 9
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 25
 },
 {
  "id": "cul-03-06",
  "titulo": "Detalhamento EC",
  "descricao": "",
  "etapa": "ETAPA 3 · ABERTURA DO PROJETO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 9
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 26
 },
 {
  "id": "cul-03-07",
  "titulo": "Abertura PC",
  "descricao": "",
  "etapa": "ETAPA 3 · ABERTURA DO PROJETO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 9
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 27
 },
 {
  "id": "cul-04-01",
  "titulo": "Pré Divulgação - Arte Padrão BH / Aprovação Parceiros",
  "descricao": "",
  "etapa": "ETAPA 4 · PRÉ-DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 8
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 28
 },
 {
  "id": "cul-04-02",
  "titulo": "Pré Divulgação - Spot Rádio - Gravação locução",
  "descricao": "",
  "etapa": "ETAPA 4 · PRÉ-DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 8
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 29
 },
 {
  "id": "cul-04-03",
  "titulo": "Pré Divulgação - Vinheta – Gravação locução",
  "descricao": "",
  "etapa": "ETAPA 4 · PRÉ-DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 8
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 30
 },
 {
  "id": "cul-04-04",
  "titulo": "Pré Divulgação - Vídeo Divulgação Teatro - Gravação Locução",
  "descricao": "",
  "etapa": "ETAPA 4 · PRÉ-DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 8
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 31
 },
 {
  "id": "cul-04-05",
  "titulo": "Pré Divulgação - VT Globo - Gravação Locução",
  "descricao": "",
  "etapa": "ETAPA 4 · PRÉ-DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 8
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 32
 },
 {
  "id": "cul-04-06",
  "titulo": "Pré Divulgação - Vídeos Diversos (Rita Márcia)",
  "descricao": "",
  "etapa": "ETAPA 4 · PRÉ-DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 8
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 33
 },
 {
  "id": "cul-04-07",
  "titulo": "Pré Divulgação - Release Pólobh",
  "descricao": "",
  "etapa": "ETAPA 4 · PRÉ-DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 8
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 34
 },
 {
  "id": "cul-04-08",
  "titulo": "Pré Divulgação - Enxoval Peças Divulgação",
  "descricao": "",
  "etapa": "ETAPA 4 · PRÉ-DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 8
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 35
 },
 {
  "id": "cul-04-09",
  "titulo": "Pré Divulgação - Roteiro Aprovações Salicweb",
  "descricao": "",
  "etapa": "ETAPA 4 · PRÉ-DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 8
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 36
 },
 {
  "id": "cul-05-01",
  "titulo": "Peças Divulgação - Agendas Culturais",
  "descricao": "",
  "etapa": "ETAPA 5 · PEÇAS DE DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 7
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 37
 },
 {
  "id": "cul-05-02",
  "titulo": "Peças Divulgação - Artista",
  "descricao": "",
  "etapa": "ETAPA 5 · PEÇAS DE DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 7
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 38
 },
 {
  "id": "cul-05-03",
  "titulo": "Peças Divulgação - Assessoria de Imprensa",
  "descricao": "",
  "etapa": "ETAPA 5 · PEÇAS DE DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 7
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 39
 },
 {
  "id": "cul-05-04",
  "titulo": "Peças Divulgação - Emissoras Rádio",
  "descricao": "",
  "etapa": "ETAPA 5 · PEÇAS DE DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 7
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 40
 },
 {
  "id": "cul-05-05",
  "titulo": "Peças Divulgação - Emissoras TV",
  "descricao": "",
  "etapa": "ETAPA 5 · PEÇAS DE DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 7
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 41
 },
 {
  "id": "cul-05-06",
  "titulo": "Peças Divulgação - Jornais",
  "descricao": "",
  "etapa": "ETAPA 5 · PEÇAS DE DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 7
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 42
 },
 {
  "id": "cul-05-07",
  "titulo": "Peças Divulgação - Ministério da Cultura",
  "descricao": "",
  "etapa": "ETAPA 5 · PEÇAS DE DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 7
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 43
 },
 {
  "id": "cul-05-08",
  "titulo": "Peças Divulgação - Mobiliário Urbano",
  "descricao": "",
  "etapa": "ETAPA 5 · PEÇAS DE DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 7
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 44
 },
 {
  "id": "cul-05-09",
  "titulo": "Peças Divulgação - Patrocinadores",
  "descricao": "",
  "etapa": "ETAPA 5 · PEÇAS DE DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 7
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 45
 },
 {
  "id": "cul-05-10",
  "titulo": "Peças Divulgação - Redes Sociais",
  "descricao": "",
  "etapa": "ETAPA 5 · PEÇAS DE DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 7
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 46
 },
 {
  "id": "cul-05-11",
  "titulo": "Peças Divulgação - Teatro",
  "descricao": "",
  "etapa": "ETAPA 5 · PEÇAS DE DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 7
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 47
 },
 {
  "id": "cul-05-12",
  "titulo": "Peças Divulgação - Ticketeira",
  "descricao": "",
  "etapa": "ETAPA 5 · PEÇAS DE DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 7
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 48
 },
 {
  "id": "cul-05-13",
  "titulo": "Peças Divulgação - Transporte Aplicativo",
  "descricao": "",
  "etapa": "ETAPA 5 · PEÇAS DE DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 7
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 49
 },
 {
  "id": "cul-05-14",
  "titulo": "Programação E-mail MKT",
  "descricao": "",
  "etapa": "ETAPA 5 · PEÇAS DE DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 7
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 50
 },
 {
  "id": "cul-06-01",
  "titulo": "Ação Social e Cortesias - Mapa Plateia - Bloqueio Sympla",
  "descricao": "",
  "etapa": "ETAPA 6 · AÇÃO SOCIAL E CORTESIAS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 6
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 51
 },
 {
  "id": "cul-06-02",
  "titulo": "Ação Social e Cortesias - Declaração Ação Social - Minuta",
  "descricao": "",
  "etapa": "ETAPA 6 · AÇÃO SOCIAL E CORTESIAS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 6
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 52
 },
 {
  "id": "cul-06-03",
  "titulo": "Ação Social e Cortesias - Planilha Cortesias - Vouchers",
  "descricao": "",
  "etapa": "ETAPA 6 · AÇÃO SOCIAL E CORTESIAS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 6
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 53
 },
 {
  "id": "cul-06-04",
  "titulo": "Ação Social e Cortesias - Distribuição Ação Social - Alinhamento Beneficiários e Teatro",
  "descricao": "",
  "etapa": "ETAPA 6 · AÇÃO SOCIAL E CORTESIAS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 6
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 54
 },
 {
  "id": "cul-06-05",
  "titulo": "Ação Social e Cortesias - Declarações Ação Social - Arquivo e Organização",
  "descricao": "",
  "etapa": "ETAPA 6 · AÇÃO SOCIAL E CORTESIAS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 6
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 55
 },
 {
  "id": "cul-07-01",
  "titulo": "Reunião Repasse projeto Produção Responsável / Equipe",
  "descricao": "",
  "etapa": "ETAPA 7 · REPASSE E APRESENTAÇÃO DO PROJETO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 5
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 56
 },
 {
  "id": "cul-07-02",
  "titulo": "Gestão da EC",
  "descricao": "",
  "etapa": "ETAPA 7 · REPASSE E APRESENTAÇÃO DO PROJETO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 5
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 57
 },
 {
  "id": "cul-07-03",
  "titulo": "Elaboração Apresentação projeto",
  "descricao": "",
  "etapa": "ETAPA 7 · REPASSE E APRESENTAÇÃO DO PROJETO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 5
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 58
 },
 {
  "id": "cul-07-04",
  "titulo": "Elaboração Apresentação projeto",
  "descricao": "",
  "etapa": "ETAPA 7 · REPASSE E APRESENTAÇÃO DO PROJETO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 5
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 59
 },
 {
  "id": "cul-07-05",
  "titulo": "Fechamento EC e Apresentação",
  "descricao": "",
  "etapa": "ETAPA 7 · REPASSE E APRESENTAÇÃO DO PROJETO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 5
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 60
 },
 {
  "id": "cul-08-01",
  "titulo": "Revisão Planejamento",
  "descricao": "",
  "etapa": "ETAPA 8 · REVISÃO E APROVAÇÃO DA EC",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 61
 },
 {
  "id": "cul-08-02",
  "titulo": "Revisão EC",
  "descricao": "",
  "etapa": "ETAPA 8 · REVISÃO E APROVAÇÃO DA EC",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 62
 },
 {
  "id": "cul-08-03",
  "titulo": "Ajustes Orçamentos Diversos",
  "descricao": "",
  "etapa": "ETAPA 8 · REVISÃO E APROVAÇÃO DA EC",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 63
 },
 {
  "id": "cul-08-04",
  "titulo": "Aprovação EC",
  "descricao": "",
  "etapa": "ETAPA 8 · REVISÃO E APROVAÇÃO DA EC",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 64
 },
 {
  "id": "cul-08-05",
  "titulo": "Revisão Negociações Fornecedores e Valores para Contratação",
  "descricao": "",
  "etapa": "ETAPA 8 · REVISÃO E APROVAÇÃO DA EC",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 65
 },
 {
  "id": "cul-09-01",
  "titulo": "Alinhamentos Técnicos para Contratações",
  "descricao": "",
  "etapa": "ETAPA 9 · ALINHAMENTOS E CONTRATAÇÕES",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 66
 },
 {
  "id": "cul-09-02",
  "titulo": "Ciclo de reuniões com fornecedores (Com participação eventual da Direção de Produção)",
  "descricao": "",
  "etapa": "ETAPA 9 · ALINHAMENTOS E CONTRATAÇÕES",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 67
 },
 {
  "id": "cul-09-03",
  "titulo": "Planilha I Briefing criação artes",
  "descricao": "",
  "etapa": "ETAPA 9 · ALINHAMENTOS E CONTRATAÇÕES",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável",
   "Direção de Produção"
  ],
  "ordem": 68
 },
 {
  "id": "cul-09-04",
  "titulo": "Elaboração Roteiros Peças Áudio / Video / Apresentações",
  "descricao": "",
  "etapa": "ETAPA 9 · ALINHAMENTOS E CONTRATAÇÕES",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 69
 },
 {
  "id": "cul-09-05",
  "titulo": "Cronograma de Produção dos Itens",
  "descricao": "",
  "etapa": "ETAPA 9 · ALINHAMENTOS E CONTRATAÇÕES",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 70
 },
 {
  "id": "cul-09-06",
  "titulo": "Revisão Negociações Fornecedores e Valores para Contratação",
  "descricao": "",
  "etapa": "ETAPA 9 · ALINHAMENTOS E CONTRATAÇÕES",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 71
 },
 {
  "id": "cul-10-01",
  "titulo": "Emissão OS's Produção",
  "descricao": "",
  "etapa": "ETAPA 10 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 72
 },
 {
  "id": "cul-10-02",
  "titulo": "Orientações Faturamentos e Contratos",
  "descricao": "",
  "etapa": "ETAPA 10 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 73
 },
 {
  "id": "cul-10-03",
  "titulo": "Emissão + Envio OS's I Contratos",
  "descricao": "",
  "etapa": "ETAPA 10 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 74
 },
 {
  "id": "cul-10-04",
  "titulo": "De acordos e Assinaturas OS's e Contratos",
  "descricao": "",
  "etapa": "ETAPA 10 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 75
 },
 {
  "id": "cul-10-05",
  "titulo": "Recebimento e Arquivamento NF's",
  "descricao": "",
  "etapa": "ETAPA 10 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 76
 },
 {
  "id": "cul-10-06",
  "titulo": "Lançamentos Valores PC + OS's no SCE",
  "descricao": "",
  "etapa": "ETAPA 10 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 77
 },
 {
  "id": "cul-10-07",
  "titulo": "Envio NF's I Planilha Controle Pólobh I Cliente",
  "descricao": "",
  "etapa": "ETAPA 10 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 78
 },
 {
  "id": "cul-10-08",
  "titulo": "Conformidade Lançamentos CP's e CR's",
  "descricao": "",
  "etapa": "ETAPA 10 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 79
 },
 {
  "id": "cul-10-09",
  "titulo": "Rubricas CP's e CR's",
  "descricao": "",
  "etapa": "ETAPA 10 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 80
 },
 {
  "id": "cul-10-10",
  "titulo": "Programação PG's",
  "descricao": "",
  "etapa": "ETAPA 10 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 81
 },
 {
  "id": "cul-10-11",
  "titulo": "Lançamentos PG's Banco",
  "descricao": "",
  "etapa": "ETAPA 10 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Assistente Financeiro"
  ],
  "ordem": 82
 },
 {
  "id": "cul-10-12",
  "titulo": "Autorizações PG's (Com anuência da Direção Administrativo-Financeiro)",
  "descricao": "",
  "etapa": "ETAPA 10 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 83
 },
 {
  "id": "cul-10-13",
  "titulo": "Arquivamento Comprovantes PG's",
  "descricao": "",
  "etapa": "ETAPA 10 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Assistente Financeiro"
  ],
  "ordem": 84
 },
 {
  "id": "cul-11-01",
  "titulo": "Briefing Registros Foto e Vídeo",
  "descricao": "",
  "etapa": "ETAPA 11 · SEMANA DO EVENTO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 85
 },
 {
  "id": "cul-11-02",
  "titulo": "Consolidação Cronograma I Telefones Úteis",
  "descricao": "",
  "etapa": "ETAPA 11 · SEMANA DO EVENTO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 86
 },
 {
  "id": "cul-11-03",
  "titulo": "Envio Cronogramas para os Fornecedores",
  "descricao": "",
  "etapa": "ETAPA 11 · SEMANA DO EVENTO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 87
 },
 {
  "id": "cul-11-04",
  "titulo": "Inventário de materiais",
  "descricao": "",
  "etapa": "ETAPA 11 · SEMANA DO EVENTO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 88
 },
 {
  "id": "cul-11-05",
  "titulo": "Separação e organização material evento",
  "descricao": "",
  "etapa": "ETAPA 11 · SEMANA DO EVENTO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 89
 },
 {
  "id": "cul-11-06",
  "titulo": "Montagem Pasta Documentação Evento (Impressão)",
  "descricao": "",
  "etapa": "ETAPA 11 · SEMANA DO EVENTO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 90
 },
 {
  "id": "cul-11-07",
  "titulo": "Ciclo Reuniões I Ligações fornecedores",
  "descricao": "",
  "etapa": "ETAPA 11 · SEMANA DO EVENTO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 91
 },
 {
  "id": "cul-11-08",
  "titulo": "Reunião produtores freela - Repasse evento e alinhamento funções",
  "descricao": "",
  "etapa": "ETAPA 11 · SEMANA DO EVENTO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 92
 },
 {
  "id": "cul-11-09",
  "titulo": "Reunião alinhamento cliente (Com participação da Direção de Produção e Equipe Produção)",
  "descricao": "",
  "etapa": "ETAPA 11 · SEMANA DO EVENTO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 93
 },
 {
  "id": "cul-12-02",
  "titulo": "Montagem",
  "descricao": "",
  "etapa": "ETAPA 12 · EVENTO",
  "prazo": {
   "modo": "cronograma",
   "etapa": "montagem",
   "ponta": "ultima"
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção",
   "Produção"
  ],
  "ordem": 94
 },
 {
  "id": "cul-12-03",
  "titulo": "Reunião alinhamento equipe para operação",
  "descricao": "",
  "etapa": "ETAPA 12 · EVENTO",
  "prazo": {
   "modo": "cronograma",
   "etapa": "alinhamentos",
   "ou": "evento",
   "ponta": "primeira"
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção",
   "Produção"
  ],
  "ordem": 95
 },
 {
  "id": "cul-12-01",
  "titulo": "Evento",
  "descricao": "",
  "etapa": "ETAPA 12 · EVENTO",
  "prazo": {
   "modo": "cronograma",
   "etapa": "evento",
   "ponta": "ultima"
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção",
   "Produção"
  ],
  "ordem": 96
 },
 {
  "id": "cul-12-04",
  "titulo": "Operação evento I entrega",
  "descricao": "",
  "etapa": "ETAPA 12 · EVENTO",
  "prazo": {
   "modo": "cronograma",
   "etapa": "evento",
   "ponta": "ultima"
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção",
   "Produção"
  ],
  "ordem": 97
 },
 {
  "id": "cul-12-05",
  "titulo": "Desmontagem",
  "descricao": "",
  "etapa": "ETAPA 12 · EVENTO",
  "prazo": {
   "modo": "cronograma",
   "etapa": "desmontagem",
   "ponta": "ultima"
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção",
   "Produção"
  ],
  "ordem": 98
 },
 {
  "id": "cul-13-01",
  "titulo": "Planilha Final Cortesias",
  "descricao": "",
  "etapa": "ETAPA 13 · FECHAMENTO COM O TEATRO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 99
 },
 {
  "id": "cul-13-02",
  "titulo": "Solicitação PAF e Orientações Faturamento Pólobh",
  "descricao": "",
  "etapa": "ETAPA 13 · FECHAMENTO COM O TEATRO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 100
 },
 {
  "id": "cul-13-03",
  "titulo": "Solicitação Fechamento Borderaux",
  "descricao": "",
  "etapa": "ETAPA 13 · FECHAMENTO COM O TEATRO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 101
 },
 {
  "id": "cul-13-04",
  "titulo": "Conferência Fechamento Borderaux",
  "descricao": "",
  "etapa": "ETAPA 13 · FECHAMENTO COM O TEATRO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 102
 },
 {
  "id": "cul-13-05",
  "titulo": "Conformidade Lançamentos CP's e CR's - Teatro / Borderaux",
  "descricao": "",
  "etapa": "ETAPA 13 · FECHAMENTO COM O TEATRO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 103
 },
 {
  "id": "cul-13-06",
  "titulo": "Rubricas CP's e CR's - Teatro / Borderaux",
  "descricao": "",
  "etapa": "ETAPA 13 · FECHAMENTO COM O TEATRO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 104
 },
 {
  "id": "cul-14-01",
  "titulo": "Devolução Material Pólobh - Conforme Inventário",
  "descricao": "- Banners Patrocinadores\n- Displays de Acrílico\n- Mala Produção",
  "etapa": "ETAPA 14 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 105
 },
 {
  "id": "cul-14-02",
  "titulo": "EC Fechamento",
  "descricao": "",
  "etapa": "ETAPA 14 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 106
 },
 {
  "id": "cul-14-03",
  "titulo": "Planilha Sobra material I listas e etc",
  "descricao": "",
  "etapa": "ETAPA 14 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 107
 },
 {
  "id": "cul-14-04",
  "titulo": "Envio Sobra Material | Listas e etc para o Cliente",
  "descricao": "",
  "etapa": "ETAPA 14 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 108
 },
 {
  "id": "cul-14-05",
  "titulo": "Arquivamento Registros Foto e Video",
  "descricao": "",
  "etapa": "ETAPA 14 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 109
 },
 {
  "id": "cul-14-06",
  "titulo": "Seleção registros foto e vídeo para o site Pólobh",
  "descricao": "",
  "etapa": "ETAPA 14 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 110
 },
 {
  "id": "cul-14-07",
  "titulo": "Envio registros foto e vídeo para o Cliente",
  "descricao": "",
  "etapa": "ETAPA 14 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 111
 },
 {
  "id": "cul-14-08",
  "titulo": "Publicação registros foto e vídeo para o site Pólobh",
  "descricao": "",
  "etapa": "ETAPA 14 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 112
 },
 {
  "id": "cul-14-09",
  "titulo": "Reunião interna (Com participação da Direção de Produção e Equipe Produção)",
  "descricao": "",
  "etapa": "ETAPA 14 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 113
 },
 {
  "id": "cul-14-10",
  "titulo": "Reunião cliente (Com participação da Direção de Produção e Equipe Produção)",
  "descricao": "",
  "etapa": "ETAPA 14 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 114
 },
 {
  "id": "cul-14-11",
  "titulo": "Apresentação EC fechamento Cliente",
  "descricao": "",
  "etapa": "ETAPA 14 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 115
 },
 {
  "id": "cul-14-12",
  "titulo": "OS's Fechamento Produção",
  "descricao": "",
  "etapa": "ETAPA 14 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 116
 },
 {
  "id": "cul-14-13",
  "titulo": "Orientações Faturamentos e Contratos",
  "descricao": "",
  "etapa": "ETAPA 14 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 5
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 117
 },
 {
  "id": "cul-14-14",
  "titulo": "Emissão + Envio OS's I Contratos",
  "descricao": "",
  "etapa": "ETAPA 14 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 5
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 118
 },
 {
  "id": "cul-14-15",
  "titulo": "De acordos e Assinaturas OS's e Contratos",
  "descricao": "",
  "etapa": "ETAPA 14 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 119
 },
 {
  "id": "cul-14-16",
  "titulo": "Recebimento e Arquivamento NF's",
  "descricao": "",
  "etapa": "ETAPA 14 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 120
 },
 {
  "id": "cul-14-17",
  "titulo": "Lançamentos Valores PC + OS's no SCE",
  "descricao": "",
  "etapa": "ETAPA 14 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 121
 },
 {
  "id": "cul-14-18",
  "titulo": "Envio NF's I Planilha Controle Pólobh I Cliente",
  "descricao": "",
  "etapa": "ETAPA 14 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 122
 },
 {
  "id": "cul-14-19",
  "titulo": "Conformidade Lançamentos CP's e CR's",
  "descricao": "",
  "etapa": "ETAPA 14 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 123
 },
 {
  "id": "cul-14-20",
  "titulo": "Rubricas CP's e CR's",
  "descricao": "",
  "etapa": "ETAPA 14 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 124
 },
 {
  "id": "cul-14-21",
  "titulo": "Programação PG's",
  "descricao": "",
  "etapa": "ETAPA 14 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 125
 },
 {
  "id": "cul-14-22",
  "titulo": "Lançamentos PG's Banco",
  "descricao": "",
  "etapa": "ETAPA 14 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Assistente Financeiro"
  ],
  "ordem": 126
 },
 {
  "id": "cul-14-23",
  "titulo": "Autorizações PG's (Com anuência da Direção Administrativo-Financeiro)",
  "descricao": "",
  "etapa": "ETAPA 14 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 127
 },
 {
  "id": "cul-14-24",
  "titulo": "Arquivamento Comprovantes PG's",
  "descricao": "",
  "etapa": "ETAPA 14 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Assistente Financeiro"
  ],
  "ordem": 128
 },
 {
  "id": "cul-15-01",
  "titulo": "Prestação de Contas - Posts Parcerias Redes Sociais Pólobh x Espetáculo",
  "descricao": "",
  "etapa": "ETAPA 15 · PRESTAÇÃO DE CONTAS — PRODUÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 129
 },
 {
  "id": "cul-15-02",
  "titulo": "Prestação de Contas - Ação Social - Conferência Declarações Originais + Folhas de Rosto e Digitalização das Declarações Pólobh + Parceiro",
  "descricao": "",
  "etapa": "ETAPA 15 · PRESTAÇÃO DE CONTAS — PRODUÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 130
 },
 {
  "id": "cul-15-03",
  "titulo": "Prestação de Contas - Passagens Aéreas",
  "descricao": "(1) Providenciar conferência da Fatura conforme orientações da Coordenação Administrativo-Financeiro considerando todos os custos que foram pagos para á agência de turismo, inclusive todas as trocas que foram feitas ao longo do processo.\n(2) Organizar arquivo Passagens Aéreas\n(3) Organizar arquivo Cartões Embarque\n(4) Providenciar Anexo NF contendo detalhamento dos cartões de embarque + Impressão dos cartões – Entrega documentação para Coordenação Administrativo-Financeiro\n(5) Providenciar Anexo contrato, contendo detalhamento das passagens e valores – Entrega documentação para Coordenação Administrativo-Financeiro",
  "etapa": "ETAPA 15 · PRESTAÇÃO DE CONTAS — PRODUÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 131
 },
 {
  "id": "cul-15-04",
  "titulo": "Prestação de Contas - Passagens Terrestres",
  "descricao": "(1) Organizar arquivo Passagens Terrestres\n(2) Organizar arquivo Cartões Embarque\n(3) Providenciar Anexo NF contendo detalhamento dos cartões de embarque + Impressão dos cartões – Entrega documentação para Coordenação Administrativo-Financeiro\n(4) Providenciar Anexo contrato, contendo detalhamento das passagens e valores – Entrega documentação para Coordenação Administrativo-Financeiro",
  "etapa": "ETAPA 15 · PRESTAÇÃO DE CONTAS — PRODUÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 132
 },
 {
  "id": "cul-15-05",
  "titulo": "Prestação de Contas - Fretamento Ônibus",
  "descricao": "(1) Providenciar Anexo NF contendo detalhamento dos dados de todos os passageiros (Nome completo, função, RG ou CPF), assinada pelo fornecedor do ônibus – Entrega documentação para Coordenação Administrativo-Financeiro\n(2) Providenciar Anexo contrato, contendo detalhamento das passagens e valores – Entrega documentação para Coordenação Administrativo-Financeiro",
  "etapa": "ETAPA 15 · PRESTAÇÃO DE CONTAS — PRODUÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 133
 },
 {
  "id": "cul-15-06",
  "titulo": "Prestação de Contas - Transporte Local",
  "descricao": "(1) Providenciar Anexo NF contendo detalhamento do transporte e seus beneficiários – Nomes e Funções – Entrega documentação para Coordenação Administrativo-Financeiro",
  "etapa": "ETAPA 15 · PRESTAÇÃO DE CONTAS — PRODUÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 134
 },
 {
  "id": "cul-15-07",
  "titulo": "Prestação de Contas - Hospedagem",
  "descricao": "(1) Providenciar Anexo NF Hotel contendo detalhamento da hospedagem e seus beneficiários – Nomes, Funções e valores – Entrega documentação para Coordenação Administrativo-Financeiro",
  "etapa": "ETAPA 15 · PRESTAÇÃO DE CONTAS — PRODUÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 135
 },
 {
  "id": "cul-15-08",
  "titulo": "Prestação de Contas - Refeições",
  "descricao": "(1) Providenciar Anexo NF, contendo detalhamento dos beneficiários | Fornecedor Ticket à Cópias dos recibos Padrão Pólobh – Entrega documentação para Coordenação Administrativo-Financeiro",
  "etapa": "ETAPA 15 · PRESTAÇÃO DE CONTAS — PRODUÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 136
 },
 {
  "id": "cul-15-09",
  "titulo": "Prestação de Contas - Catering Teatro",
  "descricao": "(1) Providenciar Anexo NF, contendo detalhamento dos beneficiários – Entrega documentação para Coordenação Administrativo-Financeiro",
  "etapa": "ETAPA 15 · PRESTAÇÃO DE CONTAS — PRODUÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 137
 },
 {
  "id": "cul-15-10",
  "titulo": "Prestação de Contas - Intérprete de Libras",
  "descricao": "(1) Providenciar arquivo fotos - Intérprete Libras",
  "etapa": "ETAPA 15 · PRESTAÇÃO DE CONTAS — PRODUÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 138
 },
 {
  "id": "cul-15-11",
  "titulo": "Prestação de Contas - Áudio Descrição",
  "descricao": "(1) Providenciar arquivo fotos:\n• Audiodescritores\n• Rádios transmissores\n• Atendimento do público especial\n(2) Providenciar arquivo áudio da audiodescrição gravado de forma amadora somente para fins de prestação de contas, sem pretensão de uso para fins comerciais = sem custo",
  "etapa": "ETAPA 15 · PRESTAÇÃO DE CONTAS — PRODUÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 139
 },
 {
  "id": "cul-15-12",
  "titulo": "Prestação de Contas - Registro Fotográfico",
  "descricao": "• Pastinha (1) – Vídeos Divulgação\n• Pastinha (2) - Medidas Segurança:\n• Pastinha (3) - Medidas Acessibilidade\n• Pastinha (4) – Tradução em Libras\n• Pastinha (5) – Áudio Descrição\n• Pastinha (6) - Merchandising patrocinadores:\n• Pastinha (7) - Atendimento Convidados\n• Pastinha (8) - Público\n• Pastinha (9) - Espetáculo",
  "etapa": "ETAPA 15 · PRESTAÇÃO DE CONTAS — PRODUÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 140
 },
 {
  "id": "cul-15-13",
  "titulo": "Prestação de Contas - Ações Formativas (Workshops, Bate-Papo, Oficinas, Aulas, Ensaio Aberto, outros)",
  "descricao": "• Borderaux emitidos pelo Teatro\n• Fotos, inclusive imagens da intérprete de libras e da mediadora\n• Vídeos – Coletânea de vídeos depoimentos dos participantes",
  "etapa": "ETAPA 15 · PRESTAÇÃO DE CONTAS — PRODUÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 141
 },
 {
  "id": "cul-16-01",
  "titulo": "Consolidação EC X PC",
  "descricao": "",
  "etapa": "ETAPA 16 · FATURAMENTO E RENTABILIDADE",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 142
 },
 {
  "id": "cul-16-02",
  "titulo": "Envio Cliente rateio faturamento Polobh",
  "descricao": "",
  "etapa": "ETAPA 16 · FATURAMENTO E RENTABILIDADE",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 143
 },
 {
  "id": "cul-16-03",
  "titulo": "Emissão OC's cliente",
  "descricao": "",
  "etapa": "ETAPA 16 · FATURAMENTO E RENTABILIDADE",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 144
 },
 {
  "id": "cul-16-04",
  "titulo": "Emissão NF's Pólobh x Cliente",
  "descricao": "",
  "etapa": "ETAPA 16 · FATURAMENTO E RENTABILIDADE",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 145
 },
 {
  "id": "cul-16-05",
  "titulo": "Envio NF's I Planilha Controle Pólobh I Cliente",
  "descricao": "",
  "etapa": "ETAPA 16 · FATURAMENTO E RENTABILIDADE",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 146
 },
 {
  "id": "cul-16-06",
  "titulo": "Acompanhamento PG's Clientes - Fornecedores e Pólobh",
  "descricao": "",
  "etapa": "ETAPA 16 · FATURAMENTO E RENTABILIDADE",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Assistente Financeiro"
  ],
  "ordem": 147
 },
 {
  "id": "cul-16-07",
  "titulo": "Cobranças e Acompanhamento Acertos BV's",
  "descricao": "",
  "etapa": "ETAPA 16 · FATURAMENTO E RENTABILIDADE",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Assistente Financeiro"
  ],
  "ordem": 148
 },
 {
  "id": "cul-16-08",
  "titulo": "Emissão e Avaliação Planilha Final Rentabilidade",
  "descricao": "",
  "etapa": "ETAPA 16 · FATURAMENTO E RENTABILIDADE",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro",
   "Coordenação de Produção"
  ],
  "ordem": 149
 },
 {
  "id": "cul-16-09",
  "titulo": "Fechamento projeto SCE + APP",
  "descricao": "",
  "etapa": "ETAPA 16 · FATURAMENTO E RENTABILIDADE",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 150
 },
 {
  "id": "cul-17-01",
  "titulo": "Prestação de Contas - Artes Divulgação",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 151
 },
 {
  "id": "cul-17-02",
  "titulo": "Prestação de Contas - Comprovantes Mídia Agendas Culturais",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 152
 },
 {
  "id": "cul-17-03",
  "titulo": "Prestação de Contas - Comprovantes Mídia Artista",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 153
 },
 {
  "id": "cul-17-04",
  "titulo": "Prestação de Contas - Relatórios e Clipping Assessoria de Imprensa",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 154
 },
 {
  "id": "cul-17-05",
  "titulo": "Prestação de Contas - Comprovantes Mídia Emissoras Rádio",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 155
 },
 {
  "id": "cul-17-06",
  "titulo": "Prestação de Contas - Comprovantes Mídia Emissoras TV",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 156
 },
 {
  "id": "cul-17-07",
  "titulo": "Prestação de Contas - Comprovantes Mídia Jornais",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 157
 },
 {
  "id": "cul-17-08",
  "titulo": "Prestação de Contas - Comprovantes Mídia Mobiliário Urbano",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 158
 },
 {
  "id": "cul-17-09",
  "titulo": "Prestação de Contas - Comprovantes Mídia Patrocinadores",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 159
 },
 {
  "id": "cul-17-10",
  "titulo": "Prestação de Contas - Comprovantes Mídia Redes Sociais",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 160
 },
 {
  "id": "cul-17-11",
  "titulo": "Prestação de Contas - Comprovantes Mídia Teatro",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 161
 },
 {
  "id": "cul-17-12",
  "titulo": "Prestação de Contas - Comprovantes Mídia Ticketeira",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 162
 },
 {
  "id": "cul-17-13",
  "titulo": "Prestação de Contas - Comprovantes Mídia Transporte Aplicativo",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 163
 },
 {
  "id": "cul-17-14",
  "titulo": "Prestação de Contas - Relatórios Disparos E-mail MKT - Pólobh e Parceiros",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 164
 },
 {
  "id": "cul-17-15",
  "titulo": "Prestação de Contas - Locução Vinheta",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 165
 },
 {
  "id": "cul-17-16",
  "titulo": "Prestação de Contas - Vídeo Vinheta",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 166
 },
 {
  "id": "cul-17-17",
  "titulo": "Prestação de Contas - Vídeo Vinheta Créditos Temporada Pólobh",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 167
 },
 {
  "id": "cul-17-18",
  "titulo": "Prestação de Contas - Fotos Banners Patrocinadores",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 168
 },
 {
  "id": "cul-17-19",
  "titulo": "Prestação de Contas - Vídeos Banners Teatro",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 169
 },
 {
  "id": "cul-17-20",
  "titulo": "Prestação de Contas - Contrato Teatro",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 170
 },
 {
  "id": "cul-17-21",
  "titulo": "Prestação de Contas - Fotos Acessibilidade Física",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 171
 },
 {
  "id": "cul-17-22",
  "titulo": "Prestação de Contas - Declaração Acessibilidade Física",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 172
 },
 {
  "id": "cul-17-23",
  "titulo": "Prestação de Contas - Fotos Intérprete de Libras",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 173
 },
 {
  "id": "cul-17-24",
  "titulo": "Prestação de Contas - Áudio Audiodescrição",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 174
 },
 {
  "id": "cul-17-25",
  "titulo": "Prestação de Contas - Fotos Audiodescrição",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 175
 },
 {
  "id": "cul-17-26",
  "titulo": "Prestação de Contas - Declarações Distribuição Ação Social",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 176
 },
 {
  "id": "cul-17-27",
  "titulo": "Prestação de Contas - Borderaux",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 177
 },
 {
  "id": "cul-17-28",
  "titulo": "Prestação de Contas - Fotos",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 178
 },
 {
  "id": "cul-17-29",
  "titulo": "Prestação de Contas - Passagens Aéreas e Cartões Embarque",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 179
 },
 {
  "id": "cul-17-30",
  "titulo": "Prestação de Contas - Relatório de Execução",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 180
 },
 {
  "id": "cul-17-31",
  "titulo": "Prestação de Contas - Mailing Vendas Ticketeira",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 181
 },
 {
  "id": "cul-17-32",
  "titulo": "Prestação de Contas - Arquivos Dropbox e Drive",
  "descricao": "",
  "etapa": "ETAPA 17 · PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 182
 }
]$json$::jsonb, now())
on conflict (modalidade) do update
  set nome = excluded.nome,
      itens = excluded.itens,
      atualizado_em = now();

insert into checklist_modelos (modalidade, nome, itens, atualizado_em)
values ('Corporativo', 'Projetos Corporativos', $json$[
 {
  "id": "cor-01-01",
  "titulo": "Briefing",
  "descricao": "",
  "etapa": "ETAPA 1 · ABERTURA DO PROJETO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 6
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 0
 },
 {
  "id": "cor-01-02",
  "titulo": "Abertura Pasta Dropbox I App",
  "descricao": "",
  "etapa": "ETAPA 1 · ABERTURA DO PROJETO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 5
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 1
 },
 {
  "id": "cor-01-03",
  "titulo": "Cadastrar SCE Centro de Resultados",
  "descricao": "",
  "etapa": "ETAPA 1 · ABERTURA DO PROJETO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 5
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 2
 },
 {
  "id": "cor-01-04",
  "titulo": "Definição Produção Responsável / Equipe",
  "descricao": "",
  "etapa": "ETAPA 1 · ABERTURA DO PROJETO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 5
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 3
 },
 {
  "id": "cor-01-05",
  "titulo": "Reunião Discussão Projeto",
  "descricao": "",
  "etapa": "ETAPA 1 · ABERTURA DO PROJETO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 5
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 4
 },
 {
  "id": "cor-01-06",
  "titulo": "Detalhamento EC",
  "descricao": "",
  "etapa": "ETAPA 1 · ABERTURA DO PROJETO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 5
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 5
 },
 {
  "id": "cor-01-07",
  "titulo": "Abertura PC",
  "descricao": "",
  "etapa": "ETAPA 1 · ABERTURA DO PROJETO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 5
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 6
 },
 {
  "id": "cor-02-01",
  "titulo": "Reunião Repasse projeto Produção Responsável / Equipe",
  "descricao": "",
  "etapa": "ETAPA 2 · REPASSE E APRESENTAÇÃO DO PROJETO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 5
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 7
 },
 {
  "id": "cor-02-02",
  "titulo": "Gestão da EC",
  "descricao": "",
  "etapa": "ETAPA 2 · REPASSE E APRESENTAÇÃO DO PROJETO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 8
 },
 {
  "id": "cor-02-03",
  "titulo": "Elaboração Apresentação projeto",
  "descricao": "",
  "etapa": "ETAPA 2 · REPASSE E APRESENTAÇÃO DO PROJETO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 9
 },
 {
  "id": "cor-02-04",
  "titulo": "Elaboração Apresentação projeto",
  "descricao": "",
  "etapa": "ETAPA 2 · REPASSE E APRESENTAÇÃO DO PROJETO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 10
 },
 {
  "id": "cor-02-05",
  "titulo": "Fechamento EC e Apresentação",
  "descricao": "",
  "etapa": "ETAPA 2 · REPASSE E APRESENTAÇÃO DO PROJETO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 11
 },
 {
  "id": "cor-03-01",
  "titulo": "Revisão Planejamento",
  "descricao": "",
  "etapa": "ETAPA 3 · REVISÃO E APROVAÇÃO DA EC",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 12
 },
 {
  "id": "cor-03-02",
  "titulo": "Revisão EC",
  "descricao": "",
  "etapa": "ETAPA 3 · REVISÃO E APROVAÇÃO DA EC",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 13
 },
 {
  "id": "cor-03-03",
  "titulo": "Ajustes Orçamentos Diversos",
  "descricao": "",
  "etapa": "ETAPA 3 · REVISÃO E APROVAÇÃO DA EC",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 14
 },
 {
  "id": "cor-03-04",
  "titulo": "Aprovação EC",
  "descricao": "",
  "etapa": "ETAPA 3 · REVISÃO E APROVAÇÃO DA EC",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 15
 },
 {
  "id": "cor-03-05",
  "titulo": "Revisão Negociações Fornecedores e Valores para Contratação",
  "descricao": "",
  "etapa": "ETAPA 3 · REVISÃO E APROVAÇÃO DA EC",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 16
 },
 {
  "id": "cor-04-01",
  "titulo": "Alinhamentos Técnicos para Contratações",
  "descricao": "",
  "etapa": "ETAPA 4 · ALINHAMENTOS E CONTRATAÇÕES",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 17
 },
 {
  "id": "cor-04-02",
  "titulo": "Ciclo de reuniões com fornecedores (Com participação eventual da Direção de Produção)",
  "descricao": "",
  "etapa": "ETAPA 4 · ALINHAMENTOS E CONTRATAÇÕES",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 18
 },
 {
  "id": "cor-04-03",
  "titulo": "Planilha I Briefing criação artes",
  "descricao": "",
  "etapa": "ETAPA 4 · ALINHAMENTOS E CONTRATAÇÕES",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável",
   "Direção de Produção"
  ],
  "ordem": 19
 },
 {
  "id": "cor-04-04",
  "titulo": "Elaboração Roteiros Peças Áudio / Video / Apresentações",
  "descricao": "",
  "etapa": "ETAPA 4 · ALINHAMENTOS E CONTRATAÇÕES",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Direção de Produção"
  ],
  "ordem": 20
 },
 {
  "id": "cor-04-05",
  "titulo": "Cronograma de Produção dos Itens",
  "descricao": "",
  "etapa": "ETAPA 4 · ALINHAMENTOS E CONTRATAÇÕES",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 21
 },
 {
  "id": "cor-04-06",
  "titulo": "Revisão Negociações Fornecedores e Valores para Contratação",
  "descricao": "",
  "etapa": "ETAPA 4 · ALINHAMENTOS E CONTRATAÇÕES",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 22
 },
 {
  "id": "cor-05-01",
  "titulo": "Emissão OS's Produção",
  "descricao": "",
  "etapa": "ETAPA 5 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 23
 },
 {
  "id": "cor-05-02",
  "titulo": "Orientações Faturamentos e Contratos",
  "descricao": "",
  "etapa": "ETAPA 5 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 24
 },
 {
  "id": "cor-05-03",
  "titulo": "Emissão + Envio OS's I Contratos",
  "descricao": "",
  "etapa": "ETAPA 5 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 25
 },
 {
  "id": "cor-05-04",
  "titulo": "De acordos e Assinaturas OS's e Contratos",
  "descricao": "",
  "etapa": "ETAPA 5 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 26
 },
 {
  "id": "cor-05-05",
  "titulo": "Recebimento e Arquivamento NF's",
  "descricao": "",
  "etapa": "ETAPA 5 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 27
 },
 {
  "id": "cor-05-06",
  "titulo": "Lançamentos Valores PC + OS's no SCE",
  "descricao": "",
  "etapa": "ETAPA 5 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 28
 },
 {
  "id": "cor-05-07",
  "titulo": "Envio NF's I Planilha Controle Pólobh I Cliente",
  "descricao": "",
  "etapa": "ETAPA 5 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 29
 },
 {
  "id": "cor-05-08",
  "titulo": "Conformidade Lançamentos CP's e CR's",
  "descricao": "",
  "etapa": "ETAPA 5 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 30
 },
 {
  "id": "cor-05-09",
  "titulo": "Rubricas CP's e CR's",
  "descricao": "",
  "etapa": "ETAPA 5 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 31
 },
 {
  "id": "cor-05-10",
  "titulo": "Programação PG's",
  "descricao": "",
  "etapa": "ETAPA 5 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 32
 },
 {
  "id": "cor-05-11",
  "titulo": "Lançamentos PG's Banco",
  "descricao": "",
  "etapa": "ETAPA 5 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Assistente Financeiro"
  ],
  "ordem": 33
 },
 {
  "id": "cor-05-12",
  "titulo": "Autorizações PG's (Com anuência da Direção Administrativo-Financeiro)",
  "descricao": "",
  "etapa": "ETAPA 5 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 34
 },
 {
  "id": "cor-05-13",
  "titulo": "Arquivamento Comprovantes PG's",
  "descricao": "",
  "etapa": "ETAPA 5 · EMISSÃO DE OS'S E PAGAMENTOS",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Assistente Financeiro"
  ],
  "ordem": 35
 },
 {
  "id": "cor-06-01",
  "titulo": "Briefing Registros Foto e Vídeo",
  "descricao": "",
  "etapa": "ETAPA 6 · SEMANA DO EVENTO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 36
 },
 {
  "id": "cor-06-02",
  "titulo": "Consolidação Cronograma I Telefones Úteis",
  "descricao": "",
  "etapa": "ETAPA 6 · SEMANA DO EVENTO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 37
 },
 {
  "id": "cor-06-03",
  "titulo": "Envio Cronogramas para os Fornecedores",
  "descricao": "",
  "etapa": "ETAPA 6 · SEMANA DO EVENTO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 38
 },
 {
  "id": "cor-06-04",
  "titulo": "Inventário de materiais",
  "descricao": "",
  "etapa": "ETAPA 6 · SEMANA DO EVENTO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 39
 },
 {
  "id": "cor-06-05",
  "titulo": "Separação e organização material evento",
  "descricao": "",
  "etapa": "ETAPA 6 · SEMANA DO EVENTO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 40
 },
 {
  "id": "cor-06-06",
  "titulo": "Montagem Pasta Documentação Evento (Impressão)",
  "descricao": "",
  "etapa": "ETAPA 6 · SEMANA DO EVENTO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 41
 },
 {
  "id": "cor-06-07",
  "titulo": "Ciclo Reuniões I Ligações fornecedores",
  "descricao": "",
  "etapa": "ETAPA 6 · SEMANA DO EVENTO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 42
 },
 {
  "id": "cor-06-08",
  "titulo": "Reunião produtores freela - Repasse evento e alinhamento funções",
  "descricao": "",
  "etapa": "ETAPA 6 · SEMANA DO EVENTO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 43
 },
 {
  "id": "cor-06-09",
  "titulo": "Reunião alinhamento cliente (Com participação da Direção de Produção e Equipe Produção)",
  "descricao": "",
  "etapa": "ETAPA 6 · SEMANA DO EVENTO",
  "prazo": {
   "modo": "semanas-antes",
   "semanas": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 44
 },
 {
  "id": "cor-07-02",
  "titulo": "Montagem",
  "descricao": "",
  "etapa": "ETAPA 7 · EVENTO",
  "prazo": {
   "modo": "cronograma",
   "etapa": "montagem",
   "ponta": "ultima"
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção",
   "Produção"
  ],
  "ordem": 45
 },
 {
  "id": "cor-07-03",
  "titulo": "Reunião alinhamento equipe para operação",
  "descricao": "",
  "etapa": "ETAPA 7 · EVENTO",
  "prazo": {
   "modo": "cronograma",
   "etapa": "alinhamentos",
   "ou": "evento",
   "ponta": "primeira"
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção",
   "Produção"
  ],
  "ordem": 46
 },
 {
  "id": "cor-07-01",
  "titulo": "Evento",
  "descricao": "",
  "etapa": "ETAPA 7 · EVENTO",
  "prazo": {
   "modo": "cronograma",
   "etapa": "evento",
   "ponta": "ultima"
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção",
   "Produção"
  ],
  "ordem": 47
 },
 {
  "id": "cor-07-04",
  "titulo": "Operação evento I entrega",
  "descricao": "",
  "etapa": "ETAPA 7 · EVENTO",
  "prazo": {
   "modo": "cronograma",
   "etapa": "evento",
   "ponta": "ultima"
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção",
   "Produção"
  ],
  "ordem": 48
 },
 {
  "id": "cor-07-05",
  "titulo": "Desmontagem",
  "descricao": "",
  "etapa": "ETAPA 7 · EVENTO",
  "prazo": {
   "modo": "cronograma",
   "etapa": "desmontagem",
   "ponta": "ultima"
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção",
   "Produção"
  ],
  "ordem": 49
 },
 {
  "id": "cor-08-01",
  "titulo": "EC Fechamento",
  "descricao": "",
  "etapa": "ETAPA 8 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 50
 },
 {
  "id": "cor-08-02",
  "titulo": "Planilha Sobra material I listas e etc",
  "descricao": "",
  "etapa": "ETAPA 8 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 51
 },
 {
  "id": "cor-08-03",
  "titulo": "Envio Sobra Material | Listas e etc para o Cliente",
  "descricao": "",
  "etapa": "ETAPA 8 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 52
 },
 {
  "id": "cor-08-04",
  "titulo": "Arquivamento Registros Foto e Video",
  "descricao": "",
  "etapa": "ETAPA 8 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 53
 },
 {
  "id": "cor-08-05",
  "titulo": "Seleção registros foto e vídeo para o site Pólobh",
  "descricao": "",
  "etapa": "ETAPA 8 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 54
 },
 {
  "id": "cor-08-06",
  "titulo": "Envio registros foto e vídeo para o Cliente",
  "descricao": "",
  "etapa": "ETAPA 8 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 1
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 55
 },
 {
  "id": "cor-08-07",
  "titulo": "Publicação registros foto e vídeo para o site Pólobh",
  "descricao": "",
  "etapa": "ETAPA 8 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 56
 },
 {
  "id": "cor-08-08",
  "titulo": "Reunião interna (Com participação da Direção de Produção e Equipe Produção)",
  "descricao": "",
  "etapa": "ETAPA 8 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 57
 },
 {
  "id": "cor-08-09",
  "titulo": "Reunião cliente (Com participação da Direção de Produção e Equipe Produção)",
  "descricao": "",
  "etapa": "ETAPA 8 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação de Produção"
  ],
  "ordem": 58
 },
 {
  "id": "cor-08-10",
  "titulo": "Apresentação EC fechamento Cliente",
  "descricao": "",
  "etapa": "ETAPA 8 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 59
 },
 {
  "id": "cor-08-11",
  "titulo": "OS's Fechamento Produção",
  "descricao": "",
  "etapa": "ETAPA 8 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 4
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Produção Responsável"
  ],
  "ordem": 60
 },
 {
  "id": "cor-08-12",
  "titulo": "Orientações Faturamentos e Contratos",
  "descricao": "",
  "etapa": "ETAPA 8 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 5
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 61
 },
 {
  "id": "cor-08-13",
  "titulo": "Emissão + Envio OS's I Contratos",
  "descricao": "",
  "etapa": "ETAPA 8 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "dias-uteis-apos",
   "base": "desmontagem",
   "diasUteis": 5
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 62
 },
 {
  "id": "cor-08-14",
  "titulo": "De acordos e Assinaturas OS's e Contratos",
  "descricao": "",
  "etapa": "ETAPA 8 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 63
 },
 {
  "id": "cor-08-15",
  "titulo": "Recebimento e Arquivamento NF's",
  "descricao": "",
  "etapa": "ETAPA 8 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 64
 },
 {
  "id": "cor-08-16",
  "titulo": "Lançamentos Valores PC + OS's no SCE",
  "descricao": "",
  "etapa": "ETAPA 8 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 65
 },
 {
  "id": "cor-08-17",
  "titulo": "Envio NF's I Planilha Controle Pólobh I Cliente",
  "descricao": "",
  "etapa": "ETAPA 8 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 66
 },
 {
  "id": "cor-08-18",
  "titulo": "Conformidade Lançamentos CP's e CR's",
  "descricao": "",
  "etapa": "ETAPA 8 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 67
 },
 {
  "id": "cor-08-19",
  "titulo": "Rubricas CP's e CR's",
  "descricao": "",
  "etapa": "ETAPA 8 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 68
 },
 {
  "id": "cor-08-20",
  "titulo": "Programação PG's",
  "descricao": "",
  "etapa": "ETAPA 8 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 69
 },
 {
  "id": "cor-08-21",
  "titulo": "Lançamentos PG's Banco",
  "descricao": "",
  "etapa": "ETAPA 8 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Assistente Financeiro"
  ],
  "ordem": 70
 },
 {
  "id": "cor-08-22",
  "titulo": "Autorizações PG's (Com anuência da Direção Administrativo-Financeiro)",
  "descricao": "",
  "etapa": "ETAPA 8 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 71
 },
 {
  "id": "cor-08-23",
  "titulo": "Arquivamento Comprovantes PG's",
  "descricao": "",
  "etapa": "ETAPA 8 · ENCERRAMENTO PÓS-EVENTO",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 2
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Assistente Financeiro"
  ],
  "ordem": 72
 },
 {
  "id": "cor-09-01",
  "titulo": "Consolidação EC X PC",
  "descricao": "",
  "etapa": "ETAPA 9 · FATURAMENTO E RENTABILIDADE",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 73
 },
 {
  "id": "cor-09-02",
  "titulo": "Envio Cliente rateio faturamento Polobh",
  "descricao": "",
  "etapa": "ETAPA 9 · FATURAMENTO E RENTABILIDADE",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 74
 },
 {
  "id": "cor-09-03",
  "titulo": "Emissão OC's cliente",
  "descricao": "",
  "etapa": "ETAPA 9 · FATURAMENTO E RENTABILIDADE",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 75
 },
 {
  "id": "cor-09-04",
  "titulo": "Emissão NF's Pólobh x Cliente",
  "descricao": "",
  "etapa": "ETAPA 9 · FATURAMENTO E RENTABILIDADE",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 76
 },
 {
  "id": "cor-09-05",
  "titulo": "Envio NF's I Planilha Controle Pólobh I Cliente",
  "descricao": "",
  "etapa": "ETAPA 9 · FATURAMENTO E RENTABILIDADE",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Back-Office"
  ],
  "ordem": 77
 },
 {
  "id": "cor-09-06",
  "titulo": "Acompanhamento PG's Clientes - Fornecedores e Pólobh",
  "descricao": "",
  "etapa": "ETAPA 9 · FATURAMENTO E RENTABILIDADE",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Assistente Financeiro"
  ],
  "ordem": 78
 },
 {
  "id": "cor-09-07",
  "titulo": "Cobranças e Acompanhamento Acertos BV's",
  "descricao": "",
  "etapa": "ETAPA 9 · FATURAMENTO E RENTABILIDADE",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Assistente Financeiro"
  ],
  "ordem": 79
 },
 {
  "id": "cor-09-08",
  "titulo": "Emissão e Avaliação Planilha Final Rentabilidade",
  "descricao": "",
  "etapa": "ETAPA 9 · FATURAMENTO E RENTABILIDADE",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro",
   "Coordenação de Produção"
  ],
  "ordem": 80
 },
 {
  "id": "cor-09-09",
  "titulo": "Fechamento projeto SCE + APP",
  "descricao": "",
  "etapa": "ETAPA 9 · FATURAMENTO E RENTABILIDADE",
  "prazo": {
   "modo": "semanas-apos",
   "base": "evento",
   "semanas": 3
  },
  "responsavelPadrao": "",
  "funcoes": [
   "Coordenação Administrativo-Financeiro"
  ],
  "ordem": 81
 }
]$json$::jsonb, now())
on conflict (modalidade) do update
  set nome = excluded.nome,
      itens = excluded.itens,
      atualizado_em = now();
