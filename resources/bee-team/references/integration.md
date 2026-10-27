# Integração Bee Team: contratos e recuperação

Leia antes de consultar ou alterar dados. Fonte funcional: [especificação](../../bee-team-spec.md). Contratos HTTP propostos: [Kanban](../../docs/kanban-openapi.yaml) e [RA](../../docs/ra-openapi.yaml). Planos complementares: [Kanban](../../docs/kanban-api-plan.md) e [RA](../../docs/ra-api-plan.md). Os planos podem conter propostas antigas; instruções explícitas prevalecem. Se houver incompatibilidade operacional, informe-a antes da ação dependente.

Antes de usar os links, confira a revisão: este pacote exige coleções diretas `/boards`, `/tasks`, `/agents`, `/teams`, campos `authorAgentId`/`executorAgentId` e `Task.executionContext`. Se os arquivos vinculados ainda tiverem workspace, pertencimento de task a time ou autonomia sem os três modos, são snapshots incompatíveis: consulte a revisão fornecida pelo responsável dos contratos ou reporte a dependência. Não use bindings antigos para preencher lacunas. A revisão de referência e seus hashes estão em [validação](../validation.md).

## Descobrir a capacidade real

Confirme endereço/configuração local e recursos disponíveis no ambiente. Um OpenAPI é contrato, não prova de servidor em execução. Não teste mutações apenas para descobrir disponibilidade. MCP deve ser descoberto pela lista/documentação de ferramentas do ambiente: `operationId` HTTP não é nome garantido de ferramenta MCP. Não implemente backend, frontend ou conectores para suprir uma capacidade ausente nesta skill.

Os contratos `0.1.0-draft` consultados em 27/10/2026 usam **boards → tasks/statuses**, sem workspace, com times RA separados, sem autenticação. `X-Actor-Kind` e `X-Actor-Id` declaram autoria; não verificam identidade. Declare o agente correto, nunca se passe pelo humano para contornar uma restrição. Responsabilidade de execução é política de uso, não isolamento seguro. Não crie login, tokens ou credenciais.

## Mapa de consulta, não catálogo de ferramentas

Board tem `createdBy` preservado e `teamId` gestor obrigatório transferível. Um time gere vários boards. Task não tem `teamId`: possui `authorAgentId` imutável e `executorAgentId` obrigatório, ambos agentes. Reatribuir executor não copia histórico interno do agente. Subtasks recursivas podem ter outro board e executor, sem limite fixo; ciclos são inválidos.

| Necessidade | Caminho HTTP proposto a conferir no contrato |
|---|---|
| Perfis e times | `/api/v1/agents`, `/api/v1/teams` |
| Transferência organizacional | `POST /api/v1/team-composition-changes`: estados finais completos e versões dos times afetados, operação atômica; pode incluir origem arquivada, sem reatribuir tasks |
| Boards e tarefas | `/api/v1/boards`; `/api/v1/boards/{boardId}/tasks` |
| Filhos em todos os boards | `GET /api/v1/tasks?parentId={taskId}`; paginar e repetir por nó para descendência |
| Status configurados | `/api/v1/boards/{boardId}/statuses` |
| Detalhe e histórico | `/api/v1/tasks/{taskId}` e subrecursos `plans`, `comments`, `attachments`, `timeline` |
| Resultado de atividade | `/api/v1/tasks/{taskId}/execution-summaries` |
| Retomada e índice RA | `/api/v1/agents/{agentId}/resumption-context`, `/activities`, `/chat-references` |

Leia método, schema e parâmetros atuais antes de montar pedidos. O contexto RA referencia tarefas; busque nelas resumos e entregas. Não suponha que a primeira página seja o histórico completo. Use filtros, `offset`/`limit` e metadados de continuação; entre páginas pode haver alterações. Reconcilie IDs e releia o alvo antes de escrever.

