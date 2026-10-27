# Revisão documental — decisões finais

27/10/2026. Somente spec, planos e OpenAPIs no checkout principal. Frontend, backend e skills permanecem pausados. Sem commit, merge ou push autorizado nesta revisão.

- [x] **1. Spec e planos:** decisões finais consolidadas: board com time gestor obrigatório/transferível; task sem vínculo direto com time; criador do board, autor e executor da task; recursão cross-board; transferência de agentes; três modos pelo board de origem. Escopo do líder permanece pendente.
- [x] **2. OpenAPIs:** 31 operações Kanban e 21 RA alinhadas. Coleções diretas; authorAgentId/executorAgentId obrigatórios; Task sem teamId; Board com createdBy e teamId gestor transferível/evento. Contexto recursivo de origem e três modos; consulta global de filhos cross-board. Primeira validação de schemas/exemplos passou.
- [x] **3. Verificação:** YAML, referências locais, JSON Schema 2020-12 com formatos, exemplos e paridade de rotas aprovados: 52 operações, 81 schemas, 625 referências e 51 exemplos. Cenários documentais: 36 combinações de autonomia, 4 nós recursivos em 4 boards, 2 ciclos rejeitados e 11 casos negativos de schema. Campos obsoletos ausentes; IDs externos opacos aceitos. Esses cenários verificam documentos, não implementação.

Pendência a encaminhar uma por vez: alcance de edição do líder via agentes geridos, sem inventar ownership por time nem controle de segurança.

Verificação exigida pelo AGENTS.md: `cargo build --locked` passou. `cargo test --locked`: 12 testes unitários passaram; os 3 testes de integração falharam ao criar o container PostgreSQL por conexão Docker indisponível (`CreateContainer`, erro de sistema 2). A suíte completa não passou. Nenhuma implementação foi retomada.

Revisão de whitespace concluída; arquivos mantidos em UTF-8 com LF. Sem commit, merge ou push.
