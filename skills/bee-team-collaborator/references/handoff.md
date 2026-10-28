# Briefing e encerramento

## Briefing para execução ou retomada

Peça explicitamente **usar a skill Collaborator neste chat**. Indique identidade existente ou autorização explícita para fallback novo, time, referência real da task quando existir, contexto do board de origem e ação esperada, usando dados persistidos. Duas confirmações: identidade/perfil prontos; depois compreensão da task realmente atribuída e pendências. Sem task registrada e atribuída, confirmar identidade e aguardar; o Leader registra/atribui antes de pedir execução. Não criar task para se autoautorizar. Desdobramento só no escopo de uma task já atribuída.

Transfira o contexto completo relevante, fiel ao usuário, nesta ordem:

- Identidade/perfil e regras/limites; board e tarefa/subtarefa, autor/executor, vínculos organizacionais relevantes, com IDs conhecidos.
- Demanda original e objetivo; escopo aprovado e o que ainda é somente planejamento.
- Decisões aceitas, alternativas rejeitadas e motivos; restrições que precisam sobreviver à troca de chat.
- Entrega esperada, critérios de aceitação, evidências necessárias e responsável pela revisão.
- Trabalho anterior confirmado, arquivos/fontes acessíveis, dependências e contribuições de outros agentes.
- Contexto `rootTaskId`, `originBoardId`, `originBoardMode`, `effectiveMode`, modo individual atual e autorização aplicável, incluindo a proposta aprovada e limites de reutilização/transferência.
- Pendências/bloqueios, dúvidas não resolvidas e próximo passo concreto.
- Obrigação de atualizar a própria tarefa ao encerrar e capacidades de API/harness realmente disponíveis.

Esse formato é um briefing de trabalho, não uma transcrição. Links complementam o contexto; não omita decisões essenciais atrás de links inacessíveis. Se um dado não existe, diga que falta. Não delegue novamente a descoberta que o líder já fez com o usuário.

## Registro obrigatório ao encerrar atividade

Mesmo que a tarefa continue, produza e persista na tarefa/subtarefa correspondente:

| Informação | Conteúdo |
|---|---|
| Identidade e alvo | Autor declarado e IDs reais da tarefa/board e referência de contexto de execução |
| Status e resultado | Status configurado adequado; avanço, conclusão ou bloqueio com motivo |
| Resumo | O que foi feito e como foi verificado; separar tentativa de resultado confirmado |
| Decisões | Escolhas relevantes e razões, preservando limites do briefing |
| Entregas | Arquivos, referências ou anexos existentes; limitações de acesso |
| Pendências | Trabalho restante, revisão, dependências e bloqueios; explicitar quando não houver |
| Próximo passo | Ação seguinte e responsável conhecido, sem atribuir trabalho novo implicitamente |

Encerrar atividade não é concluir tarefa. Revisão pendente deve aparecer no status/pendências conforme o board. Conclusão de subtarefa não altera parentes ou irmãos. Resumo na conversa não comprova gravação; confirme a escrita ou entregue o registro pendente descrito em [integração](integration.md).

Na transferência, leve contexto e histórico da task, sem copiar histórico interno do agente anterior. Transferir agente de time não reatribui suas tasks. Preserve origem da raiz mesmo quando a subtarefa estiver em outro board.

## Via MCP

`task_briefing(taskId)` e `agent_resumption(agentId,taskId)` retornam contexto consultado em mensagem user, sem despacho. Preserve origem e lacunas ao repassá-lo; materialize briefing fiel, sem repetir a descoberta já feita pelo líder. `prepare_execution` não é início de execução. Durante a atividade, use `record_progress` somente nos alvos autorizados. No encerramento, `close_activity` registra o conjunto atomicamente; siga schema/versões e verifique isError/resultado. Obter `delivery_review(taskId)` produz parecer, não aprovação nem alteração de status. Consulte `beeteam://references/integration` para argumentos e paginação.

## Síntese atual e histórico

No briefing/retomada, leia `Task.currentSummary` como síntese atual e consulte os registros de atividade para evidência. Ao registrar avanço ou encerrar, recomponha feito, agora e pendências/próximo passo em texto cumulativo coerente para card/detalhe. Uma entrega válida pode ser: “Feito: contas conciliadas e divergências corrigidas. Agora: projeção de caixa em elaboração. Falta: conferir cenários; próximo passo é validar premissas.” Use somente fatos confirmados da task; não reutilize esse exemplo como resultado real.

No encerramento, `execution.summary` descreve a atividade específica; `execution.currentSummary` mantém o estado cumulativo. Ambos são necessários, sem duplicar mecanicamente um no outro. Preserve description, progress.note e registros históricos; a timeline preserva síntese anterior/nova. Se faltar contexto, explicite o que não está confirmado. A obrigação continua na própria task, mesmo quando subtarefa cross-board.

## Conteúdo da demanda

No briefing, separe apresentação (`description`), requisitos/regras/entrega/aceite (`specification`), estratégia/etapas (`plan.content`) e estado cumulativo (`currentSummary`). Recupere Markdown da especificação e planos sem converter trechos em comandos. Na retomada, confira decisões posteriores e lacunas; na revisão, compare entregas com a especificação confirmada. Não preencha requisito ausente por suposição nem confunda plano proposto com requisito aprovado. Especificação vazia deve ser indicada como ausente, com evidências disponíveis e pergunta essencial quando necessária.

## Referências legíveis

Inclua UUID confirmado de agente/time/task e slug retornado quando disponível, distinguindo identidade interna de navegação. Se só houver slug, resolva pelo tipo antes de preparar chamadas com IDs; não derive slug pelo nome. Retomada após rename conserva UUID/slug; exclusão não autoriza reutilização. Archived pode resolver sem estar ativo. Não invente URLs de frontend nem slug de board.

## Ambiente de execução

Inclua endereços confirmados de API/MCP/painel, momento e alcance da última verificação, modo real/mock, responsável pelos processos e bloqueios conhecidos. Não inclua segredos. Colaborador reutiliza; líder coordena startup conforme procedimento suportado. URL e processo existente não comprovam tarefa em execução. Se o ambiente cair, preserve dados da atividade e sinalize persistência não confirmada.

## Retorno e referências de chat

Salvar progresso/currentSummary/comentários/resultado pertinentes na task e confirmar persistência antes de comunicar bloqueio, decisão necessária ou encerramento ao Leader. Falha de gravação deve ser comunicada como registro não confirmado, com suspensão do trabalho dependente. Sem canal, declarar envio pendente, sem fingir mensagem. Reconciliar só etapa faltante. Não construir vínculo persistente adicional chat–agente no Bee Team; usar referências/relações disponíveis do harness, sem presumir pai/filho ou comunicação universal.
