# Backend Bee Team — acompanhamento

Retomada final autorizada em 27/10/2026. Fonte documental sincronizada sem escrever no checkout principal.

- [x] Revisar os seis documentos fonte e adaptar o snapshot.
- [x] Persistência PostgreSQL >=18: sem workspace, UUIDv7, deleted_at, FKs, cardinalidades e proteção contra DELETE/TRUNCATE.
- [x] RA HTTP: perfis, composição/transferência, imagens/cópias, referências, retomada e atividades.
- [x] Kanban HTTP: boards/tasks, recursão cross-board, autonomia pela origem, planos/revisões/comentários/arquivos/resumos/timeline.
- [x] MCP: 52 tools equivalentes, 3 compostas, 2 sistema, 6 resources e 3 prompts; templates Skills 7487ee1 empacotados.
- [x] Revisão independente e regressões dos problemas encontrados.
- [x] Documentação, catálogo exportado e verificação final.
- [ ] Registrar commits locais; preservar branch/worktree sem push, merge ou deploy.

## Verificações realizadas

- `cargo build --locked`: passou.
- `cargo test --locked`: 27 testes passaram.
- `cargo build --locked --features mcp`: passou.
- `cargo test --locked --features mcp`: 30 testes passaram.
- PostgreSQL 18 real no container exclusivo `beeteam-backend-test-8fbc`, porta 55481. Os testes HTTP/MCP criam bancos isolados; nenhum banco de produto foi usado.
- Docker CLI chama WSL; SDK Testcontainers Windows não encontra socket Unix. BEE_TEST_DATABASE_URL resolveu a integração sem alterar daemon/portas do Docker nem apagar bancos existentes.
- Smoke TCP real em 127.0.0.1:18081: health ok, documentos Kanban/RA servidos e tools/list retornou 57 tools. Processo de smoke encerrado ao concluir.
- Respostas HTTP usadas pelos cenários são validadas contra schemas, incluindo erros. MCP valida catálogo e saídas testadas. Catalog JSON contém 57 tools/6 resources/3 prompts.
- Hierarquia testada com 32 níveis cross-board; matriz de 36 combinações de autonomia. Concorrência ETag e swaps/rollback de composição testados.
- Todos arquivos-fonte abaixo de 1000 linhas. Nenhum arquivo frontend alterado. UI integrada não foi alegada.

## Revisão e decisões técnicas registradas

Revisão independente por agente somente leitura, conforme requesting-code-review. Sete achados corrigidos com testes que falharam antes e passaram depois: erro details/códigos; agente sem vínculo mas com task não final; arquivo herdado no índice de atividades; metadados multipart MCP; MIME de imagem; CHECK UUIDv7 com NULL/variantes; UUID uppercase. Corrigida também invalidação de versões quando modo do board de origem muda.

Ruling: sem workspace e sem task.teamId, autor/executor independentes — decisões finais do usuário prevalecem sobre o snapshot antigo. Custos de incompatibilidade são explicitados nos contratos atualizados.

Ruling: conteúdo JSONB em tabelas separadas com FKs geradas e DTOs validados; SQLx runtime parametrizado permite build sem banco; lock transacional global dá snapshot coerente para serviço pessoal local. Custo: leituras/memória crescem com histórico, documentado em backend-implementation.md.

Ruling: bytes em PostgreSQL bytea dão atomicidade com metadados e preservação em exclusão lógica; não há path de usuário nem arquivo publicado antes do commit. Custo: uploads limitados em memória e tamanho do banco, documentados.

Ruling: autenticação foi explicitamente excluída; alcance de edição do líder permanece pendente. Não inventar bloqueio. Ciclos de liderança seguem proposta não confirmada; ciclos de tasks são estruturalmente inválidos e protegidos.

Ruling: snapshots de skills são recursos editoriais locais do commit 7487ee1, não instalação global. Atualização das skills para nomes definitivos MCP será feita depois, conforme usuário; o catálogo implementado é a referência.

Ruling: advisory lock protege escritores do serviço, não SQL externo que o ignore. Documentação e testes delimitam essa garantia. Escala multi-tenant não foi solicitada.

Nenhum achado importante ficou sem correção. Sem merge/push/deploy. Container de teste preservado.
