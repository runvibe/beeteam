# CatÃ¡logo MCP Bee Team

Implementado com **rmcp 2.0.0**, protocolo MCP 2025-11-25, Streamable HTTP stateless JSON.
Discovery real: `tools/list`, `resources/list`, `prompts/list`. [Schemas completos](mcp-catalog.json)
sÃ£o exportados do cÃ³digo do catÃ¡logo, nÃ£o uma proposta desconectada do servidor.

## Envelope das ferramentas simples

Os 55 nomes abaixo sÃ£o os operationId dos contratos, preservando inclusive
`listExecutionSummarys`. Todas chamam os mesmos serviÃ§os/DTOs de HTTP. NÃ£o hÃ¡ outro
modelo de autenticaÃ§Ã£o/permissÃµes no MCP.

Entrada: `params` contÃ©m IDs do path; `query` contÃ©m os filtros/paginaÃ§Ã£o tipados;
`body` contÃ©m o schema de request indicado na tabela. Escritas usam
`actor:{kind:"human"}` ou `{kind:"agent",id:"UUIDv7"}` declarados.
`expectedVersion` corresponde ao If-Match do alvo; `idempotencyKey` corresponde a
Idempotency-Key dos POST. Criar filho usa versÃ£o do pai; conteÃºdo da task usa versÃ£o
da task; cÃ³pia usa versÃ£o da origem e expectedTeamVersion no body. ComposiÃ§Ã£o recebe
expectedVersion por time no body. Uploads usam `upload:{name,mediaType,dataBase64}`;
metadados e limites passam pelos mesmos DTOs que o multipart HTTP. Download retorna
`{contentPath,notice}` para HTTP binÃ¡rio, sem caminhos do filesystem.

SaÃ­da normal: `{data,version,createdId}`; data Ã© o schema HTTP indicado abaixo e
version Ã© a entidade cujo ETag foi atualizado. DELETE de arquivo retorna metadados
do pai no MCP, embora HTTP responda 204. Os schemas de saÃ­da completos estÃ£o no JSON.
Erros de domÃ­nio retornam `isError:true`, conteÃºdo textual e structuredContent
`{error,code,details}`; falhas de protocolo sÃ£o JSON-RPC do SDK. NÃ£o hÃ¡401/403.
ValidaÃ§Ãµes incluem UUIDv7, campos desconhecidos, UTF-8, URLs, referÃªncias, versÃµes,
cardinalidades, arquivamento, origem da cadeia e estado de conclusÃ£o. Falhas nÃ£o
publicam escrita parcial. POST idempotente 24h; mesma chave com conteÃºdo divergente409.
Leituras nÃ£o iniciam atividade. ExclusÃµes sÃ£o lÃ³gicas e nÃ£o removem bytes fÃ­sicos.

