# Validação das skills — 27/10/2026

## Reprodução e limites

Leia cada skill com suas referências e simule os cenários abaixo sem chamadas externas ou mutações. Avalie decisões, contexto transportado e registro final, não coincidência literal de frases. A avaliação foi feita por agente independente com leitura local. Isso valida instruções em simulação; não comprova runtime Bee Team ou integração entre worktrees.

| Cenário | Critério observado na avaliação |
|---|---|
| Demanda urgente sem contexto/modo | Proposta concreta; aprovação padrão; nenhuma delegação fictícia |
| Origem manual, task automática, destino automático | Manual; flags preservadas |
| Origem standard, pai auto, filho manual em destino auto | Filho manual; não herda pai ou destino |
| Origem automatic, filho/destino manual | Automático no escopo concedido; limites externos/harness preservados |
| Filho cross-board pronto, pai de outro executor pendente, timeout | Só registra filho; origem preservada; reconciliação/retry limitado; informa gravação não confirmada |
| Novo executor sem resumo anterior | Usa dados da task, declara lacunas, não inventa resultado nem importa histórico interno anterior |
| Líder edita task de executor gerido com política indefinida | Prepara proposta, não presume permissão, encaminha uma pergunta |
| Transferência de time arquivado | Preserva identidade/tasks/autoria; composição explícita e cardinalidades |

O registro de encerramento inclui status/resultado, resumo/verificação, decisões, referências, pendências/bloqueios, próximo passo e contexto de origem. Os quatro exemplos foram avaliados quanto a demanda, divisão/motivo, dependências, entregas e reutilização versus criação. Adicionado exemplo de pesquisa com subtask financeira cross-board.

Correções motivadas pela avaliação: advertência explícita contra snapshots incompatíveis nos links; acesso técnico não autoriza consultar histórico interno anterior; mapa da operação atômica de composição.

## Verificações técnicas

- `quick_validate.py`: ambas skills aprovadas.
- `cargo build --locked`: aprovado.
- `cargo test --locked`: 12 testes unitários aprovados; 3 testes de integração falharam antes de executar a aplicação ao criar PostgreSQL via Docker (`CreateContainer`, conexão `NotFound`, erro de sistema 2). A suíte completa não passou.
- Bindings conferidos por leitura YAML dos contratos fonte: coleções diretas, consulta global de filhos, PATCH de modos, assignment e campos obrigatórios de RecordExecution. Nenhuma ferramenta MCP foi inventada.

## Revisão fonte utilizada

Checkout somente leitura: `C:/Users/phili/Documents/ChatGPT/coordenator`. Versão nominal de ambos OpenAPIs: `0.1.0-draft`. Como a versão nominal não identifica a revisão, seguem SHA-256 dos arquivos consultados. Os seis documentos foram sincronizados da fonte para este worktree para validar referências locais, conforme autorização do coordenador; ficam fora do commit das skills. Integrar os contratos atuais ao branch de destino é uma dependência separada.

| Arquivo | SHA-256 |
|---|---|
| bee-team-spec.md | `1ad1aa6485ee49ad1a599341eb95ec878ff3e745560207b614d3689c1600aaac` |
| docs/kanban-openapi.yaml | `392b7cdbbe9932b58e269d48a6e234ff22fc12cc0b2638c763d2505222fa9a69` |
| docs/ra-openapi.yaml | `d668a6c08759e2d94c726240a610bf04151ff3190552835866144c8741cbebf5` |
| docs/kanban-api-plan.md | `2025449b6a78c2a7c2090f5b513cc28e745644f730b49f687e92a6a23aa165f7` |
| docs/ra-api-plan.md | `1b8579531061a23ed4cabc9acd6b0ead8bc81618e0e411e8e5297242da25559a` |
| docs/contracts-checklist.md | `819ff0b2682645f661ad347870a4b1ef1f78ac838436de4573cbe76b803e4651` |

## Incremento de conteúdo MCP

