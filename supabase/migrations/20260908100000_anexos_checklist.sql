-- ============================================================================
-- Anexos leves nos comentarios das tarefas do check-list.
--
-- Metade do que a producao combina numa tarefa vem com um papel junto: a foto
-- da planta do local, o PDF do orcamento, a planilha do buffet. Sem onde
-- pendurar isso, o arquivo ia parar no WhatsApp e a decisao ficava no sistema,
-- separada da prova.
--
-- Os BYTES ficam aqui, no Storage. A FICHA do arquivo (nome, tamanho, quem
-- mandou) fica junto do comentario, em `checklist_itens.observacoes` — que ja e
-- jsonb e ja e gravado item a item. Nenhuma coluna nova.
--
-- "Leve" e regra, nao pedido: o teto e do BUCKET, entao nao adianta contornar a
-- tela. A peneira do app existe para dar a mensagem boa; esta aqui e a que
-- vale.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'anexos-checklist',
  'anexos-checklist',
  -- Fechado: nao existe URL permanente. A tela pede um link assinado de 60s a
  -- cada abertura, e o link morre sozinho.
  false,
  5242880, -- 5 MB por arquivo
  array[
    'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv','text/plain'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- Quem ve o check-list ve o anexo; quem edita o check-list anexa.
--
-- E o mesmo criterio das policies de `checklist_itens`: leitura para qualquer
-- perfil valido, escrita para os quatro papeis que mexem em tarefa. Nao ha
-- policy nenhuma para `anon` — sem sessao, nao se le nem se escreve.
--
-- Note que a lista de MIME e o teto de tamanho NAO sao policy: sao propriedade
-- do bucket, aplicada pelo proprio Storage antes de qualquer regra.
-- ----------------------------------------------------------------------------
drop policy if exists anexos_checklist_read on storage.objects;
create policy anexos_checklist_read on storage.objects for select
  using (bucket_id = 'anexos-checklist' and papel_atual() is not null);

drop policy if exists anexos_checklist_insert on storage.objects;
create policy anexos_checklist_insert on storage.objects for insert
  with check (
    bucket_id = 'anexos-checklist'
    and papel_atual() in ('Admin','Direcao','Producao','Administrativo')
  );

drop policy if exists anexos_checklist_delete on storage.objects;
create policy anexos_checklist_delete on storage.objects for delete
  using (
    bucket_id = 'anexos-checklist'
    and papel_atual() in ('Admin','Direcao','Producao','Administrativo')
  );

-- Sem policy de UPDATE de proposito: anexo nao se edita. Cada envio cria um
-- caminho novo, e trocar o arquivo e apagar e mandar outro — assim o que a
-- pessoa abriu ontem nao vira outra coisa hoje, sem ninguem perceber.
