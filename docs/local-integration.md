# Preview local com API e PostgreSQL reais

A API deste worktree atende em `http://127.0.0.1:18081`. A porta8080 pertence a outro projeto e foi preservada. O frontend é executado na frente c44d em `http://127.0.0.1:5173`, com proxy Vite de `/api` para18081. Os contratos continuam nas rotas `/openapi/kanban.json` e `/openapi/ra.json`; MCP em `/mcp`.

## Iniciar e reaproveitar

No Windows, com Docker e Rust disponíveis:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local-api.ps1
python scripts/bootstrap-local-api.py
```

O primeiro comando compila com MCP, copia o executável para `.local/api-runtime/` (evitando bloquear o artefato do Cargo no Windows) e inicia a API em processo oculto, com PID/logs em `.local/`. Se a instância própria já estiver ativa, verifica health e a reaproveita. `-SkipBuild` usa o binário já compilado. Não encerra processos que ocupem a porta.

PostgreSQL18 roda no container `beeteam-local-postgres`, endereço127.0.0.1:55482, banco `beeteam_local`, volume nomeado `beeteam-local-pg18`. Não compartilha banco/volume com os testes. As sete migrations (template inicial e seis de domínio) rodam no startup. Container/volume existentes são reaproveitados. A configuração de senha aleatória fica somente em `.local/postgres.env`, ignorada pelo Git; preserve esse arquivo junto do volume. Se houver storage sem a configuração original, o script não troca credenciais nem reinicializa dados. O wrapper Docker via WSL Ubuntu disponível nesta máquina recebe o path convertido por wslpath.

A API permanece em segundo plano após a sessão de terminal. Configuração ativa: APP_HOST127.0.0.1, APP_PORT18081, OTEL_ENABLEDfalse, MCP_ENABLEDtrue. CORS permite http://127.0.0.1:5173 e http://localhost:5173. Pelo proxy, requests são same-origin e ETag/Location ficam acessíveis sem configuração extra no navegador. O frontend não recebe credenciais de PostgreSQL.

## Bootstrap identificado

O segundo comando cria via HTTP os agentes **Líder local** e **Colaborador local**, **Equipe de integração local**, quadro **Bee Team local**, task **Validar integração real** e subtask **Conferir persistência pelo frontend**. A task contém especificação Markdown, plano/revisão, comentário, síntese atual e execução histórica. Esses registros são fixtures autorizadas de integração, não trabalho operacional de produto.

`.local/bootstrap.json` mantém pedidos completos, versões originais, chaves de idempotência e resultados das etapas, com substituição atômica do arquivo. Retries reutilizam o pedido original; não adotam silenciosamente versões após edições na UI. A síntese é gravada junto da execução POST idempotente, sem PATCH de bootstrap. Reruns preservam edições já feitas na UI e não recriam etapas concluídas. O script não enumera nem altera registros externos à sua fixture. Mantenha o arquivo para preservar essa associação.

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
