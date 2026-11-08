# Modos externo e integrado — plano de implementação

> Execução futura: usar superpowers:executing-plans, uma entrega por vez. Este documento autoriza planejamento, não implementação ou merge. Manter PR para revisão do usuário.

**Objetivo:** preservar o Bee Team por MCP e skills e oferecer chat integrado com o líder, permitindo agentes dos dois modos no mesmo time.

**Arquitetura:** routes adapta HTTP/MCP; dto define contratos; services decide vínculos, destinatários, fila e aprovações; repositories implementa persistência e o protocolo oficial do Codex App Server. O frontend usa a API Bee Team, nunca inicia o Codex diretamente.

**Stack:** Rust, Tokio, SQLx, SQLite/PostgreSQL, React/TypeScript e Codex App Server via JSON-RPC.

**Especificação de produto:** decisões do usuário nesta conversa em 08/11/2026, consolidadas abaixo. Continuação da tarefa `01a1b328-0c58-7481-bad1-d9ed03f1319a`, sem substituir as evidências e planos anteriores.

## Escopo e regras

- Externo: chat no harness escolhido; consulta e escrita via MCP/skills. Não tentar controlar a sessão externa nem prometer entrega push nela.
- Integrado: Bee Team administra uma sessão própria pelo adaptador; primeiro Codex. Claude Code fica como extensão posterior, sem prometer suporte já implementado.
- Os dois modos coexistem em agentes diferentes no mesmo time/projeto. Um agente mantém somente um vínculo ativo; troca encerra o anterior e preserva histórico.
- Provedor, modo e disponibilidade são campos diferentes. Codex instalado não significa sessão integrada disponível.
- Chat humano–líder existe antes de criar uma tarefa. Conversa da tarefa continua sendo o registro canônico entre agentes; mensagens do chat podem referenciar tarefas sem duplicar o histórico.
- Menções são referências a UUIDs, com nomes renderizados como links. Não resolver destinatário por texto livre ou nomes homônimos.
- Cada resumo de worker gera aviso idempotente ao líder; resumo do líder não gera aviso. A entrega segue o modo do destinatário.
- Mensagem para externo fica disponível para consulta MCP. Consulta, confirmação de recebimento e resposta são eventos distintos; não marcar entrega só porque houve uma consulta.
- Não remover o fluxo externo atual. Orientações de notificação próprias do harness continuam aplicáveis onde ele oferece esse recurso, sem Bee Team assumir controle dessa sessão.
- Sem migração de dados com reset, seed ou substituição de banco. Testes usam bancos isolados. Não reiniciar o serviço do usuário para testar.
- Sem merge/publicação automática. Medição de tokens por vínculo/tarefa permanece fase posterior.
- SOLID, arquivos abaixo de 1000 linhas e paridade HTTP/MCP. Actor context continua metadado, não autenticação.

## Ponto de partida verificado antes da implementa��o

O adaptador atual retoma threads e entrega turnos. `codex_mcp_scope.rs` desativa MCPs/plugins herdados e fixa a instância Bee Team; `codex_session.rs` interrompe a entrega em solicitações de aprovação. Isso não constitui chat integrado completo. O acesso à sessão já ocupada pelo Desktop falhou com active writer; não contornar esse bloqueio. A API de revisão em 59867 recusou conexão durante este planejamento; registro deste plano no board está pendente.

## Interfaces propostas

Nomes abaixo são decisões para a implementação; não são endpoints existentes.

- `AgentSessionMode = external | integrated`; vínculo contém modo, harness, externalId, installationId, projectRoot e versão. ID externo pode faltar apenas durante a criação de uma sessão integrada, nunca no vínculo ativo concluído.
- `SessionCapabilities`: streaming, resume, interrupt, approvals, skills, mcp e webSearch; capacidade declarada é separada de configuração habilitada e verificação de funcionamento.
- `IntegratedChat`: id, leaderAgentId, bindingId, título, createdAt. Tarefa é associação opcional por mensagem.
- `ChatMessage`: id, chatId, role, content, taskId opcional, clientMessageId; `ChatEvent`: eventId, messageId, turnId, tipo e payload validado.
- `ApprovalRequest`: id, bindingId, turnId, providerRequestId, categoria, descrição estruturada, estado pending/accepted/declined/expired e prazo. Decisão usa versão esperada.
- `ToolProfile`: versão, webSearch, networkAccess, skillRoots, enabledSkills e enabledMcpServers. Não guardar segredos nesse perfil.
- Ampliar `SessionProvider` em `repositories/contracts.rs` com operações de capacidades, criação/retomada, envio, interrupção e resposta a pedido; manter protocolo específico dentro do adaptador.
- Serviço de roteamento recebe mensagem persistida e vínculo versionado e escolhe entrega integrada ou caixa de entrada externa. Não usar o modo do remetente para decidir o destino.

