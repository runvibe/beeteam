# Kanban Bee Team — plano e contrato de API

> Para execução futura por agentes: usar superpowers:executing-plans ou, se escolhido pelo usuário, superpowers:subagent-driven-development. Este documento é um design revisável; não autoriza implementação.

**Objetivo:** registrar e acompanhar projetos, tarefas e subtarefas pela IA, com autoria verificável e resumos vinculados ao trabalho.

**Arquitetura:** HTTP e MCP adaptam os mesmos casos de uso; DTOs validam contratos, serviços autorizam e orquestram, repositórios persistem dados e arquivos. A UI continua sendo visualização e configuração; estas rotas não constituem autorização para adicionar edição de cards, arrastar, atribuir ou aprovar execução pela UI.

**Base técnica observada:** Rust 2021 (mínimo 1.94), Axum 0.8.9, SQLx 0.9/PostgreSQL, utoipa/OpenAPI, rmcp opcional. **Spec:** [bee-team-spec.md](../bee-team-spec.md). Data: 27/10/2026.

**Contrato formal proposto:** [kanban-openapi.yaml](kanban-openapi.yaml), OpenAPI 3.1, com as mesmas 30 operações deste plano. Para coerência formal: `Location` de recursos sem GET individual aponta à coleção com fragmento `#UUID`, sem criar rota adicional; criação de tarefa aceita apenas status não final, pois conclusão exige resumo; limites textuais em KiB são bytes UTF-8 (`x-maxBytes`), não contagem de caracteres. Esses detalhes continuam propostas técnicas.

## 1. Decisões e propostas

Confirmado: projetos distintos de times; status configuráveis por projeto; fluxo flexível; bloqueio separado; planejamentos; subtarefas reais exibidas como checklist; comentários e uploads em ambas; resumos, entregas e pendências na tarefa; timeline com autor. Colaborador atualiza somente trabalho atribuído a si; líder atualiza tarefas do seu time. Revisão segue orientação do usuário, podendo ser feita pelo líder em autonomia. Criação e distribuição seguem aprovação/autonomia já definidas.

Todo path, esquema, limite, mecanismo de autenticação, política de leitura e detalhe de persistência abaixo é **proposta técnica**, ainda sujeito a revisão. Não inclui CRUD de colaboradores, skills por perfil/tarefa ou transcrições de conversa.

Proposta de relação: projeto pertence ao workspace e tem `teamIds` (um ou mais times participantes); tarefa tem exatamente um `teamId`, pertencente ao projeto. Um projeto pode reunir vários times, sem transformar projeto em time. Projetos recém-criados podem ter `teamIds: []`, mas não recebem tarefas até vincular um time. Líder administra o trabalho do seu time, nunca ganha acesso de escrita a outros times por participar do mesmo projeto. Alterar `teamIds` é administração do projeto; não permite transferir tarefas existentes de time. Esta escolha resolve o escopo de autorização, mas não é uma exigência confirmada pelo usuário.

Subtarefas propostas: mesma entidade `Task`, com `parentId`, status e responsável próprios; herdam projeto/time do pai. Um nível de subtarefas na primeira versão; pai imutável após criação, sem ciclos. Checklist é projeção `status.isDone`, nunca um booleano separado. Concluir pai não conclui filhos automaticamente e vice-versa; filhos pendentes são mostrados e não impõem uma máquina rígida. Pai não concede permissão para alterar filho atribuído a outra pessoa.

## 2. Compatibilidade com API Rush

Evidência local: `src/routes/mod.rs` monta `/health`, `/echo`, `/docs`, `/openapi.json`; `src/routes/mcp.rs` expõe apenas `health_check` e `echo_request`, em HTTP stateless quando feature/config habilitadas. `src/state.rs` carrega `DatabaseRepository`. `src/error.rs` responde `{ "error": "mensagem" }`. Não há autenticação de agentes nem tabelas Kanban. `src/config.rs` e README documentam loopback por padrão, limite de corpo e CORS configurável.

Adicionar `/api/v1` apenas para o novo contrato; preservar rotas existentes. JSON de sucesso é recurso direto; listas usam envelope. Expandir erro de forma aditiva com `code` e `details`, preservando `error`. OpenAPI em utoipa descreve HTTP; MCP continua fora do documento HTTP. Multipart exige habilitar suporte Axum e ajustar limites, ainda não implementados. Autenticação deve cobrir HTTP e o transporte MCP; CORS não é autenticação.

## 3. Identidade e autorização propostas

