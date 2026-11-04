# Bee Team RA — plano do contrato

27/10/2026. Revisão somente documental. Frontend/backend/skills pausados. Fonte formal: [ra-openapi.yaml](ra-openapi.yaml); [spec](../bee-team-spec.md) e [Kanban](kanban-api-plan.md).

## Agentes e times

Perfil único persistente por agente, independente de chats. No máximo um papel colaborador e um papel líder, em times diferentes; exatamente um líder por time. Os papéis podem coexistir, sem gerente especial. Time agrupa agentes e pode gerir vários boards. Task não possui time; seu autor e executor são agentes.

Perfil: nome, imagem opcional, atuação, estilo/instruções, regras, limites e contextSummary explícito. Sem campo de skills ou transcrição integral. Limites reais de ferramentas pertencem ao harness. Board.createdBy registra criador declarado; Task.authorAgentId e executorAgentId são agentes obrigatórios. O cadastro do agente não depende de sua atribuição atual.

## Arquivamento, transferência e cópia

Arquivar time preserva time, agentes, vínculos e histórico; não libera participação automaticamente. Composição pode transferir agente explicitamente mesmo saindo de time arquivado. Não exigir que ele abandone tasks nem mover/reassignar tasks para permitir transferência. Identidade, autoria e acesso às informações das tasks permanecem.

POST /team-composition-changes envia estados finais dos times tocados e versões. Transação única com unicidade de papéis e líder obrigatório, incluindo origem arquivada; times omitidos intactos. Não impor constraints task-time ou board-executor. Ciclos de liderança são proposta separada a revisar, não confundir com ciclos parentais de tasks (inválidos por definição). Times distintos podem ter agentes com atividades em qualquer board.

Cópia cria nova identidade independente e reaproveita perfil; contextSummary entra somente quando fornecido a pedido do usuário, omitido vira vazio. Não duplicar autoria de atividades, chats, tasks ou histórico interno. Imagem local copiada como snapshot independente; referência externa copiada como valor. Transferir a mesma identidade usa composição, não cópia.

## Retomada e atividades

Referência de chat é metadado de sessão externa, sem criar/controlar sessão. externalId é string opaca, não UUID obrigatório. Retomada do agente usa seu perfil/contexto e links para tasks/resumos. Entregar uma task a outro executor não copia contexto/histórico interno do agente anterior.

GET /agents/{id}/activities é projeção de tasks reais: authored (autor), executing (executor atual), worked (autor declarado de resumo), any (união sem duplicação). Não incluir atividade alheia só por liderança. Não duplicar histórico: taskPath e summariesPath usam API Kanban. Informações das tasks são públicas localmente e não dependem do time atual.

Board gestor pode ser transferido pelo PATCH de board, com evento e sem alterar tasks. Isso não cria relação direta entre time e task.

## Coordenação e autonomia

A task fornece executionContext com rootTaskId/originBoardId da cadeia principal. Board de origem tem manual/standard/automatic; task tem manual/automatic. Origem manual força manual; automatic força automático; standard usa somente flag individual da task atual, inclusive descendente em outro board, sem herdar automático do pai. Consultar API Kanban. As consultas de perfil e contexto de time não criam um modo global de execução. Sem contexto de execução, aprovação/manual.

O líder organiza distribuição por agentes geridos; seu alcance para editar tasks de um executor gerido, independentemente do autor, está pendente. Não há permissão confirmada de 'líder do time da task'. Usuário pode reatribuir executor. Toda leitura de informação de task permanece disponível, sem autenticação.

## Rotas

Prefixo /api/v1. Perfis/times são coleções diretas. Arquivar/restaurar não remove fisicamente registros. POST de composição é comando 200; demais POST 201; DELETE de imagem é lógico, 204.

