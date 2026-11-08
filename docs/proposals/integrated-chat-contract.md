# Contrato frontend/backend do chat integrado — v0.1.0-draft

Status: contrato da implementação em revisão na branch `codex/agent-session-bindings`. Fonte dos tipos: [OpenAPI](integrated-chat-openapi.json). Testes de contrato e aceitação real do runtime são verificações distintas. Sem merge automático.

## Decisões

HTTP envia comandos; SSE transmite eventos persistidos. O frontend não conhece JSON-RPC, IDs de request ou processos do Codex. Backend traduz provedores para o contrato Bee Team. Nenhum endpoint expõe credenciais ou raciocínio privado do modelo.

MVP do chat: um vínculo integrado ativo previamente criado, uma conversa por vínculo e no máximo um turno não terminal por vínculo. Não criar uma segunda sessão silenciosamente. Criar chat não cria vínculo nem toma controle de chat externo. A etapa de lifecycle do plano fornece o vínculo; a interface mostra indisponibilidade enquanto isso não estiver pronto. Um novo vínculo gera novo chat; o anterior permanece legível.

O líder deve ser o líder atual do teamId. bindingId deve pertencer ao líder, estar ativo, no modo integrado e usar provedor suportado. Repetir criação para o mesmo vínculo retorna o chat existente (200); primeira criação retorna 201. Tarefa é opcional e não é criada automaticamente ao abrir chat.

## Endpoints

| Método e caminho /api/v2 | Resultado |
|---|---|
| GET /agents/{agentId}/runtime | Modo, vínculo, disponibilidade, capacidades e ferramentas efetivas |
| POST /agents/{agentId}/integrated-session | Cria sessão Codex própria e ativa vínculo integrado, usando If-Match do agente e expectedBindingId |
| GET /leader-chats?teamId=… | Chats do time, paginação por cursor |
| POST /leader-chats | Cria/recupera chat de um vínculo integrado existente |
| GET /leader-chats/{chatId} | Snapshot consistente de chat, últimas 50 mensagens, turno, ferramentas, aprovações e cursor |
| GET /leader-chats/{chatId}/messages | Histórico paginado, até 100 mensagens por página |
| POST /leader-chats/{chatId}/messages | Persiste mensagem e intenção de execução; retorna 202 com mensagem e turno |
| GET /leader-chats/{chatId}/events | SSE: replay após cursor e acompanhamento dos próximos eventos |
| GET /leader-chats/{chatId}/turns/{turnId} | Estado atual e ETag do turno |
| POST /leader-chats/{chatId}/turns/{turnId}/reconcile | Consulta o turno original sem reenviar; retorna {resolved,turn} |
| POST /leader-chats/{chatId}/turns/{turnId}/cancel | Solicita interrupção; 202 não significa interrupção confirmada |
| POST /leader-chats/{chatId}/approvals/{approvalId}/decision | Aceita/recusa solicitação específica, com If-Match |

Todos os IDs de entidades persistidas são UUIDv7; clientMessageId e Idempotency-Key são UUIDs de qualquer versão. Horários RFC3339 UTC. Campos opcionais de entrada omitidos têm os defaults descritos; campos de saída nullable sempre são enviados. IDs/cursors são opacos para o frontend.

Bootstrap integrado: POST integrated-session recebe `{projectRoot, expectedBindingId}`. A raiz deve ser absoluta e existir no host; executable/installationId são configuração do servidor, nunca campos enviados pelo browser. If-Match corresponde ao agente. expectedBindingId é null sem vínculo anterior ou o UUID do vínculo a substituir. Resposta 201 contém `{agentId,bindingId,harness,mode,externalId,projectRoot}`. Só depois se cria o leader-chat; falha de criação de chat não exige criar outra sessão. Sessão externa não é retomada para esse bootstrap, mesmo quando usa o mesmo Codex.

## Autoria, versões e idempotência

Preservar convenções RA/Kanban: X-Actor-Kind obrigatório nas escritas; X-Actor-Id somente quando kind=agent. São metadados, não autenticação. Não usar esses headers como fronteira de segurança. O deployment continua local; contrato não autoriza publicação da API local na internet. Aplicar a política de origem existente também ao stream e aos comandos.

Todas as escritas exigem Idempotency-Key com replay por 24h. Resolver replay antes de checar versões atuais. Payload diferente com a mesma chave dá 409 idempotency_conflict. POST de mensagem também deduplica clientMessageId por chat durante toda a vida do histórico, inclusive com nova chave: mesma mensagem retorna o resultado original, conteúdo diferente dá 409. A intenção e a mensagem são uma única transação.

Enviar mensagem não usa If-Match do chat (stream alteraria versões continuamente). Exige bindingId atual no corpo e exclusão transacional de turno ativo: duas mensagens concorrentes distintas não geram dois turnos. A segunda recebe 409 turn_in_progress. O compositor preserva seu texto. Corpo contém texto não vazio, máximo 65536 bytes UTF-8; maxLength do schema é limite adicional. taskId omitido equivale a null; se informado deve existir no contexto do time gerenciador, caso contrário 409 invalid_request.

