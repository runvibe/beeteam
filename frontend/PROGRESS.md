# Frontend — acompanhamento

Escopo: React/Vite/shadcn/ui/Zustand, API mockada substituível, sem autenticação. UI de leitura/configuração; sem dispatch/aprovação. Mudanças apenas em frontend/.

- [x] 1. Revisar os seis documentos atuais, congelar referência e regenerar tipos.
- [x] 2. Adaptar mock e testes: paginação, domínio final e autonomia recursiva.
- [x] 3. Navegação, boards, filtros e detalhe recursivo de tasks.
- [x] 4. RA, perfis, times e configurações contratuais.
- [x] 5. Testes/build, verificação visual, documentação e commits locais.

## Revisão de 27/10/2026

Referências copiadas do checkout fonte para contracts/, sem editar a fonte. 81 schemas gerados em módulos separados. Dependências alinhadas com TypeScript 5.9; shadcn Radix instalado pelo CLI.

Diferenças a adaptar: remover workspace; Board.teamId gestor único e createdBy preservado; Task.authorAgentId/executorAgentId obrigatórios e sem teamId; filhos globais recursivos cross-board; origem da raiz preservada no executionContext. Board manual/standard/automatic; task manual/automatic. Origem manual força manual, automatic força automatic, standard lê a flag da task atual sem herdar a do pai. Exclusão lógica distinta de arquivamento.

Não implementar política pendente de edição pelo líder. UI não terá reatribuição, composição operacional de times ou execução. Configurações se limitam aos metadados, perfis, status e modos previstos.

## Evidências anteriores preservadas

- Mock inicial: 4 testes passaram antes da revisão final; não comprova aderência ao domínio atual.
- Instalação acidental na raiz foi movida para .setup-residue/ ignorada; nada incluído no commit fora de frontend/.

- Tarefa 2: 12 testes passaram; tsc -b passou. Filhos cross-board e 6 combinações de autonomia verificadas. Mock em memória, reset ao recarregar; sem API real.

- Tarefas 3/4: boards/tasks e RA/configurações implementados. 29 testes passam; inclui schemas exatos, autonomia e proteção de status. npm run build passou. cargo build --locked passou; cargo test --locked: 12 unitários passaram, 3 integrações falharam ao criar PostgreSQL por Docker indisponível (erro de sistema 2). Sem mudanças Rust.

## Revisão final

- Revisor independente (skill requesting-code-review) encontrou perda de draft em BoardForm e divergência do default archived. Ambos reproduzidos em testes RED, corrigidos e GREEN.
- Ruling: a sugestão de proibir edição da flag individual fora de standard foi rejeitada: a regra do contrato restringe o cálculo efetivo, não a configuração salva. UI mostra ambos; origem continua prevalecendo. Custo: usuário pode salvar flag sem efeito imediato; explicação visível informa a precedência.
- Correção menor: IDs de busca agora únicos para não associar labels ao campo atrás de um modal.
- Itens menores reclassificados como aderência ao contrato e corrigidos: imagens de upload pelo adapter, filtros/ordem de revisões e escolha do último resumo não excluído. Três testes RED→GREEN adicionados.
- Revisão visual: desktop e 390x844; navegação, colunas e modal/abas legíveis. Sem APIs reais.

- Tarefa 5 concluída: 35 testes frontend passam; typecheck/build produção passam; lint sem erros, 9 avisos de Fast Refresh. Todos os módulos fonte abaixo de 1000 linhas. Referências conferidas novamente por SHA256 e iguais à fonte. Prévia local em http://127.0.0.1:5173. Commit local somente frontend/, sem push/merge/deploy. Nenhum achado de correção permanece aberto; limitações de escopo mock estão no README.

## Tema claro/escuro — 27/10/2026

- [x] Sistema como default, mudanças do SO e preferência explícita persistida.
- [x] Bootstrap antes do React e paletas centralizadas; seletor shadcn acessível no topo.
- [x] 52 testes frontend, typecheck e build passam. Lint sem erros; avisos preexistentes de Fast Refresh e Blob avatar.
- [x] Revisão independente sem defeitos acionáveis. OS e falha de storage verificados por testes; Claro/Escuro e reload verificados no navegador.
- [x] Desktop: Kanban, task/abas, agentes/perfis/configuração, times. Viewport estreito: seletor, Kanban, task e agentes.
- [x] cargo build --locked passou; 12 unitários Rust passaram. Três integrações impedidas por Docker indisponível (CreateContainer, OS 2).
- [x] Preview local mantido em http://127.0.0.1:5173/. Sem backend, push, merge ou deploy.

