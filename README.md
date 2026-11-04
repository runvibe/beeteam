# Bee Team

Servidor local Rust para perfis/times de agentes e boards/tasks. A IA e o harness executam o trabalho; Bee Team guarda configuração, autoria declarada, planos, arquivos e resultados. Não cria chats nem acessa provedores de IA.

## Idiomas da interface

A interface está disponível em inglês e português. O modo automático usa português
quando o primeiro idioma preferido do navegador é `pt` ou `pt-*`; os demais usam
inglês. Inglês também é o fallback de traduções ausentes. Em **Configurações globais →
Idioma**, escolha automático, English ou Português. A preferência `auto/en/pt` fica
em `localStorage["bee-locale"]` e tem prioridade sobre o navegador; se o armazenamento
estiver indisponível, a escolha continua válida durante a sessão.

A troca é imediata, inclusive em outras abas da mesma origem, sem recarregar a
página, perder rascunhos ou alterar filtros/URLs. Datas, horários relativos,
números, contadores e plurais seguem o idioma. Nomes, status criados pelo usuário,
Markdown, resumos, identificadores e conteúdo externo são preservados.

Os catálogos e as regras para novas mensagens estão em
[Internacionalização e auditoria da interface](docs/frontend-i18n.md).
No diretório `frontend`, execute `npm run audit:i18n`, `npm test` e `npm run build`.

## Executar

O binário de distribuição inicia sem variáveis: SQLite em `~/.beeteam/beeteam.sql`,
`APP_HOST=127.0.0.1`, `APP_PORT=59865`, `MCP_ENABLED=true`, `OTEL_ENABLED=false` e UI
embutida habilitada. A home é resolvida pelo sistema; `.beeteam` só é criada ao
abrir a persistência. Nenhum banco anterior é movido, convertido ou resetado.

Para produzir o executável completo, use `node scripts/build-distribution.mjs`
(Rust >=1.94, Node/npm no build). Ele compila **mcp e embedded-ui** e verifica os
assets antes de embuti-los. Execute o binário copiado sem Node/Vite em runtime.
`cargo build`/`cargo run` comuns incluem MCP, mas são builds de desenvolvimento
sem UI; `--no-default-features` permite o build API-only sem MCP. A variável de
ambiente não pode habilitar uma feature ausente do binário.

Overrides e `.env` existente continuam válidos. `DATABASE_URL` explícita é usada
sem alteração; se o driver for omitido, uma URL PostgreSQL seleciona PostgreSQL
para preservar instalações existentes. `DATABASE_DRIVER=postgres` requer URL
explícita e PostgreSQL >=18. Driver e esquema divergentes falham. Use
`MCP_ENABLED=false` e/ou `BEE_FRONTEND_MODE=disabled` para desabilitar componentes,
ou `OTEL_ENABLED=true` para habilitar telemetria. Host, porta, CORS, limite de corpo
e caminhos MCP continuam configuráveis. Migrations rodam no startup.

Não há workspace, autenticação, login ou tokens. Escritas declaram `X-Actor-Kind: human`; agentes declaram `X-Actor-Kind: agent` e `X-Actor-Id` UUIDv7 cadastrado. Isso é auditoria declarada, não identidade verificada. Política de edição pelo líder via executor gerido continua pendente e não foi transformada em bloqueio presumido.

## API e MCP

- `/health` e `/echo`: endpoints originais preservados.
- `/docs`: Swagger com os documentos System, Kanban e RA.
- `/openapi.json`: sistema; `/openapi/kanban.json` e `/openapi/ra.json`: contratos de domínio.
- `/api/v1`: 32 operações Kanban e 23 RA, sem prefixo workspace.
- `/mcp`: SDK **rmcp 2.0.0**, Streamable HTTP stateless JSON, protocolo 2025-11-25.

[Catálogo MCP](docs/mcp-catalog.md): 55 tools equivalentes às APIs, 3 compostas (`prepare_execution`, `record_progress`, `close_activity`) e 2 tools de sistema. Schemas de entrada/saída completos estão no [catálogo JSON](docs/mcp-catalog.json), exportado do mesmo código de `tools/list`. Skills são resources com allowlist; prompts usam templates Bee Team empacotados, sem instalação global ou execução automática.

Primeiro crie agentes por `POST /api/v1/agents`, depois um time com líder e um board com `teamId` gestor. POST requer `Idempotency-Key` UUID; versões individuais usam ETag/`If-Match: "N"`. Há exemplos completos nos [contratos Kanban](docs/kanban-openapi.yaml) e [RA](docs/ra-openapi.yaml). A descrição histórica de revisão/pausa nos documentos não substitui o estado de implementação registrado aqui.

## Modelo

Cada board tem um time gestor transferível e criador preservado. Um time pode gerir vários boards. Tasks têm autor e executor obrigatórios, sem time próprio. Subtasks são tasks recursivas com `parentId`, inclusive entre boards e executores distintos. Não existe endpoint de reparenting.

O board da raiz governa o contexto de execução: `manual` força manual; `automatic` força automático; `standard` considera somente `autonomyMode` da task atual. Modo do board de destino e flag do pai não substituem essa regra. Mudança do modo de origem invalida versões das tasks afetadas sem alterar suas flags individuais.

Perfil é único; cada agente pode liderar um time e colaborar em outro. Transferir agente não reatribui tasks nem copia contexto interno. Arquivar time preserva vínculos e permite transferência explícita. Arquivar agente exige ausência de vínculos e tasks não finais atribuídas. Cópia cria nova identidade; `contextSummary` só é copiado quando explicitamente fornecido.

Todos IDs novos persistidos são UUIDv7. Exclusões são lógicas (`deleted_at`/`deletedAt`); arquivos e registros permanecem no banco. `archivedAt` é separado e reversível. Registros históricos mantêm suas referências. Todas listagens usam offset/limit, filtros antes do total e ordenação estável.

## Testes

```powershell
# Banco PostgreSQL 18 exclusivo de testes, nunca um banco de trabalho.
$env:BEE_TEST_DATABASE_URL="postgres://postgres:test@127.0.0.1:55481/postgres"
$env:OTEL_ENABLED="false"
cargo build --locked
cargo test --locked
cargo build --locked --features mcp
cargo test --locked --features mcp
```

Os novos testes HTTP/MCP criam bancos isolados de nomes aleatórios na instância de teste (usuário precisa de CREATEDB). O teste de persistência e testes originais usam o banco indicado. Sem `BEE_TEST_DATABASE_URL`, testes originais/persistência tentam Testcontainers; no Windows, uma CLI Docker que chama WSL não fornece automaticamente um socket compatível ao SDK nativo. A URL explícita evita essa dependência. Nenhum teste faz trabalho de produto real.

[Implementação e integração](docs/backend-implementation.md), [acompanhamento](docs/backend-progress.md). A integração local com o frontend usa API59865, PostgreSQL dedicado55482 e proxy Vite5173. Veja [iniciar e validar o preview real](docs/local-integration.md); o QA visual da frente frontend e a confirmação PostgreSQL/proxy estão registrados no runbook.

### Resumo atual nos cards

Todas as tasks/subtasks expõem `currentSummary`, síntese cumulativa fornecida pelo colaborador (feito, andamento e pendências/próximo passo), separada da descrição e dos registros históricos. Ausência inicial/legada é `""`; o backend não inventa texto. Progresso e mudança de status exigem síntese não vazia; edições administrativas a preservam. `record_progress` aceita `currentSummary` por task; `close_activity` exige `execution.currentSummary`, com transação/idempotência compartilhadas. Listagens e quadro já incluem o campo, sem consulta de histórico por card. Regras e exemplos: [catálogo MCP](docs/mcp-catalog.md) e [contrato Kanban](docs/kanban-openapi.yaml).

## Especificação própria e Markdown

`Task.specification` é texto Markdown (máximo 65536 bytes UTF-8), sempre presente em leitura/listagem/quadro/contexto MCP. Criação aceita campo opcional, com padrão `""`; PATCH aceita substituição integral, inclusive `""` para limpar. Null/tipo incorreto/excesso de bytes são rejeitados. Migration005 preenche legadas/tombstones sem inventar conteúdo, preservando as especificações existentes.

Especificação define entrega, requisitos, regras e critérios de aceite. `description` apresenta a tarefa, `PlanRevision.content` descreve execução versionada, `currentSummary` relata estado cumulativo atual. Nenhum substitui o outro. Alteração apenas de specification é administrativa e não exige currentSummary; progress conjunto mantém sua exigência. Timeline mantém antes/depois via task.updated. Replays legados recebem vazio explícito no snapshot, mantendo versão e conteúdo anterior.

Especificações e planos/revisões conservam o texto recebido, incluindo Markdown, Unicode, quebras de linha e trechos de código/HTML literais. O backend não renderiza HTML, executa ou transforma conteúdo. Planos continuam com content Markdown limitado a 65536 bytes, revisões imutáveis e conflitos baseRevision existentes. Sem nova entidade ou versionamento exclusivo de especificação. Clientes devem tratar conteúdo como dados e renderizar com segurança quando necessário.

## Slugs de agentes, times e tasks

Agent.slug, Team.slug e Task.slug (incluindo subtasks) são gerados, sempre presentes e não editáveis. UUIDv7 permanece identidade interna e parâmetro das APIs existentes. Boards não possuem slug. Resolvers GET /api/v1/agents/by-slug/{slug}, /teams/by-slug/{slug}, /tasks/by-slug/{slug} retornam {id,slug}; no MCP: resolveAgentSlug/resolveTeamSlug/resolveTaskSlug com params.slug. Usar o UUID retornado nas APIs/prompts seguintes; não enviar slug onde se exige UUID. Retorno404 para ausente/excluído; arquivados continuam resolvendo. Formato inválido ou não canônico retorna400; não há redirect/normalização implícita no resolver.

Normalização única no PostgreSQL: lowercase+NFKD, remoção de marcas combinantes U+0300..036F, ß/æ/œ para ss/ae/oe, demais caracteres fora de a-z0-9 viram separador, hifens colapsados/sem bordas. Nomes sem caracteres úteis usam agent/team/task; não há transliteração universal de alfabetos não latinos. Máximo80 caracteres ASCII, truncando base para caber sufixos -2,-3... . Reservados new/edit/create/by-slug/resolve/search/archive/settings/api/mcp/agents/teams/tasks e strings em formato UUID recebem prefixo agent-/team-/task-.

Slugs são estáveis ao renomear e únicos por tipo, inclusive archived/deleted. Excluídos nunca liberam o nome para outra identidade; cópia cria novo slug. Migration006 usa created_at,id para backfill determinístico, incluindo tombstones sem alterar conteúdo prévio, versão ou datas. Coluna gerada/index único/trigger de imutabilidade e lock transacional coordenam concorrência. Resolvers consultam índice diretamente, sem snapshot completo ou enumeração de listas. A geração e o backfill compartilham a mesma função SQL, sem algoritmos divergentes.

Replays históricos sem slug ganham o slug canônico imutável do registro correspondente, inclusive tombstones; conservam a versão e demais campos do snapshot original. Não se reconstrói slug pelo nome antigo nem atual. Sem auth/políticas novas; alteração visual/integração frontend não validada nesta frente.

A inicialização local reutiliza armazenamento existente e não requer bootstrap. O [runbook local](docs/local-integration.md) separa API, painel, readiness MCP e fixtures opcionais; conteúdo bundled atualizado exige build e reinício coordenado para aparecer no servidor ativo.

## Atualização MCP local — Skills 88ad469

Snapshot editorial do commit `88ad46936bbbb9b0d7e50b9e1847b77d9b73c633` sincronizado em oito arquivos bundled; catálogo e teste de proveniência atualizados. Build MCP e39 testes Rust aprovados em PostgreSQL isolado. Em27/10/2026, somente a API identificada foi reiniciada após backup do binário anterior; frontend e banco permaneceram ativos. Runtime novo PID12032: health aprovado, seis resources/read iguais aos arquivos empacotados, três prompts/get renderizados e60 ferramentas anunciadas. Boards/tasks/agents/teams permaneceram exatamente iguais nas leituras antes/depois e no proxy5173. Nenhum seed/reset ou alteração de negócio. Backup local ignorado `.local/api-runtime/beeteam-before-88ad469.exe` preservado para rollback; rollback não precisou ser executado. Esta verificação de atualização não demonstra instalação fria em outra máquina nem substitui QA visual de todos os fluxos.

## Onboarding MCP — Skills 8d8ed82

Snapshot `8d8ed82793e7bc225c5dcbb0e6c3c0709c7df27a` sincronizado: líder, colaborador, codex, integration e team-examples; prompts/handoff preservados. Inclui instruções de primeira conexão e endereços confirmados, sem executar cadastro MCP pessoal nem instalar skills. Build MCP e39 testes Rust aprovados. Reinício coordenado somente da API em27/10/2026, PID28684, com backup `.local/api-runtime/beeteam-before-8d8ed82.exe` preservado; rollback não necessário. Health, seis resources/read iguais ao commit final, três prompts/get e60 tools confirmados no runtime; painel5173 HTTP200. Coleções completas existentes boards/tasks/agents/teams idênticas antes/depois e via proxy (1/2/2/1), sem seed/reset ou mutações de negócio. Frontend e PostgreSQL mantidos ativos.

