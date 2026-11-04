# Cards da Timeline e faixa da Visão Geral

Base: `main` em `5e311b1`, branch `codex/timeline-event-cards`. Extensão autorizada na tarefa Motion e plano revisões6/7: detalhes completos legíveis para eventos variados, composição visual igual a Resumos, gap menor no cabeçalho do gráfico e subtarefas à esquerda dos cards de uso empilhados.

## Implementação

- Módulos próprios para card, apresentação de campos e leitura de referências; `tasks.tsx` só escolhe o componente.
- Comentário pelo endpoint exato com validação de task/ID; revisão de plano por ID histórico ou número explicitamente registrado, com paginação protegida; anexos por ID incluindo removidos. Nenhuma associação temporal ou substituição pelo estado atual.
- Markdown completo com o renderizador seguro existente; campos alterados mostram antes/depois e valores zero/false. IDs/status ausentes não ganham valores inventados. Registro original recolhido permanece para inspeção técnica.
- Revisão independente encontrou falta da tarefa de origem e da síntese acumulada do evento de execução. Ambos corrigidos com regressão red/green e reconferidos pelo revisor. Nome atual da tarefa identifica sua origem; payload histórico não é reescrito.
- Grid de Visão Geral reutiliza lista compacta/percentuais e cards existentes sem duplicação. Desktop duas colunas; harness sobre modelos; mobile coluna única.

## Validação real

Chromium headless isolado, build local e GETs encaminhados à API real59865; sem novo servidor, writes em dados de QA ou controle da aba do usuário. Tarefa `implementar-agente-node-e-transporte-de-tuneis` resolvida anteriormente para `01a1927c-9840-7cc0-8189-1a501c846fec`. Sete tipos reais selecionados por Event ID: comentário, criação/revisão de plano, atualização, posição, criação de subtask e execução. Em1440/390px e claro/escuro, conteúdo legível dentro de um card, revisão correta, origem visível, ausência de overflow. Gap do cabeçalho4px. Capturas mobile e desktop inspecionadas.

Visão Geral validada com vazio/uso registrado na tarefa Motion e com cinco subtarefas reais do XYZ Proxy (`coordenar-entrega-do-xyz-proxy`). Lista e percentuais preservados. Desktop: duas colunas517px, subtarefas emx68 e uso emx609; mobile: coluna298px com subtarefas, harness e modelos em sequência. Evidências ignoradas pelo Git em `.local/qa/timeline-cards/evidence.json` e capturas por tipo/tamanho/tema. Nenhum mock ou seed inserido na API.

## Verificação automatizada e limites

Novos testes cobrem Markdown/sanitização, histórico antes/depois, revisão antiga em outra página, referências ausentes/estrangeiras, anexos removidos, criação/atribuição/bloqueio/arquivo/restauração, fallback desconhecido, origem e síntese de execução. Build frontend e cargo build passaram;40 testes Rust unitários passaram. PostgreSQL isolado não configurado; não usado banco de produto para testes.

Uma primeira suíte ampla apresentou três timeouts sob concorrência e uma expectativa incorreta de identidade de AbortSignal (o transporte combina sinais); expectativa corrigida e arquivos afetados passaram. Uma execução seguinte coincidiu com o novo teste red da revisão; seu resultado não representa o código final. A suíte final estável (`npm test -- --maxWorkers=4`) passou integralmente:396 testes em102 arquivos, incluindo12 testes dos novos cards. Build final frontend aprovado após as correções de revisão.

Integração do commit e aceite do usuário permanecem separados desta validação técnica; não concluir automaticamente.
