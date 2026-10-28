# Exportação e importação portável — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** permitir exportação consistente de Bee Team PostgreSQL/SQLite e restauração completa em destino vazio, preservando dados e anexos.

**Architecture:** transportes HTTP/MCP e UI chamam serviço de transferência; repositories encapsulam snapshots, restauração em lote, arquivos do pacote e jobs. Formato portável versionado, streaming e transação única na restauração; sem reaproveitar CRUD que altera IDs/versões/histórico.

**Tech Stack:** Rust, Axum, Tokio, SQLx/PostgreSQL 18+/SQLite, serde_json, SHA-256; codec ZIP com suporte ZIP64 a selecionar e fixar no Cargo.lock durante a implementação; frontend React/Vite existente.

**Spec:** `docs/data-transfer-design.md` (proposta, não aprovada para implementação).

## Global Constraints

- PostgreSQL padrão; SQLite opcional por env. Toda integração com banco ou arquivos pertence a repositories.
- Sem mistura de bancos, sem redefinir IDs UUIDv7/slugs/versões, sem excluir tombstones ou renovar replays.
- Preservar atomicidade e notificações somente após commit, inclusive recuperação de resultado após queda do processo.
- Não executar SQL do pacote nem desligar FKs/triggers/proteções de exclusão.
- Importar somente em banco vazio na primeira entrega; trocar banco existente exige etapa operacional separada.
- Testes somente em PostgreSQL 18 isolado e arquivos SQLite temporários; não usar dados de produto.
- Não implementar antes de aprovar as decisões do design. Este plano não autoriza migração nem apagamento.
- Manter arquivos fonte abaixo de 1000 linhas; build e testes a cada entrega; commits claros.

## Review Focus

- Banco muda entre prévia e confirmação: teste na tarefa 3 garante verificação sob lock.
- Queda entre commit e conclusão do job: tarefa 4 comprova marcador e retry sem duplicação.
- Arquivo válido no ZIP, mas adulterado/incompatível no conteúdo: tarefas 1 e 3 rejeitam antes de publicar dados.
- Exportação simultânea a alterações/anexos: tarefa 2 verifica snapshot único e streaming.
- Datas, replays legados e valores JSON não equivalentes entre motores: tarefas 3 e 6 provam comportamento declarado.

## Mapa de arquivos proposto

- Novo `src/dto/data_transfer.rs`: contratos de manifesto, linhas, jobs, prévia, confirmação e erros; sem acesso a storage.
- Novo `src/repositories/transfer/contracts.rs`: interfaces de snapshot/restauração/artefatos/jobs, sem SQLx nos tipos públicos.
- Novos `src/repositories/transfer/{mod,archive,jobs}.rs`: composição, arquivos ZIP/JSONL/blobs, journal/lease de jobs.
- Novos `src/repositories/transfer/{postgres,sqlite}.rs`: snapshot/exportação, validação final e bulk restore de cada driver.
- Novos `src/services/data_transfer/{mod,validation,export,import}.rs`: regras e orquestração por interfaces.
- Novos `src/routes/data_transfer.rs` e `docs/data-transfer-openapi.yaml`: API administrativa e upload/download streaming.
- Alterar `src/{config,state,main}.rs`, `src/repositories/{mod,database}.rs`, `src/routes/{mod,mcp_adapter}.rs` e catálogo MCP para composição, jobs e transporte compartilhado.
- Novas migrations de metadados técnicos: uma em `migrations/` para PostgreSQL e outra em `migrations/sqlite/`. Nomes únicos conforme histórico atual; identidade do destino e marcadores de restore, nunca dados seed.
- Novo `frontend/src/features/data-transfer.tsx`, cliente em `frontend/src/api/data-transfer.ts`; ligar à página global de configurações existente, não a BoardSettings.
- Novos testes `tests/transfer_{archive,export,restore,jobs,http,mcp}.rs` e `frontend/src/features/data-transfer.test.tsx`.