Redesign monocromático será proposta separada; não aplicado nesta mudança de tema.


## Redesign autorizado e fidelidade ao CSS — 27/10/2026

- [x] Auditoria visual de todas as áreas antes da proposta; implementação autorizada pelo usuário via chat coordenador.
- [x] Sidebar, breadcrumb, cards, filtros, painel lateral, formulários e times compactados; dados e operações existentes preservados.
- [x] Regressão cross-board testada RED/GREEN: origem correta no breadcrumb e filtros preservados ao fechar. Marca mantém nome acessível em mobile.
- [x] Feedback de tema divergente confirmado por estilos computados: Geist, spacing .25, cinzas diferentes e sombras removidas. Corrigidos para CSS de referência com fontes instaladas e somente exceções documentadas no README.
- [x] Preview recarregado: Inter Variable, spacing .29rem, card radius 2px, shadow-sm e background escuro oklch(.145 0 0). Capturas claro/escuro atuais e mobile após correção. Viewport estreito sem overflow horizontal do documento; Kanban e abas têm scroll próprio. Fechar painel devolve foco ao card.
- [x] 53 testes frontend, build/TypeScript e lint sem erros (10 avisos já conhecidos: Fast Refresh e Blob avatar). Revisão independente final sem regressão concreta.
- [x] cargo build passou; cargo test: 12 unitários passaram e 3 integrações falharam em CreateContainer PostgreSQL (Docker indisponível, OS 2).
- [x] Sem backend, push, merge ou deploy. Commit local restrito ao frontend.

Evidências: C:/Users/phili/.codex/visualizations/2026/10/27/01a17e2c-4f16-78a0-8f6c-a1309651a0de/auditoria-proposta.md; capturas finais válidas após correção: final-kanban-light.png, final-kanban-dark.png, final-mobile-filters-dark.png, final-mobile-task-dark.png. Outras capturas final-* registram a iteração anterior e não comprovam a paleta definitiva.


## Novo tema final solicitado - 27/10/2026

- CSS e98a1056 aplicado sem neutralizar cores nem trocar branco. Radius .625rem (cards 10px), spacing .29rem, sombras e fontes originais. Campo de data agora segue radius-md.
- Reload e estilos computados confirmados em claro/escuro; capturas theme-final-light.png, theme-final-dark.png, theme-final-mobile.png no diretorio de evidencias anterior. Tokens charts/sidebar-primary preservados; nao ha graficos na UI atual.
- 53 testes, build e typecheck passaram. Cargo build passou; 12 unitarios passaram, 3 integracoes falharam por Docker indisponivel (CreateContainer OS2). Layout e mock preservados. Sem push/merge/deploy.


## Rotas canonicas, task pagina, clique do card e resumo - 27/10/2026

- [x] History API/useSyncExternalStore: paths reais para listas, entidades e settings; filtros/paginacao/abas em query. Nenhum filtro/pagina em Zustand/localStorage. Mapa completo em ROUTES.md.
- [x] Task ocupa main sem Dialog/overlay; Voltar usa origem interna validada e indices de historico proprios. Deep link tem fallback deterministico ao board. Origem agente, recursao cross-board e filtros restaurados.
- [x] Corpo nao interativo de card abre task; titulo e link real para teclado/nova aba. Executor conserva acao, selecao de texto nao navega, hover/foco visiveis.
- [x] CurrentSummary do contrato final em cards (quatro linhas) e pagina (completo), vazio explicito. Sem derivar descricao/progress.note/historico. Mock valida nao vazio/16KiB UTF8 quando atualiza progress e preserva em patch administrativo.
- [x] Snapshots sincronizados com worktree 8fbc, incluindo MCP catalog. Hash kanban 8F42E6A4AF8B28A93F9C145B8D88DB34D6B67337CA3DC1D2D85DED73AFFEEAB4; MCP JSON 6C278225B3AF3521C7D389156E3AE4A2FF5679C251A1EBF27CD5327EDF7DB49B. 83 schemas regenerados.
- [x] 59 testes, build/TypeScript e lint sem erros. Revisao independente encontrou/fixou key limit de coluna, retorno apos abas/config e expansao de revisoes; revisao focal final confirmou 4 testes e nenhum achado pendente.
- [x] Cargo build passou; 12 unitarios Rust passaram; 3 integracoes continuam bloqueadas ao criar PostgreSQL Docker (OS2). Nenhum Rust alterado.
- [x] Navegador: URL com filtro apos reload, clique no corpo, task sem modal/overlay, Voltar/Forward, desktop claro/escuro e mobile sem overflow horizontal do documento. Capturas atuais: task-page-light.png, task-page-dark.png, task-page-mobile.png, cards-summary-light.png no diretorio de evidencias. Capturas antigas de task drawer nao representam estado final.
- [x] Fontes/tokens finais preservados (tema e98a1056, radius .625rem, spacing .29rem e cores semanticas originais). Mock apenas; sem auth/API real/push/merge/deploy.

