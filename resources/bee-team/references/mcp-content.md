# Materiais Bee Team no MCP

O catálogo autoritativo é `docs/mcp-catalog.md`/`.json` do backend, incluindo a revisão currentSummary validada: rmcp 2.0.0, MCP 2025-11-25, Streamable HTTP. Esta referência documenta conteúdo e empacotamento; não mantém um catálogo concorrente. As instruções operacionais e exemplos estão em [integração](integration.md), disponível como `beeteam://references/integration`.

## Recursos empacotados

| URI anunciada | Fonte editorial |
|---|---|
| beeteam://skills/leader | skills/bee-team-leader/SKILL.md |
| beeteam://skills/collaborator | skills/bee-team-collaborator/SKILL.md |
| beeteam://references/integration | skills/references/integration.md |
| beeteam://references/handoff | skills/references/handoff.md |
| beeteam://references/codex | skills/references/codex.md |
| beeteam://references/team-examples | skills/bee-team-leader/references/team-examples.md |

Use resources/list/read; URI desconhecida ou filesystem arbitrário é rejeitado. Conteúdo é snapshot editorial em `resources/bee-team`, sem instalação global. Atualizações nesta frente precisam ser incorporadas pelo backend antes de aparecerem no servidor. Não exponha notas de validação/progresso, segredos ou arquivos não permitidos. Links relativos são editoriais: use URIs anunciadas, nunca exploração de filesystem. Este guia não é resource anunciado.

## Prompts implementados

| Nome público | Argumentos string UUIDv7 obrigatórios | Fonte |
|---|---|---|
| task_briefing | taskId | [task-briefing.md](prompts/task-briefing.md) |
| agent_resumption | agentId, taskId | [collaborator-resumption.md](prompts/collaborator-resumption.md) |
| delivery_review | taskId | [delivery-review.md](prompts/delivery-review.md) |

O [manifesto](prompts/content-manifest.json) mantém descrições/argumentos e nomes alinhados ao catálogo. O backend mapeia arquivos aos nomes e incorpora contexto consultado por serviços em uma mensagem user. prompts/get rejeita parâmetros ausentes, extras, não textuais, IDs inválidos e recursos inexistentes. Origem é derivada da cadeia, não argumento editável. O contexto retornado não autoriza execução nem prova que nada mudou depois da consulta.

Exemplo de params de prompts/get: `{"name":"agent_resumption","arguments":{"agentId":"10000000-0000-7000-8000-000000000002","taskId":"10000000-0000-7000-8000-000000000001"}}`. IDs são ilustrativos e devem existir. Não envie paths/URIs nesses argumentos.

Resources/prompts não executam IA ou controlam chats. `prepare_execution` consulta sem iniciar agente; `record_progress`/`close_activity` são mutações atômicas/idempotentes conforme catálogo. Nunca anuncie sucesso parcial como conclusão de transação. Checklist deriva das tasks; encerrar atividade pode manter tarefa em andamento. Autoria declarada não é autenticação e a política de edição do líder continua pendente.

## Integração e verificação

Preserve os arquivos como fonte editorial; não edite snapshots no worktree de outra frente. O responsável backend atualiza `resources/bee-team` a partir do commit entregue e executa testes reais de discovery, resources, prompts, segurança da allowlist e paridade de conteúdo. Testes de schema/renderização nesta frente não substituem testes de protocolo. Descubra capacidades do servidor conectado; instalação antiga pode não ter a revisão. Paginação MCP de descoberta usa cursor do protocolo; listagens de entidades usam offset/limit.

## Síntese cumulativa

Os três prompts consultam currentSummary como estado cumulativo, sem atualizá-lo por leitura. O executor o recompõe ao registrar avanço/status/encerramento; `record_progress` aceita currentSummary por alvo e exige não vazio com progress; `close_activity` exige execution.currentSummary além do resumo histórico. Campo sempre presente em Task não torna seu conteúdo prova de atividade ao vivo. Os exemplos foram validados contra o catálogo regenerado com esses campos; o backend deve sincronizar os snapshots editoriais desta revisão.

## Especificação em Markdown

Os prompts consultam Task.specification junto da task, distinguindo requisitos/aceite de description, plan.content e currentSummary. Preparação retorna specification inclusive nos filhos; ler Markdown não o executa nem autoriza escrita. A edição via createTask/updateTask aceita string opcional, inclusive vazia para limpeza explícita, mas não null. Os exemplos foram validados contra o catálogo regenerado com specification; o backend deve sincronizar os textos editoriais deste commit.

## Slugs na entrada do consumidor

resolveAgentSlug, resolveTeamSlug e resolveTaskSlug resolvem referências legíveis para `{id,slug}`. Resolva antes de prompts/get: os três prompts mantêm argumentos UUIDv7, sem novos parâmetros de slug. Seis resources e três prompts permanecem iguais; tools passam a 60. Este conteúdo não acrescenta aliases nem gera slug em cliente.

## Workflows operacionais em pacotes autocontidos

As duas pastas bee-team-leader e bee-team-collaborator contêm SKILL.md enxuto e references/ com workflows completos (texto e Mermaid), integração, handoff, Codex, exemplos e templates. Os links locais ficam dentro do próprio pacote. Os workflows derivam dos documentos aprovados no commit 01e77b9; as cópias operacionais retiram a advertência histórica de que a skill ainda não aplica essas decisões, sem afirmar runtime atualizado.

Ao sincronizar MCP, incorporar as duas entradas, os workflows e suas referências alcançáveis; não publicar entradas com links inacessíveis como se os workflows estivessem disponíveis. O backend deve disponibilizar esse conteúdo por resources realmente anunciados ou por conteúdo agregado ao resource correspondente, e validar discovery/leitura e prompts. Esta frente não define novas URIs de runtime. A tabela acima descreve o catálogo anterior; conferir resources/list após atualização. Templates de briefing/retomada/revisão agora preservam atribuição obrigatória, duas confirmações e salvar antes de notificar, sem alterar argumentos UUID nem tornar prompts mutantes.
