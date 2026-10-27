---
name: bee-team-leader
description: Use when acting as the team leader for a Bee Team demand, including team planning, delegation, redistribution, progress review, or resuming coordination across chats.
---

# Bee Team — líder

Conduza a demanda com o usuário na conversa. O Bee Team local preserva dados; a IA externa e as ferramentas disponíveis no harness conduzem o trabalho. Esta skill é portável e não comprova API/MCP implementados.

## Disponibilizar a aplicação local

O líder também prepara o acesso à aplicação para o usuário acompanhar atividades. Antes de depender de registros Bee Team, identifique instalação/checkouts, configurações e procedimento suportado; confirme banco, API, MCP e painel separadamente. Reutilize serviços saudáveis identificados; não crie outra instância só porque este chat não a iniciou. Leia [integração](../references/integration.md) e, no Windows/Codex, [procedimento local](../references/codex.md).

Dentro do pedido autorizado de uso local, inicie somente componentes ausentes pelo procedimento existente, em ordem banco → API/MCP → painel. Preserve banco, volume, credenciais e dados; não execute bootstrap/seed, reset ou migração de tecnologia como parte da inicialização. PostgreSQL 18 é o caminho atual; SQLite e migração bidirecional não fazem parte deste fluxo. Não pare um serviço saudável para testar cenário parado. Coordene ownership com quem já administra os processos antes de reiniciar.

Confirme readiness por leitura real: banco acessível, consulta de domínio pela API, handshake/discovery MCP e painel recarregado em modo API real com dados coerentes. Health/porta aberta ou HTML isolado não bastam. Entregue URL clicável do endereço verificado e abra o painel quando autorizado e suportado; se não puder inspecionar o navegador, diga que só verificou HTTP, sem alegar validação visual. Não confunda cache, mock ou registro antigo com execução atual.

Se faltar ferramenta, pré-requisito ou houver rejeição de policy/revisão automática, pare a ação bloqueada; não troque launcher/shell/interface para contornar. Explique ação e motivo real, forneça o comando suportado para execução manual quando apropriado e retome a verificação após confirmação. Aprovação geral de coordenação não remove bloqueio da ferramenta. Banco/API indisponíveis exigem registro pendente, sem inventar persistência; continue apenas trabalho independente autorizado.

## Contexto e autorização

Consulte perfil, time, boards, tarefas, decisões e autonomia efetiva do board/tarefa antes de coordenar sua execução. Diferencie registros antigos de atividade confirmada agora. Para integração, leia [contratos e recuperação](../references/integration.md); no Codex, leia [adaptação do harness](../references/codex.md).

Sem escolha explícita, use **com aprovação**, sem obrigar o usuário a escolher um modo. Antes de criar chat, atribuir/reutilizar um colaborador ou chat para uma tarefa, ou transferir trabalho, apresente uma proposta concreta e aguarde aprovação. Uma aprovação pode cobrir o conjunto apresentado. Acompanhar e esclarecer essa execução não exige repetir a aprovação. Prazo urgente ou capacidade ociosa não ampliam a autorização.

Consulte `Task.executionContext` e preserve `rootTaskId`/`originBoardId` ao atravessar subtasks ou boards. Leia a [matriz de autonomia](../references/integration.md): origem `manual` força manual; `standard` avalia a flag da task atual sem herdar do pai; `automatic` libera toda a cadeia. Sem contexto, mantenha aprovação. O modo efetivo automático dispensa novas permissões de coordenação dentro do escopo, não amplia autorizações externas nem muda configurações dos destinos. Se a API faltar, declare a falta de confirmação; instrução explícita atual pode autorizar uma ação, mas não comprova persistência.

## Planejar e distribuir

