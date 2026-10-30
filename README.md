# Bee Team

Servidor local Rust para perfis/times de agentes e boards/tasks. A IA e o harness executam o trabalho; Bee Team guarda configuração, autoria declarada, planos, arquivos e resultados. Não cria chats nem acessa provedores de IA.

## Executar

Requer Rust >=1.94. PostgreSQL >=18 is the default; SQLite is available through explicit environment selection. A migration recusa versões anteriores. O `docker-compose.yaml` existente utiliza PostgreSQL 18; use um banco dedicado e preserve volumes existentes.

```powershell
docker compose up -d postgres
$env:DATABASE_URL="postgres://postgres:postgres@127.0.0.1:5453/postgres"
$env:OTEL_ENABLED="false"
$env:MCP_ENABLED="true"
cargo run --features mcp
```

Por padrão escuta em `127.0.0.1:59865`. `APP_HOST`, `APP_PORT`, `APP_CORS_ALLOW_ORIGINS`, `APP_BODY_LIMIT_BYTES`, `MCP_PATH` e `MCP_ALLOWED_ORIGINS` continuam configuráveis. Migrations rodam no startup. Sem `--features mcp` ou sem `MCP_ENABLED=true`, `/mcp` não é montado.

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
for packaging, discovery, parameters, and integration checks. Public MCP names match the backend catalog: `task_briefing`, `agent_resumption`,
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
manual handoff, not an alternative launcher. PostgreSQL 18 remains the supported
default path in this workflow; SQLite is an explicit opt-in described below. Data conversion is outside its scope.


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
após commit. SQLite is an explicit opt-in; see below.

`tests/repository_boundaries.rs` verifica isolamento de camadas, leituras durante
gravações, ausência de leitura de tabelas alheias, estabilidade do snapshot,
proteção contra gravação em leitura e paginação. Rode os testes com
`BEE_TEST_DATABASE_URL` apontando para PostgreSQL 18 isolado, nunca para dados do produto.


## SQLite environment opt-in

PostgreSQL stays the default when `DATABASE_DRIVER` is absent or empty. Set
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
executable; PostgreSQL stays the default and SQLite remains explicit opt-in.

```powershell
# Run the copied executable from a writable application directory.
$env:DATABASE_DRIVER="sqlite"
$env:DATABASE_URL="sqlite://./beeteam.sqlite"
$env:APP_HOST="127.0.0.1"
$env:APP_PORT="59865"
$env:OTEL_ENABLED="false"
$env:MCP_ENABLED="true"
$env:BEE_FRONTEND_MODE="embedded"
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

The first Motion pass animates filter positions with a damped spring, reveals Clear after space opens, and gives filter popovers short entrance/exit transitions while Radix retains keyboard and focus handling. Page changes use a 180 ms opacity entrance on the existing main surface; shell, query-string changes, and settings stay stable without retaining or remounting route children. Reduced-motion preferences make these transitions immediate. Search/tag CSS transitions remain independent.

Active-filter tags use 30% opacity for the entire stack at rest and 100% on hover, keyboard focus, or touch expansion, with a 160 ms CSS transition disabled for reduced motion. Hit areas and filter-removal behavior stay unchanged.

Kanban columns load at least six root active tasks initially (or all available when fewer), then append another viewport-sized batch when the user scrolls within 300 px of the bottom. Each column keeps an independent native scrollbar and its loaded pages during live refresh; requests consume AbortSignal, deduplicate IDs, and stop on a non-advancing cursor. Filter/board changes reset the column viewport. Errors retain cards and offer retry; exhausted columns end silently with 1rem breathing room. Task assignee avatars are fixed 28px circles; only the name is underlined on hover. Column scrollbar thumbs are subtle, with space from cards; card hover/focus outlines remain inset to avoid clipping.

Kanban column scrollbar thumbs follow the card color in dark mode, brighten on hover, and retain the light-mode and forced-color fallbacks.

On mobile (up to 850px), Kanban uses native horizontal scroll snap with one nearly full-width column and a preview of the next. A 44px previous/next toolbar names the current status and total; navigation stops at the first/last column and honors reduced motion. All columns remain mounted, retaining vertical scroll and fetched pages when moving back and forth. Desktop keeps the multi-column layout. The inner scrollbar retains a small 2px card gap without excessive right padding.

Board, agent and team listing cards include a consistent decorative filled type mark at the top left, with header space reserved to avoid overlap; existing role/autonomy symbols and card height remain separate.

Agent listing cards place the avatar at the right of the header, with the decorative type mark remaining at the top left; task assignee avatars are unchanged.

Kanban column anchors also survive opening a task and returning, keyed by board, status and filters. When all loaded cards fit the viewport and more exist, loading continues only until overflow appears or the data ends; further pages require scroll progress. Pending requests and errors stop this bounded fill.
Na coordenação Bee Team, toda demanda Leader→Collaborator é registrada e atribuída antes da execução. Perguntas, respostas, decisões e entregas ficam na tarefa; chats transportam apenas notificações com referência e tipo de mudança após persistência confirmada, sem ciclos de confirmação.

Ao ativar Leader ou Collaborator, o próprio chat recebe respectivamente 👑 ou 🐝, antes mesmo da resolução da identidade. Mudanças de papel substituem a marca inicial sem acumular; nome/contexto útil são preservados. Leader já nomeia novos chats Collaborators autorizados com 🐝. Somente títulos de chat mudam, nunca agentes/times/slugs.

Após bootstrap de identidade/time, cada interação substantiva entre agentes atualiza campos pertinentes e salva comentário completo antes da notificação. O aviso contém task, áreas realmente atualizadas, status pertinente e commentID retornado; receptor lê esse comentário por ID via MCP e o estado atual antes de agir. Validação humana pendente não implica tarefa concluída.

A Leader é a interface humana do trabalho: fora da mensagem inicial de criação/ativação de novo chat Collaborator, perguntas, escolhas, pedidos, confirmações e relatos substantivos iniciados pelo Collaborator passam por comentário e notificação à Leader, sem diálogo direto ou caixas interativas ao humano. Isso preserva metainstruções legítimas, aprovações obrigatórias do harness e trabalho independente autorizado.

A regra também vale para a Leader: decisões humanas são solicitadas por pergunta/opções registradas na tarefa e aviso referencial, sem caixas interativas. A resposta humana legítima é persistida antes de agir/delegar; não há encaminhamento para outra liderança nem ciclos. Bootstrap e controles obrigatórios do harness permanecem preservados.