| Tool | API equivalente | Efeito | Body | Data de saÃ­da |
|---|---|---|---|---|
| `createBoard` | POST `/api/v1/boards` | write | CreateBoard | BoardCreated |
| `listBoards` | GET `/api/v1/boards` | read | â€” | BoardPage |
| `getBoard` | GET `/api/v1/boards/{boardId}` | read | â€” | Board |
| `updateBoard` | PATCH `/api/v1/boards/{boardId}` | write | PatchBoard | Board |
| `listStatuses` | GET `/api/v1/boards/{boardId}/statuses` | read | â€” | StatusList |
| `createStatus` | POST `/api/v1/boards/{boardId}/statuses` | write | StatusInput | Status |
| `updateStatus` | PATCH `/api/v1/boards/{boardId}/statuses/{statusId}` | write | PatchStatus | Status |
| `orderStatuses` | PUT `/api/v1/boards/{boardId}/status-order` | write | StatusOrder | StatusOrderResult |
| `getBoardView` | GET `/api/v1/boards/{boardId}/view` | read | â€” | BoardView |
| `listTasks` | GET `/api/v1/boards/{boardId}/tasks` | read | â€” | TaskPage |
| `createTask` | POST `/api/v1/boards/{boardId}/tasks` | write | CreateTask | Task |
| `getTask` | GET `/api/v1/tasks/{taskId}` | read | â€” | Task |
| `updateTask` | PATCH `/api/v1/tasks/{taskId}` | write | PatchTask | Task |
| `assignTask` | PUT `/api/v1/tasks/{taskId}/assignment` | write | Assignment | Task |
| `moveTask` | PUT `/api/v1/tasks/{taskId}/position` | write | Position | Task |
| `blockTask` | PUT `/api/v1/tasks/{taskId}/block` | write | Block | Task |
| `listPlans` | GET `/api/v1/tasks/{taskId}/plans` | read | â€” | PlanRevisionPage |
| `createPlan` | POST `/api/v1/tasks/{taskId}/plans` | write | CreatePlan | PlanRevision |
| `listComments` | GET `/api/v1/tasks/{taskId}/comments` | read | â€” | CommentPage |
| `createComment` | POST `/api/v1/tasks/{taskId}/comments` | write | CreateComment | Comment |
| `listAttachments` | GET `/api/v1/tasks/{taskId}/attachments` | read | â€” | AttachmentPage |
| `createAttachment` | POST `/api/v1/tasks/{taskId}/attachments` | write | UploadAttachment | Attachment |
| `listExecutionSummarys` | GET `/api/v1/tasks/{taskId}/execution-summaries` | read | â€” | ExecutionSummaryPage |
| `createExecutionSummary` | POST `/api/v1/tasks/{taskId}/execution-summaries` | write | RecordExecution | ExecutionResult |
| `revisePlan` | POST `/api/v1/tasks/{taskId}/plans/{planId}/revisions` | write | RevisePlan | PlanRevision |
| `listPlanRevisions` | GET `/api/v1/tasks/{taskId}/plans/{planId}/revisions` | read | â€” | PlanRevisionPage |
| `downloadAttachment` | GET `/api/v1/tasks/{taskId}/attachments/{attachmentId}/content` | read | â€” | empty |
| `removeAttachment` | DELETE `/api/v1/tasks/{taskId}/attachments/{attachmentId}` | write | â€” | empty |
| `getTimeline` | GET `/api/v1/tasks/{taskId}/timeline` | read | â€” | EventPage |
| `archiveTask` | PUT `/api/v1/tasks/{taskId}/archive` | write | Archive | Task |
| `listAllTasks` | GET `/api/v1/tasks` | read | â€” | TaskPage |
| `createAgent` | POST `/api/v1/agents` | write | CreateAgent | Agent |
| `listAgents` | GET `/api/v1/agents` | read | â€” | AgentPage |
| `getAgent` | GET `/api/v1/agents/{agentId}` | read | â€” | Agent |
| `updateAgent` | PATCH `/api/v1/agents/{agentId}` | write | PatchAgent | Agent |
| `archiveAgent` | PUT `/api/v1/agents/{agentId}/archive` | write | Archive | Agent |
| `copyAgent` | POST `/api/v1/agents/{agentId}/copies` | write | CopyAgent | CopyResult |
| `uploadAgentImage` | POST `/api/v1/agents/{agentId}/image` | write | ImageUpload | Agent |
| `removeAgentImage` | DELETE `/api/v1/agents/{agentId}/image` | write | â€” | empty |
| `downloadAgentImage` | GET `/api/v1/agents/{agentId}/image/content` | read | â€” | empty |
| `createTeam` | POST `/api/v1/teams` | write | CreateTeam | Team |
| `listTeams` | GET `/api/v1/teams` | read | â€” | TeamPage |
| `getTeam` | GET `/api/v1/teams/{teamId}` | read | â€” | Team |
| `updateTeam` | PATCH `/api/v1/teams/{teamId}` | write | PatchTeam | Team |
| `archiveTeam` | PUT `/api/v1/teams/{teamId}/archive` | write | Archive | Team |
| `listTeamMembers` | GET `/api/v1/teams/{teamId}/members` | read | â€” | MemberPage |
| `changeTeamComposition` | POST `/api/v1/team-composition-changes` | write | ChangeComposition | CompositionResult |
| `createChatReference` | POST `/api/v1/agents/{agentId}/chat-references` | write | CreateChatReference | ChatReference |
| `listChatReferences` | GET `/api/v1/agents/{agentId}/chat-references` | read | â€” | ChatReferencePage |
| `updateChatReference` | PATCH `/api/v1/agents/{agentId}/chat-references/{chatReferenceId}` | write | PatchChatReference | ChatReference |
| `getResumptionContext` | GET `/api/v1/agents/{agentId}/resumption-context` | read | â€” | ResumeContext |
| `listAgentActivities` | GET `/api/v1/agents/{agentId}/activities` | read | â€” | ActivityLinkPage |

### Resolução por slug

| Tool | HTTP | Efeito | Entrada | Saída |
|---|---|---|---|---|
| `resolveAgentSlug` | GET `/api/v1/agents/by-slug/{slug}` | read | `params.slug` | SlugResolution |
| `resolveTeamSlug` | GET `/api/v1/teams/by-slug/{slug}` | read | `params.slug` | SlugResolution |
| `resolveTaskSlug` | GET `/api/v1/tasks/by-slug/{slug}` | read | `params.slug` | SlugResolution |

## Compostas

### prepare_execution â€” read

Entrada `{taskId,offset?,limit?}`; offset 0, limit 50, mÃ¡ximo100. Usa snapshot Ãºnico,
sem mutaÃ§Ã£o, aprovaÃ§Ã£o ou inÃ­cio de execuÃ§Ã£o. Retorna task, perfil do executor atual,
pÃ¡gina das revisÃµes atuais dos planos, pÃ¡gina de filhos diretos cross-board, Ãºltimo
resumo, pendÃªncias e executionContext derivado da raiz. offset/limit sÃ£o aplicados
Ã s pÃ¡ginas de planos e filhos; cada pÃ¡gina tem total/hasMore/nextOffset. Continuar
pelas tools simples quando necessÃ¡rio. NÃ£o presume que o executor esteja ativo.

### record_progress â€” write atÃ´mico

