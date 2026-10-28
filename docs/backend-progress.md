# Backend Bee Team — acompanhamento

Retomada final autorizada em 27/10/2026. Fonte documental sincronizada sem escrever no checkout principal.

- [x] Revisar os seis documentos fonte e adaptar o snapshot.
- [x] Persistência PostgreSQL >=18: sem workspace, UUIDv7, deleted_at, FKs, cardinalidades e proteção contra DELETE/TRUNCATE.
- [x] RA HTTP: perfis, composição/transferência, imagens/cópias, referências, retomada e atividades.
- [x] Kanban HTTP: boards/tasks, recursão cross-board, autonomia pela origem, planos/revisões/comentários/arquivos/resumos/timeline.
- [x] MCP: 52 tools equivalentes, 3 compostas, 2 sistema, 6 resources e 3 prompts; templates Skills 7487ee1 empacotados.
- [x] Revisão independente e regressões dos problemas encontrados.
- [x] Documentação, catálogo exportado e verificação final.
- [x] Registrar commits locais; preservar branch/worktree sem push, merge ou deploy.

## Verificações realizadas

- `cargo build --locked`: passou.
- `cargo test --locked`: 27 testes passaram.
- `cargo build --locked --features mcp`: passou.
- `cargo test --locked --features mcp`: 30 testes passaram.
- PostgreSQL 18 real no container exclusivo `beeteam-backend-test-8fbc`, porta 55481. Os testes HTTP/MCP criam bancos isolados; nenhum banco de produto foi usado.
- Docker CLI chama WSL; SDK Testcontainers Windows não encontra socket Unix. BEE_TEST_DATABASE_URL resolveu a integração sem alterar daemon/portas do Docker nem apagar bancos existentes.
- Smoke TCP real em 127.0.0.1:18081: health ok, documentos Kanban/RA servidos e tools/list retornou 57 tools. Processo de smoke encerrado ao concluir.
- Respostas HTTP usadas pelos cenários são validadas contra schemas, incluindo erros. MCP valida catálogo e saídas testadas. Catalog JSON contém 57 tools/6 resources/3 prompts.
- Hierarquia testada com 32 níveis cross-board; matriz de 36 combinações de autonomia. Concorrência ETag e swaps/rollback de composição testados.
- Todos arquivos-fonte abaixo de 1000 linhas. Nenhum arquivo frontend alterado. UI integrada não foi alegada.

## Revisão e decisões técnicas registradas

Revisão independente por agente somente leitura, conforme requesting-code-review. Sete achados corrigidos com testes que falharam antes e passaram depois: erro details/códigos; agente sem vínculo mas com task não final; arquivo herdado no índice de atividades; metadados multipart MCP; MIME de imagem; CHECK UUIDv7 com NULL/variantes; UUID uppercase. Corrigida também invalidação de versões quando modo do board de origem muda.

Ruling: sem workspace e sem task.teamId, autor/executor independentes — decisões finais do usuário prevalecem sobre o snapshot antigo. Custos de incompatibilidade são explicitados nos contratos atualizados.

Ruling: conteúdo JSONB em tabelas separadas com FKs geradas e DTOs validados; SQLx runtime parametrizado permite build sem banco; lock transacional global dá snapshot coerente para serviço pessoal local. Custo: leituras/memória crescem com histórico, documentado em backend-implementation.md.

Ruling: bytes em PostgreSQL bytea dão atomicidade com metadados e preservação em exclusão lógica; não há path de usuário nem arquivo publicado antes do commit. Custo: uploads limitados em memória e tamanho do banco, documentados.

Ruling: autenticação foi explicitamente excluída; alcance de edição do líder permanece pendente. Não inventar bloqueio. Ciclos de liderança seguem proposta não confirmada; ciclos de tasks são estruturalmente inválidos e protegidos.

Ruling: snapshots de skills são recursos editoriais locais do commit 7487ee1, não instalação global. Atualização das skills para nomes definitivos MCP será feita depois, conforme usuário; o catálogo implementado é a referência.

Ruling: advisory lock protege escritores do serviço, não SQL externo que o ignore. Documentação e testes delimitam essa garantia. Escala multi-tenant não foi solicitada.

Nenhum achado importante ficou sem correção. Sem merge/push/deploy. Container de teste preservado.

Implementação registrada no commit local `968b601`. Atributos Git preservam os bytes das migrations, incluindo CRLF da migration inicial já aplicada, para manter checksums SQLx entre checkouts.

## Atualização editorial pós-MCP — e96f759

