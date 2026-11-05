# Bee Team — plano do contrato Kanban

27/10/2026. Revisão somente documental. Frontend, backend e skills permanecem pausados. Fonte formal: [kanban-openapi.yaml](kanban-openapi.yaml); decisões: [spec](../bee-team-spec.md). Este plano não implementa runtime.

## Decisões finais e domínio

Board organiza tasks/status e tem teamId gestor obrigatório, podendo ser transferido; um time pode gerir vários boards. Task não tem teamId nem pertencimento direto ao time. Mudança de time do agente ou gestor do board não altera autor, executor, hierarquia ou histórico das tasks.

Board preserva createdBy, derivado do contexto declarado de criação (agente identificado ou usuário local human). Não é editável no PATCH. Task tem authorAgentId (autor/dono que escreveu) e executorAgentId obrigatórios, ambos agentes, líderes ou workers. authorAgentId é imutável. Usuário pode reatribuir executor pelo endpoint de assignment; null não é permitido. Não copiar histórico interno do agente anterior; informação da task e seus resumos continuam disponíveis a todos.

A responsabilidade do líder é organizar demandas por agentes geridos, não por possuir tasks. Alcance de edição do líder em tasks de executor gerido ainda aguarda confirmação. Os contratos não bloqueiam com base em uma permissão não definida. Autor/dono é dado de autoria preservado, não novo modelo de autenticação.

## Gestão do board e auditoria

POST /boards exige teamId. PATCH /boards/{boardId} aceita teamId e If-Match; mudança grava novo gestor e evento board.management_changed atomicamente, com ID UUID v7, boardId, previousTeamId, teamId, ator declarado e timestamp. Board retorna lastManagementChange (null antes da primeira mudança); log completo permanece append-only. Nenhum novo endpoint de log foi acrescentado nesta revisão.

Transferir board não muda createdBy, authorAgentId, executorAgentId, parentId, originBoardId nem dados das tasks. Enviar o gestor atual não duplica evento. AutonomyMode do board e configs individuais permanecem como estavam, salvo alteração explícita desses campos. Não impor unicidade de teamId na coleção de boards.

## Hierarquia recursiva entre boards

Subtask é Task com parentId; não há limite fixo de profundidade. Cada nó pode ter outro board e outro executor, mantendo autor/executor obrigatórios. Rejeitar ciclos estruturais e autorreferência. Checklist é leitura dos filhos reais; não existe estado de checkbox duplicado. Fechar pai não fecha filhos automaticamente, e filho concluído não conclui pai.

GET /tasks?parentId=... retorna filhos diretos em todos os boards. Repetir por nó para percorrer recursivamente; não usar filtro boardId para ocultar filhos cross-board. GET /boards/{boardId}/tasks permanece consulta local com os mesmos DTOs. Não criar CRUD separado de subtasks. PATCH continua sem alterar parentId/boardId. O vínculo explícito de tarefas existentes usa POST /api/v2/tasks/{taskId}/parent/link (MCP linkTaskToParent), com versões de tarefa/pai/pai anterior e idempotência; boardId permanece imutável. Consulte docs/task-parent-link.md para contexto, aprovação e preservação histórica.

O rootTaskId da raiz é seu próprio ID; originBoardId é seu board. Filho conserva rootTaskId/originBoardId do pai, mesmo em outro board. O servidor deriva esses valores, sem aceitar que o cliente substitua a origem pelo board de destino. Isso representa a cadeia persistida; o harness transporta essa referência ao executá-la. Task.executionContext é somente leitura. RecordExecution recebe a referência {rootTaskId,originBoardId}, validada contra a cadeia e preservada no resumo.

## Autonomia: precedência confirmada

Board.autonomyMode: manual (totalmente manual), standard (padrão), automatic (totalmente automático). Default inicial manual, não standard. Task.autonomyMode: manual ou automatic, default manual. Nomes JSON são representação técnica dos modos confirmados.

Task.executionContext contém rootTaskId, originBoardId, originBoardMode e effectiveMode. Consultar configurações do board de origem e da task atual; não gravar o resultado de volta em suas flags.

| Origem | Task atual | Destino / pai | effectiveMode |
|---|---|---|---|
| manual | qualquer | qualquer | manual |
| automatic | qualquer | qualquer | automatic |
| standard | manual | qualquer | manual |
| standard | automatic | qualquer | automatic |

O board da origem da task principal governa toda a cadeia. Board de destino e flag do pai não substituem a regra. Em standard, pai automático não libera filho manual. Em manual, origem supera task automática. Em automatic, origem supera task manual e destino manual. Sem contexto, pedir aprovação. Harness executa; Bee Team armazena e expõe contexto, não é engine executor. Aprovações/limites externos continuam aplicáveis.

