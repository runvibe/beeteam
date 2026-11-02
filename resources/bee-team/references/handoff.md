# Briefing e encerramento


## Leader é a interface humana do trabalho

Fora do bootstrap inicial de novo chat Collaborator e de seu retorno de configuração, toda interação de trabalho iniciada pelo Collaborator em direção ao humano passa pela Leader: perguntas, escolhas, confirmações, pedidos, decisões e relatos substantivos. Não use diálogo direto ao usuário nem caixas interativas do harness (como `request_user_input`, `request_user_input_async` no Codex ou equivalentes) como canal de trabalho. Salve o conteúdo completo em comentário da tarefa; para pergunta, formule uma questão clara e alternativas se úteis; notifique a Leader somente com taskID, áreas atualizadas, status pertinente e commentID retornado. Aguarde resposta persistida e leia o comentário indicado via MCP antes de agir sobre ela.

A regra de registro e ausência de caixas interativas vale também para a Leader em toda interação substantiva relacionada à task. Quando precisar de decisão humana, Leader registra pergunta/opções completas em comentário da tarefa e avisa o usuário somente com task, áreas efetivamente atualizadas, status pertinente e commentID, sem `request_user_input`, `request_user_input_async` ou equivalentes. Aguarda resposta autorizada. Respostas espontâneas e instruções legítimas do humano no chat continuam válidas: Leader persiste a devolutiva/decisão na tarefa antes de agir ou delegar. Não existe uma Leader acima da Leader nem encaminhamento circular. Para responder ao Collaborator, lê comentário/estado, persiste a resposta e notifica pelos mesmos metadados. Collaborator registra bloqueio somente se a dúvida impedir continuidade e continua partes independentes já autorizadas. Isso não contorna nem suprime aprovações obrigatórias de ferramentas/segurança do harness; controles impostos pelo sistema/harness são superiores, não exceções de comunicação escolhidas pelo agente. A hierarquia de instruções e metainstruções legítimas do humano continuam válidas; a skill não promete bloquear UI de aprovação imposta pelo sistema. Se faltar tarefa, Leader ou identidade, aguarde configuração, sem criar autoautorização, inventar commentID ou abrir diálogo alternativo. A única exceção de comunicação é o bootstrap de novo chat Collaborator: solicitação inicial da Leader (skill/identidade/time) e retorno limitado à configuração, nome real, IDs confirmados e prontidão ou impedimento de bootstrap; sem trabalho de negócio.


## Tarefa e comentário como fonte de verdade entre agentes

Toda solicitação de trabalho Leader→Collaborator exige task/subtask registrada e atribuída antes de pedir execução. Toda interação/notificação exige comentário completo e commentID, inclusive atualização somente de status. A única exceção de comunicação é o bootstrap de novo chat Collaborator: pedido inicial de skill/identidade/time e retorno de configuração com nome real, IDs confirmados e prontidão ou impedimento, sem demanda de negócio. Fora desse bootstrap, registre na task: pergunta, resposta, decisão, mudança de escopo, feito/não feito, bloqueio/liberação, arquivo ou entrega. Sem task ou identidade suficiente, aguarde configuração; não invente commentID nem crie autoautorização. Essa regra prevalece sobre exemplos de conversa do onboarding; não existe exceção genérica para metadados, atualizações, confirmações de identidade posteriores ou dúvidas de trabalho.

Siga a ordem: atualize primeiro os campos, artefatos e estado pertinentes; salve depois comentário completo explicando a contribuição, o que foi ou não feito e dúvidas/pendências/decisões aplicáveis; confirme persistência; só então notifique. Use description/specification, plano versionado, resumo histórico, currentSummary, arquivos e status conforme as regras existentes, sem alterar campos só para preencher aviso. Comentário não substitui campos atuais. Uma pergunta isolada pode atualizar apenas comentário. Compreensão da tarefa e pendências também são comentário. Fim da execução não significa Concluído quando validação humana exigida ainda está pendente; preserve status real e fluxo de aprovação.

