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