Entrada `{taskId,expectedVersion,actor,idempotencyKey,currentSummary?,progress?,block?,comment?,
subtaskUpdates?}`. Cada item de subtaskUpdates exige taskId e expectedVersion e pode
conter currentSummary/progress/block/comment. Enviar progress exige currentSummary não vazio no mesmo item; a síntese também pode ser atualizada sozinha. AtÃ©100 descendentes Ãºnicos reais; nÃ£o pode nomear a
prÃ³pria raiz nem outra cadeia. Todas versÃµes sÃ£o verificadas antes de aplicar o
conjunto. Exige ao menos uma alteraÃ§Ã£o. ComentÃ¡rio, andamento e bloqueio usam os
mesmos casos de uso de `createComment`, `updateTask`, `blockTask`, sem commits
intermediÃ¡rios. Checklist Ã© derivado do estado das tasks reais; nÃ£o aceita booleano
para concluir filho. SaÃ­da `{task,updatedTasks,notice}`. Falha em qualquer parte faz
rollback integral; replay nÃ£o duplica comentÃ¡rios/eventos.

### close_activity â€” write atÃ´mico

Entrada `{taskId,expectedVersion,actor,idempotencyKey,execution,block?,comment?}`.
execution usa RecordExecution: currentSummary, summary, outcome, statusId, deliverables, pending,
executionContext rootTaskId/originBoardId; progress/reviewContext opcionais.
Aplica bloco/comentÃ¡rio informados e registra execuÃ§Ã£o na mesma transaÃ§Ã£o.
NÃ£o obriga concluir: progress/blocked sÃ£o vÃ¡lidos em status nÃ£o final; completed
exige final sem bloqueio, resumo e arrays explÃ­citos. RevisÃ£o sÃ³ Ã© registrada quando
informada, sem etapa universal. NÃ£o fabrica aprovaÃ§Ã£o. SaÃ­da `{task,updatedTasks,notice}`.
Um erro de contexto/status apÃ³s comentÃ¡rio desfaz tambÃ©m o comentÃ¡rio.

As compostas nÃ£o alteram configs dos boards de destino nem propagam flag automÃ¡tica
do pai em origem standard. Manual/standard/automatic Ã© resolvido pelo board da raiz.
Os schemas exatos de todas entradas e saÃ­das constam no catÃ¡logo JSON.

## Tools de sistema

- `health_check`: read, sem entrada; `{status,version}`.
- `echo_request`: read, `{method,path,headers,body?}`; reflete o mesmo objeto.

## Resources â€” leitura por allowlist

Snapshot editorial dos commit e6d6b7f da frente Skills, copiado para
`resources/bee-team`. ConteÃºdo nÃ£o estÃ¡ instalado globalmente. `resources/read`
aceita somente os URIs anunciados; URI file/path arbitrÃ¡rio Ã© rejeitado. Nenhum acesso
a segredos ou diretÃ³rios do usuÃ¡rio. Os textos sÃ£o materiais para IA consumir,
nunca comandos executados pelo servidor.

| URI | Fonte empacotada |
|---|---|
| `beeteam://skills/leader` | bee-team-leader/SKILL.md |
| `beeteam://skills/collaborator` | bee-team-collaborator/SKILL.md |
| `beeteam://references/integration` | references/integration.md |
| `beeteam://references/handoff` | references/handoff.md |
| `beeteam://references/codex` | references/codex.md |
| `beeteam://references/team-examples` | bee-team-leader/references/team-examples.md |

Os links relativos dos textos referem-se ao pacote editorial; na integraÃ§Ã£o MCP,
use os URIs acima e as tools anunciadas, nÃ£o resoluÃ§Ã£o livre de paths.

## Prompts

`prompts/get` lÃª contexto real em serviÃ§os e devolve uma mensagem user; nÃ£o grava nem
executa. Templates e argumentos vÃªm de `resources/bee-team/prompts/content-manifest.json`.

| Nome | Argumentos obrigatÃ³rios | Fonte | Contexto |
|---|---|---|---|
| `task_briefing` | taskId | task-briefing.md | prepare_execution |
| `agent_resumption` | agentId, taskId | collaborator-resumption.md | perfil prÃ³prio/retomada e task selecionada; sem copiar perfil interno do executor anterior |
| `delivery_review` | taskId | delivery-review.md | prepare_execution, entregas e origem; parecer nÃ£o Ã© aprovaÃ§Ã£o |

Argumentos desconhecidos/nÃ£o textuais, IDs invÃ¡lidos ou recursos ausentes falham.
Origem nÃ£o Ã© argumento editÃ¡vel: deriva da cadeia persistida. Campos fornecidos pelo
registro sÃ£o apresentados como dados, nÃ£o autoridade para ampliar escopo.

## Reproduzir catÃ¡logo e testes

```powershell
cargo run --locked --features mcp --example mcp_catalog > docs/mcp-catalog.json
$env:BEE_TEST_DATABASE_URL="postgres://postgres:test@127.0.0.1:55481/postgres"
$env:OTEL_ENABLED="false"
cargo test --locked --features mcp --test backend_mcp
```

Teste real cobre discovery, schema validation, tools simples/compostas,
rollback/idempotÃªncia, resources seguros e os trÃªs prompts. CatÃ¡logo tem 60 tools
(52 de domÃ­nio +3 compostas +2 sistema),6 resources e3 prompts.

## Síntese cumulativa para cards