Credencial opaca individual em `Authorization: Bearer <token>`, emitida pelo proprietário via provisionamento local confiável, fora deste CRUD. Persistir somente hash, identificador, expiração e revogação; resolver `ActorContext { actorId, collaboratorId, workspaceId, scopes }` no servidor. Papéis e participação em times vêm do cadastro confiável, consultados a cada operação. Não aceitar `actorId`, papel ou `collaboratorId` como autoria no body. `assigneeId` é o destinatário, não prova de identidade. Tokens de colaboradores diferentes precisam ser entregues separadamente pelo harness; se todos compartilham um token, não existe isolamento verificável entre eles. O usuário local com acesso administrativo à máquina permanece a raiz de confiança.

Papéis da tabela de rotas:

- **R:** leitura proposta para membros dos times participantes do projeto, dentro do workspace; proprietário pode ler todos. Em projeto sem times, apenas proprietário. Token da UI tem escopo de leitura. Não expor dados de outros projetos/workspaces por IDs de tarefa, anexos, filtros ou totais das páginas.
- **P:** proprietário ou administrador de projeto explicitamente delegado. Liderar um time não torna alguém administrador de projeto automaticamente. P administra projetos/status, mas não dá permissão implícita para alterar tarefas de outros times.
- **L:** team leader do `task.teamId` (ou time indicado na criação). Criação/atribuição/transferência exigem também a política conversacional abaixo.
- **W:** responsável atual pela tarefa ou L. Vale para subtarefa individualmente, comentários, planejamento, anexos, bloqueio e resultados. Antigo responsável perde W após transferência. Autor de comentário/arquivo não conserva W ao perder a tarefa.

`teamId`, `projectId` e `parentId` são imutáveis na tarefa. Atribuição só aceita colaborador do mesmo time; líder pode retirar atribuição. Colaborador W não pode usar edição para se atribuir outra tarefa, trocar responsável ou mudar time. Tarefa sem responsável só é atualizada por L. A própria UI não recebe token operacional de agente.

No modo aprovação, criar trabalho e atribuir/transferir exigem `coordinationContext: { mode: "approval", conversationRef, approvalRef }`; em autonomia: `{ mode: "autonomous", conversationRef }`. Servidor confere o modo efetivo persistido e registra o contexto. **Essas referências são trilha de auditoria, não prova criptográfica de consentimento humano.** O harness/team leader precisa respeitar a aprovação na conversa; não criar botão/endpoint de aprovação. Um mecanismo de concessão assinada pelo usuário seria evolução separada, se for necessário enforcement técnico do consentimento. A identidade e o escopo W/L são impostos pelo servidor independentemente dessa limitação. A granularidade workspace/time do modo continua aberta; o serviço deve receber uma política efetiva resolvida, sem inventar precedência entre configurações ainda não decididas.

## 4. Convenções de contrato

A escolha de paginação por `offset` e `limit` foi confirmada pelo usuário e é comum aos contratos Kanban e RA. Defaults, limites e formatos abaixo permanecem os mesmos; não há paginação por cursor nos contratos.

