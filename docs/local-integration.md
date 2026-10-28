# Preview local com API e PostgreSQL reais

O launcher local deste projeto usa API em `http://127.0.0.1:18081`, PostgreSQL em `127.0.0.1:55482` e painel em `http://127.0.0.1:5173`, com proxy Vite de `/api` para18081. Execute os comandos na raiz do checkout correspondente; caminhos de worktrees de desenvolvimento não são uma instalação universal. Os contratos continuam nas rotas `/openapi/kanban.json` e `/openapi/ra.json`; MCP em `/mcp`.

## Iniciar e reaproveitar

No Windows, com Docker e Rust disponíveis, na raiz do checkout backend:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local-api.ps1
```

O primeiro comando compila com MCP, copia o executável para `.local/api-runtime/` (evitando bloquear o artefato do Cargo no Windows) e inicia a API em processo oculto, com PID/logs em `.local/`. Se a instância própria já estiver ativa, verifica health e a reaproveita. `-SkipBuild` usa o binário já compilado. Não encerra processos que ocupem a porta.

PostgreSQL18 roda no container `beeteam-local-postgres`, endereço127.0.0.1:55482, banco `beeteam_local`, volume nomeado `beeteam-local-pg18`. Não compartilha banco/volume com os testes. As sete migrations (template inicial e seis de domínio) rodam no startup. Container/volume existentes são reaproveitados. A configuração de senha aleatória fica somente em `.local/postgres.env`, ignorada pelo Git; preserve esse arquivo junto do volume. Se houver storage sem a configuração original, o script não troca credenciais nem reinicializa dados. O wrapper Docker via WSL Ubuntu disponível nesta máquina recebe o path convertido por wslpath.

A API permanece em segundo plano após a sessão de terminal. Configuração ativa: APP_HOST127.0.0.1, APP_PORT18081, OTEL_ENABLEDfalse, MCP_ENABLEDtrue. CORS permite http://127.0.0.1:5173 e http://localhost:5173. Pelo proxy, requests são same-origin e ETag/Location ficam acessíveis sem configuração extra no navegador. O frontend não recebe credenciais de PostgreSQL.

## Bootstrap opcional, separado da inicialização

Não execute bootstrap, seeds ou reset para iniciar ou validar uma instalação existente. Apenas para criar uma fixture de integração explicitamente autorizada, execute `python scripts/bootstrap-local-api.py`. Esse comando cria via HTTP os agentes **Líder local** e **Colaborador local**, **Equipe de integração local**, quadro **Bee Team local**, task **Validar integração real** e subtask **Conferir persistência pelo frontend**. A task contém especificação Markdown, plano/revisão, comentário, síntese atual e execução histórica. Esses registros são fixtures autorizadas de integração, não trabalho operacional de produto.

`.local/bootstrap.json` mantém pedidos completos, versões originais, chaves de idempotência e resultados das etapas, com substituição atômica do arquivo. Retries reutilizam o pedido original; não adotam silenciosamente versões após edições na UI. A síntese é gravada junto da execução POST idempotente, sem PATCH de bootstrap. Reruns preservam edições já feitas na UI e não recriam etapas concluídas. O script não enumera nem altera registros externos à sua fixture. Mantenha o arquivo para preservar essa associação.

## Painel e readiness

O checkout frontend precisa conter `frontend/package.json` e o proxy em `frontend/vite.config.ts`. Com dependências já instaladas, execute no diretório `frontend/`:

```powershell
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Esse comando permanece em primeiro plano. Reutilize um painel saudável já ativo. Porta ocupada não autoriza encerrar processos. Se uma política de aprovação bloquear a inicialização automática, informe o bloqueio e solicite execução manual; não tente outro mecanismo para contorná-lo. O painel usa PostgreSQL por meio da API, nunca diretamente. Não existe fallback automático para fixtures/mock.

Verifique separadamente:

```powershell
Invoke-RestMethod http://127.0.0.1:18081/health
Invoke-RestMethod http://127.0.0.1:18081/api/v1/boards
Invoke-WebRequest http://127.0.0.1:5173
Invoke-RestMethod http://127.0.0.1:5173/api/v1/boards
```

Health confirma o processo; a consulta de boards confirma leitura do armazenamento; a igualdade API/proxy confirma encaminhamento; HTML200 não prova renderização ou navegação visual. Abra o painel e navegue pelos registros reais para esse último nível de evidência. Uma página antiga ainda aberta não prova que o servidor está ativo.