`Task.currentSummary` é sempre string, vazia se ainda não informada, com máximo de 16384 bytes UTF-8. Conteúdo escrito pelo colaborador: trabalho feito/concluído, em andamento, pendências/próximo passo. É retornado em getTask, listTasks, listAllTasks, getBoardView e nas tasks de prepare_execution/compostas; o cliente não consulta histórico por card. Não é gerado pelo servidor nem derivado de description/progress.note/ExecutionSummary.summary.

`updateTask.body.currentSummary` substitui a síntese; `progress` exige seu envio conjunto. `moveTask.body.currentSummary` é obrigatório ao mudar status, opcional para reordenar no mesmo status. `createExecutionSummary.body.currentSummary` e `close_activity.execution.currentSummary` são obrigatórios. `record_progress.currentSummary` e `subtaskUpdates[].currentSummary` seguem a regra de progress por task. Escritas não aceitam vazio, null ou só espaços; omissão administrativa preserva o valor. O histórico anterior permanece na timeline. RecordExecution.summary continua descrevendo aquela atividade, não a síntese atual.

## Especificação própria e Markdown

`Task.specification` é texto Markdown (máximo 65536 bytes UTF-8), sempre presente em leitura/listagem/quadro/contexto MCP. Criação aceita campo opcional, com padrão `""`; PATCH aceita substituição integral, inclusive `""` para limpar. Null/tipo incorreto/excesso de bytes são rejeitados. Migration005 preenche legadas/tombstones sem inventar conteúdo, preservando as especificações existentes.

Especificação define entrega, requisitos, regras e critérios de aceite. `description` apresenta a tarefa, `PlanRevision.content` descreve execução versionada, `currentSummary` relata estado cumulativo atual. Nenhum substitui o outro. Alteração apenas de specification é administrativa e não exige currentSummary; progress conjunto mantém sua exigência. Timeline mantém antes/depois via task.updated. Replays legados recebem vazio explícito no snapshot, mantendo versão e conteúdo anterior.

Especificações e planos/revisões conservam o texto recebido, incluindo Markdown, Unicode, quebras de linha e trechos de código/HTML literais. O backend não renderiza HTML, executa ou transforma conteúdo. Planos continuam com content Markdown limitado a 65536 bytes, revisões imutáveis e conflitos baseRevision existentes. Sem nova entidade ou versionamento exclusivo de especificação. Clientes devem tratar conteúdo como dados e renderizar com segurança quando necessário.

## Slugs de agentes, times e tasks

Agent.slug, Team.slug e Task.slug (incluindo subtasks) são gerados, sempre presentes e não editáveis. UUIDv7 permanece identidade interna e parâmetro das APIs existentes. Boards não possuem slug. Resolvers GET /api/v1/agents/by-slug/{slug}, /teams/by-slug/{slug}, /tasks/by-slug/{slug} retornam {id,slug}; no MCP: resolveAgentSlug/resolveTeamSlug/resolveTaskSlug com params.slug. Usar o UUID retornado nas APIs/prompts seguintes; não enviar slug onde se exige UUID. Retorno404 para ausente/excluído; arquivados continuam resolvendo. Formato inválido ou não canônico retorna400; não há redirect/normalização implícita no resolver.

Normalização única no PostgreSQL: lowercase+NFKD, remoção de marcas combinantes U+0300..036F, ß/æ/œ para ss/ae/oe, demais caracteres fora de a-z0-9 viram separador, hifens colapsados/sem bordas. Nomes sem caracteres úteis usam agent/team/task; não há transliteração universal de alfabetos não latinos. Máximo80 caracteres ASCII, truncando base para caber sufixos -2,-3... . Reservados new/edit/create/by-slug/resolve/search/archive/settings/api/mcp/agents/teams/tasks e strings em formato UUID recebem prefixo agent-/team-/task-.

Slugs são estáveis ao renomear e únicos por tipo, inclusive archived/deleted. Excluídos nunca liberam o nome para outra identidade; cópia cria novo slug. Migration006 usa created_at,id para backfill determinístico, incluindo tombstones sem alterar conteúdo prévio, versão ou datas. Coluna gerada/index único/trigger de imutabilidade e lock transacional coordenam concorrência. Resolvers consultam índice diretamente, sem snapshot completo ou enumeração de listas. A geração e o backfill compartilham a mesma função SQL, sem algoritmos divergentes.

Replays históricos sem slug ganham o slug canônico imutável do registro correspondente, inclusive tombstones; conservam a versão e demais campos do snapshot original. Não se reconstrói slug pelo nome antigo nem atual. Sem auth/políticas novas; alteração visual/integração frontend não validada nesta frente.

## Workflows completos — snapshot e6d6b7f

O catálogo atual anuncia 13 resources; esta seção substitui contagens históricas acima e nos textos editoriais preservados. Os seis URIs anteriores permanecem. Novos URIs:

- `beeteam://references/leader-onboarding-flows`
- `beeteam://references/collaborator-workflow`
- `beeteam://references/mcp-content`
- `beeteam://references/task-briefing`
- `beeteam://references/collaborator-resumption`
- `beeteam://references/delivery-review`
- `beeteam://references/content-manifest`

Links Markdown relativos são mapeados pelo nome do arquivo sem extensão para `beeteam://references/{nome}`; ignore fragmento de seção ao ler o resource. Assim `references/leader-onboarding-flows.md` e `prompts/task-briefing.md` são resolvidos pela allowlist anunciada. O conteúdo permanece igual ao snapshot; Mermaid é texto, não executado. Os templates também continuam disponíveis pelos três prompts parametrizados read-only. PROGRESS, validation e README não são recursos. Nenhum filesystem arbitrário é exposto.