- IDs UUID, datas UTC RFC3339; exemplos abaixo usam aliases `p1`, `t1`, `s1` só para legibilidade. Campos JSON em camelCase. Omissão em PATCH preserva valor; `null` limpa apenas campos explicitamente anuláveis. Campos desconhecidos rejeitados.
- POST cria com `201` e `Location`; GET/PATCH/PUT respondem `200`; DELETE de anexo responde `204`. Criações retornam o recurso, não apenas ID.
- Recursos mutáveis retornam `version` inteiro e ETag correspondente. PATCH, PUT, DELETE e comandos que alteram Task exigem `If-Match`; ausência `428`, versão divergente `412`. Criação de filho usa versão do pai; resultado, comentário, plano e upload usam versão da tarefa. Ordenação de status usa versão do projeto. Mudança de qualquer conteúdo de tarefa incrementa sua versão. Toda transação grava dados + evento, ou nenhum dos dois.
- POST exige `Idempotency-Key` (UUID): chave vinculada ao ator, rota e hash do pedido por 24h; repetição idêntica devolve resposta original sem evento duplicado, conteúdo diferente dá `409`. Retry deve reutilizar a chave original. Validar autorização atual antes de devolver resposta armazenada.
- Todas as nove rotas de listagem usam `offset` inteiro de 0 a 2147483647 (padrão 0) e `limit` inteiro de 1 a 100 (padrão 50). Valores fora da faixa são rejeitados. Resposta: `{ "items": [...], "offset": 0, "limit": 50, "total": 123, "hasMore": true, "nextOffset": 50 }`. Aplicar autorização e filtros antes de calcular total e selecionar página. `hasMore = offset + items.length < total`; `nextOffset = offset + items.length` quando houver mais, senão `null`. Offset além do total retorna lista vazia, sem erro. Total e itens compartilham o mesmo snapshot dentro da resposta; entre requisições não há snapshot, podendo haver repetição ou omissão se os dados mudarem.
- Ordenação: `sortBy` aceita apenas a allowlist de cada recurso; `sortOrder=asc|desc` (padrão asc), com desempate por `id` na mesma direção. Campos desconhecidos, parâmetros repetidos, UUIDs/enum inválidos e filtros incompatíveis retornam `400 invalid_request`. Filtros diferentes compõem AND. Apenas `types` da timeline aceita múltiplos valores CSV, com OR entre os tipos; demais filtros são escalares.
- Buscas `title`, `name` e `fileName` são substrings literais case-insensitive, de 1 a 200 caracteres. `%`, `_` e `\` não são wildcards; escapar esses caracteres na implementação da consulta e usar parâmetros SQL vinculados. Não aceitar regex/SQL do cliente. `q` deixa de fazer parte do contrato; usar os filtros explícitos. Intervalos `createdFrom/createdBefore`, `updatedFrom/updatedBefore` ou `occurredFrom/occurredBefore` usam RFC3339 com timezone: início inclusivo, fim exclusivo e início estritamente anterior ao fim quando ambos presentes. Normalizar instantes para UTC. Filtros por IDs relacionados são validados no escopo consultado sem revelar recursos fora da leitura.
- Títulos 1–200 caracteres; texto Markdown até 64 KiB; resumo obrigatório 1–16 KiB; comentário 1–16 KiB; motivo de bloqueio 1–2000 caracteres. Descrição pode ser vazia. Sanitizar Markdown na renderização.
- Fluxo inicial sugerido: Backlog, A fazer, Em andamento, Em revisão, Concluída. Criação de projeto sem `statuses` usa esses cinco. Só o último tem `isDone: true`; proposta semântica para checklist/conclusão, independente do nome. Pode haver vários status finais. Manter pelo menos um status ativo não final; criação padrão usa o primeiro não final. Não exigir transições intermediárias.

## 5. Rotas completas propostas

Prefixo de todas as rotas: **`/api/v1`**. `T` representa a tarefa normal ou subtarefa; não há CRUD paralelo de subtarefas. Regras de autorização aplicam-se também a consultas indiretas e corpos com IDs relacionados.

| Método e path | Entrada principal | Sucesso | Acesso |
|---|---|---|---|
| POST `/workspaces/{workspaceId}/projects` | `name, description?, teamIds?, statuses?` | 201 Project com statuses iniciais | proprietário do workspace |
| GET `/workspaces/{workspaceId}/projects` | `name?, teamId?, archived=false, createdFrom/Before?, updatedFrom/Before?, sortBy?, sortOrder?, offset, limit` | ProjectPage | R, filtrada por acesso |
| GET `/projects/{projectId}` | — | Project | R |
| PATCH `/projects/{projectId}` | `name?, description?, teamIds?, archived?` | Project | P |
| GET `/projects/{projectId}/statuses` | `name?, isDone?, includeArchived=false, sortBy?, sortOrder?, offset, limit` | StatusList com metadados de página | R |
| POST `/projects/{projectId}/statuses` | `name, isDone?` (false por padrão) | 201 Status, acrescentado ao fim | P |
| PATCH `/projects/{projectId}/statuses/{statusId}` | `name?, isDone?, archived?` | Status | P |
| PUT `/projects/{projectId}/status-order` | `statusIds` com todos ativos exatamente uma vez | `{items: [Status], projectVersion}` | P |
| GET `/projects/{projectId}/board` | `title?, teamId?, assigneeId?, blocked?, createdFrom/Before?, updatedFrom/Before?, limitPerColumn=20` (máx. 100) | Board com todas as colunas e página inicial de cards por coluna | R |
| GET `/projects/{projectId}/tasks` | `title?, statusId?, teamId?, assigneeId?, parentId?, rootOnly?, blocked?, archived=false, createdFrom/Before?, updatedFrom/Before?, sortBy?, sortOrder?, offset, limit` | TaskPage | R |
| POST `/projects/{projectId}/tasks` | `title, description?, teamId, parentId?, assigneeId?, statusId?, coordinationContext` | 201 Task | L do time |
| GET `/tasks/{taskId}` | — | Task com contagem de filhos e último resultado | R |
| PATCH `/tasks/{taskId}` | `title?, description?, progress?` | Task | W |
| PUT `/tasks/{taskId}/assignment` | `assigneeId` (UUID ou null), `coordinationContext` | Task | L |
| PUT `/tasks/{taskId}/position` | `statusId, beforeTaskId` (UUID ou null para fim) | Task | W |
| PUT `/tasks/{taskId}/block` | `blocked, reason` (obrigatório ao bloquear; null ao liberar) | Task | W |
| POST `/tasks/{taskId}/plans` | `title, content` | 201 PlanRevision (novo planId, revision=1) | W |
| GET `/tasks/{taskId}/plans` | `title?, actorId?, createdFrom/Before?, sortBy?, sortOrder?, offset, limit` | PlanRevisionPage, revisão atual de cada planejamento | R |
| POST `/tasks/{taskId}/plans/{planId}/revisions` | `content, changeSummary, baseRevision` | 201 PlanRevision | W |
| GET `/tasks/{taskId}/plans/{planId}/revisions` | `actorId?, createdFrom/Before?, sortBy?, sortOrder?, offset, limit` | PlanRevisionPage | R |
| POST `/tasks/{taskId}/comments` | `body` | 201 Comment | W |
| GET `/tasks/{taskId}/comments` | `actorId?, createdFrom/Before?, sortBy?, sortOrder?, offset, limit` | CommentPage | R |
| POST `/tasks/{taskId}/attachments` | multipart `file`, `description?` | 201 Attachment | W |
| GET `/tasks/{taskId}/attachments` | `fileName?, mediaType?, actorId?, includeRemoved=false, createdFrom/Before?, sortBy?, sortOrder?, offset, limit` | AttachmentPage | R |
| GET `/tasks/{taskId}/attachments/{attachmentId}/content` | — | 200 bytes + Content-Disposition | R |
| DELETE `/tasks/{taskId}/attachments/{attachmentId}` | — | 204, remoção lógica auditada | W |
| POST `/tasks/{taskId}/execution-summaries` | `summary, outcome, statusId, progress?, deliverables, pending, reviewContext?` | 201 `{executionSummary, task}` | W |
| GET `/tasks/{taskId}/execution-summaries` | `actorId?, outcome?, statusId?, createdFrom/Before?, sortBy?, sortOrder?, offset, limit` | ExecutionSummaryPage | R |
| GET `/tasks/{taskId}/timeline` | `includeChildren=false, actorId?, types?, occurredFrom/Before?, sortBy?, sortOrder?, offset, limit` | EventPage unificada | R |
| PUT `/tasks/{taskId}/archive` | `archived` | Task | L |

`rootOnly=true` e `parentId` são mutuamente exclusivos; listagem sem ambos inclui tarefas e subtarefas. Checklist carrega `/projects/{p}/tasks?parentId={t}&offset=0&limit=50`; os mesmos filtros de título, status e responsável valem para subtarefas. Contagens do pai incluem todos os filhos ativos, não apenas a página carregada. `archived=false` seleciona ativos; `archived=true` seleciona arquivados, inclusive por ancestral arquivado. `includeArchived=true` nos status inclui ativos e arquivados. `includeRemoved=true` nos anexos inclui tombstones sem restaurar download.

**Quadro é uma projeção, não uma lista global de cards:** retorna todos os status ativos, inclusive colunas vazias, em `position,id` crescente (até 50 status ativos/projeto). Cada coluna contém `{status, tasks, offset: 0, limit: limitPerColumn, total, hasMore, nextOffset}`. `total` conta somente raízes ativas autorizadas que atendem aos filtros daquela coluna. Cards em `position,id` crescente; padrão 20 por coluna, máximo 100. Continuar via `/projects/{p}/tasks?statusId={s}&rootOnly=true&archived=false&sortBy=position&sortOrder=asc&offset={nextOffset}&limit={limitPerColumn}`, preservando os filtros. Não há offset global, filtro de status ou paginação de colunas no board. Arrays pequenos embutidos, como `teamIds`, entregas e status iniciais na resposta de criação, não são paginados.

| Listagem | Filtros específicos e datas | sortBy permitido (padrão em negrito) |
|---|---|---|
| Projetos | `name`, `teamId`, `archived`, created/updated | **createdAt**, updatedAt, name |
| Status | `name`, `isDone`, `includeArchived`; não há datas no recurso atual | **position**, name |
| Tarefas/subtarefas | `title`, `statusId`, `assigneeId`, `teamId`, `parentId`, `rootOnly`, `blocked`, `archived`, created/updated | **createdAt**, updatedAt, title, position |
| Planejamentos atuais | `title`, `actorId`, created da revisão atual | **createdAt**, title |
| Revisões | `actorId`, created | **revision**, createdAt |
| Comentários | `actorId`, created | **createdAt** |
| Anexos | `fileName`, `mediaType` exato case-insensitive, `actorId`, `includeRemoved`, created | **createdAt**, originalName, sizeBytes |
| Resumos de execução | `actorId`, `outcome`, `statusId` registrado no resumo, created | **createdAt** |
| Timeline | `actorId`, `types` CSV, `includeChildren`, occurred | **sequence** |

As abreviações created/updated/occurred na tabela significam os pares From/Before definidos acima. Em planejamentos, selecionar primeiro a revisão atual por planId e depois filtrar; autor/data de revisão antiga não faz um plano aparecer. `actorId` filtra autoria registrada e não autentica o solicitante. `sortBy=position` em tarefas sem statusId compara rank opaco e id; para reproduzir uma coluna, aplicar statusId e a ordenação do quadro. Listar status em páginas não altera o PUT de ordenação: enviar todos os IDs ativos exatamente uma vez, obtidos percorrendo as páginas ou pela projeção do quadro.

`beforeTaskId` precisa ser do mesmo projeto/status e mesmo nível/pai, ativo e diferente do alvo. Posição interna opaca, decidida pelo servidor; cliente não envia rank arbitrário. Ordenação concorrente serializada por coluna/conjunto de irmãos, sem perder itens; posição final pode refletir reordenação posterior de outro ator.

## 6. Recursos e comportamento

**Project:** `id, workspaceId, name, description, teamIds, archivedAt, version, createdAt, updatedAt`. **Status:** `id, projectId, name, isDone, position, archivedAt, version`. Nomes ativos únicos por projeto, ignorando caixa/espaços externos.

**Task:** `id, projectId, teamId, parentId, title, description, assigneeId, statusId, position, progress: {percent: 0..100, note}, block: {blocked, reason}, childSummary: {total, done}, latestExecutionSummaryId, archivedAt, version, createdAt, updatedAt`. Progresso informado pelo executor, independente do status; nunca inferir atividade ao vivo dele. Na conclusão, definir percent=100; reabrir permite informar novo progresso. Cada resposta inclui `updatedAt`.

**PlanRevision:** `id, planId, taskId, title, revision, content, changeSummary, actorId, createdAt`. Vários planejamentos coexistem; revisões imutáveis por planejamento são proposta de preservação de histórico. `baseRevision` divergente dá `409`; não sobrescrever texto antigo. Sem rota de apagar planejamento nesta versão.

**Comment:** `id, taskId, body, actorId, createdAt`. Append-only nesta proposta; corrigir com outro comentário. **Attachment:** `id, taskId, originalName, mediaType, sizeBytes, description, actorId, createdAt, removedAt`. **ExecutionSummary:** `id, taskId, actorId, summary, outcome, statusId, deliverables, pending, reviewContext, createdAt`. Outcome: `progress`, `completed` ou `blocked`. Entregas: `{label, attachmentId? , url?}` com no máximo uma referência; URL apenas http/https, sem busca automática pelo servidor; attachment deve pertencer à mesma tarefa e estar ativo. Pendências são strings, array vazio permitido.

Finalização: sempre registrar resumo ao encerrar atividade, inclusive tarefa parcial/bloqueada. Entrada em status `isDone` somente via `execution-summaries` com `outcome=completed`, resumo não vazio, arrays explícitos de entregas/pendências e sem bloqueio ativo. `outcome=completed` exige status final; outros outcomes exigem status não final. `blocked` exige marca de bloqueio já registrada; não confundir bloqueio com coluna. Reabrir via position para status não final preserva resumos anteriores. Reordenar tarefa já concluída no mesmo status não exige novo resumo. Tentar entrar em outro status final via position retorna `409 summary_required`; usar novo resumo. Não impor revisão universal nem fechamento automático de filhos.

Revisão: `reviewContext: {reviewerType: "user"|"team_leader", conversationRef, instructionRef}` é registro da orientação, quando revisão for exigida. Não prova consentimento por si só. No modo autônomo líder pode revisar, salvo instrução explícita contrária. Resultado de revisão pode ser comentário; mover para Em revisão é mudança normal de status. Sem motor de workflow ou nova superfície de aprovação.

**Event:** `id, sequence, taskId, type, actorId, occurredAt, data`. Tipos: `task.created`, `task.updated`, `assignment.changed`, `position.changed`, `block.changed`, `plan.created`, `plan.revised`, `comment.created`, `attachment.added`, `attachment.removed`, `execution.recorded`, `task.archived`, `task.restored`, `subtask.created`. Comentário aparece uma vez na timeline com seu `commentId`; não copiar seu texto para outro registro de histórico. `includeChildren=true` reúne eventos do pai e filhos ordenados por sequência global, preservando `taskId` e autoria reais. Alterações no filho são consultadas por essa projeção, sem duplicar eventos no pai. Eventos guardam valores anteriores e novos relevantes, sem credenciais ou bytes de arquivos.

Uploads propostos: um arquivo por chamada, até 20 MiB; limite multipart total 21 MiB, ajustando explicitamente o limite global atual. Streaming para área temporária e armazenamento fora da raiz web sob chave gerada, nunca caminho enviado pelo cliente. Nome original é metadado, não caminho. Download autenticado, `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, tipo seguro; não executar arquivos. Se gravação de metadados falhar, limpar temporário; falha de finalização não publica anexo pronto. DELETE remove acesso aos bytes e mantém tombstone/evento; limpeza física posterior, sem prazo de retenção confirmado. Sem endpoints para ler caminhos arbitrários da máquina.