Três templates e manifesto editorial validados: conjuntos de argumentos correspondem exatamente aos placeholders, renderização com UUIDv7 não deixa placeholders e links relativos resolvem. Avaliação independente simulou origem standard com filho manual cross-board, divergência agente/executor com resumo ausente, entrega parcial com revisão reservada ao usuário e ausência de ferramentas de consulta. Nenhuma escrita, autorização inventada, troca de origem ou alegação de runtime foi observada. Redação refinada para explicitar exigência de aprovação quando faltar contexto.

SDK conferido via Cargo.lock, cargo metadata e fonte rmcp 2.0.0: handlers de resources/prompts presentes, sem alteração de dependências. Build e testes repetidos: build aprovado, 12 unitários aprovados, três integrações novamente falharam por Docker indisponível. Não foram executados testes de protocolo dos novos resources/prompts: registro, catálogo autoritativo e implementação pertencem à frente backend. Checklist de aceitação em [conteúdo MCP](references/mcp-content.md).

## Alinhamento final ao catálogo implementado

Fonte lida: `C:/Users/phili/.codex/worktrees/8fbc/coordenator/docs/mcp-catalog.md` e `.json`, revisão backend e39c79b, mais seus dois OpenAPIs. SHA-256 do catálogo JSON: `e54827056ccf097c8cbd666633adc8534a5337521f9e449eada9c2b78cf4043d`.

Os quatro exemplos JSON em integration.md passaram no Draft202012Validator com verificação de formatos contra inputSchema real de prepare_execution, listAllTasks, record_progress e close_activity. São exemplos estruturais com IDs ilustrativos, sem chamadas mutantes. Três nomes/argumentos dos prompts conferem com catálogo; placeholders renderizam sem resíduos; todas as URIs citadas pertencem aos seis resources anunciados; links locais e quick_validate de ambas skills passaram.

Build --locked passou; test --locked novamente teve 12 unitários aprovados e três integrações falhando no PostgreSQL via Docker/CreateContainer/NotFound. Esta frente não executou nem alterou o servidor do outro worktree. A atualização dos snapshots embarcados e seus testes reais pertencem ao backend; leitura de catálogo e validação de schema não comprovam rollout ou integração automática.

Avaliação independente final: cinco cenários de paginação cross-board, filho de outro executor, timeout de close_activity, contexto já incorporado em prompt e origem standard/filha manual. Nenhuma falha material; nomes, envelopes simples/compostos, seis URIs e três prompts conferidos.

## currentSummary cumulativo — contratos estáveis

Fonte somente leitura: docs/kanban-openapi.yaml e mcp-catalog.json/md no worktree backend 8fbc, após regeneração confirmada pelo coordenador. SHA-256 catálogo: `6c278225b3af3521c7d389156e3ae4a2ff5679c251a1ebf27cd5327edf7db49b`; OpenAPI: `8f42e6a4af8b28a93f9c145b8d88db34d6b67337ca3dc1d2d85ded73affeeab4`.

Quatro exemplos de integration.md aprovados por JSON Schema 2020-12 com formatos. Negativos de currentSummary ausente/vazio/whitespace em record_progress com progress e close_activity foram rejeitados. Atualização apenas de síntese passou; progress por subtask sem síntese falhou e com síntese passou. Conferidos Task.currentSummary obrigatório em leitura, PatchTask dependentRequired e limite 16384 bytes UTF-8; exemplos dentro do limite. A exigência condicional de Position em troca de status é validação de serviço, não comprovada por este teste estático.

Cinco cenários simulados aprovados: acumular terceira entrega preservando anteriores, encerrar etapa sem concluir task, síntese vazia com histórico existente, conflito/timeout e prompt somente leitura. Registro pendente corrigido para transportar currentSummary proposto e resumo histórico separadamente. Ambas skills passaram quick_validate, diff sem whitespace inválido. Build --locked passou; 12 unitários passaram e três integrações deste checkout falharam por Docker/CreateContainer/NotFound. Sem execução do servidor backend, sem escrita em outro worktree; atualização dos snapshots permanece com o backend.