| Método e path | Operação |
|---|---|
| GET `/agents` | Listar agentes |
| POST `/agents` | Criar perfil único sem vínculo |
| GET `/agents/{agentId}` | Consultar perfil e vínculos |
| PATCH `/agents/{agentId}` | Editar perfil compartilhado |
| PUT `/agents/{agentId}/archive` | Arquivar ou reativar perfil |
| POST `/agents/{agentId}/copies` | Copiar perfil para novo colaborador |
| POST `/agents/{agentId}/image` | Enviar ou substituir imagem |
| DELETE `/agents/{agentId}/image` | Remover imagem atual |
| GET `/agents/{agentId}/image/content` |  |
| GET `/teams` | Listar times |
| POST `/teams` | Criar time com líder e membros |
| GET `/teams/{teamId}` | Consultar time |
| PATCH `/teams/{teamId}` | Editar propósito e contexto do time |
| PUT `/teams/{teamId}/archive` | Arquivar ou reativar time |
| GET `/teams/{teamId}/members` | Listar líder e colaboradores |
| POST `/team-composition-changes` | Alterar composição ou transferir entre times atomicamente |
| GET `/agents/{agentId}/chat-references` | Listar referências de chats |
| POST `/agents/{agentId}/chat-references` | Registrar referência a chat externo |
| PATCH `/agents/{agentId}/chat-references/{chatReferenceId}` | Editar ou arquivar referência |
| GET `/agents/{agentId}/activities` | Consultar índice de tarefas e resumos do agente |

## Convenções comuns

Sem autenticação, tokens ou controle de identidade verificada. Todas as informações das tasks são consultáveis por todos. X-Actor-Kind human/agent e X-Actor-Id (obrigatório para agent) são proposta de autoria declarada para auditoria; não são credenciais. O servidor confere existência/coerência, mas qualquer cliente pode declarar outro agente. O contexto de autor de requisição não substitui o autor/dono obrigatório da task.

Backend Rust existente, PostgreSQL >=18. IDs persistidos são UUID v7; externalId de chat/harness continua texto opaco. Exclusão lógica usa deleted_at/JSON deletedAt; preservar registros, referências históricas e bytes físicos. archivedAt é lifecycle separado. GET de excluído retorna 404; listas excluem registros removidos por padrão, salvo filtro explícito de tombstones de anexos. Nenhum DELETE remove fisicamente dados.

offset padrão 0 (0..2147483647), limit padrão 50 (1..100). Listas: {items,offset,limit,total,hasMore,nextOffset}; total após filtros/exclusão lógica; hasMore=offset+items.length<total, nextOffset=offset+items.length se houver mais, senão null. Além do total: lista vazia. Ordenação por allowlist e ID de desempate na mesma direção; não há snapshot entre páginas.

Filtros compõem AND. Buscas de nome/título/arquivo são substring literal case-insensitive; escapar %, _ e barra invertida em SQL parametrizado. Datas From inclusivas, Before exclusivas, RFC3339 com timezone e From<Before. Repetidos, desconhecidos, enums/IDs/ranges inválidos são 400. Arrays CSV somente onde declarados (types). Arrays embutidos pequenos não são paginados.

POST exige Idempotency-Key UUID (chave de requisição, não ID persistido de entidade): 24h por rota/contexto declarado/conteúdo; replay idêntico não duplica registro, conteúdo diferente 409. PATCH/PUT/DELETE e conteúdo da task exigem If-Match; ausência 428, divergência 412. Batch de composição usa expectedVersion em cada time e 409 para conflito. Criar filho usa versão do pai, mesmo cross-board. Campos desconhecidos são rejeitados; PATCH omitido preserva, null somente onde permitido.

Erros {error,code,details}: 400 entrada/contexto inválido; 404 inexistente/excluído; 409 conflito estrutural, contexto, estado ou idempotência; 412/428 versão; 413 limite; 415 mídia; 500/503 interno/storage sem detalhes sensíveis. Não há 401/403 nem bloqueio baseado em suposta identidade autenticada.

