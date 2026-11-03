# Índice compacto e filtro de resumos

## Objetivo aprovado
Na aba Resumos, substituir a tabela lateral por uma lista de itens clicáveis com título e barra de progresso abaixo. Selecionar um item aplica o filtro de resumo nos controles existentes e mostra somente aquele resumo à direita, sem rolar nem buscar páginas intermediárias. Limpar o filtro restaura a lista paginada. A Visão geral mantém somente o gráfico.

## Decisões
- Identidade sempre pelo ID do resumo; nunca aproximar por data, percentual ou texto.
- Reutilizar TaskFilters, FilterBar, Choice/FilterPopover, tags removíveis e o comportamento mobile existente. URL summaries.selected é a fonte do filtro; limpar, voltar e avançar precisam funcionar.
- O índice permanece independente do filtro de conteúdo, permitindo selecionar outro registro.
- Resumos não têm título próprio: usar texto curto derivado da primeira linha não vazia, exibido como texto simples; fallback Resumo de [data]. Não criar campo persistido nem usar HTML. Texto completo fica no conteúdo Markdown.
- A barra só usa progresso explicitamente vinculado ao resumo. Ausência aparece vazia, nunca como zero. Registros antigos sem vínculo não ganham links inventados.
- Preferir índice paginado da coleção real de resumos, não limitar silenciosamente ao feed de progresso da Visão geral. Se não houver progresso associado, manter o item com barra vazia. Mesma fonte de dados pode aproveitar cache sem contaminar a consulta filtrada.

## Backend — responsável: chat Bee Team Backend
1. Confirmar contrato atual de listExecutionSummarys. Adicionar filtro opcional id UUIDv7, combinado com taskId e demais filtros antes de count/paginação. Avaliar reutilização do predicado genérico já existente nos adaptadores SQLite/PostgreSQL; sem migração se desnecessária.
2. Documentar OpenAPI e regenerar catálogo MCP; HTTP/MCP devem produzir o mesmo resultado. ID de outra tarefa ou excluído não deve vazar registro; ID inválido retorna erro de validação.
3. Testes com vários resumos: selecionar registro fora da primeira página retorna só ele com total 1, inexistente retorna vazio, tarefa incorreta vazio, UUID inválido rejeitado, paridade MCP.
4. Cargo build e testes focados SQLite; PostgreSQL somente isolado se disponível (usuário dispensou testes PG nesta entrega, registrar limite). Não usar banco real nem reiniciar API.
5. Commit próprio e disponibilizar contrato ao Frontend.

## Frontend — responsável: chat Bee Team Frontend
1. Atualizar contrato cliente e mock id; TaskRecordList deve incluir id na queryKey/consulta de resumos e remover procura sequencial e scroll automático do selecionado.
2. Criar componente coeso summary-index.tsx: lista compacta de botões com título e barra abaixo, estado selecionado, foco teclado, responsividade; nenhuma tabela nem ícone extra necessário. Buscar índice completo por paginação própria; mostrar carregamento/erro sem esconder conteúdo válido.
3. Inserir filtro Resumo no TaskFilters/FilterBar existente. Clique no índice altera summaries.selected; remover tag ou limpar desativa filtro. Seleção fora da página consulta diretamente pelo ID. Evitar respostas antigas sobrepondo seleção rápida.
4. Atualizar tasks.tsx para usar índice novo na coluna esquerda, cards na direita, gráfico acima; mobile empilha mantendo controles padrão.
5. Testes: escolher resumo distante não percorre páginas de conteúdo; troca rápida, limpar, URL inicial, back/forward, não encontrado e erro; título sem HTML, progresso ausente versus zero; índice permanece visível ao filtrar; teclado e mobile.
6. Build/typecheck, testes focados e verificação visual quando disponível; README e commit. Não reiniciar API ou alterar dados reais.

## Integração
Integrar entregas na branch de integração atual, validar contrato e UI juntos. Atualização da API necessária para novo filtro deve ser comunicada separadamente da publicação de código. Não afirmar validação visual quando indisponível. Sem merge main neste pedido.

## Estado inicial e cuidado com checkout
Base publicada: 056beea na branch codex/integrate-conversation-scroll. Existem seis alterações locais preliminares NÃO testadas no checkout principal: docs/kanban-openapi.yaml, frontend/contracts/kanban-openapi.yaml, frontend/src/api/mock.ts, frontend/src/api/types.ts, frontend/src/features/task-record-list.tsx e frontend/src/features/tasks.tsx. A importação summary-index é incompleta. São rascunho desta demanda, não entrega. Os colaboradores devem implementar em seus worktrees a partir da integração atual; a coordenação preservará o rascunho fora do código ativo antes da integração. Não sobrescrever trabalhos alheios.