## Ordem das entregas

### 0. Contrato frontend/backend antes de paralelizar

- [ ] Revisar `docs/proposals/integrated-chat-openapi.json` e `docs/proposals/integrated-chat-contract.md` como baseline do chat interno; são propostas, não capacidades já instaladas.
- [ ] Validar schemas, exemplos compartilhados e geração de tipos. Frontend usa transporte simulado somente em testes/desenvolvimento; backend implementa contra o mesmo contrato.
- [ ] Após estabilizar contrato, frontend executa a etapa 7 em paralelo às etapas 2–3 e 6 do backend, usando um vínculo integrado de teste. Integração real depende das duas trilhas e da etapa 4 para times mistos.
- [ ] Definir contratos adicionais de edição dos perfis, OAuth e formulários MCP antes dessas respectivas fatias; não tratar o MVP de aprovação binária como conclusão da etapa 6.
- [ ] Qualquer mudança incompatível atualiza contrato, fixtures e consumidores coordenadamente; não publicar nem fazer merge automático.

Cada etapa deve registrar plano, evidências, arquivos e resultado de testes em sua subtarefa. Iniciar com testes que falham, implementar o menor incremento, verificar e fazer commit específico. Não marcar como concluída antes da revisão humana.

### 1. Contratos de modo, vínculo e migração compatível

**Arquivos:** modificar `src/dto/session_bindings.rs`, `src/services/backend/session_bindings.rs`, `src/repositories/contracts.rs`; novas migrações independentes em `migrations/sqlite/` e na sequência PostgreSQL existente, sem renumerar as antigas. Testes novos: `tests/session_modes.rs`.

- [ ] Inventariar vínculos existentes e registrar sua origem sem alterar dados reais.
- [ ] Testar `legacy_binding_defaults_external`, `only_one_active_binding` e `switch_preserves_history` nos dois drivers.
- [ ] Adicionar modo explícito. Registros legados ficam externos por padrão; nunca adotar uma sessão do Desktop automaticamente. Sessões de teste previamente gerenciadas podem ser reclassificadas somente por ação explícita.
- [ ] Estender criar/assumir/trocar vínculo via HTTP/MCP com versão esperada e idempotência; preservar snapshots de replay legados.
- [ ] Validar duas trocas concorrentes: só uma vence, a outra recebe conflito sem perder histórico.

**Aceite:** agente externo continua operando pelo MCP; agente integrado é identificável; reinício preserva o modo. Commit sugerido: `feat: distinguish external and integrated agent sessions`.

### 2. Ciclo de vida das sessões integradas e adaptadores

**Arquivos:** modificar `src/repositories/codex_session.rs`, `src/services/managed_sessions/{mod,config,dispatch}.rs`; criar `src/dto/integrated_chat.rs`, `src/services/managed_sessions/lifecycle.rs`. Testes: `tests/integrated_session_lifecycle.rs`.

- [ ] Testar criação de thread própria, retomada após reinício, executável ausente, login ausente, versão incompatível e sessão ocupada.
- [ ] Implementar capacidades e lifecycle no contrato `SessionProvider`; preservar `deliver` com adaptação explícita durante a transição.
- [ ] Criar thread pelo App Server oficial e só ativar vínculo após obter seu ID. Se falhar entre criação e persistência, registrar operação recuperável, sem duplicar threads no retry.
- [ ] Serializar turnos por sessão e limitar paralelismo entre sessões; expor cancelamento. Não matar processo do Desktop.
- [ ] Persistir IDs de thread/turno e tratar falha depois do aceite como resultado incerto, sem reenvio automático.

**Aceite:** duas sessões Bee Team independentes funcionam em paralelo e retomam corretamente; sessão externa nunca é iniciada pelo dispatcher.

### 3. Chat humano–líder e eventos persistidos

**Arquivos novos:** `src/services/leader_chat.rs`, `src/dto/leader_chat.rs`, `src/routes/leader_chat.rs`, `src/repositories/leader_chat.rs`; composição em AppState seguindo o padrão existente. Testes: `tests/leader_chat.rs`.

- [ ] Testar mensagem antes de existir tarefa, replay de clientMessageId, ordenação de eventos e reconexão.
- [ ] Criar contrato de chats, mensagens e eventos; definir rotas na OpenAPI antes de gerar cliente. POST de mensagem usa idempotência; stream usa SSE com cursor persistido e Last-Event-ID.
- [ ] Persistir intenção antes de despachar; relacionar resposta ao turno correto. Guardar conteúdo visível e resultados de ferramentas, não exigir nem expor raciocínio privado do modelo.
- [ ] Consolidar resposta final sem duplicar os fragmentos do stream. Recarregar a página não dispara novo turno.
- [ ] Implementar limite de fila, cancelamento, reconexão e sinalização de falha/resultado incerto.