Limite: posicoes de scroll sao restauradas em memoria na sessao quando os elementos estao disponiveis; reload reinicia entidades mock. Hospedagem SPA exige fallback index.html para URLs diretas (Vite ja fornece).

## Cards de boards - 27/10/2026

- Corpo nao interativo abre board; titulo agora e link acessivel. Helper compartilhado com tasks preserva controles e selecao de texto; hover/focus nos dois tipos.
- from conserva URL da listagem, e breadcrumb Boards restaura filtros/limit/offset. Teste RED/GREEN de corpo, retorno e Enter no link; teste existente de executor interno continua passando.
- 60 testes e build/TypeScript passam. Cargo build passa; 12 unitarios passam, 3 integracoes Docker OS2 continuam impedidas. Preview conferido corpo/breadcrumb com filtro e limit; captura board-cards-clickable.png no diretorio de evidencias. Sem API real/push/merge/deploy.

- Correcao adicional autorizada: titulos sem link separado. Board inteiro e link; bloco principal da task e link com executor irmao independente. Teste cobre ausencia de anchor no titulo e selecao de texto.
- Breadcrumb task reproduzido RED e corrigido: shell Boards > board origem > ancestrais > task; atual aria-current=page, origem executionContext, links preservam from/query. Captura task-breadcrumb-final.png. 60 testes/build passam.

## Entrega final: cards, breadcrumb, especificação e planos

- Cards navegáveis pelo bloco, títulos textuais, seleção de texto e executor independentes; breadcrumb superior com board/ancestrais/task e origem filtrada.
- Especificação Markdown em aba própria; contratos 8fbc sincronizados, 84 schemas. Mock: vazio permitido, null rejeitado, limite 65536 bytes UTF-8.
- Plano atual destacado, histórico secundário com metadados e revisão antiga explícita; seleção de plano/revisão independente da página e persistente na URL. Revisão independente encontrou seleção fora da página, corrigida e coberta por teste.
- 67 testes frontend passaram; build/TypeScript e lint sem erros (warnings preexistentes e aviso de bundle 658 kB). Cargo build passou; 12 testes unitários passaram, 3 integrações não iniciam Postgres por Docker indisponível (CreateContainer OS2).
- Browser: especificação com listas/tabela/código, recarga da aba, desktop e mobile; viewport433/documento416, código longo com rolagem interna987/389.
- Tema final e98a1056: radius .625rem; demais tokens preservados. Somente frontend local, sem backend real/push/merge/deploy.

### Correção da referência final de tema

Revertida a aplicação indevida do anexo antigo 2347f736 no commit833c24c. Referência autorizada e98a1056 restaurada: radius .625rem nos dois temas. Comparação de todos os tokens root/dark sem diferenças semânticas (normalização decimal e nomes Variable das fontes locais). Browser desktop/mobile confirmou radius computado .625rem/cards10px e documento sem overflow (433/433). Build frontend e67 testes passaram; cargo build passou, integrações permanecem bloqueadas por Docker indisponível. Funcionalidades e ícones preservados.

## Agentes e times como páginas completas

- Cards navegam pelo bloco, com título textual, teclado e seleção de texto; ação do líder do time independente.
- AgentPage/TeamPage na área principal, com DetailPage compartilhado, breadcrumb e Voltar; módulo de times separado. Perfil/atividades/chats/retomada/membros/boards preservados. Somente configurações permanecem em modal; fechar conserva query.
- Retorno agente→task→agente conserva aba e busca; time→board→time conserva origem. Links diretos, recarga, query, back/forward e configurações cobertos.
- 70 testes frontend passaram; build/TypeScript e lint sem erros (avisos preexistentes). Cargo build passou, 12 unitários passam e3integrações continuam bloqueadas por Docker CreateContainer OS2. Revisão independente sem achados.
- Browser desktop/mobile: corpo do card, perfil sem overlay, modal configuração, recarga, retorno task/board. Mobile agente viewport433/doc433; time433/416; zero dialogs em leitura. Capturas agent-page-final/mobile e team-page-final/mobile em diretório de visualizações desta conversa.
- Tema final e98a1056 radius .625rem confirmado computado; ícones preservados. Commit local, sem push/merge/deploy/API real.
