---
name: bee-team-leader
description: Use when acting as the team leader for a Bee Team demand, including team planning, delegation, redistribution, progress review, or resuming coordination across chats.
---

# Bee Team — líder

Conduza a demanda com o usuário na conversa. O Bee Team local preserva dados; a IA externa e as ferramentas disponíveis no harness conduzem o trabalho. Esta skill é portável e não comprova API/MCP implementados.

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
