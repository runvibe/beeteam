# Frontend: projetos, repositórios, commits e Arquivos

Base: 9ddca34. Spec: docs/specs/projects-repositories-summary-commits.md no checkout principal.

1. Arquivos: filtros fileName/mediaType/includeRemoved conforme OpenAPI; URL e controles padrão; TaskRecordList mantém lotes10, root e dedup. Metadados removidos identificados, sem download disponível.
2. Aguardar formato Backend antes de sincronizar contrato/tipos; não extrair projetos/repos de Markdown.
3. Especificação: Markdown à esquerda, cards shadcn Projetos/Repositórios à direita; mobile empilhado; estados identificado/a identificar/não aplicável/legado explícitos.
4. Resumos: evidências históricas repo/branch/hash, link somente publicado com URL web segura sem credenciais; nenhum bloco vazio para false/legado.
5. Testes de contrato/UI/URLs/paginação, build frontend e cargo, revisão e QA isolada se disponível; README e commit.

Nenhuma mudança em dados reais ou serviços ativos. Sem formulário novo de gravação de resumo.

## Execução e evidências

- Contrato final confirmado pelo Backend: Task.workScope e ExecutionSummary.commitReport; oito DTOs novos gerados. SHA256 do OpenAPI frontend/backend: af32d0deede1b35a70f03e2d6d1d06f29c15c9371147cc0915b4d7f601efa04f.
- Arquivos: fileName literal, MIME arbitrário exato validado no submit, includeRemoved; escopo taskId e lotes10. Testes desktop/mobile carregam25 como10+10+5; metadados removidos não permitem download.
- Especificação: projetos/repos explícitos; estado legado/a identificar/não aplicável preservado. Root paths somente texto, remotes não são convertidos em links.
- Resumos: snapshot histórico, hash40/64 completo selecionável, branch named/detached/unknown, local/published/unknown, links com provider/path/hash e data de confirmação declarada; ausência/false sem seção.
- Revisão independente encontrou padrão MIME inválido para HTML v flag. Teste reproduziu entrada pdf aceita; barras escapadas corrigidas, teste agora bloqueia input inválido e aceita MIME customizado. Sem outros achados importantes ou pendências menores.
- QA isolada: desktop grade Markdown/cards confirmada após corrigir prioridade sobre detail-section; mobile390 empilhado, largura/scrollWidth380; hash completo seleciona40 caracteres, popover Arquivos visível dentro da tela. Nenhum dado real/API real utilizado. Preview e arquivos temporários removidos; viewport restaurado.
- Build frontend/typecheck aprovado, aviso preexistente de chunk >500kB. cargo build --locked --features mcp -j1 e cargo test --locked --features mcp --lib -j1 aprovados (30 unitários). Não executada integração PostgreSQL neste worktree.
- Primeira suite frontend326/327; fixture de nova gravação atualizada para commitReport obrigatório, com testes rejeitando ausência e true/lista vazia. Reteste focado28/28. Suite final: npm --prefix frontend test -- --maxWorkers=2 aprovada, 87 arquivos/327 testes em98.75s.