### Local SQLite startup guidance (2026-10-28)

The bundled Codex reference preserves the e6d6b7f editorial baseline with a local
update matching DATABASE_DRIVER selection, independent SQLite storage and
driver-aware readiness. The repository source and bundled copy match; this does
not update installed global skills or personal MCP configuration.

## Current snapshot — 8ab75d1 (2026-10-29)

Supersedes the historical snapshot descriptions above. Ten approved materials from `8ab75d1c422c41a1a66ca82166c209063c50d760` are bundled, including both entrypoints, handoff, Codex, both workflows, team examples and all three prompts. `resources/bee-team/provenance.json` records source and bundled SHA-256 hashes; only Codex has a local overlay preserving three existing driver-aware startup/readiness paragraphs for SQLite. The remaining integration, mcp-content and content-manifest resources are unchanged. The manifest is build provenance, not an additional MCP filesystem resource.

The 13-resource allowlist and three read-only prompt names/arguments are unchanged. Relative links remain resolvable through their listed reference basename. Task records carry questions, answers, decisions, scope changes, blockers and deliveries; authorized chat notifications carry only persisted references and change type. Identity activation remains possible without a task. Persistence failures, repeated notifications and harness permissions cannot authorize execution or notification loops. This is a compiled package update, not evidence of activation in an existing runtime.

Links ending in `bee-team-leader/SKILL.md` or `bee-team-collaborator/SKILL.md` map to `beeteam://skills/leader` and `beeteam://skills/collaborator`, respectively, rather than a references/SKILL URI.

## Leader chat title snapshot — 2026-10-30

Bundled MCP materials now incorporate Skills commit `98e0428dceec64ea74d86c6a8d4ed27ce3a14f08`: a confirmed Leader uses a single 👑 prefix in its own chat title, preserving useful context. Agent/team names and slugs, Collaborator chats and other chats are unchanged. Existing task-authoritative communication and the local SQLite startup overlay are preserved. The resource allowlist and prompt contracts are unchanged; provenance hashes are in `resources/bee-team/provenance.json`. This updates source materials only: no active service, deployed executable or global installation is changed by this synchronization. Runtime activation remains pending.

Validation for this snapshot: source/bundle SHA-256 and all relative resource links checked; `cargo build --locked --features mcp --lib -j 1` passed; `cargo test --locked --features mcp -j 1` passed all 87 tests with isolated PostgreSQL on 55481. The MCP integration regression first failed against the old provenance, then passed with served-resource hashes checked. Catalog regenerated via the required `mcp_catalog` example. No release artifact was generated or replaced, no active runtime was restarted, and no data/global skill installation was changed.

## Both chat role marks — 2026-10-30

Current bundled source `e73c21be0263374a26ce5ea5e655e185e7cdfea2` supersedes the earlier Leader-only rule: Leader uses 👑 and Collaborator uses 🐝 from skill activation, including existing chats and role switches. Initial role marks are replaced/normalized rather than accumulated; useful title context is preserved, and normalized discovery does not establish identity. Only chat titles are affected; agent/team names, slugs and Bee Team data are unchanged. Task-authoritative communication and the three local SQLite startup/readiness paragraphs remain intact. The 13-resource allowlist and three prompt contracts are unchanged. This is a source snapshot update; no running service or release executable is updated here, so runtime activation remains pending.

Validation of the both-role snapshot: source/bundle hashes and relative resource links verified; the previous Leader-only restriction is absent from bundled materials. Library build and the full MCP-enabled Rust suite passed with one job: 87 tests using isolated PostgreSQL on 55481, including served resource hashes and prompt checks. The provenance regression failed against the old snapshot before synchronization. Catalog regenerated with the required example. No release build/replacement, service restart, data change, chat rename or global installation was performed; runtime activation is pending.

## Exact comment lookup (2026-10-30)

MCP `getComment` takes `{"params":{"taskId":"UUIDv7","commentId":"UUIDv7"}}`; HTTP parity is `GET /api/v1/tasks/{taskId}/comments/{commentId}`. No actor, expectedVersion or idempotency key is required for this read. Both IDs are required and membership is checked inside the shared service. Repositories hydrate the requested comment by primary key within the existing read snapshot, without paginating comments.

MCP success uses `structuredContent: {data: Comment, version: 1, createdId: null}` (version is the stored comment version). HTTP returns Comment directly. Comment fields are id, taskId, body, actorId, actorKind, createdAt and deletedAt. Content and authorship are returned unchanged. Missing/deleted task or comment and mismatched task membership all return HTTP 404 / MCP isError=true with `{code:"not_found",error:"Resource not found",details:{}}`. Invalid UUIDv7 input returns invalid_request / HTTP 400.

`createComment` returns the real ID in `data.id` and `createdId`; its envelope version is the updated task version. New `record_progress` and `close_activity` responses additionally return `createdComments: [{taskId,commentId}]`, including explicitly updated descendants. Empty means no comments were created. Exact idempotent replay preserves these receipts. Older saved replay snapshots may omit createdComments; no IDs are inferred or fabricated. The output schema keeps this field optional for legacy replay compatibility. If an old replay lacks the receipt needed for notification, obtain a separately authorized new comment with its returned ID; do not infer an ID from list order.