Cancelar usa ETag forte do turno; decisão usa ETag forte da aprovação. GET de turno e resposta de cancelamento retornam ETag; versão de aprovação vem no snapshot/evento/resposta e permite montar ETag como string entre aspas. If-Match ausente dá 428 version_required; desatualizado dá 409 version_conflict. Em sucesso de decisão, ETag corresponde à nova versão da aprovação.

## Estados e falhas de execução

Fluxo: queued → running → completed. running pode ir para waiting_approval → running; queued/running/waiting_approval podem ir para cancel_requested → cancelled. Rejeição/erro confirmado pode terminar failed; perda de confirmação após envio termina uncertain. De cancel_requested ainda pode chegar completed se o provedor concluiu antes da interrupção. Terminal confirmado nunca volta a running. uncertain bloqueia novos turnos até reconciliação explícita pelo backend; não oferecer retry automático de mensagem.

202 confirma persistência, não início no Codex. Falha de execução posterior vem no Turn.failure e no SSE, não transforma retroativamente o POST em erro. Timeout HTTP exige reenviar mesma chave/clientMessageId para descobrir o resultado. Desconectar stream não cancela execução. Cancelar turno já terminal retorna 200 com estado atual, sem outro efeito. Expirar uma aprovação encerra a espera com decisão negativa conforme o protocolo e registra failure quando necessário; nunca equivale a aceitar.

Troca de binding invalida envios ainda não aceitos pelo provedor. Turnos já aceitos mantêm IDs e origem; não são reenviados no novo vínculo. Chat antigo não aceita novas mensagens. Pergunta/aprovação originada por worker mantém agentId, taskId, bindingId e turnId da origem, ainda que apresentada no chat do líder. O backend resolve o pedido original, jamais o último turno arbitrário do líder.

## Histórico, stream e recuperação

Chats ordenados por createdAt/id decrescente (ordem estável, não muda com novas mensagens). Histórico retornado em ordem cronológica dentro de cada página; cursor retorna a página imediatamente anterior. Cada Message tem revision crescente; substituir por ID somente quando a revisão é maior. Histórico paginado antigo nunca sobrescreve uma revisão mais recente recebida pelo stream.

GET snapshot usa leitura consistente: mensagens materializadas, turno, ferramentas e aprovações correspondem ao mesmo eventCursor. Carregar snapshot e então abrir events?after=eventCursor garante recuperar eventos ocorridos entre as chamadas. Stream entrega pelo menos uma vez, em ordem de sequência persistida por chat; id é cursor opaco. Último cursor é exclusivo. Last-Event-ID prevalece sobre after em reconexão. Sem ambos: 400 invalid_request. Cursor de outro chat/inválido: 400; cursor expirado: 409 cursor_expired ANTES de enviar headers SSE. Refazer snapshot, não reenviar mensagem.

Persistir evento antes de publicar. Não há promessa de exactly-once de rede. Frontend deduplica event id e aplica revision/version crescente; eventos não modificam outros chats. Heartbeat `: heartbeat` a cada 15s não tem id nem muda cursor. Content-Type text/event-stream; Cache-Control no-cache; desabilitar buffering. Usar fetch streaming com AbortController para ler JSON de erro, códigos HTTP e Last-Event-ID; evitar EventSource nativo por não expor esses erros/headers de forma suficiente.

Reconectar com backoff 1s, 2s, 5s, 10s, máximo 30s, jitter; parar em 404 ou cancelamento da navegação. Mudança de chat fecha stream anterior. Evento de tipo/schemaVersion desconhecido interrompe aplicação incremental e recarrega snapshot, exibindo incompatibilidade se persistir; não reinterpretar payload desconhecido.

Eventos são discriminados por type: message.updated (mensagem completa acumulada + revision), turn.updated (turno completo), tool.updated (atividade sanitizada) e approval.updated (aprovação completa). Não transmitir tokens como deltas sem revisão: atualização acumulada simplifica replay e reconexão. Backend agrega fragmentos em janela de até 100ms, sempre emite estado final. SSE `event` coincide com type; `data` é o JSON ChatEvent do OpenAPI; `id` coincide com ChatEvent.id.

ToolActivity também tem revision crescente. Aprovação roteada de worker usa approval.updated no chat do líder, mantendo turnId/bindingId do worker de origem; esse evento não muda activeTurn do líder. turn.updated e message.updated de execução são publicados somente no chat dono daquele turno. UI compara versão da aprovação para impedir replay antigo de reabrir pedido já decidido.

Message.role também admite system para avisos somente de leitura vindos da Conversa (com taskId e identificação do remetente no conteúdo). O aviso não finge ser uma mensagem escrita pelo usuário. Se a execução destinatária for do líder, sua resposta real aparece como assistant; se for de worker, o resultado canônico permanece na Conversa e o líder recebe o aviso correspondente. Aprovação de worker sem chat integrado do líder disponível falha explicitamente com approval_required; não é aprovada automaticamente nem encaminhada a um chat externo ocupado.

