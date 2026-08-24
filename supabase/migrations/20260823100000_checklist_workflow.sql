-- ============================================================================
-- Módulo Check-List (Work Flow) de projetos.
--
-- Três tabelas:
--   * checklist_modelos — as listas padrão por modalidade (Corporativo /
--     Cultural). É o cadastro que a Coordenação mantém em Configurações.
--   * checklists        — uma lista por projeto, instanciada de um modelo.
--   * checklist_itens   — as tarefas que a equipe acompanha.
--
-- Decisão de desenho: os itens são LINHAS e são gravados um a um. É o oposto do
-- que a EC faz (`salvar_ec_completa` reescreve todas as linhas de uma vez) e é
-- de propósito: no check-list várias pessoas mexem em itens diferentes ao mesmo
-- tempo, e a gravação item a item elimina de saída o risco de uma pessoa apagar
-- o trabalho da outra.
-- ============================================================================

create table if not exists checklist_modelos (
  id uuid primary key default gen_random_uuid(),
  modalidade text not null unique check (modalidade in ('Corporativo','Cultural')),
  nome text not null default '',
  -- [{id, titulo, descricao, etapa, prazo:{modo,percentual|diasDoEvento}, responsavelPadrao, ordem}]
  itens jsonb not null default '[]'::jsonb,
  atualizado_em timestamptz not null default now()
);

comment on table checklist_modelos is
  'Listas padrão de tarefas por modalidade de projeto. Alterar o modelo não mexe '
  'nos check-lists já gerados — a tela oferece "trazer itens novos" como ação explícita.';

alter table checklist_modelos enable row level security;
drop policy if exists checklist_modelos_read on checklist_modelos;
create policy checklist_modelos_read on checklist_modelos for select using (papel_atual() is not null);
drop policy if exists checklist_modelos_write on checklist_modelos;
-- O modelo é configuração da casa: só quem administra mexe.
create policy checklist_modelos_write on checklist_modelos for all
  using (papel_atual() in ('Admin','Direcao'))
  with check (papel_atual() in ('Admin','Direcao'));