Interfaces propostas (assinaturas conceituais; Futures/streams seguem o padrão RepositoryFuture atual):

- `TransferRepository::snapshot() -> SnapshotReader`; reader mantém uma transação de leitura até `finish()` e oferece lotes de `PortableRecord`, metadados de arquivos e streams de bytes.
- `TransferRepository::begin_empty_restore(target_identity) -> RestoreWriter`; adquire lock antes de conferir vazio. Writer oferece insert de lotes/blobs, checkpoint de sequência e `commit(marker)`/rollback.
- `ArtifactRepository::create/read/finalize/remove(artifact_id)`; IDs internos, nunca paths fornecidos pelo cliente.
- `JobRepository::create/get/claim/update/reconcile(job_id)`; lease e gravações atômicas independentes da transação de domínio.
- `TransferService::{start_export,stage_import,preview,restore,cancel,status}`; nenhum tipo SQLx, HTTP ou filesystem bruto nas assinaturas de domínio.

---

### Tarefa 1: codec e validação do pacote

Files: dto/data_transfer.rs; repositories/transfer/archive.rs e contracts.rs; services/data_transfer/validation.rs; tests/transfer_archive.rs; Cargo.toml/lock.

- [ ] Escrever testes que falham: round-trip de null versus string vazia, booleano, inteiro de 64 bits, Unicode, Markdown multilinha e blob; inventário e hash adulterados devem falhar.
- [ ] Acrescentar testes de paths `../`, absoluto, symlink, entrada duplicada, versão desconhecida, arquivo truncado, limite real de expansão e quantidade de entradas.
- [ ] Implementar codec streaming com manifesto v1 conforme spec; reservar memória limitada por lote/linha, artefato só publicado ao finalizar.
- [ ] Executar `cargo test --locked --features mcp --test transfer_archive`; todos os casos devem passar; executar cargo build.
- [ ] Documentar o formato, suas limitações e exemplos; commit `feat: define portable Bee Team archive format`.

### Tarefa 2: snapshot/exportação nos dois drivers

Files: repositories/transfer/postgres.rs e sqlite.rs; services/data_transfer/export.rs; tests/transfer_export.rs; composição de repositories.

- [ ] Teste vermelho: exportar enquanto outra conexão modifica task e anexo; pacote deve conter um estado consistente, nunca metadados antigos com bytes novos.
- [ ] Testar tombstones, slugs reservados, replays expirados/legados, contador conservador, banco vazio e rejeição de dados nas tabelas legadas não suportadas.
- [ ] Implementar snapshots separados do UnitOfWork de escrita; todos os 17 grupos e arquivos saem da mesma transação. Não iterar pela API paginada entre transações diferentes.
- [ ] Testar um blob maior que o buffer e medir o limite de buffer no reader; cancelamento/falha não disponibiliza pacote parcial.
- [ ] Executar transfer_export nos dois drivers e cargo build; commit `feat: export consistent database snapshots`.

### Tarefa 3: restauração transacional em destino vazio

Files: repositories/transfer adapters; services/data_transfer/import.rs e validation.rs; migrations técnicas; tests/transfer_restore.rs.

- [ ] Testes vermelhos: destino com apenas tombstone ou replay já conta como não vazio; escrita concorrente depois da prévia deve impedir restore.
- [ ] Testar rollback após inserir parte dos blobs/entidades, UUID inválido, referência órfã, ciclo, colisão de slug, papel inválido e subtree entre boards; não desativar constraints para passar.
- [ ] Implementar restore em uma transação com locks existentes; ordem topológica para tasks, registros inalterados e marcador técnico de conclusão na mesma transação.
- [ ] Testar precisão submicrossegundo: política estrita falha com relatório, opt-in trunca somente campos tipados; snapshots de replay permanecem intactos. Não renovar expiração.
- [ ] Ajustar sequência para valor seguro e testar criação de evento posterior sem colisão. Verificar uma invalidação no sucesso e nenhuma em rollback.
- [ ] Executar transfer_restore e cargo build; commit `feat: restore portable archives into empty databases`.

