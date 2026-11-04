# Cards de uso e Timeline — validação

Escopo aprovado na tarefa Motion: harnesses únicos com ícones; modelos por presença em resumos; índice/filtro Timeline e detalhes completos nos cards, sem modal. Base frontend `56a18fb`.

## Evidências

- Cards: Chromium headless isolado, build local, somente GET encaminhado à API real 59865; sem servidor adicional, sem writes, sem controlar a aba do usuário. Em 1440 e 390 px, claro/escuro, logos carregados, duas colunas desktop e uma mobile, sem overflow horizontal. Evidências locais `.local/qa/usage-cards/{1440,390}-{light,dark}.png` e `evidence.json`. Dados reais: Codex e modelo gpt-6-astra presente em 6/6 resumos no momento da coleta.
- Testes: paginação completa/erro, deduplicação por resumo e harness, vazio, tooltip acessível, seleção distante por Event ID, limpar/back, resumo/tracking exatos e detalhes inline. Presença não lê nem soma tokens.
- Revisão independente: corrigidos fallback de nomes que colidem com propriedades de Object e inclusão de entregas/pendências nos detalhes inline.
- Build frontend e cargo build aprovados; 40 testes unitários Rust aprovados. PostgreSQL isolado não configurado; não usar banco de produto para testes.
- Contratos frontend sincronizados com Backend `54bb400` e `1cb6e08`; geração de tipos não alterou schemas. API ativa ainda sem esses filtros durante a implementação.

## Aceite integrado pendente

Após integrar os dois commits Backend e atualizar runtime pela Leader: conferir Timeline em claro/escuro, desktop/mobile; índice seleciona um único card; limpar e back/forward; atalho do gráfico usa Event ID; resumo distante não percorre páginas; detalhes completos e links; infinite scroll e descendentes; tooltip sem botão Fechar e sem modal. Não concluir a tarefa sem aceite do usuário.