- Nove snapshots solicitados copiados byte a byte de skills/ no worktree Skills, conferidos contra o commit e96f759. Nenhuma escrita no worktree de origem.
- Metadados de resources/list e catálogos Markdown/JSON atualizados para e96f759. Catálogo JSON regenerado pelo backend; tools e prompts permanecem idênticos ao catálogo anterior, com 57 tools, seis resources e três prompts. mcpName do manifesto confere com nomes, descrições e argumentos anunciados.
- team-examples.md e references/mcp-content.md preservados; allowlist e funcionalidades inalteradas. Política de edição do líder continua pendente.
- cargo build --locked e cargo build --locked --features mcp passaram. cargo test --locked: 27 testes; com --features mcp: 30 testes. Integração MCP repetiu resources/list/read e prompts/list/get/render, incluindo novo hash e conteúdo editorial renderizado.
- Primeiras tentativas tiveram timeout porque o container isolado estava parado e depois recebeu fast shutdown. Reiniciado; validação final passou mantendo uma sessão Docker ativa. Causa do shutdown não confirmada, sem atribuição ao produto. Container e bancos preservados.
- Sem push, merge ou deploy; atualização registrada em commit local dedicado.

## Síntese cumulativa atual — implementação concluída

- Task.currentSummary sempre presente, vazio inicial/legado explícito; entrada não vazia até 16384 bytes UTF-8. Conteúdo fornecido pelo colaborador, independente de descrição, progress.note e ExecutionSummary.summary.
- PATCH de progresso e troca de status exigem síntese; atualização administrativa/reordenação preserva valor quando omitido. RecordExecution/close_activity exigem síntese completa. record_progress aceita síntese no topo e em cada descendente; mutations são atômicas/idempotentes.
- Migration 202610270004 adiciona vazio em tasks antigas inclusive tombstones sem inferência; dados e histórico existentes preservados. Campo vive no JSONB já carregado e é projetado por get/list/view, sem query de histórico por card. Timeline mantém antes/depois nas alterações e encerramentos.
- Revisão independente encontrou replay legado bloqueado por validação do novo contrato antes do lookup. Corrigido: validar envelope, procurar resposta exata já persistida e exigir contrato atual para mutações novas. Replays antigos ganham apenas vazio explícito no snapshot, sem consultar síntese atual nem alterar versão. Revisão posterior sem achados pendentes.
- Teste inicial falhou por currentSummary ausente; regressões agora aprovadas para persistência, campos independentes, listagens/cards, limites Unicode, ausência/vazio, título administrativo, mudança/reordenação, histórico, backfill com excluídos e exemplos OpenAPI. HTTP e MCP exercitam replays antigos, rejeição com chave nova, conflito idempotente e rollback de síntese após falha tardia em descendente arquivado.
- Verificação final: cargo build --locked e cargo build --locked --features mcp passaram; cargo test --locked: 31 testes, com MCP: 34 testes; cargo fmt --check e git diff --check passaram. PostgreSQL18 isolado preservado. Sem alterações frontend ou alegação de integração visual.
- Sete snapshots Skills conferidos byte a byte com f3cf675 e sincronizados; metadados editoriais/catálogo regenerados. Manifesto/codex/team-examples e allowlist preservados. resources/list/read e prompts/list/get/render validados na suíte MCP. 57 tools, seis resources, três prompts.
- Contrato estável enviado cedo ao coordenador para frontend/Skills. Política de edição do líder inalterada e pendente. Sem push, merge ou deploy; commit local dedicado.

## Especificação Markdown própria da task — concluída

- Task.specification sempre presente; string Markdown até 65536 bytes UTF-8. CreateTask e PatchTask aceitam campo opcional; novas/legadas recebem vazio sem inferência. PATCH apenas de especificação é administrativo, sem exigir currentSummary. Descrição, síntese e plano continuam independentes.
- Persistência em tasks.data, migration005 com backfill preservando conteúdo/tombstones e constraint tipo/limite; events task.updated preservam especificação anterior/nova. Replays legados recebem vazio apenas no snapshot sem modificar versão ou valores existentes.
- HTTP/MCP get/list/view/prepare_execution recebem campo pelo DTO Task compartilhado, incluindo filhos. Plan.content e PlanRevision.content continuam Markdown textual, limites64KiB e revisões imutáveis existentes. Sem renderização HTML, transformação de Markdown ou execução de conteúdo no servidor.
- Teste inicial falhou pela ausência do campo; testes finais cobrem criação/PATCH, vazio/null/tipo/limites UTF-8, preservação literal CRLF/Unicode/código/HTML, independência e rollback, histórico e planos/revisões, backfill tombstones, replay, contexto raiz/filhos e tools createTask/updateTask/prepare_execution.
- Revisão independente somente leitura sem achados bloqueantes. cargo build --locked e com --features mcp passaram; cargo test --locked: 33 testes; com MCP: 36 testes. fmt/diff check e exemplos OpenAPI aprovados. Ajustada comparação de rollback do teste para snapshot persistido, evitando comparar precisão nanosegundos do retorno com microssegundos do PostgreSQL.
- Sete snapshots Skills copiados byte a byte do commit8263cea; hash editorial/catálogo regenerados. Manifesto/codex/team-examples e allowlist preservados. resources/list/read e prompts/list/get/render com specification validados. Permanecem57 tools, seis resources e três prompts.
- Contrato liberado cedo para frontend/Skills, sem mudanças de produto posteriores. Sem auth/renderização/edições de outros worktrees. Container e dados isolados preservados. Commit local, sem push/merge/deploy.