**Aceite:** usuário conversa com líder sem tarefa e continua após recarregar/reiniciar; histórico mostra apenas uma mensagem por envio idempotente.

### 4. Roteamento misto, menções e caixa de entrada externa

**Arquivos:** modificar `src/services/managed_sessions/{queue,dispatch}.rs`, `src/dto/session_delivery.rs`; criar `src/services/agent_inbox.rs`, `src/dto/agent_inbox.rs`; adaptar rotas HTTP/MCP existentes. Testes: `tests/managed_session_queue.rs`, `tests/managed_session_dispatch.rs`, novo `tests/mixed_mode_routing.rs`.

- [ ] Testar as quatro combinações de remetente/destinatário externo/integrado.
- [ ] Manter mensagem canônica na Conversa; criar uma entrega por destinatário e evento de origem.
- [ ] Integrado: despachar para vínculo ativo. Externo: expor listar pendências e confirmar recebimento por IDs no HTTP/MCP, com paginação e replay.
- [ ] Distinguir disponível externamente, recebida, em execução, respondida, falha e incerta. Não dizer que um chat externo recebeu sem evidência.
- [ ] Troca de vínculo: invalidar despachos ainda não iniciados com a versão antiga e reavaliar o destino. Não redirecionar silenciosamente um turno já aceito; reconciliar seu resultado no vínculo de origem.
- [ ] Resumo de worker gera um aviso único ao líder; resumo do líder gera zero. Mensagem automática não realimenta o mesmo gatilho.

**Aceite:** líder integrado delega a worker externo, que consulta pelo MCP e responde na Conversa; resposta chega ao líder. Fluxo inverso também funciona sem push para Desktop.

### 5. Internet, skills e MCPs configuráveis

**Arquivos:** modificar `src/repositories/codex_mcp_scope.rs`; criar `src/dto/agent_tool_profile.rs`, `src/services/agent_tools.rs`, `src/repositories/codex_tools.rs`. Testes: `tests/agent_tool_profiles.rs`.

- [ ] Testar perfis habilitados/desabilitados, skill inexistente, MCP indisponível e configuração após retomada.
- [ ] Configurar pesquisa web e rede de comandos separadamente usando o schema da versão suportada do App Server; não usar full access como substituto de acesso à internet.
- [ ] Descobrir skills com `skills/list` por cwd, permitir seleção e roots explícitas; usar paths disponíveis no host. Instalação não é presumida pela existência no repositório.
- [ ] Substituir o bloqueio geral de MCPs por seleção explícita dos servidores configurados e leitura do estado real. Preservar o MCP Bee Team correto e a regra de comunicação via Conversa no modo integrado.
- [ ] Reaproveitar autenticação gerenciada pelo provedor; não copiar tokens para mensagens, logs ou banco. Mostrar necessidade de reconexão.
- [ ] Exibir capacidades não suportadas como indisponíveis. Navegador/controle do Desktop não entra automaticamente neste escopo.

**Aceite:** sessão integrada pesquisa na web, acessa um endpoint de rede, executa uma skill e consulta um MCP adicional de teste; repete após retomada.

### 6. Aprovações e autenticação pelo painel

**Arquivos novos:** `src/dto/session_approval.rs`, `src/services/session_approvals.rs`, `src/routes/session_approvals.rs`; adaptar `src/repositories/codex_session.rs`. Testes: `tests/session_approvals.rs`.

- [ ] Testar aceitar, recusar, expirar, resposta duplicada, turno cancelado e vínculo trocado.
- [ ] Transformar solicitações do provedor em `ApprovalRequest` persistida e evento do chat, mantendo correspondência providerRequestId/turnId/bindingId.
- [ ] Encaminhar aprovações de workers ao chat humano–líder com agente, tarefa, destino e ação; responder somente à solicitação original. O líder não autoriza automaticamente em nome do humano.
- [ ] Implementar OAuth e formulários MCP suportados com URL validada, estado de conclusão e reautenticação; tipos desconhecidos recebem erro explícito, nunca aprovação automática.
- [ ] Após reinício, reconciliar pedidos com o provedor: expirar os que não podem ser respondidos com segurança e oferecer nova tentativa consciente.

**Aceite:** a ferramenta fica aguardando o usuário, recebe a decisão e prossegue ou é recusada sem exigir voltar ao Desktop.

### 7. Interface integrada e indicação dos dois modos