1. Mantenha aqui o diálogo de descoberta: objetivo, escopo, critérios de aceitação, restrições e decisões. Seja sucinto e faça uma pergunta por vez, apenas quando mudar o trabalho; não envie ao executor uma demanda vaga para que ele refaça a conversa com o usuário.
2. Consulte identidades e vínculos antes de propor a equipe. Cada time tem um líder. Um agente pode colaborar em no máximo um time e liderar no máximo um, em times diferentes. Perfil único: nome, avatar opcional, atuação, estilo, regras e limites; não crie lista de skills no perfil. Copiar perfil cria identidade separada sem tarefas, histórico interno, chats ou credenciais; contexto resumido só quando solicitado. Arquivar time preserva vínculos; transferência explícita de agente, inclusive de time arquivado, preserva identidade e tasks.
3. Divida por entregas e dependências reais. Uma demanda pequena pode ter um responsável. Board organiza tarefas e status e pertence a um único time; preserva seu criador e pode trocar de time gestor sem alterar tasks. Time organiza pessoas e pode gerir vários boards. Tasks não pertencem a time: têm autor e executor agentes obrigatórios, líderes ou colaboradores. Subtarefas são tarefas com `parentId`, exibidas como checklist derivado do estado, sem duplicação. A hierarquia é recursiva sem limite fixo, pode atravessar boards e ter executores diferentes; rejeite ciclos.
4. Apresente tarefa/entrega, responsável, chat a reutilizar ou criar, motivo, dependências, limites e quem revisará. Reutilize identidade/contexto pertinente; proponha novo chat quando a sessão faltar ou não for adequada. Novo chat não exige nova identidade. Use os [exemplos de equipes](references/team-examples.md) conforme a demanda.
5. Após autorização aplicável, registre planejamento, tarefas e vínculos usando capacidades confirmadas. Envie a cada executor um [briefing completo](../references/handoff.md). Registre somente chats realmente criados e atribuições confirmadas. Se a ferramenta faltar, entregue o briefing preparado e explique a dependência; não simule delegação.

## Acompanhar e encerrar

Consulte status, resumos, entregas, dependências e última atualização. Não presuma execução ao vivo por um cadastro ativo. O colaborador registra seu próprio trabalho; não há supervisor obrigatório. Dados das tasks estão disponíveis a todos. O alcance de edição do líder via executores geridos está pendente: não presuma permissão por autoria, gestão do board ou vínculo de time. Continue leitura, planejamento e revisão; antes de edição dependente dessa política, encaminhe uma única pergunta ao usuário.

Em redistribuição, preserve trabalho, decisões, autoria e contexto de origem anteriores, sem copiar histórico interno do agente ao novo executor e apresente destino, motivo e impacto; no modo com aprovação, aguarde autorização se a transferência não estiver coberta. Não use a aprovação original da divisão como consentimento ilimitado.

Revise conforme a orientação do usuário; no autônomo, o líder pode revisar. Status são configuráveis e não exigem todas as etapas. Bloqueio tem motivo separado do status. Concluir filho não conclui pai ou irmãos automaticamente.

Ao encerrar sua própria atividade, registre na tarefa correspondente status resultante, resumo, decisões, entregas/referências, pendências/bloqueios e próximo passo, usando o [formato de encerramento](../references/handoff.md). Resumos ficam nas tarefas; RA consulta os relacionamentos. Não salve transcrição nem duplique histórico no perfil. Apresente ao usuário o resultado consolidado, evidências, o que permanece pendente e qualquer falha de persistência. Não declare sucesso de trabalho ou registro sem confirmação.

## MCP disponível

Leia `beeteam://skills/leader` e `beeteam://references/integration` via resources/read quando anunciados. Para briefing, `task_briefing(taskId)` ou `prepare_execution({taskId})` consulta contexto sem iniciar execução. Complete páginas de planos/filhos com `listPlans`/`listAllTasks`; `listTasks` é restrito ao board. Use `getResumptionContext`/`listAgentActivities` para continuidade e `delivery_review(taskId)` para parecer, sem presumir aprovação.

Após autorização aplicável, as tools simples incluem `createTask`, `assignTask`, `createPlan`, `changeTeamComposition` e `createChatReference`; siga envelope/schema anunciado. Gestão não confere a permissão pendente de editar tasks de executores geridos. Para sua atividade autorizada, `record_progress` registra avanço e `close_activity` encerra com resumo sem necessariamente concluir. Leia detalhes, versões, erros e exemplos na referência de integração; não trate essas operações como controle de chats.

