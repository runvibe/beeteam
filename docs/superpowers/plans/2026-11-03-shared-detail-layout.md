# Plano: layout compartilhado de detalhes

**Estado:** proposta para revisão. Somente análise e documentação autorizadas. Nenhuma refatoração de produto foi implementada; todas as etapas abaixo dependem de aprovação deste plano.

**Objetivo:** extrair a composição visual de Task Details e reutilizá-la em Agent Details e Team Details, preservando funcionalidades, URLs, conteúdo e estado próprios de cada entidade.

**Base inspecionada:** frontend na worktree c44d, base `4cc04bd` com entregas `8ca745c` e `952f7eb`. A frente i18n está em andamento e deverá ser integrada antes das migrações sobrepostas. Validar novamente caminhos e classes na revisão integrada.

## Inventário real

| Aspecto | Task | Agent | Team |
| --- | --- | --- | --- |
| Entrada | `frontend/src/features/tasks.tsx` (465 linhas) | `frontend/src/features/agents.tsx` (466) | `frontend/src/features/teams.tsx` (319) |
| Estrutura | `TaskDetail`, hero visível, coluna principal e `TaskContext` | `DetailPage`, título/descrição atualmente `sr-only`, avatar e metadados | `DetailPage`, título `sr-only`, propósito/contexto no corpo |
| Navegação | `tab`: overview, specification, plans, children, comments, summaries, attachments, timeline | `agent.tab`: profile, activities, chats, resume | Sem abas hoje; membros e boards coexistem |
| Conteúdo específico | Markdown, progresso, bloqueio, síntese atual, filtros, conversas, planos, índices e gráficos | Perfil, vínculos, instruções/regras/limites/contexto, tasks por relação, chats, retomada | Propósito/contexto, agentes com papéis, boards geridos, metadados |
| Dados | `useEntity(tasks)`, overview e consultas por seção | `useEntity(agents)` e consultas por aba | `useEntity(teams)`, membros e boards paginados independentemente |
| Lateral | Status, autor/executor, relações, autonomia, cadastro; header compacto ao rolar | Não existe lateral equivalente | Não existe lateral equivalente |
| Configuração | Autonomia inline e outros fluxos específicos | `/agents/:slug/settings`, `ProfileForm` e autosave | `/teams/:slug/settings`, `TeamForm` e autosave |

Arquivos estruturais existentes: `components/detail-page.tsx`, `features/task-detail-layout.tsx`, `task-scroll-header.tsx`, `task-header-content.tsx`, `task-sections.tsx`/`.css`, `task-detail.css`, `task-filter-layout.tsx`/`.css`.

O header global e breadcrumbs pertencem a `App.tsx`, `components/context-path.tsx` e `mobile-context-path.tsx`. Não duplicar breadcrumbs no hero nem mover resolução de slugs para componentes visuais. `routing/entity-route.tsx`, `canonical-url.ts`, `query.ts` e `location.ts` continuam proprietários da identidade e histórico.

### Acoplamentos que precisam ser preservados

- Desktop a partir de **1056px**: `task-detail.css` limita shell a `100dvh`, cria scroll independente da principal e lateral. Abaixo disso: scroll do documento e lateral recolhível depois do conteúdo. Não inventar breakpoint diferente durante extração.
- `useTaskHeaderVisibility` observa hero dentro do scroller principal; compact header mantém hero e formulários originais montados. A cópia compacta tem `inert`/`aria-hidden` quando invisível.
- `TaskSections` faz overflow horizontal e revela somente a aba selecionada/focada, sem `scrollIntoView` da página; mede altura em `--task-sections-height` no documento e na página.
- `TaskFilterProvider`/`TaskFilterSlot` preservam host/portal e docking mobile. Não substituir por uma renderização duplicada dos filtros.
- Conversa conserva altura de saída até `onReady`, evitando clamp do scroll; planos guardam `planRevealConsumed`. Estes estados são de Task, não do layout genérico.
- `location.ts` salva/restaura `.detail-scroll, [data-detail-scroll]` e scroll do documento. O primeiro seletor também pode apontar para diálogo aberto. Preservar comportamento inicialmente e testar explicitamente configurações sobre a página; não reescrever toda navegação nesta extração.
- `DetailPage` usa classe `task-page` mesmo em Agent/Team: regras globais `:has(.task-page)` podem vazar scroll/layout. A migração deve substituir esse marcador nas entidades migradas de forma controlada.

