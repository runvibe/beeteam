# Navegacao e estado na URL

History API + useSyncExternalStore, em routing/location.ts/query.ts. Sem estado canonico de navegacao em Zustand. Theme continua em localStorage; filtros, offsets e limites nunca sao persistidos la.

| Rota | Conteudo |
| --- | --- |
| / e /boards | Lista de boards |
| /boards/:id | Kanban |
| /boards/:id/settings | Configuracao do board em painel |
| /tasks/:id | Task em pagina inteira; filhos usam a mesma rota por ID |
| /agents | Lista de agentes |
| /agents/:id | Perfil em painel, com abas |
| /agents/:id/settings | Configuracao do perfil |
| /teams | Lista de times |
| /teams/:id | Composicao e boards geridos em painel |
| /teams/:id/settings | Metadados do time abertos |

## Query string

- boards.name, boards.teamId, boards.archived, boards.offset, boards.limit (12).
- kanban.title, kanban.executor, kanban.blocked, kanban.updatedFrom (YYYY-MM-DD), kanban.limit (3 por coluna), kanban.<statusId>.offset.
- agents.name, agents.role, agents.teamId, agents.archived, agents.offset, agents.limit (12).
- teams.name, teams.archived, teams.offset, teams.limit (12).
- agent.tab: profile, activities, chats, resume. Configurar usa /settings.
- activities.title, activities.relation (any/authored/executing/worked), activities.offset, activities.limit (10).
- chats.offset/chats.limit (10); members.offset/members.limit (10); managedBoards.offset/managedBoards.limit (10).
- tab na task: overview, children, plans, comments, attachments, summaries, timeline.
- children, plans, comments, attachments, summaries e timeline usam <prefixo>.offset/<prefixo>.limit (10); timeline.includeChildren controla descendencia.
- revision.<planId>.show, revision.<planId>.offset e revision.<planId>.limit (5) reconstroem a lista de revisoes.
- Seletores de entidades: selector-<resource>-<label>.name/.offset/.limit (25).

Offset e inteiro entre 0 e 1000000, limit inteiro 1..100. Valores invalidos usam defaults; enums/datas/IDs de filtro invalidos tambem. Defaults podem ser omitidos. Alterar filtros ou limite limpa offsets do mesmo escopo, preservando os outros parametros. Limpar filtros usa os mesmos setters. Cada mudanca de query participa do historico; reload/deep link leem a URL antes de consultar a API.

## Origem e retorno

from guarda URL relativa interna de origem, incluindo filtros, pagina, aba e a origem anterior. Voltar usa indices de entradas criadas pelo app para voltar ate a origem sem percorrer cada ajuste de aba. Em acesso direto ou nova aba, substitui pela origem validada; sem origem valida, task volta ao proprio board (ou /boards se registro indisponivel), perfil a /agents e time a /teams. URLs externas nunca sao destinos de retorno. Back/Forward nativos reconstroem a tela. Posicoes de janela/Kanban/painel sao lembradas apenas em memoria durante a sessao; nao ha garantia de posicao apos reload/processo novo.

Cards de task tem link real no titulo (teclado, copiar endereco, nova aba) e clique nas areas nao interativas. Botoes internos conservam acao propria; selecao de texto nao navega. Task e pagina sem dialog/overlay; perfis/times/configuracoes preservam paineis enderecaveis.

Hospedagem estatica deve servir index.html como fallback de rotas SPA; Vite dev/preview ja fazem isso. A entrega continua mock local, sem API real. Recarregar reinicia entidades, mas preserva rota/query/tema.