Publish the full comment before notifying another chat. Notifications carry task ID, changed areas/relevant status and the actual comment ID. The receiver reads that exact comment and current task before acting. The bundled Skills source remains at its existing provenance commit until the final coordinated Skills snapshot arrives; this backend contract does not claim those resources have been refreshed.

Activation: align and bundle the final Skills snapshot and hashes first, regenerate the MCP catalog, build a new distribution in isolation, then coordinate replacement/restart of the SQLite 59865 server. Refresh client tool discovery and verify read-only getComment against an existing task/comment pair. This change does not restart the server or write product data.

Final coordinated Skills snapshot: `23b8bdf730802e447b4536c59df7b4ce73ef957d`; 11 canonical materials refreshed, with the three established SQLite startup/readiness paragraphs retained in the Codex reference. SHA-256 source/bundled provenance records every file. This supersedes the earlier pending-snapshot note.

## Comment author and literal text filters (2026-10-30)

`GET /api/v1/tasks/{taskId}/comments` and MCP `listComments` accept optional `actorKind=human|agent`, `actorId=UUIDv7`, and `text=substring`. Example MCP arguments: `{"params":{"taskId":"UUIDv7"},"query":{"actorKind":"agent","actorId":"UUIDv7","text":"Palette","limit":20,"offset":0}}`. Existing date, ordering and pagination options remain available. Distinct filters combine with AND. Humans have null actorId: select them with actorKind=human alone. Combining human with an existing agent actorId returns no results; actorId keeps its existing UUID/existence validation.

`text` matches a literal substring of the complete stored Markdown body, including Markdown punctuation. It is case-sensitive and accent-sensitive, does not trim or normalize, and is limited to 1024 characters / 4096 UTF-8 bytes. Empty text applies no restriction. `%`, `_`, backslash, regex syntax and SQL punctuation are literal characters, not patterns. Bound `strpos` (PostgreSQL) / `instr` (SQLite) predicates provide identical literal matching without LIKE wildcard interpolation or escaping ambiguity. No embeddings, semantic search, Markdown rendering or client-side-only filtering is used.

Filtering occurs in the repository snapshot before count/order/limit/offset. The response remains CommentPage: items, total, offset, limit, hasMore, nextOffset. Existing createdAt/id ordering and direction remain unchanged. Each request has its own read snapshot; concurrent writes can still shift offset pages between requests. No comment content, authorship or ID is modified. The same OpenAPI validation generates the HTTP and typed MCP query contracts. Invalid kind, malformed ID, oversized text, NUL characters, repeated or unknown parameters return invalid_request/400.

This source change requires a new runtime artifact and manual activation to become available on an older running server. It does not replace or restart the SQLite 59865 process.

## Task-scoped participants (2026-10-30)

`GET /api/v1/tasks/{taskId}/participants` and MCP `listTaskParticipants` return a distinct participant page (`items`, `total`, `offset`, `limit`, `hasMore`, `nextOffset`). MCP arguments: `{"params":{"taskId":"UUIDv7"},"query":{"offset":0,"limit":100}}`. Only offset/limit are accepted; the endpoint is independent of comment filters or loaded comment pages. UI clients paginate this smaller participant collection until hasMore=false, never enumerate the global agent catalog or scan comment pages.

Each item has `actorKind`, nullable `actorId`, nullable `agentName`, `agentArchived` and `agentDeleted`. The exact task contributes its current author/executor, authors recorded on comments, plan revisions, attachments, execution summaries and timeline events, plus original author/executor and previous/new executors recorded by creation/assignment events. Sources are non-deleted records; retained timeline events preserve participation even if an attachment/comment was removed. Descendants, unrelated tasks and other team members are excluded. No identity is inferred from text, names, chat content or a team roster.

Humans are one aggregate `actorKind=human, actorId=null, agentName=null`, because the model does not identify individual humans. Agent profile names and archived/deleted flags are current metadata, not historical name/role snapshots. A missing profile leaves agentName null; clients can display the recorded UUID. Deleted/archived agents are not silently removed from genuine historical participation. A participant may have no currently visible comments, so selecting that participant in the author filter can legitimately return zero comments.

Repositories aggregate the complete task-scoped set and count it before pagination in the existing read-only snapshot. Ordering is stable by actorKind then actorId; distinctness is the pair, not a name. Maximum page size remains 100 (default 50). Missing/deleted task returns 404/not_found; unknown filters or invalid pagination return 400/invalid_request. No migrations, content changes, new human identities, task writes or runtime restart are performed by this read feature.

Historical author filtering: listComments.actorId validates UUID syntax but does not require a live agent profile; recorded authors remain selectable after profile deletion. A valid unknown UUID returns an empty comment page. This supersedes the earlier actorId profile-existence requirement for listComments only.

## Task overview snapshot (2026-10-30)

