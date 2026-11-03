# Token and Model History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task, only after separate implementation authorization. Steps use checkbox syntax for tracking.

**Goal:** Registrar consumo verificável e histórico de modelos por tarefa, colaborador (incluindo Leader), sessão e harness, com consultas por período sem duplicação ou falsa precisão.

**Architecture:** Skills investigam fontes e podem obter evidências diretamente de ferramentas, APIs e arquivos permitidos; coletores/adapters são alternativas opcionais para automatizar essa leitura. Serviços normalizam observações imutáveis, preservam proveniência e atribuem parcelas a execuções; repositórios PostgreSQL/SQLite mantêm o ledger e calculam agregados em snapshots. HTTP/MCP compartilham DTOs e serviços; indisponibilidade exige investigação documentada, nunca apenas ausência de coletor.

**Tech Stack:** Rust, SQLx, PostgreSQL >=18, SQLite, contratos OpenAPI/MCP existentes, coletores locais opcionais, frontend React/TypeScript existente.

**Spec:** Requisitos consolidados neste documento, seções 1–9, a partir do pedido do usuário transmitido pela coordenação em 30/10/2026. Pesquisa iniciada nessa data; revisão documental concluída em 31/10/2026. Este arquivo é proposta, não funcionalidade entregue.

## Global Constraints

- SOMENTE pesquisa e plano nesta entrega: nenhuma migration, coletor, Skill, dashboard ou configuração de telemetria é implementado ou instalado.
- Não alterar dados reais, iniciar sessões pagas, ler credenciais/transcrições privadas, reiniciar serviços ou presumir autorização para exportar métricas.
- Respeitar `route -> dto -> service -> repository -> service -> dto -> route`; nenhuma regra de contabilização em HTTP/MCP ou SQL adapter.
- IDs internos UUIDv7; slugs são aliases imutáveis e nunca chaves de atribuição. Actor declarado não equivale a autenticação.
- PostgreSQL padrão; SQLite opt-in, migrations independentes, writes serializados, leitura em snapshot. Nenhum arquivo-fonte acima de 1000 linhas.
- Tokens, ocupação de contexto, créditos, requisições premium e dinheiro têm unidades distintas. Campo ausente é `null`/indisponível, não zero.
- Investigar e justificar a limitação é obrigatório; obter um número a qualquer custo não é. Coleta direta permitida pelo agente é caminho de primeira classe, sem exigir SDK/exporter instalado.
- `currentSummary` continua cumulativo e escrito pelo colaborador; métricas não substituem síntese, especificação, plano ou resumo de execução.
- Decisão final de31/10: apresentar métricas/modelos em campos estruturados dos resumos históricos e na Visão geral; não acrescentar bloco lateral ou métricas em comentários como apresentação padrão.
- Mudanças de Skill e contratos exigem atualização do snapshot bundled/proveniência e catálogo, sem sugerir instalação global automática.

## Review Focus

1. Retomada/rotação de arquivo conserva contador cumulativo: não contar todo o histórico outra vez (tarefas 2 e 4).
2. Uma sessão trabalha em duas tarefas, ou inclui subagentes: nenhum total pode aparecer integralmente em ambas (tarefas 2 e 3).
3. Modelo muda entre duas amostras: não atribuir toda a diferença ao último modelo nem inventar instante exato (tarefas 2 e 6).
4. Atualização final de uso chega após o fechamento da atividade: permitir conciliação sem repetir comentário ou reabrir tarefa (tarefa 3).
5. Campo de contexto/crédito parece contador de consumo: capability probe deve rejeitar semântica incompatível e mostrar indisponibilidade (tarefas 1, 4 e 5).

## 1. Escopo e critério de sucesso

O usuário precisa saber quanto foi consumido em cada tarefa e globalmente por colaborador, quais modelos/ambientes foram utilizados e quando. Leader é consumidor e participante como qualquer colaborador; seu trabalho de coordenação não deve desaparecer dos totais. Uma tarefa pode ter vários atores, cada qual em várias sessões, modelos e harnesses simultaneamente.

O MVP deve aceitar evidência parcial: modelo informado sem tokens é útil; tokens da sessão sem tarefa demonstrável ficam não atribuídos; consumo sem divisão por modelo permanece em grupo desconhecido. Não exigir que cinco produtos exponham o mesmo contrato. Entregar cinco adapters de capacidade, dos quais alguns podem produzir apenas observações de modelo e motivo explícito para tokens indisponíveis.

Não é objetivo avaliar produtividade por tokens, estimar consumo histórico a partir de tamanho de comentários, deduzir modelo pelo nome do agente, faturar usuários, ou construir dashboards globais agora. Os contratos de agregação global fazem parte do desenho para evolução posterior.

## 2. Pesquisa: capacidades e limites das fontes

**Legenda:** documentado = contrato encontrado em documentação oficial; observado = comportamento local efetivamente verificado; proposta = decisão Bee Team; não localizado = pesquisa não estabeleceu contrato, não prova impossibilidade. Os snippets/receitas abaixo são para implementação futura e não foram executados contra contas ou sessões desses produtos.

### 2.1 Codex

