# Live updates after a commit

`GET /api/v1/changes` returns a server-sent event stream using the API’s CORS policy. A new connection emits `reset`; a committed change emits `invalidate`. Both carry `{"scope":"all"}` and request a three-second retry. A heartbeat after 15 idle seconds signals liveness without invalidating data.

The frontend refetches after reset or reconnection, debounces bursts of invalidations and preserves unsaved edits. A 45-second gap triggers reconnection to recover a half-open stream. The stream has no durable cursor, and queue overflow produces a reset. Consumers that need history should read the task records.

Repository adapters publish after a successful changed transaction. Reads, no-ops, rollbacks and idempotent replays do not produce changed records. PostgreSQL uses a transaction-scoped notification and a shared listener; SQLite uses committed in-process changes. The service manages fanout and reconnects; the route formats SSE. Arbitrary SQL executed outside Bee Team is outside this notification contract.