`GET /api/v1/tasks/{taskId}/overview` / MCP `getTaskOverview` (`{"params":{"taskId":"UUIDv7"}}`) returns the current Task plus complete SQL aggregates of non-deleted DIRECT children across boards, including archived children. `directSubtasks` provides total/done/remaining and a separate blocked count (blocked is an overlapping property, not another status bucket), byStatus keyed by board/status IDs with current names and isDone, and byExecutor with total/done/remaining. Executor distribution means current assignment, never productivity or who historically performed the work. No status color exists in the model, so color is null.

The current task progress remains independent of child completion. `progressHistory` contains only explicitly recorded `task.updated` progress values, ordered from oldest to newest within the latest 100 matching events, with exact event ID, occurredAt, actor metadata and source. total/limit/truncated and coverage=explicit_progress_events_only are explicit. Task creation defaults, derived child ratios and older execution-summary progress are NOT reconstructed into points: legacy closure events did not store that progress. Consequently the latest historical point can differ from the current task progress. Follow the existing task timeline for older records; there is no claim of a complete continuous series.

`currentSummaryMeta` identifies the latest explicit synthesis event only when its stored text matches the current task synthesis; otherwise null. It never substitutes task.updatedAt or infers an author. `latestExecutionSummary` is the actual stored latest record or null, including its dated pending array. Pending items are from that record, not a claim that every item remains unresolved today. nextStep is null and decisions is empty because no dedicated structured sources exist for them.

`latestDeliverables` aggregates delivery entries across ALL non-deleted summaries and returns the latest 10 (summary creation/id descending, then entry ordinal descending), with summary ID/time/actor and original nested Deliverable; source attachmentId or URL is preserved without fabrication. `latestAttachments` returns the latest 5 non-deleted attachments; `recentEvents` the latest 20 exact-task timeline events. Each collection has items/total/limit/truncated. The dedicated attachment, summary and timeline endpoints remain available for deeper pagination. Empty data is []/null, not synthetic activity.

All queries share the repository-owned read-only snapshot. The overview read hydrates ancestry/context, not all child task bodies; counts and grouping are SQL over the complete direct-child set. Actor metadata is declared, not authentication. No product writes, migrations, new demo data or restart are performed. Frontend drilldowns use GET /tasks with parentId and includeArchived=true plus statusId, blocked or executorAgentId, retaining cross-board children.

## Optional summary usage checkpoints (2026-10-31)

The source catalog now contains 71 tools and 14 bundled resources. Optional
`RecordExecution.usageReport` is shared by `createExecutionSummary` and
`close_activity.execution`; omission/null still saves a normal summary.
`getTaskUsage` reads SQL totals and summary checkpoints, and
`listTaskUsageDimensions` pages every reported model/harness. Overview includes
the same usage read model. `reconcileSummaryUsage` appends late evidence using
the execution summary's expectedVersion, preserving task state and Markdown.

Snapshots are explicit baselines/deltas, never additive raw cumulative totals.
Stable repeated evidence contributes once; shared/tree/unallocated evidence is
not counted as exact task consumption. Missing is not zero; estimated totals
are separate. See [summary usage contracts](summary-usage.md) for the fields,
coverage, provenance and bounded reconciliation rules.

Bundled Skills source: `868ff91e09669ab7a13aa0aef86c8bd6eb695d91`.
The new allowlisted resource `beeteam://references/usage-report` requires
proportional discovery and a fresh collection attempt per genuine summary,
without blocking summary persistence when collection fails. No resource grants
arbitrary filesystem access or installs a collector. Runtime activation remains
a separate operator action.

## Required usage on new summaries — 2026-10-31

This supersedes the optional-write guidance above. `createExecutionSummary.body`
and `close_activity.execution` require a non-null `usageReport` with 1..32 entries.
The MCP tool descriptions explain source/session discovery, actual harness/model
identity, decimal-string counters, inclusive cache/reasoning subsets, request
deltas, cumulative snapshots/baselines and explicit unavailable evidence. Missing,
null or empty reports fail with guidance to collect evidence or declare
`reportKind=quality=unavailable`, null counters and factual nonblank discovery
reason/attempts. No zero or model/session identity is fabricated.

Historical reads/transfer retain missing metrics. Exact saved legacy HTTP/MCP
and compound replays remain valid before current schema validation. New keys
must satisfy the new contract. See [summary usage](summary-usage.md).

## Collaborator bootstrap snapshot — 2026-11-02

Bootstrap snapshot: Skills `5fd5f0b280865609ab7de7a2770fefa092c21fd4`, 13 source
materials tracked in provenance, 15 allowlisted resources and 3 read-only prompts.
New URI: `beeteam://references/collaborator-bootstrap`. Creation of an authorized
chat precedes Collaborator self-registration; confirmed name/agentId/teamId and
ready/pending precede Leader verification and task assignment. Bootstrap-only
communication exemptions do not authorize business work or bypass harness policy.
Existing required usage declarations and local driver-aware startup overlays remain.
The standalone SQLite default is explicitly distinguished from the legacy local
startup script. Links for the new reference resolve through the MCP allowlist.

Validation: cargo build --locked --features mcp -j 1 passed; 24 unit tests and
2 SQLite MCP tests passed with BEE_TEST_DRIVER=sqlite and OTEL_ENABLED=false.
The PostgreSQL-only SDK compound test was excluded. Served resource hashes,
13-file provenance and explicit MCP links were verified. The catalog was regenerated
with cargo run --locked --features mcp --example mcp_catalog -j 1; git diff --check
passed. Runtime activation and PostgreSQL execution are not claimed.