Documentado: App Server emite `thread/tokenUsage/updated`, eventos de turnos e `model/rerouted` com thread/turno e modelos de origem/destino. Isso permite correlação em integração que controla a conexão; não garante acesso ao stream de um aplicativo desktop já aberto. O adapter deve usar schema gerado pela versão instalada e registrar essa versão, sem depender de campos presumidos. [App Server oficial](https://learn.chatgpt.com/docs/app-server).

Documentado: `codex exec --json` produz eventos JSONL, incluindo `turn.completed.usage` com input, cached input e output. É uma fonte para execuções lançadas pelo integrador, não uma forma de observar outra sessão. Não executar novo prompt só para descobrir uso do chat atual. [Modo não interativo](https://learn.chatgpt.com/docs/non-interactive-mode).

Evidência local **recebida da coordenação**, não reexecutada nesta pesquisa: rollouts têm `event_msg.token_count.info.total_token_usage` e `turn_context.model`; o cumulativo pode continuar entre arquivos. Tratar como adapter experimental de formato interno, com fixture sanitizada e versão, nunca como API pública estável. O caminho do arquivo não identifica sozinho sessão/epoch; cache input é subconjunto de input nessa evidência. Não inferir cobertura de voz, auto-review ou subchats. Sem acesso permitido ao log/stream, Skill registra indisponibilidade.

### 2.2 GitHub Copilot

Documentado: no SDK, `assistant.usage` é efêmero, por chamada, inclui modelo e campos opcionais input/output/cache; `reasoningTokens` é subconjunto de output. Há IDs de evento/chamada e `agentId` para subagentes. Instalar assinatura antes de iniciar/retomar; eventos efêmeros perdidos não são recuperados pelo replay. `cost` é multiplicador de billing, não valor monetário. `session.usage_info` descreve contexto. Não somar eventos por chamada e agregados de shutdown sobre a mesma cobertura. A relação input/cache deve ser validada por endpoint/versão antes de produzir total normalizado. [Eventos SDK](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/streaming-events).

Documentado: hooks CLI/cloud são integrações específicas, com contexto e permissões próprios; sua disponibilidade não prova contadores no chat do VS Code/JetBrains. [Hooks oficiais](https://docs.github.com/en/copilot/reference/hooks-reference). Proposta: SDK controlado é a primeira fonte; CLI/IDE sem stream contabilizável exposto ficam `unsupported_surface` ou `collector_not_configured`, sem scraping de credenciais ou transcrições. Confirmar entitlement, política organizacional e versão durante instalação futura.

### 2.3 Claude Code

Documentado: statusLine recebe JSON com sessão/modelo/versão. `context_window.total_input_tokens/total_output_tokens` descrevem a resposta/contexto mais recente, não ledger cumulativo; `current_usage` pode ser nulo. Não diferenciar esses campos como se fossem consumo acumulado. [Statusline](https://code.claude.com/docs/en/statusline).

Documentado: Agent SDK oferece `modelUsage`/`model_usage` incluindo subagentes; `usage` cobre o loop principal. Retomadas podem carregar totais anteriores, exigindo baseline; mensagens podem repetir uso da mesma resposta. Custos são estimativas locais. Proposta: eleger resultado agregado por modelo OU chamadas individuais com cobertura completa, nunca ambos. Se agregado inclui subagente sem identificação suficiente, preservar consumo de árvore como compartilhado. [Cost tracking](https://code.claude.com/docs/en/agent-sdk/cost-tracking).

Documentado: OTel disponibiliza contador `claude_code.token.usage` por modelo/tipo; requer configuração/exportação e pode transportar identidade. Proposta: exporter somente de metadados permitidos, sem habilitar logs de prompt, resposta, raciocínio ou argumentos. Confirmar temporality, resource attributes, reset e cardinalidade na versão alvo. [Monitoring](https://code.claude.com/docs/en/monitoring-usage).

Pesquisa oficial recebida do chat Skills: hooks `SessionStart`/`PostModelSwitch` permitem observar modelo; hook Stop não garante transcrição final pronta em todas as versões. Hooks correlacionam ciclo de vida, não substituem contador. [Hooks](https://code.claude.com/docs/en/hooks). Skill isolada não recebe automaticamente stdin da statusline ou stream OTel/SDK. Desktop, CLI, IDE e cloud precisam probes separados.

### 2.4 Cursor

Documentado: hooks carregam `conversation_id`, `generation_id`, versão e modelo selecionado (`model`, opcional `model_id`/`model_params`). Esses campos observam configuração, não garantem modelo efetivamente executado em Auto. Tab e Agent têm superfícies distintas; cloud tem limitações, incluindo ausência de hooks durante fases read-only. Proposta: usar hooks para vínculo e histórico configurado, sem interpretar `preCompact`/contexto como consumo. [Hooks](https://cursor.com/docs/hooks).

Documentado: Admin API `POST /teams/filtered-usage-events` fornece eventos paginados com modelo, timestamp, tokenUsage opcional e conversationId opcional; autenticação é administrativa. Campos cache/input/output e valores de cobrança não têm necessariamente a mesma cobertura. Proposta: coletor administrativo separado, fora do alcance de Skills, busca intervalo limitado e correlaciona conversationId quando presente. Sem ID estável de evento, não deduplicar apenas por hash dos valores: preservar multiplicidade e conciliar janelas completas. Sem conversationId/vínculo inequívoco, manter não atribuído. [Admin API](https://cursor.com/docs/account/teams/admin-api).

Licença/scopes/retention/rate limits efetivos precisam ser confirmados na conta antes de ativar. Nenhuma chave foi solicitada/lida. Não utilizar cookies privados ou banco interno do editor como fallback automático. SDK/CLI/IDE/cloud não herdam capacidades uns dos outros; só declarar suporte após fixture da superfície alvo.

### 2.5 Kiro

Documentado: `/model` seleciona modelo, `/usage` mostra uso/billing e `/context` ocupação; não são equivalentes a tokens por chamada. Modelo selecionado não prova execução, especialmente com Auto/fallback. [Slash commands](https://kiro.dev/docs/reference/slash-commands/). Pesquisa Skills também identificou estimativa de tokens de definições de ferramentas no CLI 1.26: esse número não é consumo total. [Changelog](https://kiro.dev/changelog/cli/1-26/).

Documentado: ACP integra cliente e harness; extensões/capacidades dependem da negociação e geração. Não confundir ACP com MCP nem inferir suporte a uso apenas porque existe seleção de modelo. [ACP CLI](https://kiro.dev/docs/cli/acp/). Pesquisa Skills não localizou contrato oficial estável de tokens brutos por request em hooks/logs; essa ausência é um limite da pesquisa. [Hooks](https://kiro.dev/docs/hooks/).

Proposta: MVP registra modelo observado/configurado e `tokens: unavailable` até capability validada. Créditos ficam como unidade distinta, sem conversão presumida. CLI, IDE, cloud e headless são provas separadas; lançar headless não observa chat existente. Não usar relatos de formatos internos como suporte de produção.

### 2.6 Matriz operacional proposta

| Harness/superfície | Fonte preferida | Skill sozinha? | Dependência/permissão | Fallback honesto |
|---|---|---|---|---|
| Codex integração App Server/exec | Stream da execução controlada | Só se ferramenta expuser metadados | Acesso ao stream e versão compatível | unavailable, sem iniciar nova execução |
| Codex desktop/IDE existente | Metadados expostos; rollout opt-in experimental | Leitura permitida e identidade exata | Caminho restrito, parser versionado | unknown coverage/model |
| Copilot SDK | assistant.usage em tempo real | Não cria assinatura por carregar Skill | SDK/CLI autenticado, política da conta | gap de stream ou unsupported_surface |
| Copilot IDE/CLI sem coletor | Nenhum contador estabelecido nesta pesquisa | Não | Integração específica futura | tokens indisponíveis |
| Claude SDK/CLI OTel | Resultado por modelo OU stream/OTel | Só consome evidência já exposta | Exporter/hook permitido, dados minimizados | modelo sem consumo |
| Cursor Agent IDE | Hooks + Admin API quando acessível | Hook não concede chave Admin | Integração local/admin separada | configuração do modelo; tokens null |
| Cursor Tab/cloud/CLI | Probe próprio, sem herança | Não presumir | Cobertura/versionamento específico | parcela sem cobertura |
| Kiro CLI/IDE | Observações modelo/ACP negociado | Só campos disponíveis | Hooks/cliente permitido | tokens unavailable |

## 3. Identidade e estrutura persistida proposta

### 3.0 Descoberta obrigatória antes de declarar indisponibilidade

Revisão solicitada pelo usuário em 31/10/2026. Esta seção rege todos os fallbacks da matriz e das receitas, inclusive Kiro e superfícies sem contrato localizado na pesquisa anterior. “Não sei onde está” e “não existe coletor” iniciam investigação; não são evidência de indisponibilidade. O caso Codex relatado pela coordenação — negativa inicial seguida de descoberta de contadores nos logs — é caso de regressão obrigatório, não prova de que qualquer log seja fonte válida.

Workflow futuro da Skill, antes do primeiro registro e quando a capacidade mudar:

1. **Identificar contexto:** harness, superfície (desktop/CLI/IDE/cloud), versão instalada/exposta, task/actor e sessão lógica correta. Registrar como a sessão foi correlacionada. Não escolher arquivo só por ser o mais recente, pelo título ou por compartilhar diretório.
2. **Inventariar recursos disponíveis:** ferramentas conectadas, metadados de execução, APIs acessíveis com autorização já existente, comandos de diagnóstico somente leitura e fontes locais pertinentes. Consultar capability cache compatível antes de repetir descoberta. A ausência de uma ferramenta nomeada no plano não encerra a busca.
3. **Procurar fontes pertinentes:** documentação embarcada/versionada e arquivos de metadados/logs em diretórios do harness identificados por evidência. Enumerar nomes/metadados antes de ler conteúdo; filtrar pelo ID correto. Usar projeção/extração somente de campos de sessão/modelo/uso, sem carregar transcrições inteiras no contexto ou no ledger. Se a leitura seletiva segura não estiver disponível, registrar essa limitação específica.
4. **Pesquisar o método desconhecido:** consultar documentação oficial/versionada; se o método não estiver estabelecido localmente, pesquisar internet em fontes oficiais. Registrar URL, data, versão/superfície e campos relevantes. Rede indisponível é uma tentativa não executável documentada, não prova de inexistência de tokens. Relatos externos podem indicar uma pista, mas não substituem validação da fonte.
5. **Reproduzir leitura permitida:** tentar uma consulta/extração mínima da sessão correta usando ferramentas já autorizadas. Confirmar unidade, scope, tipo de contador, cache, subagentes, retomada, timestamp e modelo configurado versus efetivo. Uma fonte interna pode ser usada como experimental/versionada quando a semântica foi validada; não precisa esperar um coletor instalado. Se falta baseline, registrar a amostra e `pending`, em vez de declarar contador inexistente.
6. **Escolher resultado:** `available` com evidência reproduzível; `partial` com campos/cobertura conhecidos; `pending` aguardando fronteira de contador; ou `unavailable` com tentativas e motivo concreto. Falha de permissão, sessão não identificável e semântica ambígua são motivos distintos. Não somar créditos/contexto como tokens para evitar um fallback.

Registrar `DiscoveryReport { id, harness, surface, harnessVersion?, sessionCorrelation, investigatedAt, capabilityCacheKey, attempts[], outcome, limitationReason?, nextRecheckAt? }`. Cada tentativa contém categoria (tools/api/local_metadata/local_file/docs/web), referência sanitizada, ação somente leitura, resultado ou motivo por que não pôde ocorrer, e semântica confirmada/pendente. Não guardar comando com credencial, caminho com dados pessoais desnecessários, texto de conversa ou resposta integral de API. `unavailableReason` referencia esse relatório; explicação “sem acesso” precisa dizer qual fonte e qual restrição foram observadas. API valida presença/estrutura do relatório, sem alegar que o autorrelato autentica a investigação.

Investigação proporcional: uma passagem por inventário, busca local delimitada, documentação e pesquisa oficial quando necessária, seguida de leitura mínima. Encerrar ao obter fonte suficiente ou esgotar os caminhos pertinentes disponíveis; não varrer todo o home nem insistir em variantes do mesmo acesso negado. Caminhos que não se aplicam recebem justificativa, sem chamadas artificiais para preencher checklist.

Cache de método/capacidade por harness + superfície + versão + schema/parser + contexto de permissões, **sem reutilizar valores ou identidade de outra sessão**. Revalidar identidade e frescor da amostra em cada atualização. Mudança de versão, schema, permissão, fonte, sessão incompatível ou erro de parsing invalida a parte pertinente imediatamente. Proposta: descoberta negativa expira após 24 horas; positiva recebe revisão documental após 7 dias, com validação leve de schema em toda leitura. Cache válido evita repetir pesquisa na internet a cada comentário. Mesmo no cache negativo, detectar nova ferramenta/fonte antes de reutilizar a justificativa; usuário pode solicitar nova investigação a qualquer momento.

Limites: não iniciar sessão paga para diagnóstico, não ler credenciais, não buscar conversa alheia, não burlar permissões e não instalar hook/exporter implicitamente. Um conector autorizado pode acessar API administrativa sem expor sua chave ao agente; a falta de conector não autoriza extrair segredos. Se a investigação exigir nova permissão ou integração, registrar o requisito e continuar o trabalho funcional com a limitação explícita. **Obrigatório investigar e justificar, não obrigatório obter número a qualquer custo.**

### 3.1 Entidades históricas

Não adicionar `model` mutável ao agente como histórico. Perfil atual pode mudar sem reescrever o passado. Manter IDs estáveis e snapshots mínimos no momento da observação. `harness=cursor` não implica `provider=anthropic`; `model=auto` não é modelo concreto. Provider desconhecido continua null, mesmo se o nome parecer reconhecível.

Novas entidades (nomes propostos; não criadas nesta entrega):

| Tabela | Campos essenciais | Responsabilidade |
|---|---|---|
| execution_sessions | id, collectorNamespace, externalSessionKey, parentSessionId?, harness, surface, harnessVersion?, openedAtObserved, closedAtObserved?, capabilityVersion | Identidade lógica, independente do arquivo e da tarefa |
| usage_discovery_reports | id, sessionId?, capabilityCacheKey, investigatedAt, attemptsSafe, outcome, limitationReason?, nextRecheckAt? | Investigação sanitizada e justificativa do fallback; mesmo limite de payload seguro das observações |
| execution_bindings | id, sessionId, taskId, actorKind, actorId?, actorRole, actorNameSnapshot?, taskTitleSnapshot?, startsAt, endsAt?, bindingSource, evidenceRef | Quem trabalha em qual tarefa; intervalos explícitos e possivelmente sobrepostos |
| usage_observations | id, sessionId, sourceEventKey, epoch, sourceSequence?, sourceOccurredAt?, observedAt, scope, counterKind, safePayload, payloadHash, parserVersion, quality, unavailableReason?, supersedesId? | Evidência imutável, valores originais permitidos e cobertura |
| usage_segments | id, observationStartId?, observationEndId, sessionId, startAt?, endAt, timeBasis, inputTotal?, cacheRead?, cacheWrite?, outputTotal?, reasoning?, total?, provider?, modelId?, modelRaw?, measurementQuality, coverageState, canonical | Consumo normalizado por chamada ou delta de intervalo |
| usage_allocations | id, segmentId, bindingId?, taskId?, actorKind?, actorId?, actorRole?, harnessSnapshot, modelKey?, tokenComponents, allocationKind, allocationRevision, supersedesId? | Parcelas exatas, estimadas ou compartilhadas/não atribuídas |
| model_observations | id, sessionId, bindingId?, observedAt, sourceOccurredAt?, configuredModel?, effectiveModel?, provider?, modelRaw?, evidenceKind, sourceObservationId? | Mudanças observadas sem sobrescrever histórico |
| usage_costs | id, segmentId, amountDecimal, currency, source, quality, pricingVersion?, effectiveAt?, includesFees | Extensão monetária opcional e independente |
| execution_summary_usage_reports | id, summaryId, taskId, reportingActorKind, reportingActorId?, reportedAt, statusObservedId, statusNameSnapshot, statusIsDoneSnapshot, ledgerRevision, coverageState, revision, supersedesId? | Vínculo estruturado entre resumo histórico, estado observado e evidência; separado de Markdown |
| execution_summary_usage_entries | id, reportId, sessionId, bindingId?, usageActorKind, usageActorId?, actorRole, periodStart?, periodEnd?, timeBasis, reportKind, counterScopeKey, observationIds, segmentIds, modelObservationIds, valuesReported, periodDelta?, deltaBasis? | Uma entrada por escopo explícito, preservando ator de consumo distinto do autor do reporte |

Tipos: UUID nativo PG/TEXT SQLite validado; timestamps UTC com precisão comum de microssegundos, timestamp bruto seguro opcional e unidade explícita; contadores BIGINT/INTEGER com CHECK >=0. JSONB PG/JSON text SQLite para payload **allowlist**, limite proposto 16 KiB por observação. A API transporta contadores como strings decimais para evitar perda acima de 2^53; normalização usa inteiro checked e rejeita overflow. Custo usa decimal exato string, nunca float.

FKs não fazem cascade de histórico quando agente/tarefa são arquivados ou soft-deleted. Human sem identidade individual fica `actorKind=human, actorId=null`; não criar identidade a partir de email. `actorRole` enum leader/collaborator/human/unknown é snapshot declarado, não permissão. Troca de papel abre binding novo. Agregação por actorId usa identidade, rótulo atual opcional e rótulo histórico separado.

Índices/constraints propostos:

- UNIQUE sessions(collectorNamespace, externalSessionKey); namespace não contém segredo.
- UNIQUE observations(sessionId, epoch, sourceEventKey); mesma chave e mesmo hash = replay, hash diferente = conflito auditável 409.
- observations(sessionId, epoch, sourceSequence), segments(sessionId, endAt, id), model_observations(sessionId, observedAt, id).
- allocations(taskId, endAt materializado, id), allocations(actorId, endAt, id); índices dimensionais harness/model conforme EXPLAIN nas consultas reais.
- bindings(sessionId, startsAt, endsAt), bindings(taskId, actorId); limites half-open `[start,end)`.
- UNIQUE por revisão canônica de allocation, soma de parcelas <= segmento por componente, verificada pelo serviço sob write transaction; compartilhado não se replica como valor somável por tarefa.

Datas precisam ser materializadas na allocation para os índices indicados; copiar start/end/timeBasis do segmento na criação e manter imutável. Correções criam nova revisão e excluem a anterior da visão canônica. Os DTOs expõem evidenceIds para auditoria.

## 4. Algoritmo de contabilização

### 4.1 Normalização

`normalize(observation, capability) -> NormalizedObservation | Unavailable | Quarantine` é função pura, sem DB/rede. Capability declara unidade, scope request/turn/session/tree/context, counter delta/cumulative/gauge, relações de subconjuntos e cobertura de subagentes.

1. Validar versão, tipos, unidade e intervalo dos números. Não coagir null para 0, texto arbitrário para número ou gauge/context para contador.
2. Preservar componentes originais permitidos; separar `inputTotal` inclusivo de cache quando a semântica estiver demonstrada. Se input for exclusivo, somar cacheRead/cacheWrite apenas com categorias disjuntas confirmadas. Sem semântica suficiente, manter componentes e `total=null`.
3. `total=inputTotal+outputTotal` apenas se ambos existem e são disjuntos. Reasoning subset não soma novamente. Uma falta parcial gera qualidade/coverage parcial, nunca total falso.
4. Fonte mediu tokens não significa que atribuição à tarefa/modelo seja exata: `measurementQuality=measured|estimated|unavailable`; `allocationKind=exact|estimated|shared|unallocated`; `coverageState=complete|partial|gap|pending` são eixos separados.
5. Contagem por tokenizer local, se futuramente autorizada, é estimated com método/versão/texto coberto; não reconstruir prompts ocultos nem apresentar estimativa como consumo do provedor.

### 4.2 Baseline, retomada e reset

`derive(previous, current, capability) -> Vec<UsageSegment>`:

- Chamada individual: segmento único, dedupe por ID de chamada/evento estável, sem diferença de acumulados.
- Cumulativo: baseline inicial não é consumo novo. Só admitir baseline zero se a fonte provar início da cobertura em zero. Ao conectar a sessão existente, registrar início parcial e aguardar segunda amostra.
- Mesma sessão/epoch e ordem crescente: delta por componente conhecido. Exemplo sintético: input 1000→1300, cache 600→800, output 100→160 produz input 300, cache 200, output 60, total 360; não 560.
- Amostra repetida = no-op; amostra atrasada preserva evidência, não move cursor para trás. Reprocessar segmento afetado por revisão determinística se permitir recuperar ordem completa.
- Queda de contador: não aplicar max(0,delta). Se fonte sinaliza reset, abrir epoch e baseline novo; sem prova, quarentena `counter_regression` e gap até ressincronizar.
- Rotação do arquivo/compactação/retomada não cria epoch automaticamente. Chave é sessão lógica e identidade do contador. Alteração de schema bloqueia parsing daquele trecho até capability validada.
- Total por sessão e eventos por chamada são visões sobrepostas. Escolher cobertura canônica mais granular comprovada; agregado serve conciliação, nunca soma extra. Se só há agregado, guardar seu scope real.

### 4.3 Tarefa, ator e concorrência

Binding deve existir antes da unidade de trabalho, salvo importação histórica explicitamente comprovada. Atribuição exata exige chamada/turno vinculado ou intervalo inteiramente contido em um único binding inequívoco. Caminho do repositório, usuário de conta ou título do chat não bastam.

Quando um delta cruza troca de tarefa/modelo sem amostra na fronteira, preservar segmento compartilhado com candidatos; não dividir por tempo como se fosse medido. Se usuário optar por rateio futuro, classificar estimated, registrar pesos/método e manter original. Cada componente é conservado, com arredondamento determinístico e resíduo não atribuído.

Subagente identificado recebe sessão/binding e ator próprios. Se parent total inclui filhos, excluir cobertura sobreposta antes de somar; sem decomposição demonstrável, atribuição fica tree/shared. Leader não absorve automaticamente trabalho de colaboradores. A consulta global soma segmentos canônicos únicos; a consulta por tarefa soma somente parcelas atribuídas e mostra compartilhados como referências não somáveis.

### 4.4 Fechamento e chegada tardia

O consumo da própria chamada que grava um resumo pode só ser conhecido depois dela. Antes de registrar o resumo histórico, coletar o que existe e gravar `coverageState=pending` quando turno está aberto. Coleta direta posterior ou coletor pós-turno finaliza métricas via ingestão idempotente e adiciona revisão ao vínculo do resumo; não cria outro resumo/comentário, não muda status da tarefa e não inventa que tudo já foi medido. Preservar o reporte original e distinguir `reportedAt` original de `reconciledAt` na revisão tardia.

Persistir fila local durável de metadados, com ack somente após commit do servidor. Retry usa mesma chave; backoff não gera registros novos. Falha de exportação não bloqueia trabalho funcional, mas deixa motivo auditável. Não emitir infinitamente telemetria sobre o próprio envio de telemetria: usar evento final externo ao loop LLM ou próximo checkpoint, sem autoprompt recursivo.

## 5. Histórico dos modelos

Separar `configuredModel`, `effectiveModel` e `provider`; um valor Auto/configuração serve como observação de seleção, não inferência do provedor efetivo. IDs normalizados usam namespace provider quando conhecido; preservar string original allowlisted. Não embutir catálogo fixo obrigatório de modelos.

Por sessão + ator + tarefa, derivar períodos de observação. Se A foi visto às 10:00 e B às 10:05 sem evento de mudança, transição está em `(10:00,10:05]`; exibir “B observado às 10:05”, não “B começou às 10:05”. Evento explícito pode fornecer timestamp da mudança; registrar sourceTime versus observedTime e clock skew.

Eventos de uso com modelo efetivo definem consumo daquele modelo. Um delta cumulativo com modelos diferentes nas extremidades não é todo do último modelo: usar grupo mixed/unknown até haver detalhe. Tarefas concluídas mantêm histórico; uma correção tardia não altera status e gera revisão auditável. O último modelo por colaborador deve incluir horário, fonte e sessão; duas sessões simultâneas aparecem separadas, sem escolher arbitrariamente uma como verdade global.

## 6. Contratos propostos e atomicidade

Novos DTOs em `src/dto/usage/{observation,binding,query}.rs`; tipos de domínio em `src/services/usage/{normalization,attribution,models}.rs`; interfaces em `src/repositories/contracts.rs` com tipos de persistência em módulo dedicado. SQL e exportadores ficam em adapters. `AppState` compõe serviço/interfaces; controller não recebe pool.

Operações propostas (nomes sujeitos ao review desta proposta, não disponíveis agora):

| HTTP | MCP | Contrato |
|---|---|---|
| POST /api/v1/execution-sessions | registerExecutionSession | namespace/session key/capabilities, idempotente |
| POST /api/v1/tasks/{taskId}/execution-bindings | bindTaskExecution | actor/role/session/interval/source, UUIDs |
| POST /api/v1/usage-observations | ingestUsageObservations | lote <=100, <=1 MiB, chave idempotência, resultado por ID |
| GET /api/v1/tasks/{taskId}/usage | getTaskUsage | totais completos, cobertura, séries paginadas |
| GET /api/v1/tasks/{taskId}/model-history | listTaskModelHistory | períodos/observações por ator/sessão |
| GET /api/v1/usage | queryUsage | agregado global filtrado, sem dashboard nesta fase |

Envelope de observação proposto: `{sessionId,sourceEventKey,epoch,sourceSequence?,sourceOccurredAt?,observedAt,scope,counterKind,unit,components,configuredModel?,effectiveModel?,provider?,quality,unavailableReason?,evidenceRef,parserVersion}`. `components` contém strings inteiras ou null. Fonte indisponível exige razão enumerada e timestamp; não contém vetor de zeros. Source payload só admite os campos documentados na capability, não JSON arbitrário de transcrição.

### 6.1 Resumo histórico não é mudança de status

`ExecutionSummary.summary` é o relato histórico Markdown; `Task.currentSummary` é a síntese cumulativa atual; alteração de status é uma transição do estado da tarefa. São conceitos distintos. Podem ser gravados na mesma operação de execução, mas não há equivalência: um resumo pode registrar progresso sem mudar status, e uma mudança de status não cria resumo implicitamente. A extensão de métricas não altera essa semântica nem força transição de status. Quando a operação também muda status explicitamente, o reporte captura o status resultante; caso contrário captura o status vigente no mesmo snapshot/transação.

`createExecutionSummary` e `close_activity.execution` passam a aceitar `usageReport` estruturado opcional, separado de `summary` e `currentSummary`. `record_progress` pode continuar ingerindo evidência disponível, mas, sem resumo histórico, não cria um ponto na timeline de resumos nem acrescenta números ao comentário. Ao produzir um resumo posteriormente, referenciar a evidência já persistida em vez de duplicá-la. Comentários seguem seu propósito narrativo; não são armazenamento nem apresentação padrão de tokens/modelos.

Validação DTO antecede serviço; resumo + vínculo de métricas + evidências + mudanças funcionais explicitamente solicitadas persistem na mesma UnitOfWork e chave de idempotência. Falha de validação reverte a operação toda; indisponibilidade investigada e declarada permite gravar o resumo com coverage apropriada. A coleta externa ocorre antes da transação, nunca mantendo lock durante acesso ao harness.

### 6.2 Contrato de “tokens usados até ali”

`SummaryUsageReport` contém `{id,summaryId,taskId,reportingActor,reportedAt,statusObserved,entries[],coverage,ledgerRevision,revision,reconciledAt?}`. `statusObserved={id,name,isDone}` é snapshot histórico, nunca join apenas com o nome/status atual. `reportedAt` é o momento em que o resumo foi registrado pelo servidor; não é uma afirmação sobre o momento real em que os tokens foram consumidos. Autor do resumo pode ser Leader reportando vários colaboradores: cada entry conserva seu `usageActor`, sessão, harness e papel, sem atribuir tudo ao relator.

Cada entry declara obrigatoriamente `reportKind=cumulative_snapshot|period_delta` e `counterScopeKey={sessionId,epoch,usageActorKey,scope,componentSemantics,modelDimension?}`. `valuesReported` guarda os componentes recebidos (strings decimais/null); nunca contém um total implícito sem escopo. Modelo é dimensão do contador somente se a fonte o separar; trocar modelo não divide um contador total artificialmente. Modelos/configurações reportados são referências a `modelObservationIds`, com qualidade/proveniência.

- **cumulative_snapshot:** “até ali” significa o contador daquele escopo no instante da amostra, não total exclusivo da tarefa. Derivar `periodDelta` apenas entre observações compatíveis, ordenadas e do mesmo epoch; registrar `deltaBasis={startObservationId,endObservationId}`. Primeiro snapshot sem baseline provado não vira delta. Exemplo sintético: snapshots1000 e1300 geram delta300; não total2300. A porção atribuída à tarefa depende dos bindings e segmentos, não do valor integral1300.
- **period_delta:** valor recebido já representa o período/unidade de evidência delimitado, com IDs e scope explícitos. Não subtrair novamente. Intervalo temporal desconhecido fica null/timeBasis informado, sem inventar início ou duração. Repetir o mesmo segmento em outro resumo não acrescenta consumo global.
- **Total da tarefa/Overview:** somar allocations canônicas de segmentos únicos do ledger; nunca somar valuesReported ou snapshots exibidos na timeline. Relatórios múltiplos podem referenciar a mesma evidência; o vínculo é documental, não outra contribuição somável. Ator/modelo/harness concorrentes, shared/unallocated e mixed/unknown mantêm as regras das seções4–5.

Leitura de ExecutionSummary recebe `usageReport:null|SummaryUsageReport` em campo separado do Markdown. Ausência em registro legado projeta null, sem fabricar medições; replay de resposta antiga permanece exatamente como gravado. Consulta `GET /api/v1/tasks/{taskId}/summary-usage` / MCP `listTaskSummaryUsage` retorna linhas paginadas por `reportedAt,id`, cada uma com `summaryId`, autor, status observado, modelos reportados, tokens recebidos com reportKind e delta derivado quando demonstrável. `UsageService::summary_reports(SummaryUsageQuery)->Result<SummaryUsagePage>` monta essa leitura em snapshot. Totais vêm do ledger completo, não dessa página.

Reconciliação tardia usa `POST /api/v1/tasks/{taskId}/execution-summaries/{summaryId}/usage-revisions` / MCP `reconcileSummaryUsage`, com `expectedReportRevision`, idempotencyKey e referências de evidência. Valida pertencimento task/summary/bindings e autoria declarada; cria revisão append-only do reporte. Não reescreve Markdown, status observado ou reportedAt original. A interface mostra “Complementado em…” quando pertinente e permite acessar versão original; ausência investigada continua explícita quando nenhuma fonte foi obtida.

Replays antigos retornam snapshot antigo sem campos fabricados. Nova resposta pode ter `usageReceipt:{observationIds,segmentIds,summaryUsageReportId?,reportRevision?,coverageState}`; snapshots anteriores não são reescritos. Conflito da mesma chave com outro conteúdo é 409. Ingestão tardia usa chave própria e não incrementa versão da tarefa se só mudar ledger/vínculo de métricas; ledger possui revisão/version própria para invalidação de cache/change stream.

Consultas aceitam `actorId`, `taskId`, `harness`, `surface`, `provider`, `modelId`, `measurementQuality`, `allocationKind`, `from`, `before`, `groupBy`, `bucket`, `timezone`, `offset`, `limit`. Intervalo `[from,before)` obrigatório no global, máximo inicial 366 dias, limit máximo 100, groupBy whitelist. Filtro de desconhecidos é explícito, não string que colide com ID real.

Resposta contém `observedTotals`, `allocatedTotals`, `unallocatedTotals`, `coverage`, `asOf`, `revision`, `groups`, `series`, `totalItems`, `truncated`. Não criar `coveragePercent` de tokens sem denominador conhecido. Coverage informa sessões/intervalos conhecidos e contagens de gaps/pending; número de sessões não mede percentual de custo capturado.

## 7. Consultas, gráficos e retenção

Agregações no DB sobre ledger canônico, em snapshot read-only; não agregar somente a página no browser. Datas do evento quando confiáveis, senão `observedAt` com timeBasis explícito. Intervalo cumulativo atravessando limite de dia não pode ser repartido precisamente: bucket no instante de observação com marcador de intervalo, ou grupo `spansBuckets`, sem rateio temporal silencioso. Timezone serve apresentação e bucket; armazenar UTC e testar horário de verão.

**Decisão visual final de31/10/2026, substituindo a proposta anterior:** somente **resumos históricos + Visão geral** como apresentação padrão de métricas/modelos. Não criar bloco lateral de tokens nem adicionar métricas aos comentários. Nos resumos históricos, renderizar campos estruturados junto ao relato, em área própria separada do Markdown: autor do reporte, atores de consumo, período/escopo, status observado, modelos reportados, valores recebidos, tipo cumulativo/delta, cobertura e fonte. Resumo legado sem métrica mostra ausência de registro, não zero.

Na **Visão geral**, manter total de tokens conhecido com cobertura/asOf, lista de **todos os modelos utilizados conhecidos** e timeline baseada nos registros de resumo. Cada entrada aponta para seu resumo e exibe momento do reporte, modelos reportados, tokens recebidos com escopo/tipo explícito e status associado. A lista completa é paginável/acessível se extensa e não é substituída por apenas “último modelo”; modelo configurado/Auto sem execução comprovada aparece separado como seleção reportada, não na lista de uso efetivo comprovado. Preservar todos os modelos anteriores, múltiplos atores/harnesses/sessões simultâneos e referências à evidência.

A timeline ordena por `reportedAt,id`; esse eixo representa **momento do reporte/resumo**, não momento real de uso. Timestamp de uso comprovado e período coberto podem aparecer no detalhe, com timeBasis. Um resumo pode repetir o status anterior; rótulo de status não implica transição. Consumo conhecido sem resumo ainda contribui ao total do ledger, mas não gera uma entrada de resumo fictícia: indicar “evidência ainda não vinculada a resumo” quando pertinente.

Não somar valores recebidos da timeline para obter o total. Exibir cumulativo como “Acumulado reportado neste escopo”; exibir delta como “Consumo do período”, apenas quando validado. Contribuição tardia aparece como complemento auditável do mesmo resumo, com data da revisão e acesso ao reporte original. Ausência, pending, shared e mixed/unknown são explícitos; distribuição por modelo só no detalhe com atribuição comprovada, nunca dividindo um contador misto arbitrariamente. A navegação ao resumo/detalhe deve suportar teclado, foco e leitor de tela, reutilizando o padrão responsivo existente no mobile. Nenhum dashboard global novo faz parte desta proposta.

Evolução global: consumo por colaborador (Leader incluído), período, tarefa, modelo, harness e qualidade; tabela/drilldown usa os mesmos filtros do agregado. Sem ranking automático de produtividade. Custo opcional mostra moeda, origem, versão de preço e medido/estimado; não converter tokens por tabela presumida nem somar moedas diferentes.

Retenção proposta: não guardar transcrições, prompts, respostas, argumentos, conteúdo de arquivo, tokens de autenticação ou email no ledger. Manter metadados normalizados e hashes enquanto histórico de tarefas for retido; spool local remove itens confirmados após 7 dias, limitado a 50 MiB, sinaliza pressão sem descarte silencioso. Payload seguro detalhado retém 90 dias por padrão proposto; tombstones de dedupe e segmentos permanecem para evitar reimportação. Política é configurável/revisável antes de rollout; não aplicar limpeza agora.

Excluir payload bruto permitido não deve invalidar totais nem IDs de auditoria; receipt registra expiração. Correção de identidade e remoção de dados pessoais usam fluxo explícito, não reatribuição silenciosa. Autorização do coletor é separada do actor declarado; credencial de Admin fica no integrador, nunca em Skill, prompt, comentário ou DTO.

## 8. Receitas de validação futura por harness

Todas dependem de autorização de instalação/execução e ambiente de teste, não foram executadas nesta pesquisa. Capturar apenas fixture sanitizada de metadados.

1. **Codex:** registrar versão; usar execução controlada com stream JSON/App Server; capturar dois turnos, retomada, mudança de modelo e interrupção; comparar uso fonte/adapter. Para rollout experimental, fixture de rotação com cumulativo continuado e evento duplicado. Desktop/voz/subagente sem evidência continuam cobertura desconhecida.
2. **Copilot:** subscriber antes de create/resume; capturar chamadas com modelo, IDs, campos ausentes e subagente; desligar subscriber para provar gap de evento efêmero. Confrontar agregado final apenas para reconciliação; testar `cost` não monetário e reasoning subset.
3. **Claude:** escolher SDK ou OTel por cobertura; produzir dois resultados na mesma sessão retomada e subagente; conferir baseline e árvore. Fixture statusLine deve ser recusada como cumulativo. OTel: testar temporality, duplicação de export e reset; nenhuma captura de texto.
4. **Cursor:** probe hook confirma IDs/seleção; Admin API somente com escopo permitido, paginação de janela fechada e fixture sem conversationId. Testar eventos idênticos legítimos e página sobreposta; ausência de chave estável impede promoção de contagem exata sem reconciliação de multiplicidade.
5. **Kiro:** negociar versão/capabilities ACP e observar seleção/fallback quando exposto. Fixture créditos/contexto retorna unavailable para tokens. Só habilitar uso bruto quando contrato oficial ou probe versionado estabelecer semântica e IDs; não exigir consumo inventado para declarar adapter funcional.

## 9. Plano de execução em fases (não executar nesta entrega)

### Task 1: Descoberta, capabilities e fixtures sanitizadas

**Files:** criar `docs/usage-source-capabilities.md`, `tests/fixtures/usage/{codex,copilot,claude,cursor,kiro}/*.json`, `src/dto/usage/capability.rs`, `tests/usage_capabilities.rs`.

**Interfaces:** `Capability { harness, surface, versionRange, schemaVersion, unit, scope, counterKind, inputSemantics, subagentCoverage }`; `DiscoveryReport` da seção3.0; `validate_capability(&Capability, &SafeObservation) -> Result<()>`. Observação indisponível contém `discoveryReportId`; relatório faz parte do lote de ingestão ou referencia relatório persistido anteriormente.

- [ ] Escrever `reject_context_and_credit_as_tokens`, `unknown_version_returns_unavailable`, `missing_components_remain_null`; exigir unidades distintas e nenhum zero inventado.
- [ ] Testar `unavailable_requires_discovery_report`, `unknown_method_requires_documented_research_attempt`, `missing_baseline_is_pending` e cache negativo expirado/nova fonte; semântica não validada exige investigação, não fallback automático.
- [ ] Rodar `cargo test --locked --test usage_capabilities`; confirmar falha por contratos ainda inexistentes.
- [ ] Implementar DTO/validação e fixtures mínimas com fonte/data/versão e sem conteúdo privado; não instalar coletores.
- [ ] Rodar o teste e revisar fixtures por allowlist de campos; todos passam, nenhum segredo/email/texto de conversa.
- [ ] Commit `feat: define usage source capabilities and sanitized fixtures`.

### Task 2: Normalização e identidade histórica

**Files:** criar `src/services/usage/{mod,normalization,attribution,models}.rs`, `src/dto/usage/{mod,observation,binding}.rs`, `tests/usage_normalization.rs`.

**Interfaces:** `normalize(&SafeObservation,&Capability)->NormalizationOutcome`; `derive(&NormalizedObservation,&NormalizedObservation)->DerivationOutcome`; `attribute(&UsageSegment,&[ExecutionBinding])->AllocationResult`; `observe_model(&ModelObservation,&[ModelObservation])->ModelPeriodUpdate`.

- [ ] Testar delta 1000/600/100→1300/800/160 = 300/200/60 e total360; baseline sem zero provado não produz consumo.
- [ ] Testar resume/rotação, reset, ordem invertida, overflow, missing cache, reasoning subset, tree overlap, mudança modelo sem fronteira e intervalos de duas tarefas.
- [ ] Rodar `cargo test --locked --test usage_normalization`, confirmar falhas; implementar funções puras e enums da seção4.
- [ ] Reexecutar: soma de allocations <= segmento, parcela desconhecida preservada, fronteira de modelo expressa como intervalo.
- [ ] Commit `feat: normalize usage counters and preserve model observations`.

### Task 3: Ledger transacional e contratos compartilhados

**Files:** criar migrations com próximo número disponível em `migrations/` e `migrations/sqlite/` (nome `usage_ledger.sql`); `src/repositories/usage/{mod,postgres,sqlite}.rs`; `src/services/usage/{ingestion,queries}.rs`; `src/dto/usage/query.rs`; alterar `src/repositories/contracts.rs`, composição `src/state.rs`, `docs/kanban-openapi.yaml`, registry HTTP/MCP existente; criar `tests/backend_usage.rs` e `tests/usage_persistence.rs`.

**Interfaces:** `UsageRepository::ingest(&mut UnitOfWork, ValidatedUsageBatch)->UsageReceipt`; `UsageService::ingest(UsageBatch)->Result<UsageReceipt>`; `UsageService::query(UsageQuery)->Result<UsagePage>`; `UsageService::summary_reports(SummaryUsageQuery)->Result<SummaryUsagePage>`; `UsageService::reconcile_summary(SummaryUsageRevision)->Result<SummaryUsageReport>`. DTOs de reporte/revisão em `src/dto/usage/summary.rs`, vínculo/reconciliação em `src/services/usage/summary.rs`. Writes compostos reutilizam mesma UnitOfWork, sem transação aninhada. Ajustar assinatura concreta à interface atual mantendo essa propriedade.

- [ ] Testar replay idempotente, chave/hash conflito409, rollback comentário/status/ledger, legacy snapshot, coleta indisponível válida, finalização tardia sem comentário novo e sem mudar versão da tarefa.
- [ ] Testar resumo sem transição de status, mudança de status sem criação implícita de resumo, snapshot do status resultante em operação composta, campos estruturados separados de Markdown e autor do reporte distinto do ator de consumo.
- [ ] Testar snapshots1000/1300→delta300, primeiro snapshot sem baseline, delta recebido não subtraído, mesma evidência referenciada por dois resumos sem duplicar total, revisão tardia append-only com reportedAt original e ausência legacy null.
- [ ] Testar rename/delete/archive de agente, Leader→collaborator, mudança de harness e tarefas concorrentes; histórico e totais permanecem independentes do perfil atual.
- [ ] Rodar testes inicialmente falhando; implementar schema, adapters, serviços/DTO e contratos. Validar limites100/1MiB/16KiB e números decimais string.
- [ ] Rodar com SQLite temporário e PostgreSQL >=18 isolado: `cargo test --locked --features mcp --test backend_usage --test usage_persistence`; validar snapshots concorrentes e EXPLAIN dos filtros.
- [ ] Regenerar catálogo com `cargo run --locked --features mcp --example mcp_catalog`, atualizar README e commit `feat: persist and query task usage ledger atomically`.

### Task 4: Coleta direta e adapters opcionais com capacidades demonstradas

**Files:** criar pacote isolado `integrations/usage-collector/` com `src/{capabilities,spool,bindings}.ts`, `src/adapters/{codex,copilot,claude,cursor,kiro}.ts`, testes `test/*.test.ts`, README de instalação opt-in. Nenhuma dependência de SDK entra no backend Rust para ler máquina do usuário.

Antes do pacote opcional, documentar em `docs/usage-source-capabilities.md` receitas de leitura direta por ferramentas/APIs/arquivos permitidos, com entrada, identidade de sessão, campos extraídos e validação. Elas produzem o mesmo `SafeObservation`/`DiscoveryReport` e usam os contratos da tarefa3; não dependem do `getExecutionContext` de um coletor. A tarefa5 pode usar essas receitas após tarefas1–3, sem bloquear na instalação do pacote.

**Interfaces:** `probe(): Promise<CapabilityReport>`; `collect(cursor: SourceCursor): Promise<ObservationBatch>`; `ack(receipt: UsageReceipt): Promise<void>`; `getExecutionContext(taskId: UUID, actorId: UUID | null): Promise<ExecutionContext>` exposto por ferramenta local opcional do coletor. `ExecutionContext` contém sessionId, bindingId, capability, lastObservationAt, observações pendentes e unavailableReason, sem credenciais. Batch contém novo cursor só persistido depois do ack. Adapter só lê fonte explicitamente configurada.

- [ ] Criar testes por receita da seção8 e `spool_retry_keeps_event_key`, `admin_key_never_leaves_adapter`, `changed_schema_stops_only_source`, `identical_cursor_events_preserve_multiplicity`.
- [ ] Testar `direct_file_read_without_collector` e `authorized_api_read_without_sdk`: obter mesma observação normalizada, com evidência/versionamento, que o adapter produziria; fixture de sessão errada é recusada.
- [ ] Rodar testes antes da implementação; implementar primeiro fontes controladas Codex/Copilot/Claude, depois modelo Cursor/Kiro e Admin Cursor opcional.
- [ ] Confirmar nenhuma ativação automática, nenhum prompt pago de diagnóstico, nenhuma leitura global do home; dados por request/gauge separados.
- [ ] Executar smoke autorizado de cada superfície elegível e guardar versão/fonte/resultado, distinguindo suportado de unavailable. Sem licença/credencial, manter pendência explícita, nunca alegar validado.
- [ ] Commit `feat: add opt-in usage collectors with explicit capability fallbacks`.

### Task 5: Workflow das Skills

**Files:** atualizar fontes versionadas de Leader/Collaborator descobertas via provenance, depois `resources/bee-team/bee-team-{leader,collaborator}/SKILL.md`, referências e `resources/bee-team/provenance.json`; testes de bundle existentes.

**Interfaces:** Skill executa workflow da seção3.0 e produz `DiscoveryReport` + `SafeObservation` para os contratos da tarefa3. Pode usar diretamente ferramentas/APIs/arquivos permitidos ou `getExecutionContext` opcional. Ausência dessa ferramenta inicia descoberta de alternativas; não gera unavailable automaticamente.

- [ ] Testar exemplos de update com medição disponível, coletor ausente mas log permitido disponível, método desconhecido resolvido por docs oficiais, turn pending e Leader coordenando múltiplas tarefas. Caso Codex: inventário inicialmente sem contador exposto, busca identifica log da sessão correta e extrai somente metadados; resultado é available/partial conforme cobertura, nunca unavailable por falta de SDK.
- [ ] Testar sessão ambígua, permissão negada, rede indisponível, formato sem semântica comprovada e busca proporcional esgotada: relatório preserva tentativas/limitação sem inventar número. Testar cache válido sem pesquisa repetida e invalidação por versão/schema/permissão/nova fonte.
- [ ] Escrever instrução: resolver UUIDs, registrar binding, capturar baseline, consultar evidência a cada atualização, persistir uso/contexto junto com currentSummary, aguardar receipt antes de notificar.
- [ ] Ao gravar resumo histórico, enviar usageReport estruturado com reportKind/escopo/evidência/status observado; manter Markdown narrativo e não acrescentar métricas aos comentários como padrão. Atualização sem resumo pode ingerir evidência, sem inventar resumo ou mudar status implicitamente; contribuição tardia revisa vínculo existente.
- [ ] Exigir investigação e justificativa antes do fallback; carregar Skill não instala hooks/exporters nem concede chave Admin. Leitura direta autorizada é primeira classe; coleta opcional não é pré-requisito universal. Registrar limitação sem bloquear trabalho funcional.
- [ ] Validar pacote e proveniência, preservar aprovação/autonomia e tarefas Em teste para aceite humano; commit `docs: teach Bee Team skills evidence-backed usage reporting`.

### Task 6: Leitura e apresentação da tarefa

**Files:** criar `frontend/src/features/task-usage/{UsageOverview,SummaryUsageFields,SummaryUsageTimeline,ReportedModels,UsageCoverage}.tsx`, hooks de consulta próximos da feature; integrar campos estruturados aos resumos históricos e total/lista completa de modelos/timeline à Visão geral; atualizar contratos frontend gerados a partir do OpenAPI; testes `task-usage.test.tsx`.

**Interfaces:** componentes consomem `UsagePage`, `SummaryUsagePage` e `SummaryUsageReport`, não recalculam total da página de resumos nem inferem perfil atual. `onOpenSummary(summaryId: UUID, reportRevision?: number)` abre registro/detalhe acessível existente. `onDrilldown(filters: UsageQuery)` conserva ator/modelo/harness/intervalo/qualidade.

- [ ] Testar total parcial, gap, pending, duas sessões simultâneas, modelo configurado sem efetivo, histórico de tarefa concluída e último modelo com data.
- [ ] Testar campos separados do Markdown em resumos, ausência de bloco lateral/métricas em comentários, total conhecido + todos modelos utilizados + timeline por resumo na Overview; trocar aba não perde histórico nem produz modelo global fictício.
- [ ] Testar eixo de momento do reporte, status repetido sem falsa transição, cumulativo/delta rotulados, revisão tardia sem nova entrada fictícia, soma do ledger independente da página de resumos e modelos antigos preservados.
- [ ] Testar abertura por teclado/foco/nome acessível do histórico, detalhe responsivo mobile sem sobreposição e grupos mixed/unknown sem distribuição de tokens não comprovada.
- [ ] Implementar campos de resumo e Overview/timeline acessíveis e responsivos; nomes claros para medido/estimado/compartilhado, sem ranking/custo presumido e sem inferir consumo exato pelo timestamp do reporte.
- [ ] Rodar `npm --prefix frontend test` e `npm --prefix frontend run build`; comparar drilldown com agregado completo.
- [ ] Commit `feat: show task usage coverage and observed model history`; dashboards globais permanecem evolução separada.

### Task 7: Revisão, rollout e aceite

**Files:** criar `docs/usage-verification.md`, `docs/usage-rollout.md`; atualizar README com capacidades realmente verificadas.

- [ ] Rodar `cargo build --locked --features mcp` e `cargo test --locked --features mcp` em ambiente isolado, ambos drivers; documentar indisponibilidade de infraestrutura sem declarar suite aprovada.
- [ ] Verificar preservação das novas tabelas no mecanismo de transferência antes de liberar; se export/import exigir mudança, abrir plano específico e executar matriz quatro drivers/cancelamento desse workflow. Não editar transferência implicitamente.
- [ ] Fazer teste de carga com 100k observações sintéticas em DB isolado: consultas limitadas, memória não proporcional ao ledger inteiro, paginação estável, agregados consistentes sob ingestão.
- [ ] Revisar privacidade, retenção, dedupe sem payload, fonte indisponível, modelo desconhecido e migração em cópia isolada. Nenhum backfill inventado de tarefas antigas.
- [ ] Publicar PR com evidências separadas código/testes/artefato/runtime; ativação de coletores e release seguem autorização própria. Aceite humano em tarefa real só após rollout autorizado.
- [ ] Commit `docs: record usage ledger verification and rollout boundaries`.

## 10. Critérios de aceite e decisões finais

- Cinco harnesses representados com capacidades honestas; nenhum requisito exige tokens exatos onde fonte não os fornece.
- Indisponibilidade tem investigação proporcional e razão concreta; ausência de SDK/coletor não basta. Leitura direta permitida e cache de capacidade são exercitados nos testes, inclusive descoberta de logs Codex e rejeição de sessão errada.
- Ator/Leader, tarefa, sessão, harness, provider/modelo e papel histórico preservados; consultas globais por período não dependem do perfil atual.
- Replay, retry, resume, reset, troca de modelo e subagente não duplicam consumo; compartilhado aparece uma vez no global.
- Resumo histórico, seu vínculo de métricas e alterações funcionais explicitamente solicitadas são atômicos; resumo e transição de status continuam conceitos distintos. Finalização tardia concilia ledger/vínculo sem reescrever relato ou status.
- Resumos expõem métricas estruturadas; Overview tem total conhecido, todos modelos utilizados e timeline de reportes com status. Sem bloco lateral ou métricas em comentários como padrão; snapshots cumulativos nunca são somados como deltas.
- Série tem proveniência e lacunas; zero observado difere de ausente. Estimado difere de medido e custo difere de tokens.
- PostgreSQL/SQLite passam testes equivalentes; nenhum acesso de teste a dados reais.
- Histórico anterior sem prova fica unavailable; importação opt-in exige sessão exata, sem capturar transcrição inteira.

**Autorrevisão do plano:** requisitos de cinco ambientes, modelo em andamento/concluído, Leader, agregação global, cache/subagente, timestamp/qualidade, custo separado e política de Skills cobertos nas tarefas1–7. A revisão de31/10 exige investigação antes do fallback, leitura direta de primeira classe, relatório persistido e cache/invalidação, com casos de teste nas tarefas1,4,5. Os cinco riscos do Review Focus têm casos de teste explícitos. Fontes documentais não foram tratadas como smoke local. Nenhuma funcionalidade de tokens foi implementada por este documento.


## Revisão de requisito — 2026-11-02

A autorização nova exige total numérico e agente responsável em todo novo resumo.
O fallback deste plano que aceitava unavailable para criar resumo foi substituído;
permanece apenas para ler dados antigos e representar evidência histórica incompleta.
Não fabricar zero nem deduzir consumo pelo texto/contexto/créditos. A pesquisa oficial
foi renovada em [fontes por harness](../../harness-token-sources.md), separando fonte
existente de integração/coletor efetivamente instalado. O contrato definitivo de
novas gravações será documentado junto à validação compartilhada HTTP/MCP.


Decisão posterior confirmada: total obrigatório é o acumulado real da sessão.
Primeiro snapshot válido aceito, sem requisito de delta/task exclusiva. Novas
observações de resumo incluem totalTokens=inputTokens+outputTokens, modelo e
agente identificados. Ver contrato corrente em ../../summary-usage.md; nenhuma
soma de snapshots/cache/raciocínio nem backfill histórico é autorizada.