Snapshot inclui atividades do turno ativo e aprovações pendentes inclusive de workers destinadas ao líder. Mensagem terminal consolidada permanece no histórico; não expor saída ilimitada de ferramentas. ToolActivity.summary tem até 4096 bytes UTF-8, sem segredos. Eventos retidos no mínimo 24h; histórico de mensagens/decisões não expira com o cursor. Cursor expirado nunca implica perda de histórico.

## Aprovações e ferramentas

O adaptador Codex implementado expõe command/file_change/network com accept ou decline para aquela ocorrência; não existe botão aceitar tudo. Backend valida solicitação ainda pendente e vínculo/turno de origem válido. Pedido expirado/encerrado retorna 409 approval_expired. Decisão aceita significa decisão registrada, não ferramenta concluída. Backend deve tratar seu envio ao provedor como idempotente/reconciliável; se a conexão se perder, não pedir nova aprovação para executar de novo silenciosamente.

Runtime distingue capacidade suportada, configuração habilitada e disponibilidade efetiva. Frontend não deduz login pelo nome do provedor. Nesta fatia, configuração de ferramentas, login OAuth e formulários MCP estruturados pertencem a contratos adicionais da etapa 5/6: não inventar endpoints no frontend. Pedido desses tipos ainda não suportados deve falhar explicitamente como unsupported_capability, sem falso botão de confirmação. Essa limitação bloqueia considerar a etapa 6 completa, mas não bloqueia desenvolver o chat básico em paralelo.

## Erros HTTP

Formato existente: {error: texto legível, code: código estável, details: objeto}. UI traduz por code e preserva texto técnico para detalhes. 400 validação/autoria/cursor; 404 entidade ausente; 409 conflito de versão/vínculo, modo externo, sessão indisponível, turno ativo, aprovação expirada ou cursor expirado; 413 tamanho; 428 versão ausente; 503 storage indisponível; 500 erro interno. Provedor sem login aparece em runtime.readiness=needs_auth e envio retorna 409 session_not_ready, sem simular falha HTTP de autenticação Bee Team.

## Trabalho em paralelo e aceite

**Entrega zero — contrato:** revisar OpenAPI, exemplos e regras; gerar tipos TS em saída isolada e validar fixtures contra os schemas. Alteração incompatível exige atualizar contrato, exemplos e ambos os consumidores no mesmo PR, antes de integrar.

**Frontend:** gerar cliente/tipos a partir deste arquivo; implementar adaptador HTTP/SSE e simulador exclusivo de testes/desenvolvimento com fixtures. Compositor, histórico, estados vazio/externo/login ausente/erro, stream, cancelamento e aprovações. Sem seed em dados reais, sem simulação habilitada em produção. Não precisa esperar endpoint pronto.

**Backend:** DTOs/validação, snapshots, persistência e replay, lifecycle Codex, stream, cancelamento e aprovação. Tests de contrato usam as mesmas fixtures; serviços independentes de HTTP/MCP. Não precisa esperar telas prontas.

**Integração:** trocar transporte simulado pelo real sem mudar componentes; verificar mensagem antes de existir tarefa, worker misto, disconnect/reload, Unicode, duas requisições concorrentes, cancelamento versus conclusão, decisão duplicada, troca de vínculo e perda de processo depois do aceite. Uma aprovação de worker deve voltar somente ao worker certo.

Fixtures são contratos, não prova de execução real. Aceite final exige sessão Codex própria, dados isolados, evidências de UI + API e PR sem merge automático. OAuth/formulários e edição de perfis exigem seus contratos complementares antes do início dessas fatias.

## Recuperação explícita de turno incerto

`reconcile` exige actor, If-Match do turno e Idempotency-Key. Consulta somente o thread e o turno originais. Estado confirmado completed/cancelled/failed é persistido com mensagem final e entrega vinculada, sem nova inferência. Running, resultado desconhecido ou ausência de providerTurnId mantém uncertain e retorna resolved:false. Uma nova verificação consciente usa nova chave; repetir pedido cujo HTTP falhou conserva a mesma chave. A interface nunca reenvia a mensagem original. Criação de sessão com resultado incerto e sem externalId conhecido continua bloqueada; não é possível atribuir com segurança uma thread por adivinhação.

## Local execution boundary

Integrated execution requires a loopback listener and peer, a local Host and no forwarding headers. Browser Origin must be loopback or an exact explicitly configured trusted origin. Permissive CORS is not execution permission. Chat routes always enforce this policy; when the integrated runtime is enabled, the same boundary covers all API and MCP commands, including Conversation writes that enqueue work. Static assets and health checks remain separate. The existing external-only mode is unchanged. This is a transport boundary, not actor authentication. Rejection returns 403 local_action_forbidden.

One chat belongs to one binding and one team in this slice. Reusing its binding for a different team returns 409 binding_chat_conflict instead of returning another team's chat. Changing the team's leader makes the old chat read-only.

Error codes are extensible strings: provider failures such as needs_auth or mcp_scope_unverified preserve diagnostics. Clients handle known codes and retain a generic fallback. A bootstrap with an unknown outcome uses session_creation_uncertain; retry keeps the same key and never guesses a new thread.