A notificação curta contém somente referência real da task, áreas efetivamente atualizadas, status atual quando pertinente e commentID real retornado pela persistência. Exemplo de formato (substitua marcadores por dados confirmados): “Task <referência real>; atualizado: especificação, plano, comentário; status: <status atual>; commentID: <ID retornado>.” Não copie detalhes, instruções, perguntas ou respostas para o chat. Não invente ID nem anuncie área cuja atualização falhou ou não ocorreu.

O receptor usa MCP para ler exatamente o comentário por esse ID e o estado atual da tarefa antes de agir, conferindo que o comentário pertence à task e que executor/versão/estado permitem a ação. Consulte o contrato real em integração, sem adivinhar toolname. A resposta segue o mesmo ciclo: campos pertinentes, comentário completo, persistência confirmada e nova notificação. Comentário ausente/inacessível ou leitura indisponível suspende trabalho dependente; não substitua por conteúdo do chat ou outro comentário mais recente.

Notificação não é demanda autônoma nem aprovação adicional. No-op e ack sem conteúdo não geram comentários ou pingue-pongue. Antes de repetir após timeout, confira resultado/registro e preserve idempotência; não duplique comentários. Se gravação falhar, mantenha pendência e não emita notificação do protocolo sem comentário/ID confirmado; nunca alegue sucesso. Comunicação imposta por instrução superior continua sendo respeitada. Se o envio falhar após gravação, retome apenas o envio necessário. Permissões do harness continuam obrigatórias; a skill não amplia autorização para mensagens.

## Briefing para execução ou retomada

Peça explicitamente **usar a skill Collaborator neste chat**. Indique identidade existente ou autorização explícita para fallback novo, time, referência real da task quando existir, referências persistidas do contexto do board de origem; fora do bootstrap inicial de novo chat Collaborator e de seu retorno de configuração, notificação restrita a task, áreas efetivamente atualizadas, status pertinente e commentID retornado, usando dados persistidos. Duas confirmações: identidade/perfil prontos; depois compreensão da task realmente atribuída e pendências. Sem task registrada e atribuída, retornar apenas a configuração no bootstrap e aguardar; o Leader registra/atribui antes de pedir execução. Não criar task para se autoautorizar. Desdobramento só no escopo de uma task já atribuída.

Registre o contexto completo relevante na tarefa, fiel ao usuário, nesta ordem; o destinatário o consulta ali:

- Identidade/perfil e regras/limites; board e tarefa/subtarefa, autor/executor, vínculos organizacionais relevantes, com IDs conhecidos.
- Demanda original e objetivo; escopo aprovado e o que ainda é somente planejamento.
- Decisões aceitas, alternativas rejeitadas e motivos; restrições que precisam sobreviver à troca de chat.
- Entrega esperada, critérios de aceitação, evidências necessárias e responsável pela revisão.
- Trabalho anterior confirmado, arquivos/fontes acessíveis, dependências e contribuições de outros agentes.
- Contexto `rootTaskId`, `originBoardId`, `originBoardMode`, `effectiveMode`, modo individual atual e autorização aplicável, incluindo a proposta aprovada e limites de reutilização/transferência.
- Pendências/bloqueios, dúvidas não resolvidas e próximo passo concreto.
- Obrigação de atualizar a própria tarefa ao encerrar e capacidades de API/harness realmente disponíveis.

Esse formato organiza o conteúdo persistido da tarefa, não a mensagem entre chats. A notificação contém apenas task real, áreas efetivamente atualizadas, status pertinente e commentID real retornado. Se o destinatário não consegue ler o registro, trate a lacuna de acesso sem enviar instruções substitutas pelo chat. Se um dado não existe, diga que falta. Não delegue novamente a descoberta que o líder já fez com o usuário.

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

## Bootstrap de novo Collaborator

Siga [chat antes do cadastro](beeteam://references/collaborator-bootstrap): Leader cria o chat autorizado; o próprio Collaborator identifica/cria/configura perfil/vínculo e retorna nome real, agentId/teamId e prontidão. Leader verifica antes de atribuir trabalho. Somente pedido inicial/retorno de configuração ou impedimento dispensam comentário; não é exceção para trabalho posterior nem autorização adicional do harness.