Arquivamento proposto: sem DELETE físico de projetos/tarefas/status nesta versão. Projeto arquivado fica somente leitura, inclusive filhos, exceto restauração pelo administrador. Tarefa arquivada bloqueia mutações próprias e dos filhos; filhos continuam preservados, não são reatribuídos nem concluídos. Restauração do pai restaura visibilidade de filhos que não estavam individualmente arquivados. Listas filtram arquivados por padrão. Consultas explícitas continuam disponíveis a R. Remover time de projeto com tarefas, inclusive arquivadas, retorna `409 team_in_use`. Status referenciado por qualquer tarefa não pode ser arquivado nem mudar `isDone`: `409 status_in_use`; renomear/reordenar é permitido. Migrar tarefas ativas individualmente com autorização W/L e resumo quando necessário; preservar status usado por histórico arquivado. Não fazer migração em massa implicitamente.

## 7. Exemplos essenciais

Exemplos de leitura (IDs abreviados apenas para legibilidade; no HTTP usar UUIDs válidos):

```http
GET /api/v1/projects/p1/tasks?title=login&statusId=s1&rootOnly=true&offset=0&limit=25&sortBy=updatedAt&sortOrder=desc
GET /api/v1/projects/p1/tasks?parentId=t1&title=revisar&statusId=s1&offset=25&limit=25
GET /api/v1/workspaces/w1/projects?name=website&archived=false&offset=0&limit=50
GET /api/v1/tasks/t1/attachments?fileName=layout&mediaType=image%2Fpng&offset=0&limit=20
GET /api/v1/tasks/t1/timeline?types=comment.created,position.changed&occurredFrom=2026-10-27T00%3A00%3A00Z&occurredBefore=2026-10-28T00%3A00%3A00Z&offset=0&limit=50
```

