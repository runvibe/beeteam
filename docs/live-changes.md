# Notificações de mudanças persistidas

GET `/api/v1/changes`, Content-Type `text/event-stream`, mesma política CORS da API local. Não exige ator para leitura. Exemplo:

```text
event: reset
retry: 3000
data: {"scope":"all"}

event: invalidate
retry: 3000
data: {"scope":"all"}
```

A conexão inicial sempre exige refetch. Reconexão do cliente, recuperação do listener PostgreSQL e overflow da fila de64 mensagens também exigem refetch. Não há IDs duráveis/Last-Event-ID ou promessa de entrega de todos eventos. Evento `heartbeat` observável a cada15segundos sem outras mensagens, com o mesmo payload mínimo scope all. Não invalida dados; serve apenas à liveness. Cliente reinicia conexão/refetch após45segundos sem heartbeat/reset/invalidate, cobrindo proxy half-open que não emite erro. Consumidor faz debounce de bursts, invalida consultas ativas e não apaga drafts; conflito de edição continua usando versão/If-Match. Nova conexão substitui a anterior ao desmontar/trocar API. Sem polling de dados e sem strings/IDs sensíveis no evento.

UnitOfWork compara registros antes/depois e agenda pg_notify na mesma transação. PostgreSQL publica somente após commit, incluindo constraints diferidas. Todos adaptadores HTTP/MCP e compostas compartilham esse limite: uma notificação por transação alterada, nenhuma por leitura/replay/rollback/no-op. Abrange boards/statuses/tasks/subtasks/plans/revisions/comments/files/results/agents/teams e referências. Não cobre writes SQL arbitrários fora do aplicativo. Fanout é compartilhado por AppState, usando uma conexão PG; cada assinante consome fila bounded, encerrada ao desconectar. Listener é abortado ao liberar o estado. Perda de conexão recupera LISTEN e emite reset antes de continuar. O mecanismo é sinal de invalidação, não histórico/auditoria.

Testes em PostgreSQL isolado verificam entrega depois de commit, ausência antes de commit/rollback/replay/leituras/erros, reset em reconexão com cursor antigo, entrega SSE e recuperação após término da conexão LISTEN. Nenhum teste cria dados no banco do painel.

A conexão PostgreSQL fica encapsulada em ChangeRepository. O serviço coordena fanout/reconexão; route só formata SSE e o DTO define payload. O header X-Accel-Buffering:no solicita streaming a proxies compatíveis. futures-util usa a versão0.3.32 já presente no lock, sem atualização das dependências transitivas.