O endpoint MCP é `http://127.0.0.1:18081/mcp`, transporte Streamable HTTP, sem sessão persistente. Valide por cliente MCP/JSON-RPC com `initialize`, `notifications/initialized`, `tools/list`, `resources/list` e `prompts/list`, enviando `Accept: application/json, text/event-stream` e a versão negociada em `MCP-Protocol-Version`. Não use navegação GET como prova de funcionamento MCP. O catálogo atual anuncia60 ferramentas,6 recursos e3 prompts; conectar esse servidor ao harness é uma configuração separada, não feita pela inicialização da API.

As Skills bundled são incorporadas no binário em compilação. Copiar novos arquivos ou regenerar catálogo não atualiza uma instância ativa. Registre separadamente revisão fonte, build e revisão servida; combine um reinício antes de trocar o processo saudável. Preserve banco, volume e credenciais. O launcher é de inicialização/reuso, não um atualizador de processo ativo. PostgreSQL18 permanece o armazenamento suportado; este procedimento não implementa SQLite nem migração entre bancos.

## Contrato do transporte

Leituras não exigem autenticação. Escritas declaram X-Actor-Kind:human; POST envia Idempotency-Key por intenção, reutilizada em retry; mutações versionadas enviam If-Match:"N" da versão atual. Conflito deve recarregar o registro e preservar o erro; não há failover para mock. Slugs resolvem por `/api/v1/{agents|teams|tasks}/by-slug/{slug}` e retornam UUID para as demais APIs. `specification`, planos e `currentSummary` são conteúdos separados. Mudanças apenas administrativas não exigem síntese nova.

## Evidência e limite

Bootstrap exercitado por HTTP real, incluindo relações, versões, planos/revisões e histórico. Leitura posterior confirmou ID/slug/versão e digest da especificação iguais no PostgreSQL e HTTP; CORS preflight5173 aprovado. O serviço principal foi mantido ativo durante o QA do frontend. Evidências de UI são registradas pela frente frontend/coordenador; build ou health isolados não provam integração visual.

## QA integrado confirmado

Frontend commit `a1c9eae` reportou navegação/edição/reload reais no preview5173. Esta frente confirmou somente leitura no PostgreSQL e via proxy Vite:

- Board `Bee Team local`: descrição editada pela UI, versão4.
- Status `Validação frontend`: criado pela UI, quinta posição (position4), isDonefalse. Tentativa de concluir Backlog ocupado foi rejeitada e manteve isDonefalse.
- Agente `Colaborador local`: workStyle editado, versão3; slug preservado.
- Time `Equipe de integração local`: context editado, versão2; slug preservado.
- Task `validar-integracao-real`: autonomyModeautomatic, versão8, mantendo effectiveModemanual pela origem manual.

Frontend também reportou paginação/filtro, vínculos e navegação de subtask por slug, leitura de planos/revisões e histórico. Downloads/imagens não tiveram QA visual com fixture binária nesta rodada; seus fluxos HTTP são cobertos pelos testes de integração backend isolados. O processo ativo inicial usa o binário original; futuras partidas pelo script usam cópia em `.local/api-runtime`. Não foi necessário interromper a API para provar persistência: registros foram conferidos diretamente no PostgreSQL e relidos via HTTP/proxy.

Validação backend nesta rodada: build MCP e39 testes Rust aprovados com `--target x86_64-pc-windows-msvc`, mantendo output separado do executável ativo no Windows; dois testes Python de recuperação do bootstrap aprovados. Testes usam exclusivamente PostgreSQL55481/banco de teste, nunca `beeteam_local`55482. Sintaxe dos scripts e diff check aprovados.

## Verificação real da retomada em 27/10/2026

Sem seeds, reset ou novas escritas de negócio: API18081 e proxy5173 responderam200 e JSON idêntico para boards, tasks, agents e teams; PostgreSQL confirmou1 board,2 tasks,2 agents e1 team. MCP initialize/list/read e tools/call listBoards responderam sem erro, com60 ferramentas,6 recursos e3 prompts. Os recursos leader/integration ativos correspondiam ao snapshot25a615a antes da atualização editorial. Esta rodada verifica transporte/leitura/persistência já existente; não substitui QA visual, testes de mutações ou uma instalação limpa em outra máquina.

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
