# Bee Team

Servidor local Rust para perfis/times de agentes e boards/tasks. A IA e o harness executam o trabalho; Bee Team guarda configuração, autoria declarada, planos, arquivos e resultados. Não cria chats nem acessa provedores de IA.

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
manual handoff, not an alternative launcher. PostgreSQL 18 remains supported through explicit configuration; SQLite is now
the default described below. Data conversion is outside its scope.


## Bee Team frontend

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

## Registered session consumption in Overview

Usage and Overview reads now expose `recordedSessionUsage` globally and on each
summary timeline item. Measured/estimated session deltas remain separate from
consumption attributed to the task: shared/unallocated evidence stays that way.
Baselines and duplicate references never inflate totals; unknown stays null.
The timeline retains status/author/model/harness/provenance for a per-summary line
chart without summing pages or raw cumulative snapshots in the client. See
[usage semantics](docs/summary-usage.md). This read-only addition does not modify
existing usage reports or claim an unrecorded historical task executor.

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
