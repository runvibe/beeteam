# Cards de uso e Timeline — validação

Escopo aprovado na tarefa Motion: harnesses únicos com ícones; modelos por presença em resumos; índice/filtro Timeline e detalhes completos nos cards, sem modal. Base frontend `56a18fb`.

## Evidências

- Cards: Chromium headless isolado, build local, somente GET encaminhado à API real 59865; sem servidor adicional, sem writes, sem controlar a aba do usuário. Em 1440 e 390 px, claro/escuro, logos carregados, duas colunas desktop e uma mobile, sem overflow horizontal. Evidências locais `.local/qa/usage-cards/{1440,390}-{light,dark}.png` e `evidence.json`. Dados reais: Codex e modelo gpt-6-astra presente em 6/6 resumos no momento da coleta.
- Testes: paginação completa/erro, deduplicação por resumo e harness, vazio, tooltip acessível, seleção distante por Event ID, limpar/back, resumo/tracking exatos e detalhes inline. Presença não lê nem soma tokens.
- Revisão independente: corrigidos fallback de nomes que colidem com propriedades de Object e inclusão de entregas/pendências nos detalhes inline.
- Build frontend e cargo build aprovados; 40 testes unitários Rust aprovados. PostgreSQL isolado não configurado; não usar banco de produto para testes.
- Contratos frontend sincronizados com Backend `54bb400` e `1cb6e08`; geração de tipos não alterou schemas. API ativa ainda sem esses filtros durante a implementação.

## Validação real após integração

A Leader confirmou os contratos integrados e runtime59865 recompilado, mantendo `.local/beeteam.sqlite`. Chromium headless isolado validou o build local contra essa API real em1440/390px, claro/escuro: seleção pelo gráfico do Event ID `01a1a35c-c149-7d70-adfe-bd6319477a9b` retornou um único card, detalhes completos inline, zero modais, nenhum overflow horizontal, limpar voltou à lista e back restaurou a seleção. Índice visível no desktop e oculto no mobile. Evidências `.local/qa/timeline/{1440,390}-{light,dark}.png` e `evidence.json`.

O registro de rede contém somente GETs200, seleção `timeline?...&id=01a1a35c-c149-7d70-adfe-bd6319477a9b` em offset0, tracking `summaryId=01a1a35c-c144-7de1-aaba-92d3aaa8b8af&offset=0&limit=1` e resumo `id=01a1a35c-c144-7de1-aaba-92d3aaa8b8af&limit=1`. Sem varredura de páginas para seleção distante. Primeira tentativa do script teve erro de encerramento de contexto com requests pendentes; corrigido cleanup com unrouteAll, e as quatro execuções finais passaram.

Reexecução dos12arquivos frontend afetados:51/51 testes, mais um teste HTTP novo (52 distintos); build final aprovado. A suíte ampla anterior tinha374/381, com falhas de501 esperado da demo e testes que ainda esperavam tooltip completo/varredura de resumo, todos corrigidos e revalidados nos arquivos afetados. Suíte completa integrada é executada pela Leader separadamente.

## Aceite do usuário pendente

Validação técnica não conclui a tarefa. Manter Em revisão para aceite do usuário; integração/publicação e testes completos da Leader são evidências separadas.

## Regressão de ponto único: todos os tipos de eventos

Relato da Leader no comentário `01a1a3f9-0934-7610-b014-9aeab6281fa9`. Caso real informado: `/tasks/implementar-agente-node-e-transporte-de-tuneis?tab=timeline`, resolvido pelo endpoint tipado para `01a1927c-9840-7cc0-8189-1a501c846fec`. Somente leitura dessa tarefa.

Causa: o gráfico consultava `types=execution.recorded`, embora a Timeline contenha outros eventos. A API real retornou 17 eventos (7 comentários, 5 atualizações, 1 resumo, 1 plano, 1 revisão de plano, 1 posição e 1 subtask); tracking explícito vazio. Não houve perda de dados nem necessidade de inferir vínculos legados. Removido o filtro de tipo, preservando Event ID, ordem de sequência, paginação explícita e isolamento de `timeline.selected` em relação ao gráfico. A chave de cache distingue a consulta de todos os eventos da antiga consulta de resumos.

Teste de regressão falhou com 1 ponto em vez de 4 antes da correção e passou depois. Cobertura adicional de 21 eventos em duas páginas, seleção de comentário por Event ID e preservação dos pontos ao selecionar. Os 15 testes dos cinco arquivos afetados passaram; build frontend, cargo build e 40 testes Rust unitários passaram. PostgreSQL isolado continua indisponível; não houve alteração backend.

Chromium isolado com build corrigido e API real59865, somente GET: em1440/390px, claro/escuro, caso XYZ mostrou17/17 pontos; Motion mostrou49/49 após carregar três páginas. Seleção de evento histórico retorna um card sem reduzir pontos, limpar/back funcionam, sem modal/overflow de documento. Resumos mostrou1 ponto explícito de progresso no caso XYZ e7 em Motion, exatamente como overview. Screenshots inspecionados, rolagem horizontal interna preservada. Evidências locais `.local/qa/timeline-regression` e `.local/qa/timeline-motion-regression`, cada uma com `evidence.json` e capturas. Nenhum restart ou controle da aba do usuário; integração do novo commit cabe à Leader.