Use IDs retornados pelo servidor; IDs persistidos são UUIDv7, referências externas de chats são texto opaco. Status vêm do board, não de nomes fixos. `deletedAt` e arquivamento têm semânticas diferentes; não remova ou recrie registros para resolver inconsistência.

## Autonomia pelo board de origem

`Board.autonomyMode`: `manual`, `standard`, `automatic`, default `manual`.
`Task.autonomyMode`: `manual`, `automatic`, default `manual`.

| `originBoardMode` | Task atual | `effectiveMode` |
|---|---|---|
| `manual` | qualquer | `manual` |
| `standard` | `manual` | `manual` |
| `standard` | `automatic` | `automatic` |
| `automatic` | qualquer | `automatic` |

Leia `Task.executionContext`: `rootTaskId`, `originBoardId`, `originBoardMode`, `effectiveMode`. O servidor deriva a origem da raiz; o harness a preserva em todos os briefings. Board destino e flag do pai não substituem a regra. Em `standard`, pai automático não libera filho manual. Em origem `automatic`, filho manual em board manual continua automático. O cálculo não modifica flags persistidas. Sem contexto, manter aprovação.

Para escolha explícita de configuração, `PATCH /api/v1/boards/{boardId}` ou `PATCH /api/v1/tasks/{taskId}` aceita `autonomyMode`, com `If-Match`. Não altere essas flags só para contornar uma aprovação. `POST /api/v1/boards/{boardId}/tasks` exige `authorAgentId`, `executorAgentId`, título e `coordinationContext`; filho usa `parentId` e versão do pai, mesmo cross-board. Reatribuição usa `PUT /api/v1/tasks/{taskId}/assignment` com executor não nulo e contexto de coordenação, preservando autor e origem. A política de edição pelo líder permanece pendente; não infira autorização só porque uma rota existe.

Para consultar filhos, use a coleção global sem filtro de board: a listagem local pode omitir subtasks de outros boards. Percorra páginas e nós sem duplicar IDs, detectando ciclos inconsistentes em vez de continuar indefinidamente. O contrato não oferece alteração de `parentId`/`boardId`; não improvise reparenting.

## Escrita e falha

Use os campos exigidos pelo contrato confirmado, incluindo versão/ETag, `If-Match`, contexto de coordenação e chave de idempotência onde previstos. Referência de aprovação aponta para a decisão real na conversa; não fabrique evidência nem grave a conversa integral.

Ao encerrar, `POST /api/v1/tasks/{taskId}/execution-summaries` exige `summary`, `outcome`, `statusId`, `deliverables`, `pending` e `executionContext: {rootTaskId, originBoardId}` da cadeia. Decisões e próximo passo podem integrar resumo/pendências; não invente campos JSON. `completed` exige status final sem bloqueio; `blocked` exige bloqueio já registrado, e resultados não finais usam status não final. A operação reúne resumo e estado resultante; confirme resposta e estado. Não substitua isso por um comentário vazio ou por status final sem resultado. Anexos/referências devem apontar a entregas existentes, com acesso verificado quando possível.

Em timeout, resultado da escrita é desconhecido. Consulte o recurso antes de repetir; com idempotência suportada, reutilize a mesma chave e conteúdo. Em conflito de versão, releia, preserve mudanças alheias e reaplique apenas o que ainda é válido. Em erro de schema, corrija segundo o contrato, sem adivinhar. Após uma tentativa de reconciliação e um retry seguro sem confirmação, pare as escritas dependentes e reporte o bloqueio; não entre em loop nem crie duplicatas.

Se API/MCP estiver indisponível, entregue um registro pendente na conversa: IDs conhecidos, trabalho feito, status pretendido, resumo, decisões, referências, pendências, próximo passo e falha observada. Identifique-o como **não confirmado no Bee Team**. Isso não substitui a obrigação de persistir quando possível; na retomada, confira o servidor antes de reenviar. Continue apenas trabalho independente já autorizado. Não prometa sincronização automática ou execução após fechar o chat.