Resposta quando offset ultrapassa o total autorizado/filtrado:

```json
{"items":[],"offset":100,"limit":25,"total":7,"hasMore":false,"nextOffset":null}
```

Para busca literal de `100%`, enviar `title=100%25`; codificação URL não transforma o percentual em wildcard.

Criar projeto (proprietário): `POST /api/v1/workspaces/w1/projects` com Bearer e Idempotency-Key:

```json
{"name":"Website Bee Team","description":"Primeira entrega","teamIds":["team1"]}
```

Resposta 201: Project `p1`, `version: 1`, mais `statuses` contendo os cinco status iniciais e IDs gerados. Consultas posteriores usam `/statuses`.

Criar tarefa (líder autenticado do team1): `POST /api/v1/projects/p1/tasks`:

```json
{"title":"Criar página inicial","description":"Implementar a página aprovada","teamId":"team1","assigneeId":"agent1","statusId":"todo1","coordinationContext":{"mode":"approval","conversationRef":"chat-42","approvalRef":"message-18"}}
```

Resposta 201 (campos principais):

```json
{"id":"t1","projectId":"p1","teamId":"team1","parentId":null,"title":"Criar página inicial","assigneeId":"agent1","statusId":"todo1","progress":{"percent":0,"note":""},"block":{"blocked":false,"reason":null},"childSummary":{"total":0,"done":0},"version":1,"updatedAt":"2026-10-27T18:00:00Z"}
```