## Status-summary contract — 2026-11-02

Current bundle: Skills `4d81ec1d6513fc4d67dc3b0186a6ef9b63e9b367` (13 source
materials, 15 resources, 3 prompts). Existing startup/bootstrap overlays remain.
Task status transitions require createExecutionSummary or close_activity with a
complete execution payload. moveTask only reorders within the current status;
status changes return summary_required (HTTP 409). updateTask rejects statusId
(HTTP 400), even unchanged; record_progress also excludes it. Percentage/progress
updates remain independent. Status initialization on task creation is unchanged.
Server-owned statusObserved captures the destination status id/name/isDone at
registration and is never rehydrated from the current status, including on late
usage reconciliation. Exact saved POST replays retain their historical response;
PUT position has no persisted replay mechanism and still enforces If-Match.


### Earlier real usage guidance bundle — 2026-11-02

Bundled Skills source `88f3a44f6ad0c9dc07db817604144d7b176e3e10` requires actual
model/harness/agent/token/source evidence before a new summary, using the current
usageReport.entries payload. This is stricter skill guidance, not a new schema:
no tokenUsage/totalTokens field was added, and baseline-only snapshots are not
rejected merely for being initial. The user's decision on session cumulative
versus task-separated total remains pending. When reliable evidence is absent,
record the impediment through a comment rather than inventing usage or reporting
successful summary persistence. Existing SQLite startup/bootstrap overlays remain.

Validation of this bundle: 26 library and 2 SQLite MCP tests passed; the one
PostgreSQL-only SDK test was explicitly excluded (no isolated database configured).
Cargo build with mcp passed. Catalog regenerated (71 tools/15 resources/3 prompts),
13 source/bundle SHA256 pairs verified. No runtime restart, product data mutation
or global skill installation was performed by the backend bundle update.


## Current cumulative session requirement — 2026-11-02

The user chose actual cumulative session usage. createExecutionSummary and
close_activity.execution now use SessionUsageInput: each observation is measured,
cumulative_snapshot, scope session/session_tree, identified modelId and persisted
agent actor, with non-null totalTokens/inputTokens/outputTokens decimal integer
strings. totalTokens must equal inclusive input+output within int64; cache and
reasoning are subsets. First snapshot is accepted without a predecessor/delta.
The total describes source/session/epoch/actor/model through observedAt, not
exclusive task consumption. Separate disjoint counters; never add checkpoints
or duplicate tree/model/child coverage. General UsageObservation and late evidence
retain optional totals and legacy variants. Saved POST replays precede new-write
validation. Missing/unavailable/estimated evidence is not an alternative for a new
summary; explain collection failure in a comment. MCP descriptions include source
families and point collectors to version/surface-appropriate real telemetry.

Current bundled Skills source: `388415e855004317b367fe55f6df47d5d6993299`, aligned with the required cumulative session contract. Existing SQLite/bootstrap overlays are retained. See [verification](required-session-total-verification.md).

Final validation: 52 tests passed before bundle refresh; both SQLite MCP tests passed again after refresh. Cargo build with MCP passed. Regenerated catalog contains 71 tools, 15 resources and 3 prompts; all 13 source/bundle SHA256 pairs verified. PostgreSQL tests excluded as agreed; runtime unchanged.


## Explicit execution intervals — 2026-11-03

RecordExecution accepts optional executionTracking. Six read operations expose executions, intervals, explicit events, prior calculations, task totals and cross-task open recovery; reconcileTaskExecutionInterval provides versioned correction. close_activity returns executionSummary as an additive field, with unchanged historical replay behavior. See [contract](task-session-intervals-contract.md) and [verification](task-session-intervals-verification.md).

Catalog regenerated: 78 tools, 16 resources, 3 prompts. Bundled source631072a1da56265c0f1b1d062e20b61db732cda0 adds beeteam://references/execution-intervals; all14source/bundle hashes verified, existing SQLite/bootstrap overlays retained. 132distinct Rust tests passed plus10interval scenarios repeated on PostgreSQL; MCP build passed. Runtime unchanged.

### Structured repository evidence (2026-11-03)

Task workScope is optional; new createExecutionSummary/close_activity writes require commitReport with an explicit boolean and consistent reference list. The shared service snapshots repository metadata, validates branch/hash/link evidence and preserves absent legacy fields and saved replay responses. See [contract](summary-repository-contract.md). Catalog: 78 tools, 17 resources, 3 prompts. Skills bundle source 562c53ebb4559efe73cacc7efb490808b5c6d1b0 adds beeteam://references/repository-evidence; 15 source/bundle hashes are recorded, SQLite overlays retained. Product runtime is not changed by this bundle refresh.

### Mandatory project roots and Git discovery (2026-11-03)

CreateTask requires projects-only workScope; updateTask refreshes discovery when the explicit list is resubmitted with If-Match. Legacy specification edits require a project if absent; unrelated edits/read/replays are preserved. No-Git and unavailable folders remain valid projects. See [contract](project-discovery-contract.md). Bundled Skills source3265680f383f4645827b341fd95104fc97b00853. No product runtime restart.