## Leader — Skills dfd4e19

Snapshot `dfd4e19161b27a71451a05da4ab05d02e1379b0b`: líder e team-examples atualizados para escolha de time/líder existente ou formação aprovada; demais materiais preservados. Build MCP e39 testes Rust aprovados. API reiniciada isoladamente em27/10/2026, PID79704; backup `.local/api-runtime/beeteam-before-dfd4e19.exe` preservado. A primeira cópia encontrou lock transitório do executável após encerramento; confirmado processo/listener ausentes, nova inicialização funcionou sem rollback. Runtime: seis resources iguais ao commit final, três prompts renderizados,60 tools, health e painel200. Registros completos pré/pós/proxy iguais:1 board,2 tasks,3 agents,2 teams. Sem seed/reset, alteração de negócio ou configuração pessoal; frontend/banco preservados. Validação cobre transporte e dados, não simulação de decisões de IA nem todos os fluxos visuais.

## Workflows completos — Skills 0e3a780

Entrypoints enxutos, workflows texto/Mermaid e referências do commit `0e3a7809a318294ca07b61e7ff8c5ba683053fcb` empacotados. MCP anuncia13 resources (incluindo workflows, orientações de conteúdo e templates/manifest),60 tools e3 prompts read-only. Links relativos mapeiam basename sem extensão para `beeteam://references/{nome}`; catálogo/discovery atuais prevalecem sobre contagens históricas preservadas nos textos fonte. Não expõe README/PROGRESS/validation nem filesystem livre.

Build e39 testes Rust passaram no banco isolado, incluindo paridade dos workflows com Mermaid. Houve indisponibilidade inicial WSL/PostgreSQL, refletida em503/timeout e falhas de conexão de teste; depois de recuperar contêineres e confirmar readiness, testes e leituras passaram. Nenhum reset/seed. API reiniciada isoladamente para PID41068, backup `.local/api-runtime/beeteam-before-0e3a780.exe` preservado. Treze resources/read iguais ao commit fonte e todos links relativos com URI anunciada;3 prompts/get renderizados; health/painel/proxy aprovados. Registros completos pré/pós/proxy iguais:1board,2tasks,3agents,2teams. Instalações globais/config pessoal não alteradas nesta frente. A validação não prova execução autônoma de decisões da IA, instalação fria nem disponibilidade contínua do WSL.

## Coordenação incremental — Skills 7b14ebf

Snapshot `7b14ebf926e648c35ac1a593e48c7e17a61e0100` servido: Leader registra/reutiliza tarefa de coordenação atribuída a si antes de planejamento substantivo, salva decisões incrementalmente e trata bootstrap sem circularidade; Collaborator não se autoautoriza. Discovery permanece autoritativo, sem contagem fixa nas instruções. Build e39 testes Rust aprovados. API reiniciada isoladamente para PID59996, backup `.local/api-runtime/beeteam-before-7b14ebf.exe` preservado. Na verificação atual foram descobertos13 resources iguais ao commit fonte, links mapeados,3 prompts renderizados e60 tools; health e painel200. Coleções completas pré/pós/proxy iguais:1board,2tasks,3agents,2teams. Sem dados de negócio criados, seed/reset ou alteração pessoal; PostgreSQL/frontend preservados. Validação comprova conteúdo/transporte e persistência, não execução das decisões de IA.

## Bee Team skills

The approved next onboarding behavior is documented in
[Leader onboarding: three team flows](docs/leader-onboarding-flows.md).
The skills now apply the approved workflows through concise entrypoints and complete local references; backend MCP snapshots require separate synchronization and verification.
The [Collaborator workflow](docs/collaborator-workflow.md) documents preparation,
execution, changes, blockers, validation and delivery with an inline Mermaid flow.

Versioned guidance is available in [team leader](skills/bee-team-leader/SKILL.md)
and [collaborator](skills/bee-team-collaborator/SKILL.md), with shared references
under `skills/references/` and [multidisciplinary examples](skills/bee-team-leader/references/team-examples.md).
These are portable instructions. The backend MCP catalog documents the implemented
server capabilities; this checkout supplies editorial content for its snapshots.

Reusable task briefing, collaborator resumption, and delivery review templates live
under [skills/prompts](skills/prompts/content-manifest.json). See [MCP content usage](skills/references/mcp-content.md)
for packaging, discovery, parameters, and integration checks. Public MCP names match the backend catalog: `task_briefing`
and `delivery_review`; runtime registration remains owned by the backend.

To use from this checkout, ask the harness to read the selected `SKILL.md` by its
full local path and follow it for the authorized demand. If installed in a harness
that supports skill discovery, invoke `$bee-team-leader` or `$bee-team-collaborator`.
Each skill folder is self-contained: copy its SKILL.md and references/ together.
The complete workflows, integration, handoff, connection procedure and prompts live
inside each package. Shared editorial sources remain under skills/references and
skills/prompts; synchronize their packaged copies when those sources change.
Installation and backend snapshot publication are separate operations.

Coordination defaults to manual approval. Execution follows the root task's origin
board: `manual` forces manual, `standard` uses each current task's individual mode,
and `automatic` covers the recursive chain across boards. Tasks have an author and
executor, with no team ownership; each board has one managing team. See
[validation and progress](skills/PROGRESS.md) for checks and dependencies.


## Local readiness managed by the leader

Before substantive planning, the Leader reuses or creates its own coordination task
and records conversation decisions incrementally in Bee Team. New-team bootstrap
materializes the collected context as soon as approved identity/team/board exist.
This does not allow Collaborators to create tasks to authorize themselves.

The leader starts by asking which team to use unless the context already identifies
one. It loads the existing leader's profile and context. For a new team, it first
discusses the work, proposes the composition, and obtains explicit approval before
creating agents, the team, or memberships, including under automatic task modes.