## Filtros e detalhes de transporte

Agentes: nome, vínculo teamId/role, archived, datas. Times: nome, leaderId/collaboratorId, archived, datas. Members: nome/papel. Chats: label, harness, archived, datas. Atividades: boardId, título, status, relation, archived da task, datas; sem filtro de time herdado nas tasks.

Upload de imagem: até 5 MiB, multipart 6 MiB, PNG/JPEG/WebP validados por conteúdo; sem SVG/geração de IA. URL externa HTTPS é armazenada sem fetch servidor. DELETE marca deleted_at e limpa vínculo corrente sem apagar bytes físicos, preservando cópias independentes. APIs de perfil não implementam identidade/autenticação.

Agente/time/reference possuem version/ETag; mutação de referência atualiza também versão do agente. Transferência em lote valida expectedVersion de todos times. Arquivamento de agente é lifecycle próprio; regras de pré-condição propostas devem ser revisadas sem introduzir restrição de transferência baseada em suas tasks. Nunca retirar autoria de atividades para satisfazer lifecycle.

## Exemplos e implementação futura

GET /api/v1/agents?name=carlos&role=leader&offset=0&limit=25
GET /api/v1/agents/10000000-0000-7000-8000-000000000010/activities?relation=worked&title=api&offset=0&limit=50

O YAML contém exemplos de perfil, composição, cópia com resumo solicitado e referências externas. Não iniciar implementação nesta revisão. Após autorização, manter camadas API Rush e validar transação/cardinalidades/versões, transferência de origem arquivada sem efeito nas tasks, contexto isolado por agente, leituras sem duplicação e exclusão lógica. Política de edição pelo líder permanece pendente.

## Slugs de agentes, times e tasks

Agent.slug, Team.slug e Task.slug (incluindo subtasks) são gerados, sempre presentes e não editáveis. UUIDv7 permanece identidade interna e parâmetro das APIs existentes. Boards não possuem slug. Resolvers GET /api/v1/agents/by-slug/{slug}, /teams/by-slug/{slug}, /tasks/by-slug/{slug} retornam {id,slug}; no MCP: resolveAgentSlug/resolveTeamSlug/resolveTaskSlug com params.slug. Usar o UUID retornado nas APIs/prompts seguintes; não enviar slug onde se exige UUID. Retorno404 para ausente/excluído; arquivados continuam resolvendo. Formato inválido ou não canônico retorna400; não há redirect/normalização implícita no resolver.

Normalização única no PostgreSQL: lowercase+NFKD, remoção de marcas combinantes U+0300..036F, ß/æ/œ para ss/ae/oe, demais caracteres fora de a-z0-9 viram separador, hifens colapsados/sem bordas. Nomes sem caracteres úteis usam agent/team/task; não há transliteração universal de alfabetos não latinos. Máximo80 caracteres ASCII, truncando base para caber sufixos -2,-3... . Reservados new/edit/create/by-slug/resolve/search/archive/settings/api/mcp/agents/teams/tasks e strings em formato UUID recebem prefixo agent-/team-/task-.

Slugs são estáveis ao renomear e únicos por tipo, inclusive archived/deleted. Excluídos nunca liberam o nome para outra identidade; cópia cria novo slug. Migration006 usa created_at,id para backfill determinístico, incluindo tombstones sem alterar conteúdo prévio, versão ou datas. Coluna gerada/index único/trigger de imutabilidade e lock transacional coordenam concorrência. Resolvers consultam índice diretamente, sem snapshot completo ou enumeração de listas. A geração e o backfill compartilham a mesma função SQL, sem algoritmos divergentes.

Replays históricos sem slug ganham o slug canônico imutável do registro correspondente, inclusive tombstones; conservam a versão e demais campos do snapshot original. Não se reconstrói slug pelo nome antigo nem atual. Sem auth/políticas novas; alteração visual/integração frontend não validada nesta frente.