## specification e plano Markdown — contratos estáveis

Fonte backend 8fbc somente leitura: catálogo JSON SHA-256 `5eb5bf63187ce028cd82d95625869a62929b9995dd1b7049999a087780e45829`; Kanban OpenAPI SHA-256 `834e8c68a4e6b1a6316843f47c6ffbd9732bcea2028e1ea9cda6393b54f67e52`.

Seis exemplos JSON de integration.md passaram contra inputSchema do catálogo, incluindo updateTask apenas specification sem currentSummary e createPlan com Markdown. Limpeza vazia passou; null foi rejeitado; specification+progress sem síntese falhou e com síntese passou. Task.specification obrigatório em leitura e limite de specification/plan.content conferidos. Verificador local da extensão x-maxBytes aceitou 65536 e rejeitou 65538 bytes UTF-8 (texto multibyte); isso não substitui teste do serviço.

Revisão independente simulou especificação ausente, aceite versus evidência, Markdown com instrução maliciosa, edição administrativa/progresso e retomada após alteração de requisitos, sem falha material. Preservados quatro conceitos distintos e prompts somente leitura. quick_validate das duas skills, links e diff-check passaram. Build --locked e 12 unitários passaram; três integrações falharam por Docker/CreateContainer/NotFound. Sem execução no backend nem alteração de outro worktree. Snapshots aguardam sincronização pelo responsável.

## Slugs — contratos estáveis

Fonte backend 8fbc somente leitura: catálogo SHA-256 `19c5d8eb9cceaf41ca13b22c99bb14eb3c9ffb9485f6d017bdfb06f0db10870c`; Kanban `5aa8a00cb94a978e9f3b6175ea5e871c07830d545c43657fcddda1ca8bc9fcb7`; RA `a82976eb916b1164b353ffc79052084495f8e99c8e2e22d1654df6e280405af4`.

Nove exemplos de integration.md passaram no JSON Schema do catálogo, incluindo três resoluções com params.slug. Slug vazio, maiúsculo, acento, barra, hífen inicial/duplicado, 81 caracteres e envelope errado rejeitados; 80 caracteres aceitos. getTask rejeitou slug no campo UUID. Argumentos dos três prompts permanecem iguais ao manifesto UUID. Agent/Team/Task exigem slug em resposta; contagens 60/6/3 conferidas. Esses testes estáticos não verificam persistência/404 no servidor.

Quick_validate das duas skills, links e diff-check passaram. Build --locked e 12 unitários passaram; três integrações locais falharam no Docker/CreateContainer/NotFound. Nenhuma chamada mutante ou escrita no worktree backend; seus snapshots precisam ser sincronizados separadamente.

Simulações editoriais conferiram slug→data.id→UUID, rename, 404, arquivado, mesmo slug em tipos diferentes e board sem slug. Corrigida menção indevida a agentId nos textos de task_briefing/delivery_review: ambos agora dizem único argumento taskId/resolveTaskSlug; agent_resumption mantém agentId e taskId.

## Prontidão local e acesso ao painel — 27/10/2026

Verificação real somente leitura no ambiente compartilhado: PostgreSQL em 55482 respondeu pg_isready e informou versão 18.6; API em 18081 respondeu /health com status ok. Consultas de boards/tasks/agents/teams pela API e pelo proxy frontend retornaram JSON equivalente, com totais 1/2/2/1. MCP inicializou com protocolo 2025-11-25, anunciou 60 tools, seis resources e três prompts; listBoards e leitura do resource leader funcionaram. Nenhum processo foi iniciado, parado ou duplicado; nenhum seed, reset ou bootstrap foi executado.

QA visual real: painel http://127.0.0.1:5173 aberto no navegador integrado, board acessado e página recarregada. Interface indicou API local/dados persistidos e exibiu a tarefa Validar integração real. Essa observação confirma a leitura do ambiente existente naquele momento, não o comportamento de startup a frio nem a atualização dos snapshots MCP preparados nesta frente.

