# Implementação: intervalos de consumo por tarefa

Referência: [especificação](task-session-intervals-spec.md). Autorização de implementação: 2026-11-03.

## Entregas e verificações

- [x] Backend: contrato HTTP/MCP comum, persistência relacional por driver e transições atômicas com resumos.
- [x] Integridade: exclusividade por fonte, idempotência, pausas, resets, intervalos incompletos e reconciliação auditável.
- [x] Consultas: recuperação do intervalo aberto, listagem paginada e agregados sem dupla contagem.
- [x] Frontend: apresentação separada de acumulados da sessão e consumo/duração dos intervalos.
- [x] Skills: fronteiras explícitas, recuperação e exemplos validados contra o contrato final.
- [x] Integração: testes focados HTTP/MCP e interface, builds e revisão de toda a alteração.
- [x] Publicação na branch `codex/integrate-conversation-scroll`, preservando runtime e dados locais.

## Limites de execução

Implementações usam os worktrees existentes das equipes. O checkout principal integra commits revisados; serviços ativos não são reiniciados para validar empacotamento. Testes não usam o banco do produto. A dispensa anterior de PostgreSQL foi específica da entrega anterior; esta alteração de persistência deve validar ambos os drivers em ambiente isolado quando disponível e informar qualquer limitação.

## Registro de decisões

- O fluxo existente de resumo e seus dados históricos permanecem compatíveis. Nenhuma fronteira é inferida por texto ou horário.
- A API e as skills devem convergir no mesmo formato antes da instalação final das instruções.
- Encerrar um intervalo não conclui automaticamente a tarefa; status e resultado da execução continuam distintos.
- Rollout aditivo: `executionTracking` é opcional no contrato de resumo. Sem esse campo, não se cria intervalo nem se infere atribuição retroativa; as skills orientam o fluxo novo.
- As fronteiras selecionam `observation.evidenceId` do relatório da própria chamada, com atribuição `unallocated`. A atribuição por intervalo fica separada do acumulado da sessão.
- Finalizar uma execução pausada usa `evidenceIds: []`, sem inventar consumo durante a pausa. O relatório de uso normal continua obrigatório.
- `coverageLost: true` exige motivo e interrompe a comparabilidade. Recuperação não transforma lacuna em zero nem em consumo atribuído.
- `expectedVersion` refere-se à tarefa nas operações de resumo e ao intervalo na reconciliação. Correções preservam revisões e verificam sobreposição e limites numéricos antes do commit.

## Evidências

- Skills: origem `631072a`, integrada como `63c9e37`. Conferência independente de SHA256 de todos os arquivos dos dois pacotes instalados no Codex contra as fontes do checkout: sem divergências.
- Frontend: origem `852692c`, integrada como `7c9eb14`. No checkout integrado, `npm test -- --maxWorkers=2`: 83 arquivos / 299 testes passaram; `npm run build` passou, com aviso de tamanho de chunk já existente. A equipe validou desktop 1440 px e mobile 390 px com fixtures isoladas, incluindo popover, teclado/Escape, foco no intervalo e valores grandes.
- Backend: origem `dfe06b8`, integrada como `59e67a9`. A equipe verificou 132 testes Rust distintos e repetiu os 10 cenários de intervalos no PostgreSQL isolado. Os quatro pares de transferência passaram. Comandos, limites e a continuação após corrigir uma expectativa antiga de inventário estão em [verificação do Backend](task-session-intervals-verification.md).
- Revisão independente do Backend identificou overflow agregado após reconciliação, proveniência/horários de fronteiras corrigidas e séries removidas que precisavam de exclusão lógica. Correções aplicadas com regressões; séries reintroduzidas preservam o mesmo ID. A revisão da interface identificou ausência do agente da execução no fim pausado, corrigida com teste.
- No checkout integrado, os contratos OpenAPI backend/frontend são idênticos. Os 14 pares de hashes de proveniência conferem contra o commit de origem declarado e os arquivos MCP empacotados. Todos os arquivos-fonte alterados têm menos de 1.000 linhas.

## Verificação no checkout integrado

- `cargo test --locked --features mcp -j 1 --lib --test backend_execution_intervals --test backend_usage --test backend_mcp --test transfer_export --test transfer_roundtrip`: 62 testes passaram. `BEE_TEST_DRIVER=sqlite` usa arquivos temporários; alvos específicos PostgreSQL e transferências usam apenas a instância isolada PostgreSQL 18.
- Repetição de `--test backend_execution_intervals` com `BEE_TEST_DRIVER=postgres`: 10 testes passaram.
- `cargo build --locked --features mcp -j 1` passou no checkout integrado. O exemplo `mcp_catalog` compilou e executou com sucesso; o catálogo foi comparado semanticamente com o JSON versionado.
- A compilação usa `--target-dir C:/Users/phili/.codex/worktrees/8fbc/coordenator/target` para não sobrescrever o executável usado pela API ativa. `OTEL_ENABLED=false`; credenciais de teste não são do produto.
- `git diff --check` passou. Nenhum banco do produto foi modificado e nenhum serviço ativo foi reiniciado.

## Ativação

Os commits integrados de Backend, Frontend e Skills foram publicados no remoto em `52fbb72`, juntamente com a documentação das verificações. Não houve merge na `main` nem troca do executável em execução.

A implementação está no checkout de integração. A API em execução deve ser recompilada/reiniciada pelo fluxo local habitual, preservando seu banco e configuração, para oferecer os endpoints e migrações novos. O frontend em desenvolvimento lê as alterações integradas; a aceitação visual com a API local atualizada permanece distinta dos testes com fixtures/bancos isolados.

Resumos antigos continuam sem intervalos inferidos. Novos intervalos só existem após ações explícitas do cliente/skill; o tracking é aditivo no contrato e não transforma acumulados históricos em consumo atribuído.
