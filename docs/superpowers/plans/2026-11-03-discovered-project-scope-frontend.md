# Frontend: escopo descoberto pelo Backend

Base bb7f9df. Entrada de escopo passa a nome/pasta absoluta de projeto; repositórios não são entrada. A UI atual somente apresenta os metadados, não possui formulário de edição do escopo.

1. Ocultar card Repositórios quando não houver registros, inclusive legado/sem Git.
2. Confirmar DTOs finais Backend antes de gerar tipos; apresentar descoberta pending/inaccessible/not_git junto ao projeto sem confundir estados.
3. Mostrar somente checkout/worktree usado pelos projetos declarados; não promover worktrees vizinhas a envolvidas.
4. Preservar snapshots de commits, layout desktop/mobile, filtros e paginação. Testes de estados/legado e build; QA responsiva isolada e commit.

Nenhuma alteração de dados reais ou reinício de serviço autorizado.

## Entrega

- DTOs gerados após confirmação de docs/project-discovery-contract.md: ProjectGitDiscovery, WorkProjectInput, TaskWorkScopeInput; criação exige projetos e PATCH usa somente input. Contrato frontend/backend SHA256 92d269a3b5383fed9e4a100732282d13eb195143a07976e339bd386af7fbdf72.
- Descoberta exibida junto a cada projeto: detected/not_git/unavailable com motivos específicos; legado sem discovery distinto. Worktree usada, raiz do checkout quando diferente e branch contextual; diretórios Git internos e worktrees vizinhas não são envolvidos.
- Card Repositórios existe somente para registros vinculados a projetos declarados. Commits históricos inalterados. Não existe formulário de criação/escopo nem método createTask no frontend atual; nenhum formulário novo necessário.
- Mock rejeita workScope PATCH com501 antes da mutação, pois não tem descoberta local; não armazena input como se fosse output válido.
- Testes red/green de ocultação, estados, checkout, vínculo e guarda mock.33 testes focados aprovados. Build frontend aprovado (aviso preexistente chunk>500kB); cargo build --locked --features mcp -j1 e cargo test --locked --features mcp --lib -j1 aprovados (33 unitários). Integração PostgreSQL não executada neste worktree.
- Revisão independente sem defeitos importantes. QA isolada desktop/mobile390: estados distintos visíveis, card repos ausente, mobile em coluna única e document clientWidth/scrollWidth380. Preview/arquivos temporários removidos e viewport restaurado.
- Suíte frontend completa aprovada: npm --prefix frontend test -- --maxWorkers=2,88 arquivos/336 testes em100.11s.