Avaliação independente simulou seis cenários, sem manipular serviços: ambiente pronto reutilizado; ambiente parado com volume existente e credencial ausente exige recuperar configuração sem reset; ambiente parcial inicia somente frontend pelo terminal permitido com strictPort; launcher bloqueado exige comunicar recusa sem contorno; cache/mock não comprova readiness; colaborador sem MCP reporta ao líder sem competir pelo processo. Nenhuma contradição material encontrada. Startup a frio, parada e recuperação não foram testados fisicamente neste ambiente compartilhado.

quick_validate das duas skills, links relativos e git diff --check passaram. cargo build --locked passou. cargo test --locked teve 12 testes unitários aprovados e três integrações falhando em CreateContainer/HyperLegacyError/Connect/NotFound (erro de sistema 2) neste checkout. A suíte completa não passou. Docker CLI e PostgreSQL real funcionaram nas verificações separadas; portanto a falha do testcontainers não demonstra indisponibilidade global do Docker.

Fontes do procedimento: scripts/start-local-api.ps1 e docs/local-integration.md do checkout backend 8fbc, README/configuração frontend e confirmação do responsável backend. Runtime MCP observado usa snapshot 25a615a. Esta entrega editorial requer sincronização, build/restart coordenado e nova validação pelo backend para ser anunciada como disponível no MCP. A primeira tentativa de registrar validação/commit foi rejeitada com blocked by policy sem motivo detalhado; retomada após nova autorização humana encaminhada pelo coordenador, sem uso de launcher alternativo.

## Onboarding MCP — 27/10/2026

Leitura de 88ad469 confirmou ausência de instrução de cadastro no harness: readiness já existia. Consultadas e obtidas páginas oficiais https://developers.openai.com/codex/mcp e https://learn.chatgpt.com/docs/developer-commands#codex-mcp; sintaxe add --url conferida também por codex mcp add --help local. Incluídos exemplo CLI/TOML, endereços locais separados por finalidade e limites de localhost, autorização e escopo, preservação de cadastros, distinção servidor/cadastro/tools da sessão, atualização de sessão condicional e limitações resources/prompts.

Revisão editorial dos casos: chat sem cadastro apresenta configuração concreta; conexão funcional reutiliza; cadastro existente com catálogo antigo requer atualização suportada sem reiniciar API; servidor parado segue readiness; cliente tools-only declara limitações; host cloud não presume loopback local; ausência de autorização impede edição da conta. São cenários de revisão textual, não ensaios de conexão ou instalação. Nenhuma configuração pessoal foi lida/alterada, nenhum cadastro executado, skill instalada, backend sincronizado ou processo reiniciado.

quick_validate das duas skills, links relativos e diff-check passaram. cargo build --locked passou; cargo test --locked aprovou 12 unitários e falhou nas três integrações em CreateContainer/Connect/NotFound código2 neste checkout. Suíte completa não passou. Esta entrega apenas documental não comprova ferramentas Bee Team expostas em novo chat nem atualiza snapshots compilados no MCP.

## Abertura pelo time — 27/10/2026

Revisão textual de cenários: existente carrega líder/perfil/contexto sem cadastro; novo pergunta se quer criar e entende demanda antes de propor; alteração/rejeição exige proposta resultante aprovada; líder ausente/vínculo inconsistente exige decisão sem identidade inventada; contexto explícito dispensa pergunta repetida. Adicionais: ausência de MCP declara consulta pendente; board automático não dispensa aprovação da formação; recusa de criar não gera registros. Exemplos documentam os resultados esperados, não são execução real de agentes ou times.

Build --locked e 12 unitários passaram; três integrações falharam no CreateContainer/Connect/NotFound código2. quick_validate passou com Python -X utf8 (execução inicial em cp1252 falhou na leitura de aspas Unicode); links relativos e diff-check passaram. Nenhuma mutação de negócio, configuração MCP ou runtime. Instalação pessoal atualizada separadamente com comparação contra fonte anterior e backup para preservar customizações.