## Recursos preservados

Status configuráveis por board, nomes/ordem livres e sem máquina rígida. Bloqueio com motivo separado de status. Fluxo inicial sugerido Backlog, A fazer, Em andamento, Em revisão, Concluída. Status final usa isDone; criação em estado não final e conclusão por resumo são propostas técnicas existentes. Revisão segue orientação do usuário, sem etapa obrigatória universal.

Planos múltiplos, revisões imutáveis propostas, comentários, anexos, entregas/pendências, resumos de execução e timeline permanecem vinculados à task em qualquer profundidade. includeChildren=true na timeline agrega toda a descendência cross-board, sem duplicar eventos, com taskId e autoria declarada. Não copiar histórico interno de agente ao transferir executor.

Ao encerrar atividade, executor registra resultado/status/resumo/entregas/pendências. Contexto de execução do resumo precisa coincidir com a cadeia; divergência retorna 409 execution_context_mismatch. Encerrar atividade não é concluir task. Finalização exige resumo e coerência de status/bloqueio conforme schemas.

Uploads: um arquivo até 20 MiB, corpo multipart até 21 MiB. Armazenamento fora da raiz web, nome apenas metadado, sem path arbitrário. Download attachment/nosniff. DELETE marca deletedAt e preserva dados físicos; includeRemoved expõe metadados excluídos, não restaura download. Limpar temporário de upload não confirmado não equivale a apagar registro persistido.

Arquivamento de board/task preserva registros. Propostas anteriores de bloqueio de escrita em arquivados continuam descritas nos schemas, sem confundir arquivamento com exclusão. Mudança de time não é motivo para perder tasks/histórico. Status em uso não pode ser arquivado ou mudar isDone; renomear/reordenar preserva referências.

## Rotas

Prefixo /api/v2. Quadro: GET /boards/{boardId} metadados; GET /boards/{boardId}/view projeção. Nova consulta global GET /tasks permite checklist cross-board sem duplicar CRUD.

| Método e path | Operação |
|---|---|
| GET `/boards` | Listar boards |
| POST `/boards` | Criar board |
| GET `/boards/{boardId}` | Consultar board |
| PATCH `/boards/{boardId}` | Atualizar ou arquivar board |
| GET `/boards/{boardId}/statuses` | Listar status ordenados |
| POST `/boards/{boardId}/statuses` | Criar status ao fim |
| PATCH `/boards/{boardId}/statuses/{statusId}` | Configurar status |
| PUT `/boards/{boardId}/status-order` | Ordenar todos os status ativos |
| GET `/boards/{boardId}/view` | Consultar quadro |
| GET `/boards/{boardId}/tasks` | Listar tarefas e subtarefas |
| POST `/boards/{boardId}/tasks` | Criar tarefa ou subtarefa |
| GET `/tasks/{taskId}` | Consultar tarefa |
| PATCH `/tasks/{taskId}` | Atualizar conteúdo e progresso |
| PUT `/tasks/{taskId}/assignment` | Atribuir ou transferir responsável |
| PUT `/tasks/{taskId}/position` | Mover ou reordenar tarefa |
| PUT `/tasks/{taskId}/block` | Bloquear ou desbloquear |
| GET `/tasks/{taskId}/plans` | Listar plans |
| POST `/tasks/{taskId}/plans` | Registrar plans |
| GET `/tasks/{taskId}/comments` | Listar comments |
| POST `/tasks/{taskId}/comments` | Registrar comments |
| GET `/tasks/{taskId}/attachments` | Listar attachments |
| POST `/tasks/{taskId}/attachments` | Registrar attachments |
| GET `/tasks/{taskId}/execution-summaries` | Listar execution-summaries |
| POST `/tasks/{taskId}/execution-summaries` | Registrar execution-summaries |
| GET `/tasks/{taskId}/plans/{planId}/revisions` | Listar revisões de planejamento |
| POST `/tasks/{taskId}/plans/{planId}/revisions` | Salvar revisão imutável |
| GET `/tasks/{taskId}/attachments/{attachmentId}/content` |  |
| DELETE `/tasks/{taskId}/attachments/{attachmentId}` | Remover acesso ao anexo e preservar registro excluído logicamente |
| GET `/tasks/{taskId}/timeline` | Consultar timeline unificada |
| PUT `/tasks/{taskId}/archive` | Arquivar ou restaurar tarefa |
| GET `/tasks` | Listar tasks entre boards e consultar filhos recursivos |

## Convenções comuns

