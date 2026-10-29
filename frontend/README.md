# Bee Team — frontend

React + Vite + TypeScript + shadcn/ui (Radix) + Zustand. O preview usa a **API HTTP real por padrão**, com persistência no PostgreSQL do backend. Não há autenticação, login ou tokens. O mock em memória permanece disponível somente por opção explícita.

## Executar

Requer Node 22.12+ (validado com 22.19) e npm.

```sh
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```

A API local deve estar ativa em http://127.0.0.1:59865. O Vite encaminha `/api` para esse endereço. Copie `.env.example` para `.env.local` se precisar ajustar `BEE_API_TARGET` (destino do proxy) ou `VITE_API_BASE_URL` (base HTTP do cliente). O servidor não cria nem apaga dados automaticamente. O bootstrap e o startup pertencem ao backend.

Para demonstração isolada, defina `VITE_API_MODE=mock` e reinicie o Vite; nesse modo, alterações são perdidas ao recarregar. Não há fallback automático quando a API falha.

Acesse http://127.0.0.1:5173. Produção estática: `npm run build`; prévia: `npm run preview -- --host 127.0.0.1`.

## O que está disponível

- Boards com busca, time gestor, ativos/arquivados; Kanban com filtros de título, executor, bloqueio e data de atualização. Todas as colunas são mantidas; continuação usa offset/limit por coluna e conserva os filtros.
- Task com autor/executor, status, progresso, bloqueio, filhos reais em todos os boards, navegação recursiva por filho/pai, planos e revisões, comentários, arquivos para download, resumos/entregas/pendências e timeline com descendência opcional.
- RA com busca, papel, time e arquivamento. Perfil, vínculos, regras/limites, contexto resumido, atividades por autoria/execução/resumo, referências externas de chats e contexto de retomada. Metadados de time, membros e boards geridos.
- Configuração de nome/descrição/modo do board, modo individual da task, perfis (incluindo imagem por URL HTTPS), metadados dos times e criação/renomeação/conclusão/ordenação de status.
- Loading, vazio, erro com retry, validação de texto/versão, feedback de gravação, teclado e layout para navegador comum e largura estreita.

Não há despacho, criação/atribuição de tasks, composição operacional de times ou botão de aprovação. Essas ações permanecem na conversa/harness. As datas são registros, não heartbeats. A UI não simula identidade autenticada ou permissões de líder ainda pendentes.

## Domínio e autonomia

Sem workspace. Board tem um time gestor e criador preservado. Tasks têm authorAgentId/executorAgentId obrigatórios, sem teamId. Os filhos podem pertencer a outros boards e executores, sem limite fixo de profundidade. O mock deriva a raiz iterativamente e detecta ciclos, sem duplicar estado de checklist.

O board de origem da raiz governa a cadeia: manual força manual; automatic força automático; standard usa a flag da task atual sem herdar a do pai. O cálculo não altera flags dos destinos. A UI diferencia configuração salva de modo efetivo. Mudar a flag sob origem manual/automatic não modifica essa precedência.

## Contratos e adapter

`contracts/` contém uma cópia de referência dos seis documentos fonte revisados em 27/10/2026. Não é a fonte central e não deve substituir `docs/` na integração. `npm run generate:types` gera os 88 schemas em módulos pequenos em `src/api/generated/`.

`BeeApi` em `src/api/types.ts` é a porta tipada consumida pelas features; `ApiProvider` injeta o adapter e isola o cache por instância. `createMockApi()` é a implementação demonstrativa. `seed.ts` contém fixtures UUID v7, inclusive hierarquia com quatro níveis e filhos entre boards. A configuração usa IDs v7 novos e controle de versão. Registros removidos são filtrados por deletedAt; arquivamento é distinto.

O mock implementa as operações consumidas por esta UI, não todo o CRUD operacional OpenAPI nem um servidor HTTP. `createHttpApi()` implementa a mesma porta em produção local, com transporte separado, paginação, downloads/imagens binárias, erros HTTP/rede e timeout de 30 segundos. Writes declaram `X-Actor-Kind: human`; versões usam `If-Match` forte. Criação de status mantém a mesma chave de idempotência ao repetir uma intenção após erro e gera outra para uma nova criação. Não há retry automático de writes. Após conflito, Recarregar formulário busca o board atualizado no servidor. Autoria human/agent declarada não é identidade verificada.

TanStack Query mantém apenas cache/estado remoto. A URL comanda navegação, filtros e paginação; Zustand permanece apenas no controlador de tema. Nenhuma entidade é persistida em localStorage. A API é a fonte persistente de dados no modo normal.

### Limites explícitos desta entrega