## Decisão de arquitetura proposta

Usar composição por slots e componentes pequenos. Rejeitar um componente com `entityType` que consulta API e decide todas as abas; rejeitar copiar CSS/markup de Task em Agent/Team, pois mantém divergência e acoplamento. Manter adapters por entidade, hooks de domínio e os componentes de conteúdo existentes.

Criar em `frontend/src/components/detail-layout/`:

| Arquivo proposto | Responsabilidade e contrato |
| --- | --- |
| `detail-shell.tsx` | `DetailShell({label, hero, navigation?, children, context?, overlays?, primaryRef, heroRef})`. Slots `ReactNode`, refs de elementos DOM; compõe seção/colunas/scroll sem buscar dados ou ler URL. `overlays` fora da coluna rolável. Uma identidade estável por entidade, nunca por idioma/aba/versão. |
| `detail-header.tsx` | `DetailHeader({title, titleRef, description?, avatar?, actions?, metadata?, children?})`; um h1 visível, descrição em slot para preservar Markdown ou texto e regiões específicas. Nenhuma inferência de campo de domínio. |
| `detail-navigation.tsx` | `DetailNavigation({items, value, ariaLabel, trailing?, filterSlot?})`; itens `{value,label,disabled?}` já traduzidos, renderiza triggers dentro de Tabs controlado pelo adapter. Reutiliza overflow/medição/reveal de TaskSections. Sem tabs obrigatórias e sem mudar chaves de URL. |
| `detail-context.tsx` | `DetailContext({label, toggleLabel, toggleSummary?, compactHeader?, children})`; lateral desktop e disclosure mobile com `aria-controls`/`aria-expanded`. Nenhum conteúdo específico. Mantém estado de expansão local enquanto entidade não mudar. |
| `use-detail-header-visibility.ts` | Extrair somente observação de refs/viewport e `pastHeader`; sem `Task`, progresso ou resumo. Lifecycle limpa observers/listeners; breakpoint compartilhado com CSS. |
| `detail-layout.css` | Geometria, min-width, scroll, sticky e collapse. Sem estilos de Markdown de Task, gráficos, status ou formulários. Variável local `--detail-navigation-height`; transição compatível com `--task-sections-height` enquanto consumidores Task forem migrados. |

Nenhum desses módulos importa `api`, `state/ui`, DTO Task/Agent/Team ou `features/*`. Labels são props ou chaves comuns já disponibilizadas pelo i18n. Não criar nova biblioteca de componentes nem dependência de runtime.

O contrato de `DetailShell` inclui também slot opcional `backAction`, antes do hero. Agent/Team fornecem o botão Voltar existente, chamando `goBack('/agents')` e `goBack('/teams')`; o shell não conhece fallback nem routing. Task mantém sua navegação atual sem acrescentar botão redundante. Cada adapter mantém `titleRef` e efeito de foco inicial uma vez por identidade, preservando o comportamento atual de `DetailPage`; refresh, versão, tradução e troca de aba não refocam o h1. Testar Voltar visível, origem filtrada/fallback e foco inicial, além do breadcrumb compacto.

Adapters propostos em `features/`: `task-detail-page.tsx`, `task-context.tsx`, `agent-detail-page.tsx`, `agent-context.tsx`, `team-detail-page.tsx`, `team-context.tsx`. Extrair somente quando o módulo atual acumular responsabilidades; não mover todos os conteúdos automaticamente. Listagens `Agents`, `Teams` e queries permanecem com seus owners. Todos os arquivos novos/modificados devem ficar abaixo de1000 linhas; preferir unidades de200–400 linhas.

## Composição por entidade