Sem autenticação, tokens ou controle de identidade verificada. Todas as informações das tasks são consultáveis por todos. X-Actor-Kind human/agent e X-Actor-Id (obrigatório para agent) são proposta de autoria declarada para auditoria; não são credenciais. O servidor confere existência/coerência, mas qualquer cliente pode declarar outro agente. O contexto de autor de requisição não substitui o autor/dono obrigatório da task.

Backend Rust existente, PostgreSQL >=18. IDs persistidos são UUID v7; externalId de chat/harness continua texto opaco. Exclusão lógica usa deleted_at/JSON deletedAt; preservar registros, referências históricas e bytes físicos. archivedAt é lifecycle separado. GET de excluído retorna 404; listas excluem registros removidos por padrão, salvo filtro explícito de tombstones de anexos. Nenhum DELETE remove fisicamente dados.

offset padrão 0 (0..2147483647), limit padrão 50 (1..100). Listas: {items,offset,limit,total,hasMore,nextOffset}; total após filtros/exclusão lógica; hasMore=offset+items.length<total, nextOffset=offset+items.length se houver mais, senão null. Além do total: lista vazia. Ordenação por allowlist e ID de desempate na mesma direção; não há snapshot entre páginas.

Filtros compõem AND. Buscas de nome/título/arquivo são substring literal case-insensitive; escapar %, _ e barra invertida em SQL parametrizado. Datas From inclusivas, Before exclusivas, RFC3339 com timezone e From<Before. Repetidos, desconhecidos, enums/IDs/ranges inválidos são 400. Arrays CSV somente onde declarados (types/taskIds). Arrays embutidos pequenos não são paginados.

POST exige Idempotency-Key UUID (chave de requisição, não ID persistido de entidade): 24h por rota/contexto declarado/conteúdo; replay idêntico não duplica registro, conteúdo diferente 409. PATCH/PUT/DELETE e conteúdo da task exigem If-Match; ausência 428, divergência 412. Batch de composição usa expectedVersion em cada time e 409 para conflito. Criar filho usa versão do pai, mesmo cross-board. Campos desconhecidos são rejeitados; PATCH omitido preserva, null somente onde permitido.

Erros {error,code,details}: 400 entrada/contexto inválido; 404 inexistente/excluído; 409 conflito estrutural, contexto, estado ou idempotência; 412/428 versão; 413 limite; 415 mídia; 500/503 interno/storage sem detalhes sensíveis. Não há 401/403 nem bloqueio baseado em suposta identidade autenticada.

## Filtros e projeção do quadro

Tasks (local/global): title, statusId, authorAgentId, executorAgentId, parentId, rootOnly, blocked, archived, createdFrom/Before, updatedFrom/Before; consulta global também boardId. Sem teamId nas tasks. Boards: name, teamId gestor, archived e datas. Planos: título, autor declarado e data da revisão atual; revisões/comentários: autor/data; anexos: nome, tipo, autor/data e includeRemoved; resumos: autor, outcome, status registrado, datas; timeline: ator, types CSV, datas e descendentes.

Quadro mantém todas as colunas ativas visíveis e primeira página de cards por coluna; limitPerColumn padrão20, máximo100; cada coluna retorna offset/limit/total/hasMore/nextOffset. Continuação pela listagem local com statusId e mesmos filtros/ordenação. A projeção inicial de cards raiz não limita a existência/consulta das subtasks; checklist completo usa /tasks?parentId. Não impor paginação global de colunas nem alterar contexto pela visualização do board de destino.

## Exemplos e verificação documental

GET /api/v2/tasks?parentId=10000000-0000-7000-8000-000000000002&offset=0&limit=50
GET /api/v2/boards/10000000-0000-7000-8000-000000000001/tasks?title=login&executorAgentId=10000000-0000-7000-8000-000000000011&offset=0&limit=25

O YAML contém exemplos de criador do board, autor/executor da task, reatribuição, transferência do board, cadeia de quatro nós em boards diferentes e matriz de 36 combinações de autonomia. Validar esquemas não demonstra implementação do comportamento; os cenários documentam a precedência que os implementadores deverão cumprir.

## Implementação futura — não executar nesta revisão

Preservar API Rush routes → dto → services → repositories, SQLx parametrizado/migrations, módulos abaixo de 1000 linhas. Não implementar auth. Quando autorizado, validar FK de agentes, gestão do board, ciclos, recursão, contexto de origem, eventos atômicos, UUID v7 e exclusão lógica. Integração HTTP/MCP usa os mesmos DTOs e regras. Escopo de edição do líder permanece pendente; não criar permissão silenciosa.

## Resumo atual cumulativo (implementado)