Loading a skill does not connect its MCP server. The skills now include
[Codex MCP onboarding](skills/references/codex.md#conectar-bee-team-ao-codex):
discover the real endpoint, register it only with user authorization, then verify
tools in the active chat separately from server health. Examples are documentation;
they do not change personal Codex configuration or install skills.

The leader skill now checks and reuses the database, API, MCP and real frontend,
starts only missing components through the installation's supported procedure,
and provides a verified clickable panel URL. Collaborators reuse that environment
and report failures without starting competing processes. See the
[Windows/Codex procedure](skills/references/codex.md) and
[readiness checks](skills/references/integration.md). Startup does not run preview
bootstrap automatically or reset storage. Tool-policy rejection requires a clear
manual handoff, not an alternative launcher. PostgreSQL 18 remains supported through explicit configuration; SQLite is now
the default described below. Data conversion is outside its scope.


## Bee Team frontend

Boards, agents and teams use a dedicated card scroller; navigation, breadcrumbs and filters remain outside it. Small desktop collections grow in balanced centered rows (1–3 in one row, then ceil(sqrt(count)) columns), centered vertically while they fit. At horizontal capacity or vertical overflow they use a normal top/left grid. Mobile keeps one card per row. Kanban columns retain their existing behavior.

These three lists prefetch approximately one measured viewport at a time (API limit at most 100), with a one-row threshold and reserved footer space. The first request estimates capacity; later requests measure rendered cards. Existing explicit URL limits remain supported. The URL stores all loaded exact `offset:limit` blocks in `<resource>.window` and the window start in `<resource>.offset`; resizing affects only the next block. Reload/back restores those blocks and the saved visible-card anchor from session storage. Loaded blocks remain available when scrolling back to the first card; loading more never evicts earlier cards. Filter changes reset the window and abort obsolete HTTP requests; refreshes deduplicate IDs and retain visible records. Loading, retry, a keyboard-accessible “Carregar mais” fallback and the actual end of records replace previous/next pagination on these lists.

The common loading indicator uses the Bee Team hexagon with rotation, including the next-page footer while more records are available; reduced-motion mode keeps it static. The branding logo is unchanged. Mobile breadcrumbs use an accessible return button and only the current name, with measured overflow panning and edge fades; reduced motion uses ellipsis and the complete accessible name. Theme and global settings stay on the same top row.

Listing filters and actions sit at the top right; breadcrumbs identify pages, with page headings retained for assistive technology instead of visible introductory headers. Active filters (including search) appear as a compact, absolutely positioned tag stack below the icons. The trigger and list hit areas keep stable geometry during animation; only the tag visuals animate, with a light fixed shadow. Mouse hover or keyboard focus expands the stack; its button toggles it on touch, and reduced-motion preferences disable the elastic transition. Search expands inline from its circle into a rounded input capsule; its X or Escape closes it without clearing the URL value, and reopening restores focus and text. Clear filters preserves existing URL and pagination behavior. The final gear icon on a board opens its existing settings panel and is never counted as a filter. Global settings use a distinct sliders icon with the existing import/export dialog.

The React frontend lives in `frontend/`. Run `npm ci` and `npm run dev` there. The normal preview uses the real API through a Vite `/api` proxy to `http://127.0.0.1:59865`; see `frontend/.env.example` and `frontend/README.md` for configuration. Mock mode is explicit opt-in (`VITE_API_MODE=mock`), with no automatic fallback.

A skill Leader acompanha a conversa no painel (time, board e task em página inteira), com URLs reais e preservação de edição ativa. Collaborators registram trabalho sem conduzir a tela. Sem UI, o Leader mantém o registro e fornece link; atualização ao vivo depende da implementação frontend/backend verificada.

## Atualização ao vivo

`GET /api/v1/changes` fornece SSE de invalidação para HTTP e MCP. Eventos `invalidate` e `reset` carregam apenas `{"scope":"all"}`; clientes devem refazer queries ativas e preservar rascunhos locais. `reset` é enviado em cada conexão/reconexão e após perda de mensagens. Não há replay durável nem cursor; `Last-Event-ID` não evita o refetch. Heartbeat SSE nomeado15s e retry3000ms. PostgreSQL NOTIFY entrega somente após commit real; rollback, replay idempotente e leituras não emitem invalidação. Cada processo usa um listener compartilhado com fila limitada, sem consultar tabelas periodicamente. Alterações SQL externas que não passam pelo UnitOfWork não notificam. O stream não é ferramenta MCP e não transporta conteúdo de negócio. Proxy deve preservar streaming sem buffering. Detalhes: [contrato SSE](docs/live-changes.md).

## Fronteira de persistência PostgreSQL

HTTP e MCP recebem o mesmo `BackendService` composto em `AppState`; não recebem
pool, driver ou transação. Os serviços dependem dos contratos `ResourceStore`,
`TransactionStore` e `ChangeSource` em `repositories/contracts.rs`. Toda integração
com PostgreSQL fica em `repositories/`: conexão, migrações, SQL, tradução de erros,
arquivos, idempotência, slugs, sequências, transações e LISTEN/NOTIFY. `db.rs`
mantém somente reexports de compatibilidade para inicialização e testes.

As listagens usam filtros, ordenação determinística, contagem e `LIMIT/OFFSET`
no PostgreSQL. `query.rs` seleciona a página e `reads.rs` carrega o contexto
relacionado necessário, incluindo ancestrais entre boards. Os serviços continuam
responsáveis pelas regras de execução e pela montagem dos contratos de resposta.
Leituras usam `REPEATABLE READ READ ONLY`, sem o advisory lock de gravação, para
manter contagem, página e contexto na mesma visão consistente.

Gravações ainda usam o snapshot completo de recursos e o advisory lock global
dentro do repository. Essa escolha preserva as invariantes entre recursos e a
atomicidade dos comandos compostos; não é uma otimização de concorrência das
escritas. O `UnitOfWork` não expõe a transação SQL e confirma notificações apenas
após commit. SQLite is the default standalone store; see below.

`tests/repository_boundaries.rs` verifica isolamento de camadas, leituras durante
gravações, ausência de leitura de tabelas alheias, estabilidade do snapshot,
proteção contra gravação em leitura e paginação. Rode os testes com
`BEE_TEST_DATABASE_URL` apontando para PostgreSQL 18 isolado, nunca para dados do produto.


## SQLite defaults and database overrides

SQLite at `~/.beeteam/beeteam.sql` is the default without overrides. Set
`DATABASE_DRIVER=postgres|sqlite` and a matching `DATABASE_URL`; unknown drivers
and mismatched URL schemes fail startup before a connection is opened. There is
no fallback to another driver. Selecting a new SQLite file starts an independent
empty database; it does not copy, migrate or reset PostgreSQL data.

```powershell
# Choose a dedicated path whose parent directory already exists.
$env:DATABASE_DRIVER="sqlite"
$env:DATABASE_URL="sqlite://C:/bee-data/beeteam.sqlite"
$env:OTEL_ENABLED="false"
$env:MCP_ENABLED="true"
cargo run --locked --features mcp
```

For a disposable in-memory instance use `sqlite::memory:`. For persistence use a
file. The local `scripts/start-local-api.ps1` also respects these environment
variables and skips Docker for SQLite or an explicit external PostgreSQL URL;
it reads the process environment, not `.env`. An already running API must be
restarted explicitly before its driver changes. `cargo run` continues to load
`.env` through dotenvy. To return to PostgreSQL set `DATABASE_DRIVER=postgres`
and its PostgreSQL URL. Neither path converts existing data.

SQLite uses independent migrations under `migrations/sqlite/`, foreign keys,
WAL and a 30-second busy timeout. Its `BEGIN IMMEDIATE` write transaction
serializes writers across processes before loading the existing mutation
snapshot. Reads use WAL snapshots, SQL filtering/count/order/pagination and
targeted related-record hydration without the writer lock. UUIDv7, retired slug
reservations, soft deletion, file storage, replay snapshots and atomic compound
commands share the existing application contracts. Database constraints guard
relationships, immutable structure/slugs and unique live bindings. The adapter
registers Unicode-aware name comparisons and literal case-insensitive searches.
SQLite files must be opened through this adapter for those custom functions.

SQLite SSE invalidation polls a transactionally incremented clock every 200ms
through the shared process listener. Other API processes using the same SQLite
file observe committed resource changes; rollback, reads and replay-only commits
do not advance it. PostgreSQL retains LISTEN/NOTIFY. These are invalidation hints,
with the same reconnect/reset behavior and no durable event replay. Direct SQL
writes bypassing UnitOfWork do not notify with either driver.

```powershell
# Existing HTTP/MCP tests use isolated temporary SQLite files through app().
$env:BEE_TEST_DRIVER="sqlite"
$env:OTEL_ENABLED="false"
# PG-specific tests still require their isolated PostgreSQL 18 URL.
$env:BEE_TEST_DATABASE_URL="postgres://postgres:test@127.0.0.1:55481/beeteam_test"
cargo test --locked --features mcp
# Focused SQLite persistence, concurrency, snapshots and notification checks:
cargo test --locked --features mcp --test sqlite_persistence
# Return shared HTTP/MCP tests to PostgreSQL:
Remove-Item Env:BEE_TEST_DRIVER
```

## Single executable and separate development frontend

Build the distributable from the repository root:

```powershell
node scripts/build-distribution.mjs
```

The command installs the pinned frontend dependencies with `npm ci --include=dev` in the
isolated `.local/distribution/frontend` build directory, forces `NODE_ENV=production`, builds against the real
same-origin `/api/v1`, then runs
`cargo build --locked --release --features mcp,embedded-ui`. It does not install
over a running Vite checkout's `node_modules`. Build prerequisites are Rust from
`Cargo.toml`, Node.js and npm; this workflow was validated with Node 22.19.0 and
npm 11.12.1. Commit both lockfiles and use these versions for repeatable inputs.
Native executable hashes can differ across compiler/OS toolchains; byte-identical
cross-machine Rust builds are not claimed.

The output is `target/release/beeteam.exe` on Windows, or
`target/release/beeteam` on Unix. Copy that executable to the runtime machine.
There is no Node/Vite, `frontend/dist`, source checkout or npm dependency at
runtime. The selected database and its persistent data remain external to the
executable; the default is SQLite at `~/.beeteam/beeteam.sql`.

```powershell
# No environment variables are needed for the distribution defaults.
./beeteam.exe
```

`APP_PORT` defaults to `59865`; set it explicitly to select another port. The local
launcher preserves that override, and the MCP endpoint uses the configured port.
For a separate Vite process, set `BEE_API_TARGET` to the same API port.

Open `http://127.0.0.1:59865/`. UI, `/api/v1`, `/docs` and the configured MCP
endpoint share the listener. Deep links under boards/tasks/agents/teams load the
SPA. Only known UI paths get HTML; missing assets, API paths and MCP prefixes
retain non-HTML errors. Fingerprinted Vite assets use immutable caching and
ETags; HTML and public non-fingerprinted files revalidate. HEAD and conditional
GET are supported. Existing route errors are never replaced with HTML.

`BEE_FRONTEND_MODE` accepts `embedded` or `disabled`. Its default is `embedded`
when compiled with `embedded-ui`, otherwise `disabled`. Requesting embedded mode
from an API-only executable fails startup explicitly. For development:

```powershell
# Terminal 1, repository root; keep the desired existing DB configuration.
$env:BEE_FRONTEND_MODE="disabled"
cargo run --locked --features mcp
# Terminal 2, frontend/; use npm ci once in a fresh checkout.
$env:BEE_API_TARGET="http://127.0.0.1:59865"
npm run dev
```

Vite keeps its `/api` proxy and hot reload. Never run `npm ci` over a checkout
whose native Node modules are in use; use the isolated distribution command or
stop your own dev session first. No service is automatically restarted by the
build command.

For manual embedded builds, run `npm ci` and `npm run build:embedded` inside
`frontend`, then compile Cargo with `embedded-ui`. A normal `npm run build` does
not create the embedding provenance manifest. Cargo rejects absent/stale sources,
changed asset bytes or inventory mismatches. The build-only `BEE_FRONTEND_DIST`
can point at another verified dist directory, such as
`.local/distribution/frontend/dist`; it is not consulted at runtime. Source and
output SHA-256 hashes guard freshness, not publisher authenticity. The generated
`.beeteam-build.json` is not served by the executable.

Export/import remains disabled unless explicitly enabled. In embedded mode its
browser allowlist must include the chosen UI origin, for example
`BEE_TRANSFER_ALLOWED_ORIGINS=http://127.0.0.1:59865` (and the localhost variant
only if used). A same-origin UI does not remove the administrative opt-in.

## Portable export and import

Global **Configurações globais → Exportar e importar dados** exports a complete
`.beeteam.zip` and restores it into an **empty** PostgreSQL or SQLite installation.
The package contains a versioned manifest, 17 JSONL groups, SHA-256 inventories and
binary attachments. It preserves IDs, retired slugs, versions, links, Markdown,
author-written summaries, history, tombstones and original replay responses. This
is a complete portable backup, not a CSV report or a merge of installations.

Enable explicitly on the intended instance before starting it:

```powershell
$env:BEE_TRANSFER_ENABLED="true"
$env:BEE_TRANSFER_DIR="C:/bee-data/transfers"
$env:BEE_TRANSFER_ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
```

Origins must match exactly, including port. Browser requests with an Origin not
listed are rejected, including actual writes; requests without Origin remain
available to local CLI/MCP clients. This setting is not authentication. Keep the
service and its transfer directory restricted to the intended administrator;
archives include deleted data and historical responses. On Windows provision the
directory with the process account's ACL. Never share its journal across unrelated
database installations. Processes serving the same instance must share this path
so the OS lease can enforce one active transfer.

| Environment variable | Default |
| --- | --- |
| `BEE_TRANSFER_ENABLED` | `false` |
| `BEE_TRANSFER_DIR` | `.local/transfers` |
| `BEE_TRANSFER_ALLOWED_ORIGINS` | empty (no browser Origin allowed) |
| `BEE_TRANSFER_UPLOAD_BYTES` | 2147483648 (2 GiB) |
| `BEE_TRANSFER_EXPANDED_BYTES` | 10737418240 (10 GiB) |
| `BEE_TRANSFER_MAX_ENTRIES` | 100000 |
| `BEE_TRANSFER_LINE_BYTES` | 1048576 (1 MiB) |
| `BEE_TRANSFER_TIMEOUT_SECONDS` | 1800 |
| `BEE_TRANSFER_RETENTION_SECONDS` | 86400 |

The validator also bounds the manifest to 64 MiB and the reference index to one
million records. Local disk space is checked before writes and extraction.
Exports read one consistent online snapshot and stream blobs in 64 KiB chunks;
ongoing writes can continue. PostgreSQL legacy `authors`/`posts` data is explicitly
rejected rather than silently omitted. Artifacts become downloadable only after
the archive is complete. Terminal artifacts expire through periodic maintenance;
job/idempotency records and DB commit markers remain available for recovery.

To change database engine, first export the source, start a **separate empty**
destination with the chosen driver, upload, inspect its preview and confirm.
Import rechecks emptiness under the normal writer lock and commits all data,
sequence floor and completion marker together. Any pre-commit failure rolls back.
The committed marker wins over late cancellation or process failure before the
journal update. PostgreSQL timestamps have microsecond precision: nanoseconds
require explicit `truncate_to_microseconds` approval. JSON/Markdown/replay contents
are never traversed to rewrite date-like strings. The default is strict rejection.
There is no force/reset/replace operation and no automatic runtime cutover.

The [HTTP contract](docs/data-transfer-openapi.json) documents jobs, streaming
upload/download, previews, restore and cancellation. Mutations require a UUID
`Idempotency-Key`; upload also requires the whole-file `X-Archive-SHA256` and one
multipart `file` field. Reuse the same key after an uncertain response; different
content with that key conflicts. Poll `/api/v1/data-transfers/jobs/{id}` after
reconnect. The UI retains the job ID locally. MCP tools `exportData`,
`getDataTransfer`, `previewDataImport`, `restoreDataImport`, `cancelDataTransfer`
use the same service; upload/download stay on HTTP and no filesystem path is
accepted as an MCP argument. Queries continue during a SQLite restore; successful
commit produces one invalidation, preserving existing frontend drafts and URL.

Transfer tests: `cargo test --locked --features mcp --test transfer_archive
--test transfer_export --test transfer_restore --test transfer_roundtrip
--test transfer_jobs --test transfer_http` (one command). The roundtrip suite
requires the isolated PostgreSQL 18 `BEE_TEST_DATABASE_URL` and covers all four
driver pairs, typed precision, tombstones, blobs, hierarchy and rollback.

## MCP Skills snapshot — 2026-10-29

Bundled resources and the three read-only prompt templates incorporate Skills commit `8ab75d1c422c41a1a66ca82166c209063c50d760`: work is recorded and assigned before execution; substantive agent communication belongs to the task, with reference-only notifications after confirmed persistence. Identity activation without a task remains separate. Harness permissions are unchanged. The Codex reference retains three existing SQLite-aware startup/readiness paragraphs; exact source/bundle hashes are in `resources/bee-team/provenance.json`. Existing services must be updated separately to serve this compiled snapshot; this change does not restart them or install global skills.

Active filter tags provide individual accessible remove buttons (hover, keyboard and touch), preserving other filters and resetting the associated page blocks. Team purpose and context share one clipping region with paragraph breaks and a single bottom fade only when the combined text overflows.
Listing card roles and autonomy modes use distinct accessible icons with tooltips. Card timestamps use Portuguese relative time, updated by one shared minute timer; exact timestamps remain in time datetime/title attributes. Invalid dates have an explicit unavailable state.
Boards, agents, teams and Kanban task summaries share CardExcerpt tokens: 13px type, 22px line height and 110px reserved height, including short/empty content. Task cards still display currentSummary and preserve blocking/progress metadata.
Removing a tag preserves the expanded filter stack and its pointer area; keyboard removal transfers focus to the next remove control, and clearing the last tag returns focus to the toolbar. Card footers use compact padding with no extra bottom padding on the enclosing card.
Native scrollbars use shared monochrome tokens throughout the app, including portals, dialogs, popovers and horizontal overflow; forced-colors retains platform controls. Card grids leave an inset beside the scrollbar. Kanban scrolling fills the remaining viewport so its horizontal scrollbar stays at the bottom of the working area.
Listing card hover/focus outlines are drawn inside the card boundary so the scroll viewport cannot clip the top edge; keyboard focus uses a stronger inset outline without changing card dimensions.
Card and Kanban scroll regions extend to the bottom of the viewport; document overflow is clipped to prevent keyboard focus from shifting the fixed shell. The list footer reserves 64px while loading or more records remain, and a 1rem bottom breathing space at the end; prefetch still uses one measured row.
Entity filter popovers place search above options and focus it on opening. Typing filters the existing paginated API query; ArrowDown moves into the option group while selected values remain available.
Agent option lists scroll below their search field; team selectors use the five-result autocomplete described below. The icon rail reserves 56px (44px targets plus 6px padding), with 8px content padding to avoid an unused lateral gap.
Team filters now use a true API-backed combobox: empty input shows the five most recently created teams (createdAt desc, ID tie-break), each term searches all teams with limit 5/offset 0, and no catalog scrolling or pagination is shown. Suggestions support arrow keys/Enter, selected labels and clearing; obsolete queries are aborted and cannot replace current results.
At the end of card listings, the footer keeps only 1rem of bottom breathing space and a screen-reader status announcement; no visible end/count text or large reserved band remains.
Team card footers link the leadership icon directly to the resolved agent slug and the collaborator count to agents filtered by team UUID and collaborator role. Both shortcuts preserve a return URL and do not activate the enclosing team card; absent/unavailable leaders have no fabricated link.

Configuration editing autosaves text on blur and options on change. Board metadata, profiles, team metadata, existing statuses and task autonomy share a serialized, coalescing write queue with If-Match versions. Unchanged and invalid forms are not sent. Focused fields flush on panel close; failed/in-flight drafts survive reopening within the same app session, with explicit retry and reload controls. Creation, import/export and destructive actions remain explicit. Live refresh does not replace an active draft or silently adopt a conflicting metadata version.
The header is a single 48px breadcrumb/filter row. Global settings and theme controls live at the bottom of the navigation rail as circular 44px targets; board settings stays with contextual filters. Mobile filter controls scroll horizontally without wrapping; list scrolling still reaches the viewport bottom. The two explanatory board captions were removed without changing tasks, subtasks or history.

Card lists show a small bottom-centered return-to-top overlay after scrolling. Its 44px keyboard-accessible target scrolls only the card region, preserves filters and loaded pages, respects reduced motion, and moves above a visible loading/retry footer. It reserves no layout space.

The return-to-top control uses a small outlined chevron (no shaft or filled arrow), retaining its circular 44px interaction target.

Team autocomplete marks selected matches inline with a check. It does not repeat the selected name or offer an internal clear action; the external filter tag remains the removal control. Searching does not clear the stored selection or inject out-of-result items.

An active team filter with empty search shows only its resolved selected team, including direct URL navigation. Typing switches to global matches; activating the selected option again clears the filter with pointer or keyboard. Unfiltered empty search still shows the five newest teams.

The team autocomplete does not display a recent-teams caption or leave spacing for it; loading, error and empty-result feedback remain.

The main content has zero left/right padding on desktop and mobile. The top bar removes only its left padding. Vertical spacing, top bar right padding, and all rail, card, form and popover padding remain unchanged.

The card-list viewport removes only its left padding and retains 8px on the right; measured capacity already subtracts both computed sides independently.

Motion animates filter positions and tag expansion with a shared damped spring, reveals Clear after space opens, and gives filter popovers short entrance/exit transitions while Radix retains keyboard and focus handling. The search capsule crossfades its glyph and input without replacing the input or button; its responsive width remains CSS-driven. `motion-presets.ts` supplies the shared 160 ms feedback, 180 ms entrance, 100 ms exit and 220 ms resize timings, including CSS variables. Page changes use opacity on the existing main surface; shell and query-string changes stay stable without retaining or remounting route children. Context dialogs enter with Motion opacity and exit through Radix's CSS Presence lifecycle, preserving modal focus and scroll handling. Reduced-motion preferences make transitions immediate. Escape in an expanded tag list returns focus to its toggle before the list becomes inert and hidden from assistive technology.

Active-filter tags use 30% opacity for the entire stack at rest and 100% on hover, keyboard focus, or touch expansion, with a 160 ms CSS transition disabled for reduced motion. Hit areas and filter-removal behavior stay unchanged.

Kanban columns load at least six root active tasks initially (or all available when fewer), then append another viewport-sized batch when the user scrolls within 300 px of the bottom. Each column keeps an independent native scrollbar and its loaded pages during live refresh; requests consume AbortSignal, deduplicate IDs, and stop on a non-advancing cursor. Filter/board changes reset the column viewport. Errors retain cards and offer retry; exhausted columns end silently with 1rem breathing room. Task assignee avatars are fixed 28px circles; only the name is underlined on hover. Column scrollbar thumbs are subtle, with space from cards; card hover/focus outlines remain inset to avoid clipping.

Kanban column scrollbar thumbs follow the card color in dark mode, brighten on hover, and retain the light-mode and forced-color fallbacks.

On mobile (up to 850px), Kanban uses native horizontal scroll snap with one nearly full-width column and a preview of the next. A 44px previous/next toolbar names the current status and total; navigation stops at the first/last column and honors reduced motion. All columns remain mounted, retaining vertical scroll and fetched pages when moving back and forth. Desktop keeps the multi-column layout. The inner scrollbar retains a small 2px card gap without excessive right padding.

Board, agent and team listing cards include a consistent decorative filled type mark at the top left, with header space reserved to avoid overlap; existing role/autonomy symbols and card height remain separate.

Agent listing cards use a centered 56px profile avatar above the centered name, with the decorative type mark at the top left. The 272px card height, description fade and footer remain consistent; task assignee avatars are unchanged.

Kanban column anchors also survive opening a task and returning, keyed by board, status and filters. When all loaded cards fit the viewport and more exist, loading continues only until overflow appears or the data ends; further pages require scroll progress. Pending requests and errors stop this bounded fill.
Na coordenação Bee Team, toda demanda Leader→Collaborator é registrada e atribuída antes da execução. Perguntas, respostas, decisões e entregas ficam na tarefa; chats transportam apenas notificações com referência e tipo de mudança após persistência confirmada, sem ciclos de confirmação.

Ao ativar Leader ou Collaborator, o próprio chat recebe respectivamente 👑 ou 🐝, antes mesmo da resolução da identidade. Mudanças de papel substituem a marca inicial sem acumular; nome/contexto útil são preservados. Leader já nomeia novos chats Collaborators autorizados com 🐝. Somente títulos de chat mudam, nunca agentes/times/slugs.

Após bootstrap de identidade/time, cada interação substantiva entre agentes atualiza campos pertinentes e salva comentário completo antes da notificação. O aviso contém task, áreas realmente atualizadas, status pertinente e commentID retornado; receptor lê esse comentário por ID via MCP e o estado atual antes de agir. Validação humana pendente não implica tarefa concluída.

A Leader é a interface humana do trabalho: fora do bootstrap inicial de novo chat Collaborator e de seu retorno de configuração, perguntas, escolhas, pedidos, confirmações e relatos substantivos iniciados pelo Collaborator passam por comentário e notificação à Leader, sem diálogo direto ou caixas interativas ao humano. Isso preserva metainstruções legítimas, aprovações obrigatórias do harness e trabalho independente autorizado.

A regra também vale para a Leader: decisões humanas são solicitadas por pergunta/opções registradas na tarefa e aviso referencial, sem caixas interativas. A resposta humana legítima é persistida antes de agir/delegar; não há encaminhamento para outra liderança nem ciclos. Bootstrap e controles obrigatórios do harness permanecem preservados.
### Kanban blocked-state presentation

Blocked task cards keep their lock badge and use a soft destructive-color background and accent in both themes. Kanban columns stretch together to fill the available page height, while longer boards and narrow screens retain normal scrolling.

## Leader chat title snapshot — 2026-10-30

Bundled MCP materials now incorporate Skills commit `98e0428dceec64ea74d86c6a8d4ed27ce3a14f08`: a confirmed Leader uses a single 👑 prefix in its own chat title, preserving useful context. Agent/team names and slugs, Collaborator chats and other chats are unchanged. Existing task-authoritative communication and the local SQLite startup overlay are preserved. The resource allowlist and prompt contracts are unchanged; provenance hashes are in `resources/bee-team/provenance.json`. This updates source materials only: no active service, deployed executable or global installation is changed by this synchronization. Runtime activation remains pending.

## Both chat role marks — 2026-10-30

Current bundled source `e73c21be0263374a26ce5ea5e655e185e7cdfea2` supersedes the earlier Leader-only rule: Leader uses 👑 and Collaborator uses 🐝 from skill activation, including existing chats and role switches. Initial role marks are replaced/normalized rather than accumulated; useful title context is preserved, and normalized discovery does not establish identity. Only chat titles are affected; agent/team names, slugs and Bee Team data are unchanged. Task-authoritative communication and the three local SQLite startup/readiness paragraphs remain intact. The 13-resource allowlist and three prompt contracts are unchanged. This is a source snapshot update; no running service or release executable is updated here, so runtime activation remains pending.

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

Task detail keeps its full-page route and tab query parameters. A visible title and execution state lead into independent reading sections separated by subtle theme-aware dividers and a 300px page-level context sidebar aligned with the top of the detail area, alongside the heading, navigation and content. Narrow content areas stack the context behind an accessible disclosure; small screens select sections through a native select. The autonomy form remains mounted across section/disclosure changes, preserves autosave sessions, and becomes read-only for archived tasks. Task specification and plan Markdown headings are nested below the page heading without changing stored content.

Task detail dividers separate logical document sections, plan history, and execution summary/deliverables/pending blocks. Existing list borders are reused. Markdown section dividers are opt-in, use root-level principal headings, and respect authored thematic breaks; stored Markdown, nested headings, paragraphs and lists are unchanged.

The task detail blocked alert uses a red background, white text and a decorative blocking icon beside the complete message. The alert retains its announcement semantics and wraps long reasons on small screens.

The current work summary retains its horizontal section dividers and spacing without a vertical accent bar.

On wide task detail screens, the main reading column and context sidebar scroll independently below the global topbar; the sidebar stays in place while reading and remains scrollable when its controls exceed the viewport. Narrow screens retain normal page scrolling and the context disclosure. Timeline filter tags use the shared overlay without reserved height, with reduced filter-to-content spacing. The current summary aligns with its sibling sections without a left inset.

Specification and Subtasks begin directly with their document/list (or existing empty state), without redundant introductory headings or helper copy.

Root task details omit the duplicate board path above their title; the global breadcrumb and nested-task ancestry remain available.

The task executor appears in the context sidebar, without a duplicate in the main status/progress row.

Task status leads the context sidebar. The main column displays recorded progress as a full-width accessible bar with a percentage positioned at the fill endpoint and clamped inside the edges at 0% and 100%, without motion or inferred activity.

Mobile breadcrumbs use a 44px back-chevron control with the existing contextual destination and long-title behavior. Task details omit the duplicate content back button; desktop breadcrumb links remain available.

Na aba Planos, o Histórico de alterações permanece aberto abaixo do documento. As revisões chegam em páginas incrementais ao aproximar o fim do conteúdo (scroll principal no desktop e página no mobile), com o indicador de carregamento compartilhado e sem paginação do histórico. A seleção de planos e os links de revisão mantêm seu estado na URL; páginas são isoladas por tarefa/plano/revisão atual, deduplicadas por ID, e erros permitem nova tentativa sem remover os registros já carregados.

A barra de progresso do detalhe exibe apenas a porcentagem e o preenchimento; "Progresso registrado" permanece como nome acessível, sem rótulo visual ou espaço reservado. O texto de andamento na Visão geral permanece independente.

A aba Planos usa navegação lateral vertical no desktop, com lista incremental e rolagem independente, mantendo o conteúdo e histórico no scroll principal e o contexto da tarefa à direita. No mobile, a lista é substituída por páginas com scroll-snap horizontal e controles anterior/próximo de 44px, sem loop; cada plano conserva sua posição vertical durante a navegação. O histórico usa o scroll vertical da página do plano. O LoadingIndicator compartilhado só mostra o spinner após 100ms contínuos, cancela o timer ao desmontar e reinicia o prazo em cada requisição; os dados e as requisições não aguardam esse prazo. O status acessível permanece disponível e o texto invisível fica contido no indicador, evitando scrollbar externa e variações de largura. Seu marcador de carregamento reserva 60px em todos os estados, inclusive ao terminar; o indicador continua visível durante requests e não participa da ancoragem de scroll. Lotes novos são acrescentados sem substituir os registros existentes. A seleção por URL consulta diretamente a última revisão para abrir o documento. A navegação localiza a posição real por páginas sequenciais limitadas e canceláveis, sem inserir o selecionado artificialmente no topo. Carrega somente até encontrar o plano e obter espaço suficiente abaixo para revelá-lo, ou atingir o fim. A lista o alinha o mais alto possível dentro de scrollHeight-clientHeight, somente na primeira carga da tela (incluindo refresh/link direto); cliques e trocas de seleção posteriores não reposicionam a lista. Refetches em background, inclusive após autosave de autonomia, preservam os itens e não inserem loader na lista; o indicador é reservado à carga inicial e às próximas páginas. Os títulos mantêm o mesmo peso tipográfico e espaçamento nos estados ativo e inativo; o destaque usa fundo e aria-current, sem mudar quebras de linha ou altura. Refresh e retorno do navegador mantêm IDs, ordem e vizinhos reais, inclusive no mobile. Nenhuma edição ou draft é descartado por mutação automática.

No detalhe da tarefa, as abas horizontais permanecem sticky durante a leitura. No desktop, abas à esquerda e filtros à direita compartilham a mesma faixa. No mobile, os filtros ficam abaixo das abas; quando essa área sai da tela, mesmo sem filtros ativos, os mesmos controles aparecem verticalmente abaixo do logo da sidebar, com menus, busca e tags à direita. Ao retornar à área original, os controles voltam ao local inicial. O DOM, a seleção, a busca e o foco são preservados. No desktop, um observador do cabeçalho original mostra título, progresso e bloqueio resumido no topo da sidebar somente após o cabeçalho sair do scroll principal. O resumo é uma repetição visual aria-hidden, mantém o original no fluxo e não remonta formulários; desaparece ao retornar ao topo. A transição respeita prefers-reduced-motion. No mobile, o contexto continua no disclosure e não recebe esse resumo fixo.

As atualizações por autosave de boards, status, times, agentes e tasks são silenciosas: não exibem salvando, sucesso ou linha reservada. Erros, retry e avisos de conflito permanecem disponíveis; drafts, coalescing e controle de versão são preservados.

A troca de abas da task reutiliza o fade de páginas (opacidade 0,72→1 em 180ms), somente no painel de conteúdo e sem key de remontagem. Título, tabs sticky e contexto permanecem estáticos; query, filtros e paginação na mesma aba não reiniciam o efeito. Com movimento reduzido, a opacidade é imediatamente 1.

## Task-scoped participants (2026-10-30)

`GET /api/v1/tasks/{taskId}/participants` and MCP `listTaskParticipants` return a distinct participant page (`items`, `total`, `offset`, `limit`, `hasMore`, `nextOffset`). MCP arguments: `{"params":{"taskId":"UUIDv7"},"query":{"offset":0,"limit":100}}`. Only offset/limit are accepted; the endpoint is independent of comment filters or loaded comment pages. UI clients paginate this smaller participant collection until hasMore=false, never enumerate the global agent catalog or scan comment pages.

Each item has `actorKind`, nullable `actorId`, nullable `agentName`, `agentArchived` and `agentDeleted`. The exact task contributes its current author/executor, authors recorded on comments, plan revisions, attachments, execution summaries and timeline events, plus original author/executor and previous/new executors recorded by creation/assignment events. Sources are non-deleted records; retained timeline events preserve participation even if an attachment/comment was removed. Descendants, unrelated tasks and other team members are excluded. No identity is inferred from text, names, chat content or a team roster.

Humans are one aggregate `actorKind=human, actorId=null, agentName=null`, because the model does not identify individual humans. Agent profile names and archived/deleted flags are current metadata, not historical name/role snapshots. A missing profile leaves agentName null; clients can display the recorded UUID. Deleted/archived agents are not silently removed from genuine historical participation. A participant may have no currently visible comments, so selecting that participant in the author filter can legitimately return zero comments.

Repositories aggregate the complete task-scoped set and count it before pagination in the existing read-only snapshot. Ordering is stable by actorKind then actorId; distinctness is the pair, not a name. Maximum page size remains 100 (default 50). Missing/deleted task returns 404/not_found; unknown filters or invalid pagination return 400/invalid_request. No migrations, content changes, new human identities, task writes or runtime restart are performed by this read feature.

Historical author filtering: listComments.actorId validates UUID syntax but does not require a live agent profile; recorded authors remain selectable after profile deletion. A valid unknown UUID returns an empty comment page. This supersedes the earlier actorId profile-existence requirement for listComments only.
No desktop, a barra de rolagem principal do detalhe fica no limite direito da área de conteúdo, junto à divisória contextual. O respiro de 8px fica entre conteúdo e barra, preservando a largura de 300px da sidebar e sem alterar a rolagem interna dos planos.

O wrapper `.task-page` não adiciona padding em nenhum breakpoint. Os espaçamentos internos dos componentes permanecem; no desktop, o scroll principal alcança o fundo da janela e `.task-detail-primary` e `.task-context` não adicionam padding inferior. O comportamento mobile permanece independente.

A faixa `.task-section-navigation` não adiciona padding vertical; os botões mantêm suas alturas e a faixa mantém o comportamento sticky.

Na Conversa, Tipo de autor usa o ícone de classificação e Autor da fala usa o ícone de pessoa, com os mesmos rótulos acessíveis e estados ativos.

Arquivos, Timeline, Subtasks e Resumos usam scroll infinito no detalhe da tarefa, com paginação server-side e o controlador compartilhado de visibilidade. O carregamento segue enquanto o marcador final estiver visível, até preencher a área ou esgotar resultados. Os lotes são deduplicados por ID e preservam a ordem da API; trocar tarefa ou filtro cancela a consulta anterior. O marcador mantém 60px de altura e usa o indicador padrão com atraso visual de 100ms. Falhas mantêm os itens carregados e permitem repetir o lote. Desktop observa o scroll principal; mobile observa a página. Limites e filtros da URL permanecem válidos; offsets legados não escondem os primeiros registros, pois essas listas iniciam em zero. Resumos preserva Markdown, entregas e pendências.

A Visão geral consulta `GET /api/v1/tasks/{taskId}/overview` para obter um snapshot agregado completo: filhas diretas por status e responsável, incluindo arquivadas. Bloqueios são uma dimensão sobreposta, sem somar tarefas novamente. As legendas abrem Subtasks com filtros reais (`parentId`, `statusId`, `executorAgentId` ou `blocked`, mais `includeArchived=true`), preservando a origem de navegação e o foco de teclado. A distribuição concluídas/restantes não representa produtividade ou carga estimada.

O gráfico de progresso apresenta somente atualizações explícitas registradas (até 100, com truncamento informado), sem reconstruir períodos ou transformar conclusão de subtarefas em progresso. Pontos e linha de referência têm alternativa tabular. A síntese usa autor/data do evento correspondente quando disponíveis; não reutiliza a data geral de atualização da tarefa. Pendências são identificadas como pertencentes ao último resumo de execução e mostram sua autoria/data. Decisões e próximo passo só são exibidos se fornecidos: o modelo atual não possui esses campos estruturados e retorna lista vazia/null. Descrição e nota de andamento permanecem em Markdown seguro.

Entregas, arquivos e atividade aparecem em feeds compactos de até cinco itens visíveis por categoria, com acesso às seções completas. Os limites da API são dez entregas, cinco arquivos e vinte eventos; os totais vêm do snapshot. A interface usa os tokens existentes nos dois temas, gráficos sem animação e layout empilhado no mobile. Backend ativo precisa oferecer o novo endpoint e `includeArchived` em listagens de tarefas; erros de integração exibem retry e preservam o texto básico da tarefa, sem fabricar métricas.

O filtro Autor da fala consulta todas as páginas de `GET /api/v1/tasks/{taskId}/participants`, independentemente do texto e da janela de comentários. Mostra participantes da tarefa, incluindo históricos, arquivados e excluídos, e um grupo de pessoas sem inventar identidades. Não consulta o catálogo global como fallback. O endpoint deve estar disponível no backend ativo; falhas exibem erro e nova tentativa. A agregação autoritativa pertence ao backend; o adaptador de demonstração mantém a mesma seleção escopada em memória.

## Task overview snapshot (2026-10-30)

`GET /api/v1/tasks/{taskId}/overview` / MCP `getTaskOverview` (`{"params":{"taskId":"UUIDv7"}}`) returns the current Task plus complete SQL aggregates of non-deleted DIRECT children across boards, including archived children. `directSubtasks` provides total/done/remaining and a separate blocked count (blocked is an overlapping property, not another status bucket), byStatus keyed by board/status IDs with current names and isDone, and byExecutor with total/done/remaining. Executor distribution means current assignment, never productivity or who historically performed the work. No status color exists in the model, so color is null.

The current task progress remains independent of child completion. `progressHistory` contains only explicitly recorded `task.updated` progress values, ordered from oldest to newest within the latest 100 matching events, with exact event ID, occurredAt, actor metadata and source. total/limit/truncated and coverage=explicit_progress_events_only are explicit. Task creation defaults, derived child ratios and older execution-summary progress are NOT reconstructed into points: legacy closure events did not store that progress. Consequently the latest historical point can differ from the current task progress. Follow the existing task timeline for older records; there is no claim of a complete continuous series.

`currentSummaryMeta` identifies the latest explicit synthesis event only when its stored text matches the current task synthesis; otherwise null. It never substitutes task.updatedAt or infers an author. `latestExecutionSummary` is the actual stored latest record or null, including its dated pending array. Pending items are from that record, not a claim that every item remains unresolved today. nextStep is null and decisions is empty because no dedicated structured sources exist for them.

`latestDeliverables` aggregates delivery entries across ALL non-deleted summaries and returns the latest 10 (summary creation/id descending, then entry ordinal descending), with summary ID/time/actor and original nested Deliverable; source attachmentId or URL is preserved without fabrication. `latestAttachments` returns the latest 5 non-deleted attachments; `recentEvents` the latest 20 exact-task timeline events. Each collection has items/total/limit/truncated. The dedicated attachment, summary and timeline endpoints remain available for deeper pagination. Empty data is []/null, not synthetic activity.

All queries share the repository-owned read-only snapshot. The overview read hydrates ancestry/context, not all child task bodies; counts and grouping are SQL over the complete direct-child set. Actor metadata is declared, not authentication. No product writes, migrations, new demo data or restart are performed. Frontend drilldowns use GET /tasks with parentId and includeArchived=true plus statusId, blocked or executorAgentId, retaining cross-board children.

## Usage and model history proposal

The summary-checkpoint backend is implemented in source. Every new execution
summary now requires usageReport, including an explicit factual unavailable
declaration when measurement is impossible; historical absence and saved replays
remain compatible.
See [summary usage contracts and limits](docs/summary-usage.md). Runtime activation
is separate. The broader collector/global-ledger proposal below remains future work.

The [token and model ledger plan](docs/superpowers/plans/2026-10-30-token-model-ledger.md)
researches Codex, GitHub Copilot, Claude Code, Cursor and Kiro. It proposes
historical actor/task/session/model/harness attribution, honest coverage,
deduplication, atomic reporting and optional separate cost accounting.
Skills must investigate tools, permitted APIs/local metadata and official
documentation before reporting unavailability, recording concrete attempts and
limitations. Direct permitted reads are a first-class path; collectors are
optional, with capability caching to avoid repeating discovery on every update.
The proposed task UI presents structured usage/model fields in historical
execution summaries, separate from Markdown. Overview shows known token totals,
all known models used and a timeline of summary reports with observed status.
There is no proposed usage sidebar or default metric presentation in comments.
Cumulative snapshots and period deltas remain explicit; totals use deduplicated
ledger evidence. A summary report does not imply a status transition or an exact
usage timestamp. This visual proposal remains subject to implementation review.
The broader collector/global-ledger roadmap remains a proposal. The implemented
summary-checkpoint increment and its limits are documented separately above;
no external collector is installed or enabled by it.

O cabeçalho da tarefa mantém descrição abaixo do título e síntese atual após progresso/bloqueio em todas as abas, com Markdown e proveniência quando disponível. Ao sair do viewport desktop, a sidebar oferece prévias compactas expansíveis por teclado; os formulários permanecem montados e o mobile conserva uma única coluna. A Visão geral mantém gráficos e nota de andamento sem duplicar descrição/síntese.

As skills investigam no início a fonte de métricas da sessão e tentam consultá-la a cada novo resumo histórico. Cada novo resumo exige usageReport estruturado, separado do Markdown, com acumulado real de tokens da sessão até o resumo, modelo identificado, harness, agente e fonte verificáveis. Ausência não é zero; erro de gravação não permite anunciar salvamento. Leituras e replays legados permanecem compatíveis.


Descrição e síntese no cabeçalho ocupam toda a largura da coluna principal, com quebra natural e parágrafos Markdown preservados. As prévias da sidebar mantêm seus limites compactos; tabelas e código continuam com rolagem horizontal própria.

A síntese atual no cabeçalho usa card neutro com tokens do tema, padding e cantos arredondados, sem altura fixa ou faixa lateral. Descrição e sidebar compacta mantêm suas apresentações independentes.

No card da síntese, título fica à esquerda e autoria/data reais à direita; no mobile, a identificação pode ocupar a linha seguinte, mantendo o conteúdo Markdown completo abaixo.

A autoria do card usa `RelativeTime` (o mesmo de Boards/Agentes), com relógio compartilhado, texto relativo em português e data absoluta no `title`/`datetime`. A sidebar mantém a data absoluta.

A autoria no card reutiliza o ícone UserRound dos agentes/colaboradores; o texto preserva o tipo real (agente ou pessoa), sem criar uma nova ação.
Resumos históricos podem trazer `usageReport` opcional como metadados separados do Markdown. A interface distingue métricas ausentes de zero, snapshots originais de deltas derivados, qualidade medida/estimada/indisponível e atribuição exata/compartilhada/não atribuída. Proveniência e revisões ficam em detalhes expansíveis; contadores decimais são formatados com BigInt, sem perda de precisão.

A Visão geral mostra `TaskOverview.usage` como agregação autoritativa: total conhecido e estimado separados, componentes medidos, cobertura/lacunas, modelos/harnesses distintos e checkpoints de resumos com horário de reporte e status observado. `GET /tasks/{id}/usage` e `/usage/dimensions` paginam checkpoints/dimensões via Carregar mais, sem somar páginas/snapshots nem substituir o total pelo último reporte. Cache/raciocínio são subconjuntos de entrada/saída. Respostas antigas continuam exibindo ausência de agregação; resumos sem métricas permanecem válidos. Nenhuma coleta, credencial ou métrica de demonstração é criada pelo frontend; o adaptador de demonstração não sintetiza agregações de uso.
## Board columns and subtasks

Board views include all active tasks belonging to the requested board, including
subtasks at any depth. Descendants in another board are not duplicated or counted.
Continue a column with the board task list, matching status/filter/sort parameters
and `archived=false`, without `rootOnly`; general lists retain optional `rootOnly=true`.
Task read projections include optional nullable `parentReference: {id,title,slug}`
from existing batched ancestor hydration, so cards can link their mother without
per-card requests. `parentId` and each task's status remain independent. Moving a
child through an execution summary does not change its mother; existing final-status
summary requirements remain. Positional `beforeTaskId` still targets a sibling
with the same parent; this change does not redefine ordering across hierarchies.

Validation: the SQLite regression suite passed 7 tests across board subtasks,
HTTP domain flows, MCP and Overview; one PostgreSQL-only MCP test was excluded.
The new test covers cross-board ancestry, total/page parity, parent references,
HTTP/MCP parity, filters, optional rootOnly, independent child status and archive.
PostgreSQL execution and live UI acceptance remain separate; no product data or
runtime was changed by this delivery.

O Kanban inclui todas as tarefas ativas do próprio board, inclusive subtarefas em qualquer nível. A primeira página e as continuações usam o mesmo escopo; parentId é preservado. Cards de subtarefas identificam o vínculo e permitem abrir a mãe independentemente do status da filha. Filhas em outros boards não são importadas para a coluna da mãe.

O card usa um único link visível “Subtarefa” para abrir a mãe. O nome da mãe fica no tooltip e no rótulo acessível, preservando o contexto de retorno.

A navegação de seções da tarefa não adiciona padding no wrapper, na faixa mobile ou na lista de abas; botões mantêm padding interno e alvos de toque existentes.

A sidebar direita de contexto da tarefa usa padding horizontal desktop de 24px à esquerda e 4px à direita; o espaçamento vertical e o contexto mobile de uma coluna são preservados.

O menu global esquerdo usa padding horizontal de 12px por lado (antes 6px) e coluna de 68px (antes 56px), preservando logo/ícones centralizados e alvos de 44px em desktop e mobile. O padding vertical continua 6px.

O cabeçalho da tarefa usa 8 px entre título e descrição e 12 px entre os demais blocos, com padding de 12 px no resumo. O espaçamento interno do Markdown e a apresentação compacta da sidebar são preservados.

O contrato de novos resumos exige `RecordExecution.usageReport` não nulo, com 1 a 32 entradas. A leitura de `ExecutionSummary` mantém o campo opcional/nulo para legado. O frontend atual apenas consulta resumos e atividades: não expõe formulário nem adaptador de criação de resumo ou `close_activity`. Nenhuma declaração de indisponibilidade ou tentativa de coleta é gerada automaticamente.
Novo Collaborator é configurado no próprio chat: Leader cria primeiro o chat autorizado e solicita sua skill; ele identifica/reutiliza ou cria o perfil e vínculo aprovados, confirma persistência e retorna nome real com agentId/teamId e prontidão. Leader verifica antes de atribuir trabalho. A exceção inicial sem comentário cobre somente pedido/retorno de bootstrap; trabalho posterior mantém task/commentID e permissões do harness.
## Collaborator bootstrap bundle — 2026-11-02

Bundled Skills source `5fd5f0b280865609ab7de7a2770fefa092c21fd4` adds
`beeteam://references/collaborator-bootstrap`. The Leader first creates an authorized
Collaborator chat; that chat confirms/reuses or creates/configures its own profile
and team binding, then returns the real name, agentId/teamId and ready/pending.
The Leader verifies persisted identity/binding before assigning business work.
Only initial bootstrap, its readiness/blocker reply and strictly necessary registry
follow-up omit task/commentID; subsequent work retains the task/comment protocol.
This adds read-only guidance, not a new bootstrap API or automatic chat/profile
creation. The package contains 15 MCP resources; local SQLite startup guidance is
preserved, distinguishing standalone defaults from the legacy PostgreSQL script.
No runtime restart, global installation or business-data mutation is performed by
this backend bundle synchronization.

A Visão geral separa o consumo registrado de sessão (`recordedSessionUsage`, quando fornecido pela API) dos totais atribuídos à tarefa. Exibe deltas medidos/estimados e cobertura de sessões, referências iniciais e duplicadas; não soma snapshots, revisões ou páginas no cliente. Consumo de sessão pode incluir outros trabalhos e não deve ser somado ao total atribuído. Respostas antigas sem esse agregado e modelos não informados continuam sem inferências.

O gráfico de evolução dos resumos usa o horário de cada resumo e o delta medido de sessão projetado pela API para cada checkpoint. Pontos de referência/sem medida ficam numa faixa informacional separada de zero; linhas não atravessam lacunas. Foco, clique/toque e seletor consultam status, autor, modelo/harness e proveniência, com abertura somente de leitura do resumo por UUID. A paginação informa a cobertura carregada, sem alterar totais globais; nenhum executor histórico é inferido.
## Registered session consumption in Overview

Usage and Overview reads now expose `recordedSessionUsage` globally and on each
summary timeline item. Measured/estimated session deltas remain separate from
consumption attributed to the task: shared/unallocated evidence stays that way.
Baselines and duplicate references never inflate totals; unknown stays null.
The timeline retains status/author/model/harness/provenance for a per-summary line
chart without summing pages or raw cumulative snapshots in the client. See
[usage semantics](docs/summary-usage.md). This read-only addition does not modify
existing usage reports or claim an unrecorded historical task executor.

O gráfico de resumos preserva a área visual de 270 px e seus eixos sem checkpoints ou em respostas legadas sem uso agregado. O estado vazio não cria pontos, valores zero ou linhas; referências iniciais existentes permanecem pontos informacionais selecionáveis.

O mesmo padrão vazio vale para distribuição de subtarefas por status/responsável e evolução do progresso (eixo 0/50/100 preservado). Barras de cards, cabeçalho e sidebar usam trilho compartilhado: ausência é Sem dados, sem aria-valuenow nem preenchimento; zero registrado continua 0%. Pontos de progresso revelam data, percentual e ator por mouse/foco/toque. Tokens ficam não informados quando não há vínculo explícito do evento com evidência de consumo; não se usa proximidade temporal. Carregamento e erro continuam estados independentes.

O anel de seleção/foco dos pontos de progresso mantém formato circular mesmo entre registros próximos; a área clicável pode estreitar sem deformar o anel ou bloquear os pontos vizinhos.

Na Visão geral, a evolução do progresso é o primeiro gráfico abaixo das abas, seguida pelas distribuições de subtarefas por status e responsável.

Mudanças de status exigem registrar um resumo pela API; criação mantém status inicial e reordenação no mesmo status não é transição. A UI atual não oferece mudança de coluna/status nem criação de resumo: status é somente leitura, filtros e configuração de colunas não mudam o status das tarefas. O adaptador de demonstração rejeita statusId em patch de tarefa. O gráfico Evolução dos resumos usa reportedAt e statusObserved histórico de cada resumo; altura representa delta de tokens de sessão, sem converter status em percentual. O gráfico independente de progresso permanece disponível.

As skills orientam toda mudança de status após a criação exclusivamente pelo registro de resumo, atômico com statusObserved e usageReport obrigatório. close_activity precisa usar o mesmo serviço de resumo; updateTask/moveTask não são atalhos para transição. Atualização isolada de percentual de progresso continua permitida conforme contrato.
### Task status changes require execution summaries

New status transitions must use `POST /api/v1/tasks/{taskId}/execution-summaries`
(`createExecutionSummary`) or `close_activity` with a complete execution payload.
Task status, summary, usage report and the server-owned historical `statusObserved`
snapshot are committed atomically. A currentSummary string alone is insufficient.
`moveTask` only reorders within the current status (including final statuses);
a different status returns HTTP 409 `summary_required`. PATCH/updateTask rejects
statusId with HTTP 400 `invalid_request`, even if unchanged. Task creation retains
its initial non-final status, and independent percentage/progress updates remain
available. Existing historical records and exact saved POST replays are preserved.
No migration or service restart is required by the source change itself; clients
and bundled guidance must be aligned before runtime activation.
Os pontos de Evolução dos resumos abrem um popover ancorado com autor, data, status histórico e deltas medido/estimado. Hover, foco e toque são suportados; Escape, saída do mouse e clique externo fecham. O portal evita corte por overflow/sticky; o detalhe abaixo permanece como alternativa.


Os pontos de **Evolução do progresso registrado** abrem um popover ancorado por
mouse, foco de teclado ou toque, com data, autoria, percentual e nota do evento.
Escape, saída do mouse ou clique fora fecham o detalhe. Esses eventos não possuem
vínculo explícito com resumos: status histórico e tokens permanecem não informados.
Nos resumos com baseline de sessão, o detalhe também exibe o snapshot acumulado
registrado (entrada + saída), sem somar cache/raciocínio novamente. Essa referência
não é atribuída à tarefa, não altera totais nem substitui o delta ausente.

### Harness token source survey (before scope decision)

[Verified harness sources](docs/harness-token-sources.md) records official Codex,
Copilot CLI/SDK/VS Code, Claude Code, Cursor and Kiro telemetry capabilities checked
on 2026-11-02, including endpoint/export paths and surface limitations. This is
capability research, not an installed collector. The new required numeric-total
and responsible-agent write contract is pending the user's scope decision
(session cumulative consumption versus task-separated consumption); the current
runtime validation has not been changed by this documentation-only update.


### Earlier real usage guidance bundle — 2026-11-02

Bundled Skills source `88f3a44f6ad0c9dc07db817604144d7b176e3e10` requires actual
model/harness/agent/token/source evidence before a new summary, using the current
usageReport.entries payload. This is stricter skill guidance, not a new schema:
no tokenUsage/totalTokens field was added, and baseline-only snapshots are not
rejected merely for being initial. The user's decision on session cumulative
versus task-separated total remains pending. When reliable evidence is absent,
record the impediment through a comment rather than inventing usage or reporting
successful summary persistence. Existing SQLite startup/bootstrap overlays remain.


### Required cumulative session total — 2026-11-02

The scope decision is resolved: new summaries require the real **session cumulative**
usage through the observation time, including the first snapshot (no prior baseline
or delta required). Send `usageReport.entries[].totalTokens` as a decimal integer
string equal to inclusive `inputTokens + outputTokens`, with both components,
`quality: measured`, `reportKind: cumulative_snapshot`, session/session_tree scope,
an identified `modelId` and `actor: {kind: agent, id: <persisted UUIDv7>}`.
Do not add cache/reasoning subsets, sum snapshots, or label this as exclusive task
consumption. Missing source/total/model/agent fails clearly; unavailable is not a
substitute for a new summary. Old reports and exact saved replays stay valid.
See [current contract](docs/summary-usage.md) and [official source survey](docs/harness-token-sources.md).

The required cumulative session contract remains in effect; see its [verification](docs/required-session-total-verification.md). The current bundled Skills source is documented under explicit task execution intervals below, with SQLite/bootstrap overlays retained.

Novos resumos exigem observações medidas com acumulado `totalTokens`, modelo e
agente identificado, em escopo de sessão ou sessão e descendentes. O frontend
sincroniza `RecordExecution` com `SessionUsageInput`; não oferece formulário de
criação de resumo. Detalhes, checkpoints e popovers mostram cada snapshot até
`observedAt`, incluindo os posteriores ao baseline, sem somar checkpoints ou
árvores e subagentes. `totalTokens` é autoritativo; no histórico sem esse campo,
entrada + saída é exibida como cálculo legado somente quando ambos existem.
O acumulado permanece separado dos deltas e dos totais atribuídos à tarefa.

Implementação de [consumo por tarefa com intervalos de sessão](docs/task-session-intervals-spec.md), com [verificação de integração](docs/task-session-intervals-implementation.md). A ativação local requer executar a API atualizada; dados antigos não recebem fronteiras inferidas.

As skills passam a orientar intervalos explícitos de trabalho: início salvo antes de executar, checkpoint, pausa antes de trocar tarefa, retomada em novo intervalo e encerramento independente do aceite/status final. IDs retornados e evidências vinculam as fronteiras; texto, status e proximidade temporal não substituem os vínculos. Payload/leituras dependem do contrato Backend e não são inventados pela skill.

A visão geral inclui **Consumo por intervalos da tarefa**, alimentado pelas leituras
`execution-interval-usage`, `execution-intervals` e `execution-tracking-events`.
Totais globais vêm da API, independentemente das páginas carregadas: intervalos
válidos, parcelas parciais, cobertura e durações observada somada/decorrida permanecem
separados dos acumulados de sessão. A linha do tempo mostra início, checkpoint,
pausa, retomada e fim com status histórico, autor, modelos, fonte, coleta e resumo
explicitamente referenciado. Pontos suportam mouse, teclado e toque; o espaçamento
visual separa registros e não representa duração. A seleção também fica disponível
abaixo do gráfico, que permanece visível sem dados.

O detalhe de intervalo mostra fronteiras observadas e recebidas, evidências,
segmentos e diferenças calculadas pelo servidor. Resumos e intervalos são resolvidos
por UUID, nunca por proximidade de horário. Revisões anteriores podem ser consultadas
sem substituir o cálculo atual. Estados abertos/incompletos/ausentes não viram zero,
e encerramento enquanto pausado não cria nova coleta. O frontend não abre, encerra,
reconcilia nem preenche intervalos legados automaticamente. Rollout depende da API
com esses endpoints; falhas e indisponibilidade são exibidas com tentativa novamente.

### Explicit task execution intervals

Execution summaries optionally accept `executionTracking` (`start`, `checkpoint`, `pause`, `resume`, `finish`) in the same HTTP/MCP transaction as status and measured session usage. Start before work, retain the returned execution/interval UUIDs, and pause/finish before switching tasks. Checkpoints expose partial consumption; task totals use final valid intervals, never a sum of snapshots. Pauses, resets, missing model-series boundaries and declared recovery gaps are not fabricated as work. Session usage remains a separate metric.

The API exposes paginated executions, intervals, events, immutable prior calculations, open-interval recovery across tasks, and complete task totals with coverage, summed observed duration and elapsed duration. Source/root and source/session exclusivity excludes agent/model/epoch from locks and checks closed ranges during corrections. Counter/root metadata is an explicit declaration, not authentication or proof that a harness exclusively worked on the task. New interval tables use independent additive SQLite/PostgreSQL migrations; legacy summaries/replays remain intact and tracking is not yet mandatory for old clients.

See [contract and limitations](docs/task-session-intervals-contract.md) and [validation](docs/task-session-intervals-verification.md). Bundled MCP Skills source is `3265680f383f4645827b341fd95104fc97b00853`, including `beeteam://references/execution-intervals`. Portable archives include the five relational groups; archives predating them may omit all five, interpreted as empty without creating historical attribution. Existing empty-destination, cancellation, timestamp and commit-marker rules are unchanged.

A Visão geral termina no consumo por intervalos: mantém evolução do progresso e distribuições, sem repetir os blocos textuais e históricos das demais abas. Os percentuais vinculados explicitamente a resumos abrem a aba Resumos e carregam até o ID selecionado, preservando eventos antigos sem associação.

A evolução do progresso apresenta gráfico à esquerda e registros sempre visíveis em card à direita no desktop, ambos com 215 px de altura; a tabela tem rolagem interna e cabeçalho fixo. Em telas menores os blocos ficam empilhados.

O gráfico de progresso mantém detalhes somente nos pontos, sem repetir o registro selecionado nem explicações abaixo do gráfico e da tabela.

O consumo por intervalos usa indicadores compactos e etiquetas de cobertura, sem parágrafos explicativos. Valores ausentes aparecem como traço acessível; zero medido continua exibido como zero.

A aba Resumos apresenta cada registro em um Card do shadcn, com autor, data e resultado no cabeçalho. Markdown, métricas, entregas e pendências permanecem completos, separados dentro do mesmo card.

A lista de subtarefas mostra a barra e o percentual registrado em cada tarefa. Ausência de progresso mantém a barra vazia e um traço; não presume zero nem infere avanço pelo status.

A Visão geral inclui uma lista compacta de subtarefas com rolagem infinita interna, responsável, status e progresso. A aba Subtarefas permite combinar filtros de status, responsável, bloqueio e arquivamento; as opções de status e responsável vêm dos agregados completos da tarefa, inclusive subtarefas ainda não carregadas.

Os filtros compactos de subtarefas têm ícones distintos para status, responsável, bloqueio e arquivamento, preservando nomes acessíveis e tooltips.

Na Visão geral, a lista de subtarefas é apresentada diretamente na página, sem card nem rolagem interna: total, nome e progresso em linhas compactas. Carrega os demais itens pela rolagem da página e inclui arquivadas, acompanhando o total dos gráficos.
O percentual ocupa sua largura de conteúdo ao lado da barra flexível, com respiro de 8px
à direita da linha. Títulos longos e 100% não criam rolagem horizontal nem invadem a scrollbar.

Os gráficos de subtarefas por status e responsável ficam no início da aba Subtarefas. Resumos repete o gráfico de evolução no topo e organiza índice de registros à esquerda e cards à direita, empilhados no celular. O índice usa o vínculo explícito com o resumo.

Subtarefas por status usa gráfico de pizza e legenda com quantidade e percentual. Fatias e legendas filtram a lista; o gráfico permanece vazio quando não há subtarefas.

A Visão geral mostra somente o gráfico de evolução; a tabela de registros fica exclusivamente no índice da aba Resumos.


### Filtro exato de resumo

`GET /api/v1/tasks/{taskId}/execution-summaries?id={summaryId}` e MCP `listExecutionSummarys` aceitam `id` UUIDv7 opcional. O filtro combina com a tarefa e os demais filtros antes da contagem e paginação; seleção fora da primeira página não exige percorrer páginas intermediárias. ID inexistente, excluído ou de outra tarefa retorna página vazia; formato inválido ou UUID de outra versão retorna 400. Remover `id` restaura a coleção paginada. Os predicados existentes SQLite/PostgreSQL são reutilizados, sem migração. Esta entrega valida SQLite isolado e paridade HTTP/MCP; PostgreSQL foi dispensado neste escopo e não foi executado. Publicar código não atualiza a API em execução.
Na aba Resumos, o índice compacto usa scroll infinito compartilhado em sua própria área de rolagem e permanece disponível ao filtrar.
O índice carrega novas páginas automaticamente enquanto houver espaço, interrompe no fim ou em erro e permite tentar novamente sem descartar os itens carregados.
Selecionar um título aplica `summaries.selected` ao filtro padrão Resumo e consulta
`GET /api/v1/tasks/{taskId}/execution-summaries?id={summaryId}` diretamente, sem buscar
páginas intermediárias ou rolar até o registro. Limpar o filtro restaura a lista; voltar e
avançar restauram a seleção pela URL. Requer a API com suporte ao filtro `id`.
Os títulos são trechos da primeira linha não vazia, exibidos como texto simples. As barras
usam somente vínculos explícitos `summaryId` no histórico disponível: ausência de vínculo
ou de cobertura aparece vazia, distinguida de progresso registrado em 0%.

No mobile, o índice lateral de Resumos fica oculto. O filtro padrão mantém suas opções com scroll infinito próprio, compartilhando o cache do índice e buscando páginas apenas conforme a área visível exige. Seleção pela URL, tags removíveis e docking continuam disponíveis.
As skills orientam projeto obrigatório com nome/raiz absoluta separado da especificação Markdown, somente nas pastas/worktrees envolvidas. Repositórios são descobertos pelo Bee Team, não informados pelo agente; coleta Git real sustenta evidências de commits por resumo. Investigação sem commit é válida; nunca criar commit apenas para preencher declaração. Raiz do checkout, remotes sem credenciais, branch histórica, hash completo e publicação confirmada permanecem fatos distintos, sujeitos ao contrato Backend.

A aba Especificação apresenta `Task.workScope` em cards Projetos (nome/pasta raiz) e
Repositórios (nome/link web e relações explícitas com projetos), ao lado do Markdown no
desktop e empilhados no mobile. Estado legado ausente, a identificar e não aplicável
continuam distintos; nenhum vínculo é extraído do texto ou aberto no filesystem.

Resumos com `commitReport.hasCommits=true` mostram o snapshot histórico de repositório,
branch nomeada/detached/desconhecida, hash curto e campo somente leitura com hash completo.
Links exigem publicação declarada com data, URL HTTP(S) sem credenciais/query/fragmento e
caminho exato GitHub/GitLab para o hash, incluindo hosts explicitamente declarados.
Referências locais/desconhecidas permanecem texto; declarações false e legados não criam
uma seção vazia. Não há formulário de gravação de resumos no frontend.

Arquivos oferece busca literal por nome, tipo MIME exato aplicado ao confirmar e inclusão
de removidos, usando parâmetros reais `fileName`, `mediaType`, `includeRemoved`, combinados
na URL e no filtro padrão com tags/limpar/docking. A lista reutiliza o scroll infinito em
lotes de 10. Metadados removidos são identificados; seu botão de download fica desabilitado.
Os controles usam ícones distintos de busca, tipo de arquivo e lixeira, mantendo tooltip,
nome acessível e indicação de filtro ativo tanto no desktop quanto no mobile.
As tags expandidas respeitam a borda direita do resumo, incluindo o estado recolhido e
o dock mobile, sem aumentar a largura rolável da página. Regressão visual documentada em
[filter-summary-overflow-qa.md](docs/superpowers/plans/2026-11-03-filter-summary-overflow-qa.md).
Cada arquivo aparece em uma linha compacta com ícone de categoria, nome em destaque,
tamanho legível, autoria/data e ação de download. O MIME determina a categoria; somente
tipo vazio ou binário genérico usa a extensão como fallback. Tipos desconhecidos mantêm
ícone genérico. O MIME original e bytes exatos permanecem no título dos metadados.
Removidos preservam descrição e data de remoção, com badge, nome secundário e download
desabilitado. No mobile, nomes quebram linha e a ação fica abaixo dos metadados.

Na Conversa, cada mensagem mostra tempo relativo no canto superior direito, na mesma
faixa do avatar e da identidade do autor, com alinhamento pelo topo. Reutiliza o relógio compartilhado de `RelativeTime`; hover/foco
revela a data e hora exatas em tooltip, e clique/toque abre o mesmo dado em popover.
Nomes longos quebram linha sem sobrepor a data; ordenação e ancoragem de scroll são preservadas.

### Projetos, repositórios e commits de execução

Novas tarefas exigem `workScope.projects` com ao menos um projeto nomeado e pasta absoluta. Repositórios são descobertos localmente pelo servidor, sem fornecê-los como entrada. Pastas sem Git ou inacessíveis continuam cadastráveis, com resultado da descoberta por projeto. O campo permanece opcional apenas nas leituras de tarefas antigas. Editar a especificação de um legado sem projeto exige a lista na mesma chamada; outras edições continuam permitidas. Para atualizar a descoberta, envie novamente os projetos por PATCH com If-Match. Detalhes em [project-discovery-contract.md](docs/project-discovery-contract.md). Cada novo resumo exige `commitReport`: `hasCommits: false` com lista vazia ou `true` com referências completas. Branches nomeadas, detached HEAD e estado desconhecido permanecem distintos; os nomes e URLs dos repositórios são copiados para o histórico. Links exigem publicação declarada com verificação remota, provedor e URL web explícitos e hash completo correspondente. O servidor inspeciona Git local em modo somente leitura, mas não confirma publicação remota. Registros antigos sem declaração continuam ausentes; replays salvos são preservados. Contrato e exemplos em [summary-repository-contract.md](docs/summary-repository-contract.md).

A entrada de escopo agora contém somente `workScope.projects` (key, nome e pasta raiz
absoluta). A criação exige projetos; PATCH substitui a lista e solicita nova descoberta
pelo backend. Repositórios e metadados Git são saída derivada, nunca campos de entrada.
A interface atual não oferece formulário de criação/edição de escopo. A demonstração
rejeita essa escrita como indisponível, sem simular uma inspeção do filesystem.

Nos cards, cada projeto conserva seu nome e sua pasta declarada, sem repetir raiz do
checkout, branch ou data da inspeção. Os metadados de descoberta continuam no contrato
da API. O card Repositórios é ocultado quando
não há repositórios vinculados aos projetos declarados. Outras worktrees e o diretório Git
compartilhado não são apresentados como projetos envolvidos. Commits históricos continuam
usando seus snapshots originais, independentemente de novas descobertas.

Os botões **Abrir no Explorer** e **Abrir no VS Code** enviam uma ação explícita para
o computador Windows onde a API Bee Team está rodando. A API resolve a pasta pela
task UUID e chave do projeto cadastrado; o navegador não envia caminho nem comando.
O card mostra espera e erro e evita cliques concorrentes. A confirmação significa
solicitação enviada ao processo, não comprovação de uma janela visível. A demonstração
não simula abertura. Contrato: [local-projects-openapi.json](docs/local-projects-openapi.json),
também disponível em `/openapi/local-projects.json`.

A rota POST exige listener e conexão loopback, Host local, Origin local quando
presente e `X-Bee-Local-Action: open-project`; rejeita headers de encaminhamento.
Isso protege o uso direto local e a prévia Vite local. Não exponha essa rota por
túneis/proxies remotos; metadados de ator não são autenticação. Não há ferramenta MCP
de abertura, mudança de banco, retry automático ou idempotência persistente: após
timeout, confira o desktop antes de repetir. Pastas inexistentes, arquivos, caminhos
relativos/UNC/dispositivos e aplicações ausentes retornam erro. O adaptador verifica
a pasta antes de iniciar um `.exe` absoluto, sem `cmd`, PowerShell, `.cmd` ou busca
em PATH. Explorer usa `%SystemRoot%/explorer.exe`; VS Code usa a instalação padrão
em `%LOCALAPPDATA%/Programs/Microsoft VS Code`, `%ProgramFiles%/Microsoft VS Code`
ou `%ProgramFiles(x86)%/Microsoft VS Code`. Outras instalações e outros sistemas
operacionais são reportados como indisponíveis, sem fallback para shell.

Referências da implementação: [argumentos de processos Rust](https://doc.rust-lang.org/stable/std/process/struct.Command.html)
e [CLI do VS Code](https://code.visualstudio.com/docs/configure/command-line).

## Evidência nos pontos de progresso

Ao abrir um ponto com `summaryId`, o frontend consulta somente o resumo vinculado pelo filtro exato de ID e tarefa. O tooltip exibe o status histórico e as observações de uso, separando acumulados de sessão de deltas e atribuição à tarefa. Pontos legados sem vínculo continuam sem status/consumo inferidos; carregamento, erro e resumo indisponível são estados distintos. Não há associação por proximidade de horário nem soma de snapshots.

## Harnesses e modelos na Visão Geral

Os cards mostram harnesses registrados sem duplicações e presença de modelos por resumo distinto. As barras representam quantos resumos mencionam cada modelo; não representam tokens. A leitura percorre todas as páginas de uso antes de exibir contagens e rejeita páginas inconsistentes, sem apresentar um total parcial como completo. Ausência de evidência mantém os dois cards vazios. Ícones monocromáticos locais do Lobe Icons 1.102.0 (MIT, licença e proveniência em `frontend/public/harness-icons`) têm nome acessível, tooltip e fallback para harnesses desconhecidos. Na mesma faixa do desktop, subtarefas compactas e seus percentuais ficam à esquerda; harnesses e modelos ficam empilhados à direita, nessa ordem. No mobile, a faixa vira uma coluna, respeitando ambos os temas.

## Navegação da Timeline

A Timeline reutiliza o índice lateral e os controles de Resumos. `timeline.selected` guarda o Event ID na URL e consulta `timeline?id=...`, combinado com o escopo da tarefa/descendentes, antes de count/paginação. Limpar restaura a lista infinita; voltar/avançar restauram a seleção. O índice fica oculto no mobile e o filtro continua disponível. O gráfico superior usa todos os tipos de eventos da própria tarefa, em ordem de sequência, pela API leve `timeline-points`: somente ID, tarefa, tipo, data e sequência. As páginas de até100 pontos são carregadas automaticamente até `hasMore=false`, sem botão nem dependência da rolagem da página. Carregamento parcial, erro e paginação inconsistente são explícitos; falhas permitem tentar novamente. O gráfico mantém largura dinâmica e rolagem horizontal. O evento completo é buscado pelo ID exato somente ao abrir o popover (mouse, foco ou clique). Selecionar um evento filtra os cards sem reduzir os pontos do gráfico; os cards continuam em consulta e infinite scroll independentes. “Ver evento” seleciona o Event ID e fecha o popover, sem modal. Histórico de progresso em Resumos continua restrito aos registros explícitos de progresso, sem inventar pontos a partir de comentários ou planos.

Os cards exibem detalhes completos por leituras exatas: `execution-tracking-events?summaryId=...` e `execution-summaries?id=...`, sem percorrer páginas intermediárias. Event ID, TrackingEvent ID e Summary ID permanecem distintos. Essa interface requer os contratos Backend dos commits `54bb4005e6d439da5eda9c405222fd0ecf0f312a` e `1cb6e08c356c82054cf2addd93b062404813b868`; o build frontend não atualiza a API em execução.

Todos os tipos de evento usam a mesma composição Card/Header/Content dos Resumos, com tarefa de origem, autoria, data e número do evento. Comentários carregam pelo endpoint de ID exato; planos percorrem revisões até o ID registrado, nunca substituindo pela revisão atual; anexos preservam metadados e estado de remoção. Alterações mostram os campos registrados antes/depois; sínteses, notas e conteúdo Markdown são legíveis dentro do card. Eventos de execução mantêm sua síntese acumulada separada do resumo histórico. Ausência/erro de referência é explícito; campos desconhecidos têm apresentação legível, e o registro original continua disponível em uma seção recolhida. O cabeçalho do gráfico usa espaçamento compacto entre título e descrição.

Logo abaixo das abas, a Visão geral exibe tokens válidos, duração somada e tempo decorrido no consumo por intervalos; o indicador de tokens parciais não é exibido nesse painel.

Os botões de abertura de projetos usam apenas ícones com nomes acessíveis, sem mensagem de sucesso; falhas continuam visíveis. O SVG do Visual Studio Code vem do pacote oficial em https://code.visualstudio.com/brand.

A timeline de execução mantém a rolagem horizontal dentro do próprio gráfico em telas estreitas, sem o seletor e o bloco de detalhes repetidos abaixo. Detalhes nos pontos e histórico de revisões continuam disponíveis.

Os pontos selecionados ou em foco nos gráficos e na timeline usam o mesmo hexágono SVG da marca, mantendo o ponto central e a área de interação.

Os eventos da timeline se distribuem proporcionalmente por toda a largura disponível; muitos registros preservam o espaçamento mínimo com rolagem interna.

As abas da tarefa seguem: Visão geral, Especificação, Planos, Subtasks, Conversa, Resumos, Arquivos e Timeline.

O cabeçalho da tarefa mantém apenas o breadcrumb global do topo; não repete o caminho acima do título. Relações da lateral permanecem disponíveis. O card “Resumo atual do trabalho” do cabeçalho usa fundo transparente com borda discreta, preservando conteúdo, autoria/data e padding; cards históricos de Resumos e Timeline mantêm suas superfícies.

O bloco de consumo na Visão geral não usa divisórias horizontais e mantém espaçamento compacto até a evolução do progresso.

O filtro MIME em Arquivos oferece atalhos com ícones e extensões dos tipos presentes em todas as páginas e aplica a digitação válida automaticamente após 300 ms.

O filtro MIME permite seleção múltipla nos atalhos ou tipos separados por vírgula; os resultados incluem qualquer tipo selecionado, mantendo os demais filtros e a paginação.

Na timeline, o tooltip traz apenas ação, agente e status. O item do histórico oferece Detalhes da execução, com resumo, evidências e intervalo consultados pelo ID do resumo quando expandido.

Os tooltips de progresso e execução são compactos, sem botão Fechar; Ver resumo aplica o filtro pelo ID, e Ver evento abre o detalhe completo em um painel de diálogo.

A consulta da timeline aceita `id=<UUIDv7 do evento>` para selecionar um evento exato antes da contagem e paginação. O filtro mantém o escopo da tarefa e de `includeChildren`, além dos demais filtros; eventos fora do escopo retornam página vazia. O mesmo parâmetro está disponível em `getTimeline.query.id` no MCP.

A consulta `GET /api/v1/tasks/{taskId}/execution-tracking-events` aceita `summaryId=<UUIDv7>` (MCP: `listTaskExecutionTrackingEvents.query.summaryId`) para obter os eventos completos vinculados explicitamente ao resumo, sem percorrer páginas ou inferir horários. O filtro é aplicado antes da contagem e paginação, combina com `executionId` e `intervalId` e preserva o escopo da tarefa; resumo inexistente ou de outra tarefa retorna página vazia.

O gráfico pode carregar todos os pontos por `GET /api/v1/tasks/{taskId}/timeline-points` (`getTimelinePoints` no MCP), seguindo `nextOffset` automaticamente até `hasMore=false`. Cada ponto contém somente `id` (Event.id), `taskId`, `type`, `occurredAt` e `sequence`; o endpoint mantém filtros/escopo da timeline e páginas de até 100 itens. A projeção ocorre no banco sem carregar o payload completo dos eventos. Cards e detalhes continuam independentes em `timeline`/`timeline?id=...`. Uma página parcial ou com erro não representa o histórico completo; cada página tem snapshot próprio e eventos novos exigem atualização da consulta.

O conteúdo editorial anunciado pelo MCP (ferramentas, schemas, prompts e recursos Bee Team) é fornecido em inglês. As descrições dos contratos HTTP compartilhados permanecem na fonte original e recebem tradução somente na apresentação MCP. Nomes técnicos, valores de contrato e dados fornecidos pelos usuários, inclusive contexto persistido anexado a prompts, não são traduzidos.
# Criação de status no frontend

Nas configurações do board, **Adicionar status** revela o formulário e foca o nome. **Salvar** cria o status e recolhe o formulário; falhas mantêm o rascunho para nova tentativa. **Cancelar** ou Escape descartam o rascunho sem gravar. Durante o envio, os controles ficam desabilitados para evitar duplicação. Criação e edição usam **Conta como concluído**, com a mesma semântica do campo `isDone`.

Na Visão Geral, Harnesses utilizados e Modelos utilizados são seções sem superfície, borda ou sombra externa, mantendo ícones, barras e estados de leitura. O layout continua com subtarefas à esquerda e presença empilhada à direita, empilhando tudo no mobile. Modelos não exibe o subtítulo redundante; contagens e descrição acessível das barras permanecem. Na Timeline, o eixo fica a 40px do topo do plot, com legendas abaixo e rolagem horizontal preservada.

No mobile, o botão Info abre uma tela própria de detalhes da tarefa (`task.view=details`), com Voltar e os mesmos controles do contexto desktop. Aba, filtros e origem permanecem na URL; o conteúdo principal e os formulários continuam montados. Entrada direta retorna à tarefa sem depender de histórico anterior. Desktop conserva a sidebar.


## Layout compartilhado de detalhes

Task, Agent e Team usam os componentes de `frontend/src/components/detail-layout`: shell por slots, cabeçalho, navegação horizontal opcional, contexto responsivo e observação do cabeçalho. Esses componentes recebem conteúdo, labels traduzidos e callbacks, sem consultar API ou conhecer entidades. Os adapters mantêm queries, regras de domínio, navegação, formulários e filtros.

No desktop (1056px ou mais), conteúdo e sidebar têm rolagem independente. No mobile, Info abre uma tela própria e Voltar restaura a página, aba, filtros e rolagem; os controles continuam montados ao alternar a tela ou redimensionar. As chaves são `task.view`, `agent.view` e `team.view`, sem alterar slugs. O padding direito é 1rem, respeitando safe areas. Configurações de Agent/Team continuam em `/settings` com os formulários fora do conteúdo oculto. Agent apresenta Perfil, Tarefas e Chats; Team mantém membros e boards com paginações independentes, sem novas abas. Troca de idioma mantém identidade dos componentes e conteúdo fornecido pelo usuário.

A navegação principal de Agent e Team segue Board: breadcrumb global no desktop e Voltar no breadcrumb compacto mobile, sem botão duplicado no conteúdo. O Voltar da tela própria Info permanece dedicado ao retorno à mesma entidade.

Links antigos com `agent.tab=resume` ou `tab=resume` abrem Perfil. Instruções de trabalho e contexto permanecem no perfil; o frontend não consulta mais o endpoint de retomada do agente.

Vínculos do agente aparecem somente no contexto lateral desktop e na tela Info mobile, sem duplicação na aba Perfil. Memberships e navegação para o time permanecem disponíveis.

Nos detalhes de Agent, Tasks e Chats usam scroll infinito; em Team, Membros e Boards geridos carregam independentemente. `DetailRecordList` reutiliza o controlador `useInfiniteScroll`, marcador de 60px e loading padrão. Carrega páginas limitadas quando o fim está visível, deduplica pela identidade do registro, mantém totais da API e registros já carregados em erros, com retry da página pendente. Filtros/limites/from permanecem na URL; offsets legados não ocultam registros iniciais. Desktop observa o painel principal e mobile observa a página.
A consulta agregada de retomada de agentes foi removida da API e do MCP, junto ao prompt específico. Perfil (`workInstructions` e `contextSummary`), contexto dos times e conversas permanecem nas consultas próprias. A continuidade de tarefas usa `task_briefing`/`prepare_execution` e leituras explícitas; os intervalos `start`/`pause`/`resume`/`finish` permanecem disponíveis.

Chats de Agent oferecem filtros por nome (substring), harness (igualdade exata), cadastro ativo/arquivado e período de criação. Dias inicial/final são inclusivos no fuso do navegador, informado no controle; a API recebe `createdFrom` inclusivo e `createdBefore` exclusivo na meia-noite do dia seguinte, respeitando mudanças de horário. Filtros ficam em `chats.label`, `chats.harness`, `chats.archived`, `chats.createdFrom` e `chats.createdUntil`; mudanças reiniciam a coleção paginada. Limpar mantém limite/origem e permite Voltar restaurar o conjunto anterior. Datas inválidas/invertidas bloqueiam a consulta e permitem correção/limpeza.

### Última atividade registrada do agente

`GET /api/v1/agents/{agentId}/latest-activity` e a tool MCP `getAgentLatestActivity` retornam `{activity: null}` ou um evento compacto com `type`, `occurredAt`, `taskId`, `taskSlug`, `taskTitle`, `eventId` e `summaryId` nullable. A autoria vem exclusivamente de `actorKind=agent` e `actorId` no evento persistido da tarefa, nunca de atribuição da tarefa ou atualização do perfil. Não representa presença online.

A seleção usa o instante `occurredAt` decrescente, preservando frações e offsets, seguido de `sequence` e `eventId` decrescentes. Inclui tarefas, boards e agentes arquivados; exclui agente inexistente/deletado (404) e eventos, tarefas ou boards deletados. `summaryId` exige referência explícita `execution.recorded` a resumo não deletado da mesma tarefa. Slug/título são metadados atuais. Falhas de consulta continuam erros, não ausência de atividade. SQLite e PostgreSQL usam snapshot consistente, filtro de autoria indexado e `LIMIT 1`, sem hidratar históricos completos.

O Perfil do agente mostra Última atividade a partir de `GET /agents/{agentId}/latest-activity`: evento persistido com autoria declarada do próprio agente, sem inferir atividade de updatedAt ou executor atual. O bloco usa tipo traduzido, título da tarefa preservado, tempo relativo com data exata e link para o evento na Timeline com origem de retorno. Ausência é explícita; falha permite retry e não significa ausência. A consulta inclui tarefas arquivadas acessíveis, exclui registros deletados e não representa presença online.

Appearance settings separate the Default/Codex/Claude Code/Copilot palette from light/dark/system mode, persisted locally without changing existing mode preferences. Source versions, exact tokens and neutral role adaptations are documented in [theme palette provenance](docs/design/theme-palettes.md).

Harness icons in task Overview use transparent button backgrounds in every palette and mode, retaining their symbols, tooltips and keyboard focus outline.

In Codex, board/team/agent listing cards use the secondary-button surface in both modes. Page backgrounds, Kanban task cards and other palettes retain their existing surfaces. The read-only browser regression script `frontend/scripts/check-list-card-surfaces.cjs` compares a baseline build (`--baseline`) with the updated build across four palettes, two modes and desktop/mobile. Set `QA_PLAYWRIGHT_MODULE`, `QA_BROWSER_EXECUTABLE`, `QA_API_URL` and `QA_BOARD_PATH` to a populated test board; run it from the repository root. Evidence stays under `.local/qa/codex-list-surfaces`.
