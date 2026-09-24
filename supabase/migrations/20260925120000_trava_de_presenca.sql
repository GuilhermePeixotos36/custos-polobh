-- ============================================================================
-- Trava de PRESENÇA: um documento, um editor por vez          (25/09/2026)
--
-- O pedido da Pólobh, com todas as letras: "o sistema não pode permitir que um
-- documento seja editado, substituído, arquivado, cancelado ou emitido se outro
-- usuário estiver com ele aberto em modo de edição".
--
-- Repare no verbo: PERMITIR. O que existia até aqui era outra coisa — a trava
-- otimista, que deixa os dois editarem e recusa o segundo salvamento. Ela é
-- essencial e continua valendo (é a rede embaixo desta), mas chega tarde: às
-- 16h, depois de meia hora de trabalho perdido. Esta chega às 15h30, antes de
-- a segunda pessoa digitar a primeira letra.
--
-- COMO FUNCIONA
--
-- Quem entra em modo de edição TOMA o documento; a tabela guarda uma linha por
-- documento, e a chave primária é o documento — não cabe um segundo dono.
-- Enquanto edita, o navegador dá sinal de vida a cada 30 segundos.
--
-- O QUE IMPEDE A TRAVA DE VIRAR UM PROBLEMA PIOR
--
-- Uma trava que só o dono solta é uma trava que trava a casa: a pessoa fecha o
-- notebook, vai almoçar, e o documento fica preso até alguém ligar para ela.
-- Por isso a posse tem PRAZO: sem sinal por 90 segundos (três batidas
-- perdidas), ela caduca sozinha e o próximo que chegar assume. É o mesmo
-- motivo de a limpeza acontecer DENTRO da função de tomar posse, e não num
-- serviço à parte que pode estar fora do ar justamente no dia em que é preciso.
-- ============================================================================

create table if not exists edicoes_abertas (
  -- "os:<uuid>", "ec:<uuid>", "projeto:<uuid>". Texto, e não duas colunas com
  -- chave estrangeira, porque a trava vale para tipos diferentes de documento e
  -- não deve depender de qual tabela guarda cada um.
  documento text primary key,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  -- O nome fica GRAVADO aqui, e não é lido de `perfis` na hora: o aviso da tela
  -- ("Marisa está editando desde 14h20") precisa aparecer mesmo para quem não
  -- enxerga o cadastro, e um join a mais numa consulta que roda a cada 30
  -- segundos é caro à toa.
  usuario_nome text not null default '',
  desde timestamptz not null default now(),
  visto_em timestamptz not null default now()
);

comment on table edicoes_abertas is
  'Quem está com cada documento aberto em modo de edição. Posse com prazo: 90s sem sinal e ela caduca. Escrita só pelas RPCs abrir/renovar/fechar_edicao.';

alter table edicoes_abertas enable row level security;

drop policy if exists edicoes_abertas_read on edicoes_abertas;

-- Ler: qualquer pessoa logada. Saber que a Marisa está com o documento é o
-- ponto inteiro da funcionalidade, e vale para quem tem menos acesso também.
create policy edicoes_abertas_read on edicoes_abertas for select
  using (papel_atual() is not null);

-- Nenhuma policy de escrita, de propósito: quem grava são as RPCs abaixo, com
-- `security definer`. Uma policy de insert deixaria o cliente escolher o
-- `usuario_id` que quisesse — e tomar o documento em nome de outra pessoa.

/* O quanto de silêncio derruba a posse. Três batidas de 30s, com folga. */
create or replace function edicao_prazo() returns interval
language sql immutable as $function$ select interval '90 seconds' $function$;

/*
 * Toma (ou renova) a posse do documento.
 *
 * A mesma função serve para os dois porque o caso mais comum é o segundo: o
 * navegador chama isto a cada 30 segundos, e a renovação precisa ser a operação
 * barata e idempotente.
 *
 * Devolve SEMPRE o estado atual da posse, e não só um sim/não: a tela precisa
 * dizer QUEM está editando e DESDE QUANDO. Quando a posse é de outra pessoa,
 * `meu` volta falso e nada é gravado — sem erro, porque não é erro nenhum: é a
 * resposta à pergunta "posso editar?".
 */
create or replace function abrir_edicao(p_documento text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_linha edicoes_abertas;
begin
  if auth.uid() is null then
    raise exception 'EDICAO_SEM_SESSAO';
  end if;

  -- A limpeza mora aqui, e não num serviço à parte: um serviço pode estar fora
  -- do ar justamente no dia em que alguém precisa assumir um documento preso.
  delete from edicoes_abertas where visto_em < now() - edicao_prazo();

  insert into edicoes_abertas (documento, usuario_id, usuario_nome)
  values (
    p_documento,
    auth.uid(),
    coalesce((select nome from perfis where id = auth.uid()), '')
  )
  on conflict (documento) do update
     set visto_em = now(),
         usuario_nome = excluded.usuario_nome
   where edicoes_abertas.usuario_id = auth.uid();

  select * into v_linha from edicoes_abertas where documento = p_documento;

  return jsonb_build_object(
    'meu', v_linha.usuario_id = auth.uid(),
    'usuarioId', v_linha.usuario_id,
    'usuarioNome', v_linha.usuario_nome,
    'desde', v_linha.desde,
    'vistoEm', v_linha.visto_em
  );
end;
$function$;

/*
 * Larga o documento.
 *
 * Só o dono larga o que é dele — a cláusula do `usuario_id` é o que impede uma
 * aba de alguém derrubar a posse de outra pessoa ao ser fechada.
 */
create or replace function fechar_edicao(p_documento text)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  delete from edicoes_abertas where documento = p_documento and usuario_id = auth.uid();
$function$;

/*
 * Quem está com o documento, sem tomar posse.
 *
 * Existe para a tela poder AVISAR antes de a pessoa clicar em "Editar", em vez
 * de a consulta ter o efeito colateral de tomar o que ela só queria consultar.
 */
create or replace function quem_edita(p_documento text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
    when e.documento is null then null
    else jsonb_build_object(
      'meu', e.usuario_id = auth.uid(),
      'usuarioId', e.usuario_id,
      'usuarioNome', e.usuario_nome,
      'desde', e.desde,
      'vistoEm', e.visto_em
    )
  end
  from (select 1) _
  left join edicoes_abertas e
    on e.documento = p_documento and e.visto_em >= now() - edicao_prazo();
$function$;

-- `public` não basta: o Supabase concede EXECUTE a `anon` e `authenticated` por
-- DEFAULT PRIVILEGES. Sem revogar de `anon`, tomar posse de um documento seria
-- possível sem sessão nenhuma.
revoke all on function abrir_edicao(text) from public, anon;
revoke all on function fechar_edicao(text) from public, anon;
revoke all on function quem_edita(text) from public, anon;
revoke all on function edicao_prazo() from public, anon;
grant execute on function abrir_edicao(text) to authenticated;
grant execute on function fechar_edicao(text) to authenticated;
grant execute on function quem_edita(text) to authenticated;
grant execute on function edicao_prazo() to authenticated;