Criar subtarefa: mesmo POST, `parentId: "t1"`, título "Revisar acessibilidade", `teamId: "team1"`, `assigneeId: "agent2"` e contexto de coordenação. Usar `If-Match` atual do pai. Agent1 não pode alterar essa subtarefa; agent2 pode, assim como o líder do team1.

Salvar planejamento em `POST /tasks/t1/plans`:

```json
{"title":"Plano de implementação","content":"1. Estruturar conteúdo\n2. Implementar layout\n3. Conferir acessibilidade"}
```

Resposta 201 contém `planId: "plan1", revision: 1`. Outro POST `/plans` cria outro planejamento; POST `/plans/plan1/revisions` com `{ "content": "Plano revisado...", "changeSummary": "Incluída revisão mobile", "baseRevision": 1 }` preserva a versão anterior.

Mover: `PUT /tasks/t1/position` com `{ "statusId": "doing1", "beforeTaskId": null }`. Bloquear: `PUT /tasks/t1/block` com `{ "blocked": true, "reason": "Aguardando conteúdo do usuário" }`. Desbloquear: mesmo endpoint com `{ "blocked": false, "reason": null }`. Cada chamada usa ETag atual.

Comentar: `POST /tasks/t1/comments` com `{ "body": "Layout disponível para revisão." }`. Upload: `POST /tasks/t1/attachments`, multipart `file=<bytes de layout.png>` e `description=Prévia`; resposta inclui `id: "file1"`. Para subtarefa, trocar apenas o taskId.

