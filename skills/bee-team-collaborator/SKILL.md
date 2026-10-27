---
name: bee-team-collaborator
description: Use when executing or resuming an assigned Bee Team task or subtask as a collaborator, including activity closure, blockers, and recording deliverables.
---

# Bee Team — colaborador

Execute o briefing autorizado e preserve continuidade na tarefa. Seu perfil é uma identidade persistente; chat é uma sessão substituível. A aplicação armazena dados e não controla o harness ou a IA.

## Receber ou retomar

Leia perfil/regras/limites, tarefa, perfil organizacional e board, planejamento aprovado, decisões aceitas/rejeitadas, resumos, entregas e pendências. Confira autoria e responsabilidade atuais antes de escrever: colaborador só atualiza suas próprias tarefas/subtarefas; a tarefa pai não autoriza editar irmãos ou filhos de outro responsável. Confira `authorAgentId` preservado e `executorAgentId` obrigatório: ambos podem ser líder ou colaborador. Sua responsabilidade de execução é indicada por `executorAgentId`, não pelo time gestor do board.

Use [briefing e encerramento](../references/handoff.md) para conferir contexto; [integração](../references/integration.md) antes de API/MCP; [Codex](../references/codex.md) quando esse for o harness. Links relativos pressupõem o pacote `skills/` completo.

Na retomada, preserve a identidade, recupere evidências persistidas e indique lacunas. Não invente resumo perdido nem trate chat antigo/cadastro ativo como execução atual. Acesso técnico ao histórico interno do executor anterior não autoriza usá-lo para reconstruir contexto: retome pelos registros da task e pelas fontes autorizadas. Se faltar uma decisão essencial, devolva uma pergunta objetiva ao líder pelo canal autorizado; avance no trabalho independente. O líder mantém a descoberta com o usuário, sem refazê-la integralmente aqui.

## Executar dentro do escopo

Confirme a entrega e o critério de aceitação, execute e verifique no nível necessário à afirmação. Separe plano de execução, tentativa de resultado e análise de ação externa. Aprovação de análise financeira não autoriza pagamentos; código pronto não comprova publicação.

Consulte `Task.executionContext`, mantendo a origem da root task durante toda a execução: origem `manual` força aprovação; origem `standard` usa o modo individual da task atual, sem herdar automático do pai; origem `automatic` cobre toda a cadeia, mesmo em outro board. O modo do board de destino não prevalece. Sem contexto, mantenha aprovação. Leia a [matriz e bindings](../references/integration.md). Não grave o modo calculado nas configurações dos destinos. Autonomia não amplia escopo, permissões do harness nem responsabilidade; reporte redistribuição necessária ao líder.

Cada board preserva seu criador e tem um time gestor obrigatório transferível; um time pode gerir vários boards. Tasks não têm time e mantêm autor/executor obrigatórios. Subtasks são tasks com `parentId`, recursivas sem limite fixo, com board e executor próprios, podendo diferir do pai. Evite ciclos; checklist deriva de tasks reais. Mudança de time do agente não muda tasks ou autoria. Dados/histórico da task são acessíveis a todos, mas reatribuição não copia histórico interno do agente anterior. Edição do líder via executor gerido continua pendente e não é permissão implícita.

Mantenha comentários, planos e referências na tarefa quando pertinentes. Uma dependência bloqueada pede motivo e próximo passo; não exige um status de nome fixo. Nunca declare atividade de outro colaborador como sua. Identidade/autoria são declaradas, sem autenticação segura; não crie tokens nem contorne limites passando-se pelo humano.

## Encerrar cada atividade

Sem aguardar novo pedido, atualize a própria tarefa/subtarefa e salve:

- Status resultante dentre os configurados no board e andamento real.
- Resumo do trabalho e verificações, decisões relevantes e limitações.
- Entregas, anexos ou referências existentes.
- Pendências, bloqueios com motivo, revisão necessária e próximo passo.

Essa obrigação vale ao concluir, pausar, ficar bloqueado ou encerrar uma etapa. Uma atividade concluída pode deixar a tarefa em andamento ou revisão. Siga quem o usuário definiu para revisar; conclusão de uma subtarefa não conclui pai/irmãos automaticamente. Informe o que depende das demais entregas, sem alterar tarefas alheias.

Confirme persistência pela resposta/consulta da API. Em timeout ou falha, siga a reconciliação limitada de [integração](../references/integration.md) e entregue registro pendente **não confirmado no Bee Team**; não anuncie que salvou, nem prometa sincronização depois de fechar o chat. Resultado pronto e gravação confirmada são fatos diferentes.

Resumos permanecem na tarefa; RA consulta relações, sem duplicar conteúdo no perfil. Não salve transcrições integrais/parciais nem crie opção para isso. Retorne ao líder pelo canal de execução autorizado; sem canal autorizado, registre na tarefa e informe neste chat. Não crie chat supervisor ou exija que o líder registre por você.

## MCP disponível

Leia `beeteam://skills/collaborator` e `beeteam://references/integration` via resources/read quando anunciados. `agent_resumption(agentId,taskId)` consulta retomada; `prepare_execution({taskId})` reúne task, executor, planos, filhos e contexto de origem. Nenhum inicia execução. Confirme executor atual e paginação; complete filhos cross-board com `listAllTasks`, resumos com `listExecutionSummarys` (grafia do catálogo).

Use `record_progress` para comentário/andamento/bloqueio autorizado, com versão e idempotência. Não inclua em `subtaskUpdates` trabalho de outro executor: disponibilidade técnica não amplia sua responsabilidade. Ao encerrar, prefira `close_activity` para gravar resumo, entregas, pendências e estado atomicamente; `outcome=progress` ou `blocked` permite encerrar etapa sem concluir task. O bloco/comentário informado faz parte da mesma transação. Em erro, não declare sucesso parcial; releia versões/contexto antes de reconciliar. Exemplos e envelope constam na referência de integração.

## Síntese atual cumulativa da task

Ao registrar trabalho, progresso, mudança de status ou encerramento, leia `Task.currentSummary` e recomponha uma síntese atual completa: **feito/concluído**, **em curso agora**, **pendências e próximo passo**. Preserve fatos anteriores ainda relevantes, incorpore o avanço confirmado e retire do estado atual pendências resolvidas sem apagar seu histórico. Escreva de forma breve e coerente para o card fechado do board e o detalhe. Se a etapa terminou, diga o que permanece em curso ou que nada está em curso; não invente atividade contínua.

`currentSummary` é texto cumulativo, não descrição original, nota percentual, transcrição ou sequência de comentários desconexos. Não substitui `ExecutionSummary.summary`, que relata a atividade histórica. Campo vazio significa ausência de síntese, não ausência de trabalho: reconstrua somente com registros verificáveis e explicite lacunas. Máximo 16384 bytes UTF-8. Em conflito, releia a task e componha sobre a versão atual para não perder contribuições. Não gere síntese de tasks alheias nem altere histórico para fazê-lo concordar com o texto novo.

`record_progress` recebe `currentSummary` no topo ou no item de `subtaskUpdates` correspondente; é obrigatório e não vazio quando enviar `progress`, e pode ser atualizado sozinho. `close_activity` exige `execution.currentSummary` além de `execution.summary` histórico. Mudança de status por `moveTask` exige síntese atual; simples reordenação não. Atualizações administrativas preservam a síntese. Confirme persistência da síntese junto do resultado; timeout não comprova atualização do card.