## Slugs estáveis para agentes, times e tasks — concluído

- Agent/Team/Task.slug sempre presente; UUIDv7 interno e relações/rotas por ID preservados; boards fora do escopo. Três resolvers by-slug retornam {id,slug} com consulta SQL indexada direta, sem carregar snapshot/histórico ou enumerar listas. Arquivados resolvem; excluídos/ausentes404; formato não canônico400.
- Migration006 compartilha normalizador NFKD/acentos/ASCII entre backfill e criação/cópia,80chars, fallback/reservados/UUID-like documentados, sufixos numéricos. Índices únicos incluem tombstones; trigger impede renomear slug. Backfill ordered created_at,id preserva conteúdo/versões/datas; concorrência serializada e constraint DB coberta.
- Replays antigos recebem slug canônico imutável por identidade armazenada, sem recalcular nome ou substituir snapshot. MCP preserve UUID nos prompts/casos de uso depois de resolver slug.
- Teste inicial falhou pela ausência do campo; testes finais cobrem criação concorrente/colisão, tipos separados, tasks/subtasks, estabilidade rename, cópia, exclusão/não reutilização, DB uniqueness/imutabilidade, fallback/reservados/UUID/Unicode/truncamento, backfill tombstones e índice utilizável, HTTP/MCP resolution e replay legado. Exemplos dos dois OpenAPIs validados.
- Revisão independente encontrou inversão de locks na migration006; corrigida antes do primeiro commit para obter advisory lock antes de DDL, confirmada em revisão posterior. Validação final usa banco isolado novo bee_slug_final_20261027; testes exploratórios preservados, nenhum checksum de migração previamente commitada alterado. Fixture de persistência agora usa slug único por execução para não colidir com rodadas anteriores e mantém teste UUID independente da constraint slug.
- Builds cargo build --locked e --features mcp aprovados; testes36 default e39 MCP aprovados. fmt/diff check e limite de1000 linhas por fonte aprovados. Nenhum frontend alterado ou integração visual alegada.
- Sete snapshots Skills25a615a conferidos byte a byte, metadados/catálogo atualizados; manifesto/codex/team-examples e allowlist preservados. MCP60 tools (55 HTTP+3compostas+2sistema),6resources/3prompts; resources/prompts exercitados pela suíte.
- Contratos estáveis enviados cedo ao coordenador. PostgreSQL/container/dados de teste preservados. Sem auth/políticas novas, outros worktrees, push/merge/deploy; commit local dedicado.

## Integração frontend com API local real — concluída nesta frente

- [x] Serviço persistente oculto em127.0.0.1:18081;8080 de outro projeto preservada. PostgreSQL18.6 dedicado beeteam-local-postgres:55482, DBbeeteam_local, volumebeeteam-local-pg18; sete migrations aplicadas, sem reset/destruição. Credenciais e PID/logs/journal apenas em.local ignorado.
- [x] scripts/start-local-api.ps1 inicia/reaproveita banco e API, recusa substituir storage sem configuração original e não encerra processos. Usa cópia de binário nas futuras partidas para evitar lock Windows. scripts/bootstrap-local-api.py cria fixture identificada via HTTP, reutiliza idempotência e preserva edições em reruns.
- [x] Revisão detectou riscos de PATCH sem replay e journal não atômico no bootstrap. Corrigidos: síntese gravada por POSTexecution idempotente; pedido/versão/chave congelados antes do envio; temp+fsync+replace atômico. Dois testes de falha/resposta perdida aprovados; revisor confirmou resolução.
- [x] Frontend a1c9eae conectado por proxy5173/api->18081. QA UI reportado pela frente frontend; confirmação independente no DB/proxy de descrição board/status criado e ordem, workStyle agente, context time, autonomyMode task com origem manual preservada. Slugs/relações persistentes. Detalhes em local-integration.md.
- [x] Build MCP e39 testes Rust aprovados com targetWindows separado, banco isolado55481; dois testes Python aprovados. Sintaxe scripts/diff check/arquivo de credenciais ignorado confirmados. Nenhuma incompatibilidade Rust exigiu alteração de contratos/regras.
- Limite: não foi executado restart da API ativa durante QA. Comando de instância temporária foi bloqueado pela revisão automática sem motivo específico; persistência foi comprovada por PostgreSQL e novas leituras HTTP/proxy mantendo o serviço ativo. A tentativa inicial de build no artefato ativo falhou por lock Windows e foi substituída por output target separado. Nenhuma falha de produto atribuída a esses limites operacionais.
- Downloads/imagens sem QA visual binário nesta rodada, cobertos na suíte HTTP backend isolada; não alegar integração visual além das evidências frontend. Nenhum outro worktree editado; sem push/merge/deploy. API e dados mantidos ativos para uso.

