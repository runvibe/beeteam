# Navegacao e estado na URL

History API + useSyncExternalStore, em routing/location.ts/query.ts. Sem estado canonico de navegacao em Zustand. Theme continua em localStorage; filtros, offsets e limites nunca sao persistidos la.

| Rota | Conteudo |
| --- | --- |
| / e /boards | Lista de boards |
| /boards/:id | Kanban |
| /boards/:id/settings | Configuracao do board em painel |
| /tasks/:id | Task em pagina inteira; filhos usam a mesma rota por ID |
| /agents | Lista de agentes |
| /agents/:id | Perfil em página completa, com abas |
| /agents/:id/settings | Configuração do perfil em modal; página permanece ao fundo |
| /teams | Lista de times |
| /teams/:id | Composição e boards geridos em página completa |
| /teams/:id/settings | Configuração dos metadados em modal |

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

Cards de boards usam link abrangente; tasks usam link no bloco principal, com executor independente fora. Titulos sao texto sem link separado. Links oferecem teclado, copiar endereco e nova aba; areas nao interativas tambem abrem. Botoes internos conservam acao propria; selecao de texto nao navega. Task e pagina sem dialog/overlay; perfis/times/configuracoes preservam paineis enderecaveis.

Hospedagem estatica deve servir index.html como fallback de rotas SPA; Vite dev/preview ja fazem isso. A entrega continua mock local, sem API real. Recarregar reinicia entidades, mas preserva rota/query/tema.

- `tab=specification` abre diretamente a especificação Markdown.
- `plans.selected=<planId>` seleciona um plano independentemente de `plans.offset/limit`.
- `revision.<planId>.selected=<revision>` seleciona uma revisão histórica independentemente da paginação. Ausente/0 significa plano atual; revisão inexistente é indicada explicitamente.
- `revision.<planId>.show=true` expande Histórico de alterações. Seleções não reiniciam offsets; recarga e histórico do navegador preservam os parâmetros.

Agentes e times usam cards com link no bloco principal e títulos textuais. O líder no card de time é uma ação independente. `Voltar` restaura a origem validada e seus parâmetros; links de membros, vínculo de time, tasks e boards registram `from`. Configurações usam a mesma query da página e fechar remove apenas `/settings`, mantendo aba/filtros/paginação. Sem origem, a página volta à listagem correspondente.
