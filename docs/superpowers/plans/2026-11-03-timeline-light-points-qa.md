# Gráfico Timeline com projeção leve

Extensão autorizada na tarefa Motion, plano revisão9. O gráfico deve carregar todos os pontos automaticamente por uma API própria, mantendo cards e índice independentes.

## Contrato e implementação

Backend confirmou `GET /api/v1/tasks/{taskId}/timeline-points`, projeção de cinco campos: `id` (Event ID), `taskId`, `type`, `occurredAt`, `sequence`. Page padrão, limite máximo100 e padrão50. Frontend usa100 e sequência asc; rótulos vêm do catálogo local. O evento completo só é consultado por ID ao abrir o popover por mouse/foco/clique.

`TimelinePointPages` carrega automaticamente `nextOffset` até `hasMore=false`, independente de IntersectionObserver, scroll da página ou botão. Mantém pontos já lidos e estado parcial explícito se houver erro; retry retoma a leitura. Total alterado, IDs repetidos, sequência regressiva, lacunas/offset parado ou fim truncado não podem produzir cobertura completa. Troca de tarefa aborta requisição anterior e isola cache. Cards completos preservam API, seleção e infinite scroll existentes. Nenhuma mudança na escala/rolagem horizontal do gráfico.

## Verificação

Testes incluem205 pontos/3 páginas automáticas, falha intermediária e retry, histórico vazio, dados inconsistentes, abort ao trocar tarefa, seleção por Event ID, todos os tipos e ausência de leitura de eventos completos antes de abrir o ponto. A regressão automática detectou uma dependência faltante do efeito entre páginas com resposta rápida; incluído `nextOffset`, e o caso passou.

Suíte frontend completa:406/406 em103 arquivos, com quatro workers. Build frontend e cargo build passaram;40 testes Rust unitários passaram. Revisão independente sem achados. PostgreSQL isolado não configurado nesta worktree; Backend valida seu contrato separadamente.

Durante a implementação, API59865 ainda retornava404 para o novo endpoint. QA real requer integração/restart coordenados pela Leader. Script isolado preparado em `.local/timeline-light-points-qa.cjs`; não substituir a resposta por dados simulados nem anunciar runtime atualizado sem verificar.