### Tarefa 4: jobs, API e recuperação

Files: repositories/transfer/jobs.rs; services/data_transfer/mod.rs; routes/data_transfer.rs; dto/config/state; OpenAPI; tests/transfer_jobs.rs e transfer_http.rs.

- [ ] Testes vermelhos para idempotência, confirmação de pacote/destino trocados, job expirado, cancelamento em corrida com commit e restart pós-commit/pré-journal.
- [ ] Implementar rotas da spec, lease único por instância, retenção terminal, upload/download streaming, limites próprios e respostas 202/409/413/422 sem dados de conexão em erros.
- [ ] Reconciliar jobs interrompidos com marcador no DB: confirmar commit ou rollback antes de permitir retry. Nenhuma retomada automática que repita writes sem prova.
- [ ] Testar recurso desabilitado, origem não autorizada e que consulta de progresso funciona durante o lock SQLite. Não alegar autenticação pelo ator ou token da prévia.
- [ ] Executar transfer_jobs/transfer_http, validar OpenAPI e build; commit `feat: expose recoverable data transfer jobs`.

### Tarefa 5: painel e MCP

Files: frontend features/client citados; routes/mcp_adapter.rs; docs/mcp-catalog.*; tests/transfer_mcp.rs.

- [ ] Testar tela com exportação, upload, contagens, aviso de histórico excluído, destino não vazio, precisão de datas, confirmação e falha; cancelamento não pode apagar o resultado de um commit já concluído.
- [ ] Implementar seção global Exportar/Importar com progresso e downloads. Manter filtros/rascunhos do restante da aplicação; após restore concluído invalidar caches sem salvar drafts antigos automaticamente.
- [ ] Expor tools MCP pelo mesmo serviço para export/status/preview/restore de upload conhecido; sem filesystem arbitrário e sem blobs no contexto do modelo.
- [ ] Testar paridade HTTP/MCP e regenerar catálogo com `cargo run --locked --features mcp --example mcp_catalog`.
- [ ] Rodar testes frontend, TypeScript/build e testes Rust afetados; commit `feat: add data transfer controls to UI and MCP`.

### Tarefa 6: matriz completa e documentação operacional

Files: testes de integração novos, README.md, docs/local-integration.md e orientação de operação correspondente.

- [ ] Executar PostgreSQL→PostgreSQL, PostgreSQL→SQLite, SQLite→PostgreSQL, SQLite→SQLite com o mesmo fixture isolado: comparar IDs, versões, payloads, vínculos, tombstones, bytes/hash, replays e sequência futura.
- [ ] Reabrir destino após restore; testar consumo pelo frontend/API/MCP, notificações e nenhuma exposição parcial em conexões concorrentes.
- [ ] Registrar resultados de precisão quando houver conversão aprovada, sem afirmar igualdade byte a byte dos timestamps tipados nesses casos.
- [ ] Rodar `cargo build --locked --features mcp`, `cargo test --locked --features mcp` e checks frontend aplicáveis. OTEL_ENABLED=false e BEE_TEST_DATABASE_URL apenas de ambiente isolado.
- [ ] Revisão independente da matriz, logs de recuperação e limites; documentar backup completo versus relatório CSV, configurações e restauração em instalação nova. Commit de conclusão, sem publicação implícita.

## Etapa posterior: substituir uma instalação existente

Não implementar um `force=true` que apague dados. Antes desta etapa, fechar contrato de supervisor, manutenção coordenada entre todas as instâncias e aprovação de corte. Reutilizar export/restore em banco candidato vazio; não misturar troca de processo/env com regras dos repositories.

Critério de aceite: snapshot do banco antigo após suspensão de escritores, candidato validado, reinício coordenado com nova configuração, frontend reconectado ao destino correto, antigo preservado e rollback documentado antes de liberar novas escritas. Testar queda em cada etapa do corte. Descarte definitivo da instalação antiga é outra ação explícita.