Encerrar atividade: `POST /tasks/t1/execution-summaries`:

```json
{"summary":"Página implementada e revisão concluída conforme orientação.","outcome":"completed","statusId":"done1","deliverables":[{"label":"Prévia da página","attachmentId":"file1"}],"pending":[],"reviewContext":{"reviewerType":"team_leader","conversationRef":"chat-42","instructionRef":"message-25"}}
```

Resposta 201 inclui o resumo com autoria derivada do token e a Task atualizada (`statusId: done1`, `progress.percent: 100`, nova version). Se ainda houver pendências, usar `outcome: progress`, status não final e preencher `pending`.

Sequência: proprietário cria projeto e configura participantes/status; líder registra planejamento acordado em tarefas e atribuições; executores consultam quadro, detalham planos, trabalham, comentam e enviam arquivos em suas tarefas; cada executor registra resumo ao encerrar; líder/usuário orienta revisão na conversa; painel lê quadro e timeline. Em todas as mutações de Task, buscar versão atual após uma mudança e usar retry idempotente para respostas perdidas.

## 8. Erros

```json
{"error":"Somente o responsável ou o líder do time pode alterar esta tarefa.","code":"task_write_forbidden","details":{}}
```

| HTTP | Codes e condição |
|---|---|
| 400 | `invalid_request`: JSON, UUID, offset/limit, filtro, ordenação, campo ou referência inválidos; intervalo invertido/igual, parâmetro repetido/desconhecido, status fora do projeto, pai incompatível, responsável fora do time |
| 401 | `unauthenticated`: token ausente, inválido, expirado ou revogado |
| 403 | `task_write_forbidden`, `project_admin_required`, `coordination_context_required`, `coordination_mode_mismatch` |
| 404 | `not_found`: inexistente ou fora do escopo de leitura; inclui arquivo removido |
| 409 | `archived_resource`, `status_in_use`, `team_in_use`, `summary_required`, `task_blocked`, `revision_conflict`, `idempotency_conflict`, `duplicate_status` |
| 412 / 428 | `version_conflict` / `version_required` |
| 413 / 415 | `payload_too_large` / `unsupported_media_type` |
| 500 / 503 | `internal_error` / `storage_unavailable`; sem detalhes de driver, token ou caminhos locais |

Um recurso legível mas não gravável retorna 403; recurso fora de leitura retorna 404 antes de revelar detalhes. Validações que dependem de dados protegidos vêm depois da autorização.

## 9. Plano incremental de implementação futura

Restrições globais: somente Kanban; sem CRUD de colaboradores; identidade/time/política precisam de registros confiáveis provisionados como pré-requisito. Nenhuma API de escrita protegida será liberada sem esse pré-requisito. Sem transcrições ou campos skills. Arquivos de código abaixo de 1000 linhas; SQLx com parâmetros e migrations; `route -> dto -> service -> repository -> service -> dto -> route`. PostgreSQL é proposta de continuidade da base, não decisão final de armazenamento do produto.