**Task primeiro:** hero mantém título, descrição/edição, progresso, arquivado, bloqueio e síntese atual. Lateral mantém exatamente TaskContext e TaskCompactHeader por composição. O adapter controla Tabs manual, filtros, animação de painel, altura da conversa, consultas e chaves existentes. Não alterar ordem/valores das oito abas, conteúdo ou layout interno.

**Agent depois:** header visível com nome, roleDescription, avatar e ação Configurar; cadastro/data passam ao contexto direito com vínculos a líder/colaborador. Manter links de vínculos também no Perfil na primeira migração, sem retirar funções. Quatro abas atuais, valores e `agent.tab` intactos; não converter Tasks do agente em proprietário de tarefas. Perfil, atividades/filtros/paginação, chats e retomada permanecem componentes específicos. Compact header, se usado, contém apenas nome/avatar/descrição, nunca progresso fictício.

**Team por último:** header visível com nome e propósito; contexto textual permanece no corpo para não duplicar prosa. Lateral recebe ação Editar metadados, cadastro/data e liderança somente se os campos já disponíveis permitirem; não inferir totais globais da página atual de membros. Membros e boards continuam no corpo, com paginações independentes. **Proposta conservadora: nenhuma aba nova nesta fase.** O shell aceita navegação ausente, mantendo toda funcionalidade de Team. Se o usuário quiser separar Visão geral/Agentes/Boards, isso requer decisão adicional de informação/URL; não copiar as abas de Task.

As três entidades passam a compartilhar proporção/ritmo/header/sidebar e comportamento responsivo, mas não regras de negócio. Configurações Agent/Team continuam em seus caminhos `/settings`, preservando `location.search`, fechar com replace e retorno correto à entidade/lista filtrada.

## Etapas de execução após aprovação

1. **Congelar baseline integrado e coordenar i18n.** Conferir main e commits visuais, registrar capturas/URLs em1440,1056,1055,768,390 e320px, temas claro/escuro. Inventariar chaves i18n efetivamente existentes e arquivos reservados. Não começar reestruturação de `agents.tsx`, `teams.tsx`, `tasks.tsx` enquanto estiverem sob migração de textos.
2. **Extrair shell e migrar somente Task.** Primeiro testes de equivalência de estrutura, foco e estado; criar módulos acima, substituir containers sem trocar owners ou montagem. Manter seletores `data-detail-scroll`, âncoras e compatibilidade de altura durante a transição. Passar a largura/sticky/scroll genéricos antes de remover regras antigas; jamais manter duas regras conflitantes na versão entregue.
3. **Validar Task isoladamente.** Reexecutar cenários de filtros, conversa, planos, Timeline, summary e compact header. Comparar screenshots com baseline. Um commit revisável deve conter apenas extração e equivalência Task, permitindo revert independente.
4. **Migrar Agent.** Adapter com quatro abas e sidebar específica. Testar cada aba, configuração/autosave/conflito, deep links, retorno de times/tasks e lista filtrada. Preservar draft ao alternar idioma/resize/compact header; não exigir preservação de estado anteriormente descartado ao desmontar abas sem definir mudança separada.
5. **Migrar Team.** Shell sem navegação, sidebar específica; preservar propósito/contexto, liderança/membros, boards e seus pagers, configuração/autosave e retorno. Adicionar abas somente se aprovadas separadamente.
6. **Limpar compatibilidade e verificar conjunto.** Retirar `DetailPage` antigo apenas se não houver consumidores; localizar usos antes. Reduzir classes task-* genéricas e `:has` sem alterar listagens. Auditar traduções, acessibilidade e arquivos<1000 linhas. README descreve contratos/slots; commits separados por etapa e plano de rollback por entidade.

## Testes e critérios de aceite

Reaproveitar suites reais: `features/task-scroll-header.test.tsx`, `task-filter-layout.test.tsx`, `task-conversation.test.tsx`, `conversation-anchor.test.tsx`, `plan-navigation.test.tsx`, `plan-navigation-style.test.ts`, `components/settings-autosave.test.tsx`, `routing/entity-pages.test.tsx`, `navigation.test.tsx`, `slug-navigation.test.tsx`, `components/ui/dialog-motion.test.tsx`.

