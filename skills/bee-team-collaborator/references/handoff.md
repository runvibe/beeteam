# Briefing e encerramento


## Tarefa como fonte de verdade entre agentes

Toda solicitação de trabalho da Leader ao Collaborator deve existir em task/subtask registrada e atribuída antes de pedir execução. O destinatário consulta a tarefa, comentários e estado atual como fonte de verdade; notificação não é demanda autônoma, aprovação adicional ou autorização para ampliar escopo.

Perguntas, respostas, decisões, mudanças de escopo, bloqueios e entregas entre agentes ficam na tarefa pertinente. Use comentários para diálogo e histórico; atualize description/specification, plano versionado, currentSummary e status quando exigido pelo tipo de mudança e pelas regras existentes. Comentário não substitui campos atuais, e uma pergunta isolada não exige alteração artificial de status. A segunda confirmação, de compreensão da tarefa e suas pendências, fica em comentário da task e gera somente aviso referencial; a confirmação inicial de identidade pode ocorrer sem tarefa.

Salve primeiro e confirme sucesso; só então notifique pelo canal autorizado com referência real da tarefa/comentário e tipo de mudança. Exemplo de formato, substituindo os marcadores por referências retornadas: “Task <referência real>; comentário <referência real>; tipo: pergunta registrada.” Respostas, decisões e instruções de trabalho não são transportadas pelo chat, mesmo como cópia do conteúdo salvo. O outro agente lê o registro antes de agir. Sem acesso, declara a lacuna e suspende trabalho dependente; não substitui a leitura por instruções em chat.

Notifique apenas mudança relevante ainda não comunicada. Antes de repetir após timeout, confira o registro e resultado disponível; preserve idempotência e não duplique comentários. Aviso repetido não gera comentário de recebimento ou nova notificação automaticamente; só uma nova contribuição substantiva registrada justifica outro aviso. Não crie ciclos de confirmações. Se salvar falhar, sinalize apenas o impedimento e registro não confirmado, sem apresentar decisão/instrução pendente como autorização. Se o envio falhar, mantenha o registro e retome somente a notificação necessária.

Permissões do harness para enviar mensagens continuam obrigatórias; a skill não as amplia. Sem canal autorizado, deixe envio pendente. Ativação de papel/identidade e escolha de chat podem ocorrer sem tarefa, mas não carregar trabalho de negócio: qualquer solicitação desse trabalho exige tarefa previamente registrada e atribuída. Collaborator não cria tarefa para se autoautorizar.


## Briefing para execução ou retomada

Peça explicitamente **usar a skill Collaborator neste chat**. Indique identidade existente ou autorização explícita para fallback novo, time, referência real da task quando existir, referências persistidas do contexto do board de origem e tipo de mudança, usando dados persistidos. Duas confirmações: identidade/perfil prontos; depois compreensão da task realmente atribuída e pendências. Sem task registrada e atribuída, confirmar identidade e aguardar; o Leader registra/atribui antes de pedir execução. Não criar task para se autoautorizar. Desdobramento só no escopo de uma task já atribuída.

Registre o contexto completo relevante na tarefa, fiel ao usuário, nesta ordem; o destinatário o consulta ali:

- Identidade/perfil e regras/limites; board e tarefa/subtarefa, autor/executor, vínculos organizacionais relevantes, com IDs conhecidos.
- Demanda original e objetivo; escopo aprovado e o que ainda é somente planejamento.
- Decisões aceitas, alternativas rejeitadas e motivos; restrições que precisam sobreviver à troca de chat.
- Entrega esperada, critérios de aceitação, evidências necessárias e responsável pela revisão.
- Trabalho anterior confirmado, arquivos/fontes acessíveis, dependências e contribuições de outros agentes.
- Contexto `rootTaskId`, `originBoardId`, `originBoardMode`, `effectiveMode`, modo individual atual e autorização aplicável, incluindo a proposta aprovada e limites de reutilização/transferência.
- Pendências/bloqueios, dúvidas não resolvidas e próximo passo concreto.
- Obrigação de atualizar a própria tarefa ao encerrar e capacidades de API/harness realmente disponíveis.

Esse formato organiza o conteúdo persistido da tarefa, não a mensagem entre chats. A notificação contém apenas referência e tipo de mudança. Se o destinatário não consegue ler o registro, trate a lacuna de acesso sem enviar instruções substitutas pelo chat. Se um dado não existe, diga que falta. Não delegue novamente a descoberta que o líder já fez com o usuário.

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

`task_briefing(taskId)` e `agent_resumption(agentId,taskId)` retornam contexto consultado em mensagem user, sem despacho. Preserve origem e lacunas ao consultá-lo; esse resultado de leitura não é mensagem de despacho. Materialize o contexto necessário na tarefa antes de notificar, mantendo briefing fiel, sem repetir a descoberta já feita pelo líder. `prepare_execution` não é início de execução. Durante a atividade, use `record_progress` somente nos alvos autorizados. No encerramento, `close_activity` registra o conjunto atomicamente; siga schema/versões e verifique isError/resultado. Obter `delivery_review(taskId)` produz parecer, não aprovação nem alteração de status. Consulte `beeteam://references/integration` para argumentos e paginação.

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

## Planejamento da Leader e atribuição

Leader pode criar/reutilizar task de coordenação própria dentro da demanda autorizada, antes de planejamento substantivo, em board adequado; registrar decisões incrementalmente nela. Cumprimentos/consulta cadastral não exigem task. Sem identidade/time/board em time novo, coletar contexto necessário e materializar assim que pré-requisitos aprovados existirem, sem inventar IDs. Antes de pedir execução ao Collaborator, registrar e atribuir a task real. Essa permissão inicial da Leader não autoriza Collaborator a criar task própria para se autoautorizar. Informar apenas registros cuja persistência esteja confirmada; plano de chat/harness não é plano salvo no Bee Team.
