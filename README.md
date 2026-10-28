# Bee Team

Servidor local Rust para perfis/times de agentes e boards/tasks. A IA e o harness executam o trabalho; Bee Team guarda configuração, autoria declarada, planos, arquivos e resultados. Não cria chats nem acessa provedores de IA.

## Executar

Requer Rust >=1.94 e PostgreSQL >=18. A migration recusa versões anteriores. O `docker-compose.yaml` existente utiliza PostgreSQL 18; use um banco dedicado e preserve volumes existentes.

```powershell
docker compose up -d postgres
$env:DATABASE_URL="postgres://postgres:postgres@127.0.0.1:5453/postgres"
$env:OTEL_ENABLED="false"
$env:MCP_ENABLED="true"
cargo run --features mcp
```

Por padrão escuta em `127.0.0.1:8080`. `APP_HOST`, `APP_PORT`, `APP_CORS_ALLOW_ORIGINS`, `APP_BODY_LIMIT_BYTES`, `MCP_PATH` e `MCP_ALLOWED_ORIGINS` continuam configuráveis. Migrations rodam no startup. Sem `--features mcp` ou sem `MCP_ENABLED=true`, `/mcp` não é montado.

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

[Implementação e integração](docs/backend-implementation.md), [acompanhamento](docs/backend-progress.md). A integração local com o frontend usa API18081, PostgreSQL dedicado55482 e proxy Vite5173. Veja [iniciar e validar o preview real](docs/local-integration.md); o QA visual da frente frontend e a confirmação PostgreSQL/proxy estão registrados no runbook.

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
path in this workflow; SQLite/migration work is outside its scope.


## Bee Team frontend

The React frontend lives in `frontend/`. Run `npm ci` and `npm run dev` there. The normal preview uses the real API through a Vite `/api` proxy to `http://127.0.0.1:18081`; see `frontend/.env.example` and `frontend/README.md` for configuration. Mock mode is explicit opt-in (`VITE_API_MODE=mock`), with no automatic fallback.

## Atualização ao vivo

`GET /api/v1/changes` fornece SSE de invalidação para HTTP e MCP. Eventos `invalidate` e `reset` carregam apenas `{"scope":"all"}`; clientes devem refazer queries ativas e preservar rascunhos locais. `reset` é enviado em cada conexão/reconexão e após perda de mensagens. Não há replay durável nem cursor; `Last-Event-ID` não evita o refetch. Keepalive15s e retry3000ms. PostgreSQL NOTIFY entrega somente após commit real; rollback, replay idempotente e leituras não emitem invalidação. Cada processo usa um listener compartilhado com fila limitada, sem consultar tabelas periodicamente. Alterações SQL externas que não passam pelo UnitOfWork não notificam. O stream não é ferramenta MCP e não transporta conteúdo de negócio. Proxy deve preservar streaming sem buffering. Detalhes: [contrato SSE](docs/live-changes.md).
