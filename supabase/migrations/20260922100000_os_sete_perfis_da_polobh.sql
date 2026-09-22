/*
 * OS SETE PERFIS DA PÓLOBH — a matriz que faltava (16/09/2026).
 *
 * Ela estava no check-list desde 15/09, escrita em três lugares diferentes, e
 * por isso passou como "falta a matriz". Está tudo lá, com os nomes exatos:
 *
 *   · EC — "Uma EC só poderá ser criada, editada, substituída pelos seguintes
 *     perfis: Diretoria Produção, Coordenação Produção, Produção, Back-office.
 *     Os demais perfis não poderão: Direção Administrativo-Financeira,
 *     Coordenação Administrativo-Financeira, Assistência Administrativo
 *     Financeira";
 *   · RENTABILIDADE — "Esta aba só poderá ser visualizada pelos seguintes
 *     perfis: Diretoria Produção, Direção Administrativo-Financeira,
 *     Coordenação Produção, Coordenação Administrativo-Financeira. Os demais
 *     não poderão: Assistência Administrativo Financeira, Produção,
 *     Back-office";
 *   · OS, em duas etapas — "Até esta etapa (Enviar para Conclusão Financeiro):
 *     Diretoria Produção, Coordenação Produção, Coordenação Administrativo-
 *     Financeira, Produção, Back-office. Os demais: Assistência Administrativo
 *     Financeira" e "A partir desta etapa: Diretoria Produção, Coordenação
 *     Produção, Coordenação Administrativo-Financeira, Back-office. Os demais:
 *     Produção, Assistência Administrativo Financeira".
 *
 * A DECISÃO QUE EU PRECISEI TOMAR. Nas duas listas da OS, a Direção
 * Administrativo-Financeira não aparece nem entre quem pode nem entre quem não
 * pode. Nas outras duas listas ela aparece sempre que é para excluí-la (na EC)
 * ou incluí-la (na rentabilidade), então a omissão é falha de digitação, não
 * regra. Entrou como quem EDITA as duas etapas da OS — é direção, e a lista de
 * exclusão da OS nomeia só a Assistência. Se estiver errado, é tirar dois
 * recursos de uma área em Configurações, sem migração.
 *
 * AS ÁREAS ANTIGAS NÃO SAEM. Em produção são três — Direção, Financeiro e
 * Produção —, e elas continuam existindo e ligadas a quem já usa o sistema:
 * apagá-las deixaria gente sem acesso no meio do expediente. As sete novas
 * entram ao lado, e a troca é feita usuário a usuário em Configurações, quando
 * a Pólobh quiser.
 */

/* ------------------------------------------------------------------ *
 * 1. `oss.emitir` — a chave da última fase.
 *
 * A emissão pelo Back-office usava `oss.editar`, que é a chave de MONTAR a OS.
 * Com uma chave só, "a partir desta etapa a Produção não edita mais" não se
 * cumpre: a Produção precisa de `oss.editar` para montar, e com ela emitiria.
 * Quem já emite hoje (tem `oss.editar`) continua emitindo — a chave nova é
 * dada a todos eles, para nada mudar de comportamento nesta migração.
 * ------------------------------------------------------------------ */
update areas
   set recursos = array_append(recursos, 'oss.emitir')
 where 'oss.editar' = any(recursos)
   and not ('oss.emitir' = any(recursos));

/* ------------------------------------------------------------------ *
 * 1b. Abrir espaço para o nome "Produção".
 *
 * Em produção já existe uma área com esse nome — uma das três de fábrica
 * (Direção, Financeiro, Produção) —, e ela NÃO tem a matriz do check-list: ela
 * emite OS, porque até aqui emitir era `oss.editar`. Sem isto, o `on conflict`
 * lá embaixo engoliria a área nova em silêncio, e a matriz ficaria com seis
 * perfis em vez de sete — sem ninguém perceber.
 *
 * A saída é renomear a antiga, e não sobrescrevê-la: quem está nela continua
 * com exatamente os acessos que tinha hoje (o vínculo é por id, não por nome, e
 * `papel_base` não muda, então a RLS também não). A Pólobh move a pessoa para a
 * área nova quando quiser, em Configurações.
 *
 * "Direção" e "Financeiro" não colidem com nenhum dos sete nomes e ficam como
 * estão.
 *
 * O que distingue as duas, para esta migração poder rodar duas vezes sem
 * estrago: a antiga acabou de receber `oss.emitir` no passo 1, e a nova, pela
 * matriz, não o tem. Então só renomeia quem o tem.
 * ------------------------------------------------------------------ */