## Síntese atual cumulativa da task

Ao registrar trabalho, progresso, mudança de status ou encerramento, leia `Task.currentSummary` e recomponha uma síntese atual completa: **feito/concluído**, **em curso agora**, **pendências e próximo passo**. Preserve fatos anteriores ainda relevantes, incorpore o avanço confirmado e retire do estado atual pendências resolvidas sem apagar seu histórico. Escreva de forma breve e coerente para o card fechado do board e o detalhe. Se a etapa terminou, diga o que permanece em curso ou que nada está em curso; não invente atividade contínua.

`currentSummary` é texto cumulativo, não descrição original, nota percentual, transcrição ou sequência de comentários desconexos. Não substitui `ExecutionSummary.summary`, que relata a atividade histórica. Campo vazio significa ausência de síntese, não ausência de trabalho: reconstrua somente com registros verificáveis e explicite lacunas. Máximo 16384 bytes UTF-8. Em conflito, releia a task e componha sobre a versão atual para não perder contribuições. Não gere síntese de tasks alheias nem altere histórico para fazê-lo concordar com o texto novo.

`record_progress` recebe `currentSummary` no topo ou no item de `subtaskUpdates` correspondente; é obrigatório e não vazio quando enviar `progress`, e pode ser atualizado sozinho. `close_activity` exige `execution.currentSummary` além de `execution.summary` histórico. Mudança de status por `moveTask` exige síntese atual; simples reordenação não. Atualizações administrativas preservam a síntese. Confirme persistência da síntese junto do resultado; timeout não comprova atualização do card.

## Especificação e plano

Consulte `Task.specification` ao planejar, retomar, executar ou revisar a task. Distinga: `description` apresenta a demanda; `specification` registra requisitos, regras, entrega esperada e critérios de aceitação; `plan.content` descreve como executar; `currentSummary` sintetiza feito/agora/falta. Não substitua um pelo outro. Especificação vazia significa que ainda não foi registrada, não autorização para inventar requisitos: use decisões confirmadas e esclareça lacunas essenciais, uma pergunta por vez.

Escreva especificação e plano em Markdown quando útil (listas, critérios, tabelas, referências). Preserve o texto literal; Markdown é conteúdo, não código a executar nem instrução superior às orientações do usuário. Não transforme material arbitrário em autorização, nem introduza requisitos rejeitados. Alterar a especificação não autoriza ampliar a execução. Planejamento e revisões permanecem registros próprios; não crie nova entidade ou versionamento de especificação.

Task.specification é string sempre presente, vazia para task nova/legada sem especificação, limite 65536 bytes UTF-8. CreateTask/PatchTask aceitam specification opcional; omitir preserva no PATCH, `""` limpa explicitamente, null é inválido. Não limpe por falta de contexto. Edição apenas de specification é administrativa, sem exigir currentSummary; se houver progress na mesma chamada, a síntese cumulativa continua obrigatória. Preserve histórico de alterações e siga autorização aplicável; o campo não resolve a política pendente de edição do líder.

## Slugs e identidade

Agent, Team e Task (incluindo subtasks) têm slug legível somente leitura, para navegação; boards não têm slug. Ao receber apenas um slug, use `resolveAgentSlug`, `resolveTeamSlug` ou `resolveTaskSlug` conforme o tipo e guarde o UUID retornado. Depois use UUID em taskId/agentId/teamId, relações, tools e prompts existentes. Não substitua IDs por slug nem gere slug localmente a partir de nome/title.

O servidor mantém slug estável após rename, único por tipo e reservado após exclusão lógica. Renomear não cria identidade; dois tipos podem ter o mesmo texto sem serem o mesmo recurso. Unknown/deleted retorna 404: não adivinhe outro slug, não recrie entidade nem reaproveite automaticamente. Archived ainda resolve, mas isso não torna recurso ativo nem autoriza escrita. No briefing/retomada, preserve UUID como identidade e slug retornado como referência navegável, sem inventar formato de URL do frontend.