Mapa proposto: criar `src/dto/kanban/{projects,statuses,tasks,plans,activity,attachments,errors}.rs`, `src/routes/kanban/{mod,projects,statuses,tasks,activity,attachments}.rs`, `src/services/kanban/{mod,authorization,projects,statuses,tasks,activity,attachments}.rs`, `src/repositories/kanban/{mod,projects,statuses,tasks,activity,attachments}.rs`, `src/services/identity.rs`, `src/repositories/identity.rs` e `src/routes/auth.rs`. Atualizar os respectivos `mod.rs`, `src/state.rs`, `src/routes/mod.rs`, `src/error.rs` e depois `src/routes/mcp.rs`. DTOs não acessam banco; erros de domínio não dependem de HTTP; storage de arquivos via interface de repositório. Serviços recebem `ActorContext` verificado e interfaces de repositório, sem Request/StatusCode/MCP. Adotar `migrations/<timestamp>_kanban_*.sql`, sem schema inline.

Foco de revisão: tokens trocados/revogados; acesso cruzado entre times via filhos/anexos; retries e concorrência; uploads interrompidos/path traversal; arquivamento e referências históricas. Cada etapa abaixo inclui a validação correspondente. Comandos são para execução futura, não rodados neste pedido documental.

1. **Identidade e política** — criar contexto de ator e interfaces `IdentityRepository.resolve_token` e `KanbanAuthorization.require_read/require_write/require_leader`. Testes em `tests/kanban_authorization.rs`: token falsificado/revogado falha; agent1 não edita trabalho de agent2; líder só atua no próprio time; transferido perde W; UI somente leitura. Escrever testes falhando, implementar resolução/provisionamento confiável, executar `cargo test --test kanban_authorization`, revisar e comitar separadamente.
2. **Projetos e status** — DTOs/rotas/serviços/repositórios projects/statuses, migrations de projetos/participação/status e integração em AppState/OpenAPI. `tests/kanban_projects.rs`: isolamento de workspace, status inicial, reorder incompleto rejeitado, isDone/status em uso bloqueados, projeto arquivado somente leitura. Ciclo teste falhando → implementação mínima → `cargo test --test kanban_projects` → revisão/commit.
3. **Tarefas e quadro** — implementar CRUD limitado, atribuição, posição, bloqueio, filhos e consultas paginadas; interfaces `TaskService.create/update/assign/move/block/get/list/board`, entradas DTO + ator e versão. `tests/kanban_tasks.rs`: checklist derivado, ciclo/projeto/time inválidos, filho de outro responsável, pai concluído com filho aberto, filtros e totais sem vazamento, offset além do total, busca literal de `%`/`_`/`\`, ranges e sort inválidos rejeitados, filtros equivalentes em subtarefas, todas as colunas presentes e continuação de cards com ordem equivalente, conflito ETag, reorder concorrente e arquivo histórico preservado ao arquivar. Ciclo teste falhando → implementação → `cargo test --test kanban_tasks` → revisão/commit.
4. **Atividades e finalização** — planos/revisões, comentários, resumos e eventos transacionais; `ActivityService.add_plan/revise_plan/comment/record_execution/timeline`. `tests/kanban_activity.rs`: duas revisões concorrentes não sobrescrevem, resumo obrigatório para conclusão, bloqueio impede concluir, idempotência não duplica evento, timeline de filhos mantém autor/taskId. Testar falha de transação sem mudança parcial; depois implementar e rodar `cargo test --test kanban_activity`, revisar/comitar.
5. **Arquivos** — `AttachmentService.upload/download/remove` consome identidade/autorização e interface `AttachmentStorage`; streaming fica no adaptador HTTP, metadados/auditoria no serviço. `tests/kanban_attachments.rs`: limites, upload interrompido, nome com traversal, acesso cross-task e remoção/retry sem download residual. Implementar após testes falhando, rodar `cargo test --test kanban_attachments`, revisar/comitar.
6. **MCP e documentação** — expor tools equivalentes aos casos de uso (ex.: `kanban_get_board`, `kanban_create_task`, `kanban_record_execution`) consumindo os mesmos DTOs/serviços e ator do transporte autenticado, nunca actorId livre em arguments. Arquivos binários usam HTTP autenticado; tools podem listar metadados/retornar caminho relativo de download, sem token na URL. `tests/kanban_mcp.rs` verifica mesma autorização e resultado que HTTP; nenhum fallback anônimo. Atualizar README/OpenAPI, rodar `cargo test --features mcp --test kanban_mcp`, `cargo build`, `cargo test`, `cargo test --features mcp` com PostgreSQL/Docker disponíveis; revisar/comitar só após verificação. Não criar UI operacional neste plano.

Antes da implementação, revisar principalmente: relação projeto/time proposta; estado e responsável próprios dos filhos; política de leitura; provisionamento de credenciais; aprovação conversacional auditada versus enforcement criptográfico; revisões append-only; limites e arquivamento. Nenhum desses detalhes técnicos deve ser apresentado como decisão já aprovada.
