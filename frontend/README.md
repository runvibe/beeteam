# Bee Team — frontend demonstrativo

React + Vite + TypeScript + shadcn/ui (Radix) + Zustand. Esta entrega usa **API mockada em memória**, sem autenticação, login, tokens ou conexão com IA/backend. Dados fictícios e alterações reiniciam ao recarregar a página.

## Executar

Requer Node 22.12+ (validado com 22.19) e npm.

```sh
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```

Acesse http://127.0.0.1:5173. Produção estática: `npm run build`; prévia: `npm run preview -- --host 127.0.0.1`.

## O que está disponível

- Boards com busca, time gestor, ativos/arquivados; Kanban com filtros de título, executor, bloqueio e data de atualização. Todas as colunas são mantidas; continuação usa offset/limit por coluna e conserva os filtros.
- Task com autor/executor, status, progresso, bloqueio, filhos reais em todos os boards, navegação recursiva por filho/pai, planos e revisões, comentários, arquivos demonstrativos para download, resumos/entregas/pendências e timeline com descendência opcional.
- RA com busca, papel, time e arquivamento. Perfil, vínculos, regras/limites, contexto resumido, atividades por autoria/execução/resumo, referências externas de chats e contexto de retomada. Metadados de time, membros e boards geridos.
- Configuração de nome/descrição/modo do board, modo individual da task, perfis (incluindo imagem por URL HTTPS), metadados dos times e criação/renomeação/conclusão/ordenação de status.
- Loading, vazio, erro com retry, validação de texto/versão, feedback de gravação, teclado e layout para navegador comum e largura estreita.

Não há despacho, criação/atribuição de tasks, composição operacional de times ou botão de aprovação. Essas ações permanecem na conversa/harness. As datas são registros, não heartbeats. A UI não simula identidade autenticada ou permissões de líder ainda pendentes.

## Domínio e autonomia

Sem workspace. Board tem um time gestor e criador preservado. Tasks têm authorAgentId/executorAgentId obrigatórios, sem teamId. Os filhos podem pertencer a outros boards e executores, sem limite fixo de profundidade. O mock deriva a raiz iterativamente e detecta ciclos, sem duplicar estado de checklist.

O board de origem da raiz governa a cadeia: manual força manual; automatic força automático; standard usa a flag da task atual sem herdar a do pai. O cálculo não altera flags dos destinos. A UI diferencia configuração salva de modo efetivo. Mudar a flag sob origem manual/automatic não modifica essa precedência.

## Contratos e adapter

`contracts/` contém uma cópia de referência dos seis documentos fonte revisados em 27/10/2026. Não é a fonte central e não deve substituir `docs/` na integração. `npm run generate:types` gera os 81 schemas em módulos pequenos em `src/api/generated/`.

`BeeApi` em `src/api/types.ts` é a porta tipada consumida pelas features; `ApiProvider` injeta o adapter e isola o cache por instância. `createMockApi()` é a implementação demonstrativa. `seed.ts` contém fixtures UUID v7, inclusive hierarquia com quatro níveis e filhos entre boards. A configuração usa IDs v7 novos e controle de versão. Registros removidos são filtrados por deletedAt; arquivamento é distinto.

O mock implementa as operações consumidas por esta UI, não todo o CRUD operacional OpenAPI nem um servidor HTTP. Um futuro adapter HTTP pode substituir `createMockApi()` em `main.tsx`, preservando a interface. Não foi implementado nesta entrega. Deve mapear versões para ETag/If-Match, idempotência para POST, downloads e paginação exatamente conforme contratos. Não inserir login/tokens. Autoria human/agent declarada não é identidade verificada.

TanStack Query mantém apenas cache/estado remoto. Zustand guarda navegação/UI; nenhuma entidade é persistida nele ou em localStorage. O mock é a fonte de dados desta sessão.

### Limites explícitos desta entrega

- Nenhuma integração real com backend, PostgreSQL ou MCP foi executada.
- Configuração de imagem usa URL HTTPS; o formulário não envia uploads. Imagens já enviadas são lidas pelo adapter e exibidas com URL de objeto revogada ao desmontar. O mock usa um PNG demonstrativo para testar esse caminho.
- O mock não pretende reproduzir todas as condições de armazenamento/concor­rência do servidor nem implementar operações operacionais ausentes da UI.

## Verificação

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

53 testes cobrem schemas JSON Schema 2020-12 dos registros/projeções, filtros/paginação, versões, exclusão lógica, autonomia de origem, filhos cross-board, status e navegação/erros. Revisão visual realizada via navegador em desktop e viewport de 390×844.

Na raiz, `cargo build --locked` passou. `cargo test --locked`: 12 unitários passaram; 3 integrações falharam ao criar container PostgreSQL por Docker indisponível (`CreateContainer`, erro de sistema 2). Nenhum arquivo Rust foi alterado. Isso não confirma execução integrada.

Consulte `PROGRESS.md` para checklist e evidências finais. Não houve merge, push ou deploy.

## Aparência

O seletor Tema no topo oferece Sistema, Claro e Escuro. Na primeira visita, Sistema segue a preferência do sistema operacional e reage às mudanças. A escolha explícita é salva em localStorage (`beeteam.theme`) e prevalece após recarregar. Voltar a Sistema reativa o acompanhamento. Se o armazenamento estiver bloqueado, a troca funciona apenas na sessão. Entidades continuam somente no mock.

Um script síncrono no head aplica a classe e color-scheme antes do React; as paletas semânticas ficam centralizadas em index.css. Testes exercitam o bootstrap real e o controlador, incluindo armazenamento indisponível. Verificação manual confirmou Claro/Escuro após recarga, controles e conteúdo em desktop e viewport estreito; não foi feito ensaio de rede artificialmente lenta.


### Redesign compacto monocromático

Sidebar reduzida, breadcrumb navegável e caminho de ancestrais entre boards, cards com avatar e metadados essenciais, filtros recolhíveis em telas estreitas e ação de limpar filtros. Detalhes usam painel lateral (tela inteira em largura estreita), mantendo semântica modal, foco e conteúdo; o board permanece visível, mas inerte enquanto o painel está aberto. Times mostram composição antes do editor de metadados. Estados continuam escritos, sem depender de cor.

O CSS fornecido é a base: Inter, Playfair Display e JetBrains Mono instaladas localmente; espaçamento 0,29rem, sombras e escala neutra preservados. Exceções: branco puro vira oklch(0.985 0 0), cores cromáticas ficam cinza, sidebar-primary escuro usa primary neutro e raios negativos são limitados a zero. O layout compacto tem medidas próprias; não altera a escala de utilitários do tema. Cards usam raio de 2px e shadow-sm. A versão inicial divergente usava Geist, cinzas substitutos, spacing de 0,25rem e removia sombras; isso foi corrigido e conferido nos estilos computados após recarga completa.