Task.currentSummary é string sempre presente em item/listagens/view, inicialmente vazia (incluindo backfill de legadas). Texto explícito do worker, máximo 16384 bytes UTF-8, com feito/concluído, trabalho atual e pendências/próximo passo; não se infere descrição, nota de progresso ou histórico. Escrita substitui a síntese inteira, preservando antes/depois nos eventos existentes da timeline.

PatchTask aceita currentSummary não vazio e o exige quando progress é enviado. Position (operação moveTask) o exige ao mudar status, não ao reordenar no mesmo status. RecordExecution exige currentSummary; mantém summary como registro histórico de atividade e salva ambos atomicamente. MCP simples segue os mesmos DTOs; record_progress aceita currentSummary no topo e por descendente, obrigatório com progress; close_activity exige execution.currentSummary. Título/descrição/modo podem ser editados sem enviar resumo; preservam o existente.

Persistência reutiliza tasks.data JSONB (migration 202610270004); nenhuma tabela duplicada ou query por card. Backend não calcula síntese nem cliente precisa ler toda história. Erro de versão, conteúdo, contexto ou descendente reverte todas as alterações compostas; idempotência cobre o texto enviado. Sem alterações na política de edição do líder.

## Especificação própria e Markdown

`Task.specification` é texto Markdown (máximo 65536 bytes UTF-8), sempre presente em leitura/listagem/quadro/contexto MCP. Criação aceita campo opcional, com padrão `""`; PATCH aceita substituição integral, inclusive `""` para limpar. Null/tipo incorreto/excesso de bytes são rejeitados. Migration005 preenche legadas/tombstones sem inventar conteúdo, preservando as especificações existentes.

Especificação define entrega, requisitos, regras e critérios de aceite. `description` apresenta a tarefa, `PlanRevision.content` descreve execução versionada, `currentSummary` relata estado cumulativo atual. Nenhum substitui o outro. Alteração apenas de specification é administrativa e não exige currentSummary; progress conjunto mantém sua exigência. Timeline mantém antes/depois via task.updated. Replays legados recebem vazio explícito no snapshot, mantendo versão e conteúdo anterior.

Especificações e planos/revisões conservam o texto recebido, incluindo Markdown, Unicode, quebras de linha e trechos de código/HTML literais. O backend não renderiza HTML, executa ou transforma conteúdo. Planos continuam com content Markdown limitado a 65536 bytes, revisões imutáveis e conflitos baseRevision existentes. Sem nova entidade ou versionamento exclusivo de especificação. Clientes devem tratar conteúdo como dados e renderizar com segurança quando necessário.

## Slugs de agentes, times e tasks

Agent.slug, Team.slug e Task.slug (incluindo subtasks) são gerados, sempre presentes e não editáveis. UUIDv7 permanece identidade interna e parâmetro das APIs existentes. Boards não possuem slug. Resolvers GET /api/v2/agents/by-slug/{slug}, /teams/by-slug/{slug}, /tasks/by-slug/{slug} retornam {id,slug}; no MCP: resolveAgentSlug/resolveTeamSlug/resolveTaskSlug com params.slug. Usar o UUID retornado nas APIs/prompts seguintes; não enviar slug onde se exige UUID. Retorno404 para ausente/excluído; arquivados continuam resolvendo. Formato inválido ou não canônico retorna400; não há redirect/normalização implícita no resolver.

Normalização única no PostgreSQL: lowercase+NFKD, remoção de marcas combinantes U+0300..036F, ß/æ/œ para ss/ae/oe, demais caracteres fora de a-z0-9 viram separador, hifens colapsados/sem bordas. Nomes sem caracteres úteis usam agent/team/task; não há transliteração universal de alfabetos não latinos. Máximo80 caracteres ASCII, truncando base para caber sufixos -2,-3... . Reservados new/edit/create/by-slug/resolve/search/archive/settings/api/mcp/agents/teams/tasks e strings em formato UUID recebem prefixo agent-/team-/task-.

Slugs são estáveis ao renomear e únicos por tipo, inclusive archived/deleted. Excluídos nunca liberam o nome para outra identidade; cópia cria novo slug. Migration006 usa created_at,id para backfill determinístico, incluindo tombstones sem alterar conteúdo prévio, versão ou datas. Coluna gerada/index único/trigger de imutabilidade e lock transacional coordenam concorrência. Resolvers consultam índice diretamente, sem snapshot completo ou enumeração de listas. A geração e o backfill compartilham a mesma função SQL, sem algoritmos divergentes.

Replays históricos sem slug ganham o slug canônico imutável do registro correspondente, inclusive tombstones; conservam a versão e demais campos do snapshot original. Não se reconstrói slug pelo nome antigo nem atual. Sem auth/políticas novas; alteração visual/integração frontend não validada nesta frente.