## Procedimento local e verificação de retomada

- Runbook separa inicialização/reuso, frontend em primeiro plano, readiness API/proxy/MCP e bootstrap opcional autorizado; sem caminhos de worktree como instalação universal. SQLite não implementado.
- Runtime real preservado: consultas API/proxy iguais; PostgreSQL existente com 1 board, 2 tasks, 2 agents e 1 team; MCP initialize/list/read/listBoards sem erros. Sem novas escritas de negócio ou reinício do processo da API.
- Build MCP e 39 testes Rust aprovados; 2 testes Python aprovados. A primeira tentativa da suíte encontrou o contêiner isolado de testes parado; após iniciar apenas esse contêiner, a suíte passou. Testes nunca usaram beeteam_local.
- Snapshot MCP ativo segue25a615a; nova sincronização editorial será registrada separadamente.

## Atualização MCP local — Skills 88ad469

Snapshot editorial do commit `88ad46936bbbb9b0d7e50b9e1847b77d9b73c633` sincronizado em oito arquivos bundled; catálogo e teste de proveniência atualizados. Build MCP e39 testes Rust aprovados em PostgreSQL isolado. Em27/10/2026, somente a API identificada foi reiniciada após backup do binário anterior; frontend e banco permaneceram ativos. Runtime novo PID12032: health aprovado, seis resources/read iguais aos arquivos empacotados, três prompts/get renderizados e60 ferramentas anunciadas. Boards/tasks/agents/teams permaneceram exatamente iguais nas leituras antes/depois e no proxy5173. Nenhum seed/reset ou alteração de negócio. Backup local ignorado `.local/api-runtime/beeteam-before-88ad469.exe` preservado para rollback; rollback não precisou ser executado. Esta verificação de atualização não demonstra instalação fria em outra máquina nem substitui QA visual de todos os fluxos.

## Onboarding MCP — Skills 8d8ed82

Snapshot `8d8ed82793e7bc225c5dcbb0e6c3c0709c7df27a` sincronizado: líder, colaborador, codex, integration e team-examples; prompts/handoff preservados. Inclui instruções de primeira conexão e endereços confirmados, sem executar cadastro MCP pessoal nem instalar skills. Build MCP e39 testes Rust aprovados. Reinício coordenado somente da API em27/10/2026, PID28684, com backup `.local/api-runtime/beeteam-before-8d8ed82.exe` preservado; rollback não necessário. Health, seis resources/read iguais ao commit final, três prompts/get e60 tools confirmados no runtime; painel5173 HTTP200. Coleções completas existentes boards/tasks/agents/teams idênticas antes/depois e via proxy (1/2/2/1), sem seed/reset ou mutações de negócio. Frontend e PostgreSQL mantidos ativos.

## Leader — Skills dfd4e19

Snapshot `dfd4e19161b27a71451a05da4ab05d02e1379b0b`: líder e team-examples atualizados para escolha de time/líder existente ou formação aprovada; demais materiais preservados. Build MCP e39 testes Rust aprovados. API reiniciada isoladamente em27/10/2026, PID79704; backup `.local/api-runtime/beeteam-before-dfd4e19.exe` preservado. A primeira cópia encontrou lock transitório do executável após encerramento; confirmado processo/listener ausentes, nova inicialização funcionou sem rollback. Runtime: seis resources iguais ao commit final, três prompts renderizados,60 tools, health e painel200. Registros completos pré/pós/proxy iguais:1 board,2 tasks,3 agents,2 teams. Sem seed/reset, alteração de negócio ou configuração pessoal; frontend/banco preservados. Validação cobre transporte e dados, não simulação de decisões de IA nem todos os fluxos visuais.