- Integração HTTP real validada com banco local dedicado. O frontend não usa transporte MCP. Criação/composição operacional de entidades permanece no backend/harness; a UI mantém apenas os editores já existentes e criação de status.
- Configuração de imagem usa URL HTTPS; o formulário não envia uploads. Imagens já enviadas são lidas pelo adapter e exibidas com URL de objeto revogada ao desmontar. O mock usa um PNG demonstrativo para testar esse caminho.
- O mock não pretende reproduzir todas as condições de armazenamento/concor­rência do servidor nem implementar operações operacionais ausentes da UI.

## Verificação

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

85 testes cobrem schemas JSON Schema 2020-12 dos registros/projeções, filtros/paginação, versões, exclusão lógica, autonomia de origem, filhos cross-board, status e navegação/erros. Revisão visual realizada via navegador em desktop e viewport de 390×844.

Na raiz, `cargo build --locked` passou. `cargo test --locked`: 12 unitários passaram; 3 integrações falharam ao criar container PostgreSQL por Docker indisponível (`CreateContainer`, erro de sistema 2). Nenhum arquivo Rust foi alterado. Esses testes da base Rust deste worktree não validam o backend atual executado no worktree separado. A integração HTTP no navegador foi validada independentemente, com gravações confirmadas também no banco pelo Backend.

Consulte `PROGRESS.md` para checklist e evidências finais. Não houve merge, push ou deploy.

## Aparência

O botão de tema no topo mostra a próxima ação: sol para ativar claro, lua para ativar escuro. Sem preferência salva, acompanha o sistema operacional; a escolha manual é persistida em localStorage (`beeteam.theme`). Funciona por teclado e possui nome acessível. Na sidebar recolhida, logo e seta de expansão ficam centralizadas; a seta aponta para a ação de expandir/recolher. Indicadores decorativos de infraestrutura foram removidos do cabeçalho e rodapé; erros de conexão permanecem visíveis.

Um script síncrono no head aplica a classe e color-scheme antes do React; as paletas semânticas ficam centralizadas em index.css. Testes exercitam o bootstrap real e o controlador, incluindo armazenamento indisponível. Verificação manual confirmou Claro/Escuro após recarga, controles e conteúdo em desktop e viewport estreito; não foi feito ensaio de rede artificialmente lenta.


### Redesign compacto monocromático

Sidebar reduzida, breadcrumb navegável e caminho de ancestrais entre boards, cards com avatar e metadados essenciais, filtros recolhíveis em telas estreitas e ação de limpar filtros. Tasks usam página inteira com Voltar à origem. Perfis, times e configurações mantêm painéis endereçáveis. Times mostram composição antes do editor de metadados. Estados continuam escritos, sem depender de cor.

O novo CSS enviado em 27/10 substitui as adaptacoes monocromaticas anteriores: tokens claros/escuros, branco original, cores destructive/charts/sidebar-primary, spacing .29rem, sombras e radius .625rem preservados. Inter, Playfair Display e JetBrains Mono usam os nomes Variable das fontes locais instaladas. Cards e campos aplicam raios derivados do tema; painel lateral e abas mantem a geometria do layout aprovado. Seletor e persistencia permanecem iguais.


## Rotas, retorno e resumo atual

Veja [ROUTES.md](ROUTES.md) para paths, query strings e defaults. Filtros, pagina e abas sao reconstruidos da URL; Voltar conserva origem de board/perfil e navegacao recursiva. Sem origem interna valida, task retorna ao seu board. Cards abrem pela area nao interativa ou link do titulo; controles internos conservam suas acoes.

Task.currentSummary vem do contrato final: sintese cumulativa fornecida pelo colaborador, exibida em ate quatro linhas no card e completa na pagina. Vazio mostra "Sem atualizacao registrada". Nao derivamos texto da descricao, progress.note ou historico. Fixtures sao demonstrativas. O mock valida currentSummary nao vazio/ate 16384 bytes UTF-8 no patch e exige quando progress muda; configuracao administrativa preserva resumo. Nao existe editor operacional de progresso nem API real nesta UI.

Cards de boards compartilham a navegacao dos cards de tasks: area nao interativa abre a rota, titulo e texto; card e link real com suporte a teclado/nova aba, selecao de texto nao navega. Breadcrumb Boards recupera filtros e paginacao da listagem de origem pela URL.

Titulos de cards sao texto, sem links separados: boards tem um link abrangendo o card e tasks tem link no bloco principal com executor fora dele. Breadcrumb superior das tasks mostra Boards, board de origem, ancestrais e task atual; indica board atual distinto quando cross-board. Links recuperam contexto disponivel na cadeia from.

## Especificação e planos em Markdown

Task exibe `specification` na aba Especificação: requisitos, entrega e aceite. Descrição continua sendo o objetivo; resumo atual descreve feito/agora/falta; plano descreve a execução. Não há editor operacional. Campo sempre presente, vazio por padrão; mock valida 65536 bytes UTF-8 e rejeita null.