Adicionar testes de contrato em `components/detail-layout/detail-layout.test.tsx` e integração em `features/agent-detail-layout.test.tsx`/`team-detail-layout.test.tsx`. Os testes devem provar comportamento, não apenas existência de classes:

- Um h1 e landmarks nomeados; teclado nas abas, foco visível, disclosure mobile acessível; compact header invisível não alcançável por Tab; foco não roubado por refresh/idioma.
- Scroll principal e sidebar independentes desktop, documento mobile; resize em1055/1056 não perde conteúdo nem deixa foco dentro de área escondida. Header/abas não cobrem controles e filtros continuam no mesmo portal.
- URLs Task `tab` e Agent `agent.tab`, parâmetros das listas/pagers e `from` preservados em reload/back/forward. Team permanece sem aba. Slugs não mudam e UUIDs continuam nas chamadas.
- Task conversa não salta ao carregar, draft/âncora preservados conforme comportamento atual; planos não repetem reveal; seleção de Timeline por Event.id e resumo por ID mantêm gráficos/listas independentes.
- Agent: todas as quatro abas, vínculos, perfil, chats, retomada; Team: membros e boards paginados separadamente. Dados fornecidos pelo usuário não são traduzidos ou truncados de forma destrutiva.
- Estados loading, erro, vazio, dados parciais e arquivado apresentados pelo adapter/QueryState em slots apropriados; erro de seção não derruba sidebar/hero já carregados. Não duplicar consultas para preencher cópia compacta.
- Configurações abertas preservam formulário, versão/autosave, foco/restauração e `from`; Escape e fechar não provocam navegação extra. Testar selector de restauração de scroll com diálogo e página presentes.
- EN/PT, claro/escuro, reduced motion, nomes e Markdown longos,320/390/768/1055/1056/1440px: nenhum overflow horizontal de documento; barras de abas podem rolar deliberadamente. Comparação de screenshots e fluxos manuais, sem confiar somente em jsdom.

Por etapa: testes focados e `npm run build`. Ao concluir conjunto: suíte frontend completa, `cargo build` e `cargo test` no ambiente isolado apropriado; registrar separadamente o que exige PostgreSQL. QA de produto somente leitura; mutações de formulários em fixtures/ambiente de teste, sem seed/reset de dados reais.

## Riscos e dependências

| Risco | Mitigação/limite |
| --- | --- |
| i18n altera os mesmos arquivos | Integrar tokenização antes de mover código; coordenar reserva por arquivo. Preservar chaves e passar labels traduzidos ao layout, não hardcode de PT. |
| Scroll global depende de seletor/classe Task | Manter compatibilidade durante Task; migrar marcador deliberadamente por entidade, testar documento/painel/diálogo e popstate. |
| Remount descarta formulário/portal ou causa refetch | Slots/keys estáveis por UUID; não usar idioma, versão ou aba como key do shell; manter providers e hooks de domínio nos mesmos owners. |
| Copy compacta duplica controles/IDs | Conteúdo compacto específico e sem formulários duplicados; IDs useId; inert/aria-hidden quando invisível. |
| Team sem tabs difere do pedido de padronização | Compartilhar shell; navegação opcional. Qualquer taxonomia nova de abas fica explicitamente fora desta proposta. |
| Breakpoints/altura sticky variam com tradução | Medição local ResizeObserver; testar EN/PT, zoom e nomes longos; limpar observadores/variáveis ao desmontar. |
| Mudança visual remove funções | Matriz acima e testes existentes como gate por entidade; nada de simplificar domínio para caber no componente. |

## Limite de aprovação

Aprovar este plano autoriza a sequência incremental descrita, incluindo header visível e sidebar em Agent/Team, mantendo Team sem novas abas. Ainda não há autorização para implementar. Leader apresenta a proposta e registra aprovação ou ajustes; depois revalidar baseline/i18n e iniciar execução separadamente.