create table if not exists checklists (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null unique references projetos(id) on delete cascade,
  modalidade text not null default '',
  modelo_id uuid references checklist_modelos(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on column checklists.projeto_id is
  'Único: um projeto tem um check-list. Trocar a modalidade regenera a lista, não cria uma segunda.';

alter table checklists enable row level security;
drop policy if exists checklists_read on checklists;
create policy checklists_read on checklists for select using (papel_atual() is not null);
drop policy if exists checklists_write on checklists;
create policy checklists_write on checklists for all
  using (papel_atual() in ('Admin','Direcao','Producao','Administrativo'))
  with check (papel_atual() in ('Admin','Direcao','Producao','Administrativo'));

create table if not exists checklist_itens (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references checklists(id) on delete cascade,
  -- Item do modelo que originou este. Vazio = criado à mão dentro do projeto.
  origem_modelo_item_id text not null default '',
  titulo text not null default '',
  descricao text not null default '',
  etapa text not null default '',
  status text not null default 'Pendente'
    check (status in ('Pendente','Em andamento','Concluído','Não se aplica')),
  data_limite date,
  -- Data ajustada à mão: o recálculo dos prazos não passa por cima dela.
  data_manual boolean not null default false,
  concluido_em timestamptz,
  concluido_por text not null default '',
  responsavel text not null default '',
  -- Mesmo formato de `ec_linhas.observacoes`: [{id, texto, autorNome,
  -- responsavelNome, resolvida, respostas[]}]. Isso faz a thread da EC e o motor
  -- de pendências funcionarem aqui sem nenhuma adaptação.
  observacoes jsonb not null default '[]'::jsonb,
  oculto boolean not null default false,
  ordem int not null default 0
);

create index if not exists checklist_itens_checklist_idx on checklist_itens (checklist_id);
-- A visão cronológica ("indexado por data") varre por data-limite.
create index if not exists checklist_itens_data_idx on checklist_itens (data_limite);

alter table checklist_itens enable row level security;
drop policy if exists checklist_itens_read on checklist_itens;
create policy checklist_itens_read on checklist_itens for select using (papel_atual() is not null);
drop policy if exists checklist_itens_write on checklist_itens;
create policy checklist_itens_write on checklist_itens for all
  using (papel_atual() in ('Admin','Direcao','Producao','Administrativo'))
  with check (papel_atual() in ('Admin','Direcao','Producao','Administrativo'));

-- Toda gravação de item carimba o check-list, para a tela saber que mudou.
create or replace function tocar_checklist() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update checklists set atualizado_em = now()
   where id = coalesce(new.checklist_id, old.checklist_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists checklist_itens_tocar on checklist_itens;
create trigger checklist_itens_tocar
  after insert or update or delete on checklist_itens
  for each row execute function tocar_checklist();

-- ============================================================================
-- Sementes: listas padrão iniciais.
--
-- PROVISÓRIAS — redigidas a partir do fluxo que o próprio sistema já modela
-- (EC -> aprovação -> OS -> credenciamento -> cronograma -> evento -> prestação
-- de contas). Servem para o módulo nascer funcionando; a lista definitiva vem
-- da Pólobh e é editada em Configurações, sem tocar em código.
--
-- `on conflict do nothing`: reaplicar a migração não sobrescreve o que a
-- Coordenação já ajustou.
-- ============================================================================

insert into checklist_modelos (modalidade, nome, itens) values
  ('Cultural', 'Projetos Culturais', '[
  {
    "id": "mi-01",
    "titulo": "Confirmar escopo, datas e local do projeto com o cliente",
    "descricao": "",
    "etapa": "PRÉ-PRODUÇÃO",
    "prazo": {
      "modo": "percentual",
      "percentual": 0.0
    },
    "responsavelPadrao": "",
    "ordem": 0
  },
  {
    "id": "mi-02",
    "titulo": "Montar a Estimativa de Custos (EC)",
    "descricao": "",
    "etapa": "PRÉ-PRODUÇÃO",
    "prazo": {
      "modo": "percentual",
      "percentual": 0.05
    },
    "responsavelPadrao": "",
    "ordem": 1
  },
  {
    "id": "mi-03",
    "titulo": "Enviar a EC para aprovação do cliente",
    "descricao": "",
    "etapa": "PRÉ-PRODUÇÃO",
    "prazo": {
      "modo": "percentual",
      "percentual": 0.1
    },
    "responsavelPadrao": "",
    "ordem": 2
  },
  {
    "id": "mi-04",
    "titulo": "Registrar a aprovação da EC e liberar as contratações",
    "descricao": "",
    "etapa": "PRÉ-PRODUÇÃO",
    "prazo": {
      "modo": "percentual",
      "percentual": 0.15
    },
    "responsavelPadrao": "",
    "ordem": 3
  },
  {
    "id": "mi-05",
    "titulo": "Conferir enquadramento e incentivos fiscais do projeto",
    "descricao": "",
    "etapa": "PRÉ-PRODUÇÃO",
    "prazo": {
      "modo": "percentual",
      "percentual": 0.18
    },
    "responsavelPadrao": "",
    "ordem": 4
  },
  {
    "id": "mi-06",
    "titulo": "Reservar o espaço e fechar o contrato de locação",
    "descricao": "",
    "etapa": "PRÉ-PRODUÇÃO",
    "prazo": {
      "modo": "percentual",
      "percentual": 0.22
    },
    "responsavelPadrao": "",
    "ordem": 5
  },
  {
    "id": "mi-07",
    "titulo": "Emitir as OSs dos fornecedores aprovados",
    "descricao": "",
    "etapa": "CONTRATAÇÕES",
    "prazo": {
      "modo": "percentual",
      "percentual": 0.3
    },
    "responsavelPadrao": "",
    "ordem": 6
  },
  {
    "id": "mi-08",
    "titulo": "Coletar documentação e contratos dos fornecedores",
    "descricao": "",
    "etapa": "CONTRATAÇÕES",
    "prazo": {
      "modo": "percentual",
      "percentual": 0.4
    },
    "responsavelPadrao": "",
    "ordem": 7
  },
  {
    "id": "mi-09",
    "titulo": "Solicitar autorização de ECAD e direitos autorais",
    "descricao": "",
    "etapa": "CONTRATAÇÕES",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": -45
    },
    "responsavelPadrao": "",
    "ordem": 8
  },
  {
    "id": "mi-10",
    "titulo": "Fechar o plano de acessibilidade (Libras, audiodescrição)",
    "descricao": "",
    "etapa": "CONTRATAÇÕES",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": -40
    },
    "responsavelPadrao": "",
    "ordem": 9
  },
  {
    "id": "mi-11",
    "titulo": "Fechar o plano de comunicação e o material gráfico",
    "descricao": "",
    "etapa": "CONTRATAÇÕES",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": -35
    },
    "responsavelPadrao": "",
    "ordem": 10
  },
  {
    "id": "mi-12",
    "titulo": "Enviar o credenciamento aos fornecedores",
    "descricao": "",
    "etapa": "CONTRATAÇÕES",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": -15
    },
    "responsavelPadrao": "",
    "ordem": 11
  },
  {
    "id": "mi-13",
    "titulo": "Confirmar o cronograma de montagem com todos os fornecedores",
    "descricao": "",
    "etapa": "PRÉ-EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": -10
    },
    "responsavelPadrao": "",
    "ordem": 12
  },
  {
    "id": "mi-14",
    "titulo": "Conferir as respostas de credenciamento (equipe e veículos)",
    "descricao": "",
    "etapa": "PRÉ-EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": -7
    },
    "responsavelPadrao": "",
    "ordem": 13
  },
  {
    "id": "mi-15",
    "titulo": "Reunião de alinhamento final da equipe",
    "descricao": "",
    "etapa": "PRÉ-EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": -3
    },
    "responsavelPadrao": "",
    "ordem": 14
  },
  {
    "id": "mi-16",
    "titulo": "Checagem final de infraestrutura no local",
    "descricao": "",
    "etapa": "PRÉ-EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": -1
    },
    "responsavelPadrao": "",
    "ordem": 15
  },
  {
    "id": "mi-17",
    "titulo": "Montagem",
    "descricao": "",
    "etapa": "EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": -2
    },
    "responsavelPadrao": "",
    "ordem": 16
  },
  {
    "id": "mi-18",
    "titulo": "Ensaio e passagem de som",
    "descricao": "",
    "etapa": "EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": -1
    },
    "responsavelPadrao": "",
    "ordem": 17
  },
  {
    "id": "mi-19",
    "titulo": "Realização do evento",
    "descricao": "",
    "etapa": "EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": 0
    },
    "responsavelPadrao": "",
    "ordem": 18
  },
  {
    "id": "mi-20",
    "titulo": "Desmontagem",
    "descricao": "",
    "etapa": "EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": 1
    },
    "responsavelPadrao": "",
    "ordem": 19
  },
  {
    "id": "mi-21",
    "titulo": "Registrar ocorrências e conferir as medições dos fornecedores",
    "descricao": "",
    "etapa": "PÓS-EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": 3
    },
    "responsavelPadrao": "",
    "ordem": 20
  },
  {
    "id": "mi-22",
    "titulo": "Conferir notas fiscais e faturas dos fornecedores",
    "descricao": "",
    "etapa": "PÓS-EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": 7
    },
    "responsavelPadrao": "",
    "ordem": 21
  },
  {
    "id": "mi-23",
    "titulo": "Fechar a rentabilidade do projeto na EC",
    "descricao": "",
    "etapa": "PÓS-EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": 10
    },
    "responsavelPadrao": "",
    "ordem": 22
  },
  {
    "id": "mi-24",
    "titulo": "Enviar a prestação de contas ao cliente",
    "descricao": "",
    "etapa": "PÓS-EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": 15
    },
    "responsavelPadrao": "",
    "ordem": 23
  },
  {
    "id": "mi-25",
    "titulo": "Arquivar o projeto e a documentação",
    "descricao": "",
    "etapa": "PÓS-EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": 20
    },
    "responsavelPadrao": "",
    "ordem": 24
  }
]'::jsonb),
  ('Corporativo', 'Projetos Corporativos', '[
  {
    "id": "mi-01",
    "titulo": "Confirmar briefing, escopo e datas com o cliente",
    "descricao": "",
    "etapa": "PRÉ-PRODUÇÃO",
    "prazo": {
      "modo": "percentual",
      "percentual": 0.0
    },
    "responsavelPadrao": "",
    "ordem": 0
  },
  {
    "id": "mi-02",
    "titulo": "Montar a Estimativa de Custos (EC)",
    "descricao": "",
    "etapa": "PRÉ-PRODUÇÃO",
    "prazo": {
      "modo": "percentual",
      "percentual": 0.05
    },
    "responsavelPadrao": "",
    "ordem": 1
  },
  {
    "id": "mi-03",
    "titulo": "Enviar a EC para aprovação do cliente",
    "descricao": "",
    "etapa": "PRÉ-PRODUÇÃO",
    "prazo": {
      "modo": "percentual",
      "percentual": 0.1
    },
    "responsavelPadrao": "",
    "ordem": 2
  },
  {
    "id": "mi-04",
    "titulo": "Registrar a aprovação da EC e liberar as contratações",
    "descricao": "",
    "etapa": "PRÉ-PRODUÇÃO",
    "prazo": {
      "modo": "percentual",
      "percentual": 0.15
    },
    "responsavelPadrao": "",
    "ordem": 3
  },
  {
    "id": "mi-05",
    "titulo": "Definir o local e fechar o contrato de locação",
    "descricao": "",
    "etapa": "PRÉ-PRODUÇÃO",
    "prazo": {
      "modo": "percentual",
      "percentual": 0.22
    },
    "responsavelPadrao": "",
    "ordem": 4
  },
  {
    "id": "mi-06",
    "titulo": "Fechar o número de participantes e a lista nominal",
    "descricao": "",
    "etapa": "LOGÍSTICA E PARTICIPANTES",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": -45
    },
    "responsavelPadrao": "",
    "ordem": 5
  },
  {
    "id": "mi-07",
    "titulo": "Contratar hospedagem e transporte dos participantes",
    "descricao": "",
    "etapa": "LOGÍSTICA E PARTICIPANTES",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": -40
    },
    "responsavelPadrao": "",
    "ordem": 6
  },
  {
    "id": "mi-08",
    "titulo": "Emitir as OSs dos fornecedores aprovados",
    "descricao": "",
    "etapa": "CONTRATAÇÕES",
    "prazo": {
      "modo": "percentual",
      "percentual": 0.3
    },
    "responsavelPadrao": "",
    "ordem": 7
  },
  {
    "id": "mi-09",
    "titulo": "Coletar documentação e contratos dos fornecedores",
    "descricao": "",
    "etapa": "CONTRATAÇÕES",
    "prazo": {
      "modo": "percentual",
      "percentual": 0.4
    },
    "responsavelPadrao": "",
    "ordem": 8
  },
  {
    "id": "mi-10",
    "titulo": "Fechar o kit do participante e o material gráfico",
    "descricao": "",
    "etapa": "LOGÍSTICA E PARTICIPANTES",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": -30
    },
    "responsavelPadrao": "",
    "ordem": 9
  },
  {
    "id": "mi-11",
    "titulo": "Abrir a comunicação com os participantes (convite / save the date)",
    "descricao": "",
    "etapa": "LOGÍSTICA E PARTICIPANTES",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": -25
    },
    "responsavelPadrao": "",
    "ordem": 10
  },
  {
    "id": "mi-12",
    "titulo": "Fechar o cardápio e o serviço de alimentacao",
    "descricao": "",
    "etapa": "LOGÍSTICA E PARTICIPANTES",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": -20
    },
    "responsavelPadrao": "",
    "ordem": 11
  },
  {
    "id": "mi-13",
    "titulo": "Enviar o credenciamento aos fornecedores",
    "descricao": "",
    "etapa": "CONTRATAÇÕES",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": -15
    },
    "responsavelPadrao": "",
    "ordem": 12
  },
  {
    "id": "mi-14",
    "titulo": "Confirmar o cronograma de montagem com todos os fornecedores",
    "descricao": "",
    "etapa": "PRÉ-EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": -10
    },
    "responsavelPadrao": "",
    "ordem": 13
  },
  {
    "id": "mi-15",
    "titulo": "Conferir as respostas de credenciamento (equipe e veículos)",
    "descricao": "",
    "etapa": "PRÉ-EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": -7
    },
    "responsavelPadrao": "",
    "ordem": 14
  },
  {
    "id": "mi-16",
    "titulo": "Fechar o roteiro do evento e a ordem do dia",
    "descricao": "",
    "etapa": "PRÉ-EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": -5
    },
    "responsavelPadrao": "",
    "ordem": 15
  },
  {
    "id": "mi-17",
    "titulo": "Reunião de alinhamento final da equipe",
    "descricao": "",
    "etapa": "PRÉ-EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": -3
    },
    "responsavelPadrao": "",
    "ordem": 16
  },
  {
    "id": "mi-18",
    "titulo": "Checagem final de infraestrutura e tecnologia no local",
    "descricao": "",
    "etapa": "PRÉ-EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": -1
    },
    "responsavelPadrao": "",
    "ordem": 17
  },
  {
    "id": "mi-19",
    "titulo": "Montagem",
    "descricao": "",
    "etapa": "EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": -2
    },
    "responsavelPadrao": "",
    "ordem": 18
  },
  {
    "id": "mi-20",
    "titulo": "Credenciamento dos participantes",
    "descricao": "",
    "etapa": "EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": 0
    },
    "responsavelPadrao": "",
    "ordem": 19
  },
  {
    "id": "mi-21",
    "titulo": "Realização do evento",
    "descricao": "",
    "etapa": "EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": 0
    },
    "responsavelPadrao": "",
    "ordem": 20
  },
  {
    "id": "mi-22",
    "titulo": "Desmontagem",
    "descricao": "",
    "etapa": "EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": 1
    },
    "responsavelPadrao": "",
    "ordem": 21
  },
  {
    "id": "mi-23",
    "titulo": "Registrar ocorrências e conferir as medições dos fornecedores",
    "descricao": "",
    "etapa": "PÓS-EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": 3
    },
    "responsavelPadrao": "",
    "ordem": 22
  },
  {
    "id": "mi-24",
    "titulo": "Conferir notas fiscais e faturas dos fornecedores",
    "descricao": "",
    "etapa": "PÓS-EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": 7
    },
    "responsavelPadrao": "",
    "ordem": 23
  },
  {
    "id": "mi-25",
    "titulo": "Fechar a rentabilidade do projeto na EC",
    "descricao": "",
    "etapa": "PÓS-EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": 10
    },
    "responsavelPadrao": "",
    "ordem": 24
  },
  {
    "id": "mi-26",
    "titulo": "Enviar o relatório final ao cliente",
    "descricao": "",
    "etapa": "PÓS-EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": 15
    },
    "responsavelPadrao": "",
    "ordem": 25
  },
  {
    "id": "mi-27",
    "titulo": "Arquivar o projeto e a documentação",
    "descricao": "",
    "etapa": "PÓS-EVENTO",
    "prazo": {
      "modo": "ancora",
      "diasDoEvento": 20
    },
    "responsavelPadrao": "",
    "ordem": 26
  }
]'::jsonb)
on conflict (modalidade) do nothing;