Plano atual aparece primeiro; Histórico de alterações é secundário. Cada plano mantém revisões próprias, autor/data/resumo e seleção por URL, inclusive fora da página atual. Especificação e planos atuais/históricos usam react-markdown + remark-gfm (títulos, listas, tabelas, links e código), ignorando HTML bruto e URLs inseguras. Conteúdo fonte é preservado. Código e tabelas têm rolagem própria no mobile.

Referência final e98a1056: radius .625rem e demais tokens fornecidos preservados. Cards têm link no bloco principal, título textual e ações de executor independentes. Breadcrumb superior conserva Boards > board > ancestrais > task.

## Páginas de agentes e times

`/agents/:id` e `/teams/:id` abrem conteúdo na área principal, com breadcrumb e Voltar. Perfil, atividades, chats, retomada, membros e boards permanecem disponíveis. Somente `/settings` abre um modal de configuração, cujo fechamento conserva o estado da página. Cards navegam pelo corpo e pelo teclado; títulos são texto, e o líder do time mantém uma ação independente. Seleção de texto não dispara navegação. Query strings preservam abas, buscas e paginação em links diretos, recarga e retorno entre entidades. Tema e98a1056 (.625rem) e ícones existentes preservados.

## Slugs legíveis

Agentes, times e tasks/subtasks têm URLs por slug persistido. Boards mantêm UUID. O adapter resolve slug para UUID e a UI continua usando IDs nas APIs e relações. Links UUID antigos são canonicalizados preservando query, origem e histórico. Renomear não muda o slug. Contratos OpenAPI kanban/RA e catálogo MCP sincronizados com os três resolvers; fixtures reproduzem unicidade e colisões sem substituir o backend como fonte da verdade.

## Atualização automática

No modo HTTP, uma conexão EventSource em `/api/v1/changes` recebe `invalidate` e `reset` com escopo global. Os eventos são avisos; a UI consulta novamente a API para obter os registros. Eventos próximos são agrupados em 150 ms; consultas anteriores ao evento são canceladas no cache para não publicar um snapshot antigo. Queries visíveis são atualizadas e as demais ficam stale até a próxima leitura. Não há navegação automática, alteração da URL nem reset de rolagem.

Na conexão/reconexão e ao voltar à aba, o estado é consultado novamente. Se a conexão falhar (ou a abertura demorar mais de 10 segundos), aparece um aviso discreto e há consulta a cada 15 segundos enquanto a aba estiver visível. EventSource tenta reconectar conforme o servidor; sem SSE não se promete atualização instantânea. O mock não abre conexão.

Formulários abertos preservam os campos e a versão de edição mesmo quando chega uma alteração externa; salvar uma versão antiga retorna conflito em vez de sobrescrever a mudança remota. Perfil/time/status avisam quando existe versão mais nova; fechar e reabrir carrega essa versão descartando o rascunho. O board oferece recarga explícita após erro. Falhas de consulta em background mantêm os dados anteriores e os campos montados, com mensagem de erro.

O servidor envia `heartbeat` nomeado a cada 15 segundos. Se nenhum evento chegar em 45 segundos, a UI fecha e reabre a conexão e ativa o mesmo fallback. Isso cobre proxies que mantêm uma conexão aberta após a queda do upstream sem disparar `onerror`.

### Visual do Kanban

Cards bloqueados mantêm o ícone e texto "Bloqueada" e recebem fundo/borda avermelhados discretos, usando o token semântico de erro nos temas claro e escuro. As colunas ocupam o espaço vertical restante da página e se estendem igualmente, inclusive vazias; conteúdo maior continua com rolagem e o Kanban mantém a rolagem horizontal em telas estreitas.

Alterar o frontend fonte não atualiza um processo com UI embutida já iniciado. Gere a nova distribuição com `node scripts/build-distribution.mjs`; a ativação do novo executável é uma etapa separada. Para preview sem substituir o binário, execute Vite em outra porta com `BEE_API_TARGET=http://127.0.0.1:59865`.

### Navegação fixa por ícones

A faixa lateral mostra somente o logo no topo e três botões circulares de 44 px, centralizados verticalmente. A largura é 72 px no desktop e 56 px em telas estreitas. Os botões conservam nomes acessíveis, indicação da seção ativa, foco visível e tooltips Radix por mouse/teclado (Escape fecha). Não há controle de expandir/recolher. Sidebar e navbar são transparentes e sem bordas; breadcrumb, configurações globais e alternância de tema permanecem disponíveis.

Validação: navegação e tooltip pelo teclado, temas claro/escuro, mobile e largura mínima de 320 px; o Kanban mantém seu scroll horizontal e o destaque de bloqueio. O preview visual usa fixtures somente em memória em processo separado; o binário ativo e o banco do usuário não são substituídos pelo desenvolvimento frontend.

Nas listagens, cards têm altura uniforme de 340px, títulos em até duas linhas e áreas reservadas para descrição. O fade é aplicado apenas quando a medição detecta texto excedente; o conteúdo integral permanece acessível e disponível no detalhe, sem alterar os dados.