update areas
   set nome = 'Produção (legado)'
 where nome = 'Produção'
   and 'oss.emitir' = any(recursos);

/* ------------------------------------------------------------------ *
 * 2. As sete áreas da Pólobh.
 *
 * `papel_base` é o nível de segurança NO BANCO (governa a RLS), e não a matriz
 * de telas: 'Direcao' para quem dirige, 'Producao' para quem produz,
 * 'Administrativo' para o administrativo-financeiro. Quem decide tela é
 * `recursos`, abaixo, e é lá que a matriz do check-list está escrita.
 *
 * `ativa` fica TRUE: área inativa não pode ser atribuída a ninguém, e estas
 * nascem justamente para receber gente.
 * ------------------------------------------------------------------ */
insert into areas (nome, papel_base, recursos, ativa) values

  -- Produção, direção: tudo do lado da produção, mais a rentabilidade.
  ('Diretoria Produção', 'Direcao', array[
     'projetos','projetos.editar','ecs','ecs.editar','oss','oss.editar','oss.emitir',
     'checklists','checklists.editar','cronogramas','fornecedores','fornecedores.editar',
     'financeiro','rentabilidade','guia'], true),

  -- Administrativo-financeiro, direção: vê e edita OS e faturamento, vê a
  -- margem — e NÃO edita EC, que o check-list lhe nega expressamente.
  ('Direção Administrativo-Financeira', 'Direcao', array[
     'projetos','ecs','oss','oss.editar','oss.emitir',
     'checklists','cronogramas','fornecedores','fornecedores.editar',
     'financeiro','rentabilidade','guia'], true),

  ('Coordenação Produção', 'Producao', array[
     'projetos','projetos.editar','ecs','ecs.editar','oss','oss.editar','oss.emitir',
     'checklists','checklists.editar','cronogramas','fornecedores','fornecedores.editar',
     'financeiro','rentabilidade','guia'], true),

  -- É a coordenação administrativo-financeira que recebe a OS do "Enviar para
  -- Conclusão Financeiro" — ela edita as duas etapas, e não edita EC.
  ('Coordenação Administrativo-Financeira', 'Administrativo', array[
     'projetos','ecs','oss','oss.editar','oss.emitir',
     'checklists','cronogramas','fornecedores','fornecedores.editar',
     'financeiro','rentabilidade','guia'], true),

  -- A Assistência é o único perfil excluído das DUAS etapas da OS, e da
  -- rentabilidade, e da edição de EC. Ela acompanha: vê tudo, não edita.
  ('Assistência Administrativo-Financeira', 'Administrativo', array[
     'projetos','ecs','oss','checklists','cronogramas','fornecedores','guia'], true),

  -- Produção monta a EC e monta a OS — e para no "Enviar para Conclusão
  -- Financeiro": sem `financeiro` e sem `oss.emitir`, os blocos de faturamento
  -- e o botão de emitir não abrem para ela.
  ('Produção', 'Producao', array[
     'projetos','projetos.editar','ecs','ecs.editar','oss','oss.editar',
     'checklists','checklists.editar','cronogramas','fornecedores','fornecedores.editar',
     'guia'], true),

  -- Back-office edita EC, edita as duas etapas da OS e emite — mas não vê
  -- margem: o check-list o exclui da rentabilidade.
  ('Back-office', 'Producao', array[
     'projetos','projetos.editar','ecs','ecs.editar','oss','oss.editar','oss.emitir',
     'checklists','checklists.editar','cronogramas','fornecedores','fornecedores.editar',
     'financeiro','guia'], true)

on conflict (nome) do nothing;