**Arquivos novos:** `frontend/src/features/leader-chat.tsx`, `leader-chat.test.tsx`, `agent-session-mode.tsx`, `agent-tools.tsx`, `session-approval.tsx`; reutilizar `frontend/src/features/agent-chats.tsx` e cliente gerado da API.

- [ ] Criar testes de streaming/reconexão, foco, scroll, envio duplicado, cancelamento e pedido de aprovação.
- [ ] Adicionar acesso ao chat do líder no contexto do time, com estado vazio antes da primeira tarefa, histórico, compositor e respostas incrementais.
- [ ] Mostrar agente/modo/provedor, ferramenta em execução e link da tarefa; evitar mover scroll de quem está lendo mensagens anteriores.
- [ ] Mostrar pendências externas sem spinner de execução falsa; permitir configurar modo, ferramentas e trocar vínculo com explicação das mensagens em andamento.
- [ ] Renderizar Markdown como conteúdo, sem executar HTML; mensagens de ferramenta e de usuário são distinguíveis. Traduzir PT/EN incluindo acessibilidade e erros.
- [ ] Validar desktop/mobile e atalhos de teclado; abertura de links mantém tema e contexto conforme padrões atuais.

**Aceite:** usuário consegue iniciar conversa, acompanhar trabalho, responder pergunta e aprovar uma ferramenta apenas pelo Bee Team.

### 8. Skills, documentação e contratos distribuídos

**Arquivos:** localizar fontes atuais de `get-a-team-lead`, `get-a-worker`, `setup-bee-team` e suas cópias em `resources/bee-team`; atualizar `README.md`, `docs/managed-session-delivery.md`, OpenAPIs e `docs/mcp-catalog.json`.

- [ ] Documentar descoberta do modo no início da sessão; externo consulta pendências pelo MCP, integrado usa entrega Bee Team. Não declarar a sessão acessível apenas porque tem ID.
- [ ] Atualizar exemplos de time misto, assumir/trocar vínculo, resposta a menções e aviso por resumo. Preservar atualizações obrigatórias e resumo curto separado do histórico.
- [ ] Atualizar proveniência das skills empacotadas e regenerar catálogo: `cargo run --locked --features mcp --example mcp_catalog`.
- [ ] Validar pacotes em diretórios de harness isolados e cliente frontend gerado. Não instalar globalmente durante testes.

**Aceite:** os dois modos possuem tutorial reproduzível; instruções antigas não mandam integrado enviar mensagem por fora da Conversa.

### 9. Aceitação ponta a ponta e entrega em PR

- [ ] `cargo build` e `cargo test` com ambiente de testes isolado; repetir contratos/migrações nos drivers SQLite e PostgreSQL >=18.
- [ ] Em frontend: `npm test`, `npm run build` e `npm run audit:i18n`.
- [ ] Testar líder integrado + dois workers integrados: paralelismo, pergunta de um worker, resposta somente a ele, resumo e aviso único.
- [ ] Testar líder integrado + worker externo e líder externo + worker integrado, incluindo consulta/ack MCP.
- [ ] Testar falha de rede, MCP sem login, processo encerrado após aceitar turno, troca de vínculo, reinício e aprovação pendente.
- [ ] Comparar contagens e integridade de uma cópia do banco antes/depois da migração; preservar original.
- [ ] Abrir PR com changelog, notas de compatibilidade, evidências e limitações; disponibilizar build local para avaliação. Sem merge na main e sem publicar sem aceite.

## Foco de revisão

1. Chats externos ocupados: nenhuma tentativa de controlar Desktop (etapas 1–2).
2. Troca de sessão durante envio: sem entregar duas vezes ou à sessão errada (etapa 4).
3. Stream desconectado após aceite: recuperar histórico, nunca reenviar por suposição (etapas 2–3).
4. Aprovação respondida após cancelamento/troca: decisão antiga não afeta turno novo (etapa 6).
5. Ferramenta anunciada mas sem credencial/disponibilidade: estado honesto e recuperação visível (etapas 5–7).

## Fora desta fase

Claude Code executável, hospedagem cloud/multitenant, cobrança, métricas por intervalo de tokens, controle remoto de sessões Desktop, automação de navegador e migração automática do histórico do harness. A arquitetura prevê adaptadores, mas nenhum desses recursos é requisito para liberar o primeiro modo integrado.

## Registro no Bee Team

Pendente: anexar este plano como nova revisão/novo plano na tarefa de integração, criar as nove subtarefas acima com conteúdo próprio e preservar as seis subtarefas anteriores como evidência da primeira entrega. Não reabrir itens anteriores apenas para representar escopo novo. Confirmar os IDs retornados e o conteúdo persistido antes de anunciar registro no board.
