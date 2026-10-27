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
