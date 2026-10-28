# Bee Team RA — plano e contrato de API

Estado: design proposto em 27/10/2026, sem implementação. Artefato principal: [ra-openapi.yaml](ra-openapi.yaml), OpenAPI 3.1. Base funcional: [spec](../bee-team-spec.md). Integração: [Kanban](kanban-api-plan.md). A spec foi atualizada antes deste contrato.

## 1. Decisões confirmadas

Um perfil e uma identidade por agente. Cada agente ocupa no máximo um papel de colaborador e um de líder, podendo acumular ambos somente em times diferentes. Cada time tem exatamente um líder. Carlos pode liderar tecnologia e colaborar em coordenação. Não existe novo papel de gerente.

Cópia solicitada manualmente reutiliza o perfil e cria nova identidade independente, sem chats, tarefas, histórico ou credenciais. Não é necessária para acumular os dois papéis permitidos. Perfil persiste independentemente dos chats. A aplicação não cria/controla chats, nem gera imagens por IA. Não há skills no perfil nem transcrições integrais.

Todos os detalhes abaixo — rotas, autenticação, políticas de edição/leitura, arquivamento, ciclos, limites e persistência — são propostas técnicas. Preservam o Kanban: colaborador só altera sua própria tarefa; líder pode alterar todas as tarefas de seu time.

## 2. Modelo e invariantes

`Agent` possui `name`, `roleDescription`, `workStyle`, `workInstructions`, `rules`, `accessLimits`, imagem opcional e vínculos derivados `collaboratorTeamId`/`leaderTeamId`. Estes vínculos não são editáveis no PATCH do perfil. `agentId` é a identidade usada como `assigneeId`/`collaboratorId` no Kanban; `actorId` identifica o principal autenticado e tem mapeamento persistente para agente, inclusive histórico de credenciais revogadas. Não depender de token atual para reconhecer autoria antiga.

`Team` pertence ao workspace, contém `leaderId` obrigatório, nome, propósito e contexto. A lista paginada `/members` inclui o líder e os colaboradores; o resumo do time contém `collaboratorCount`. Não embutir arrays potencialmente grandes em todas as respostas. Agente sem vínculos é válido; time sem líder não é.

Proposta de enforcement:

1. FKs garantem mesmo workspace e identidade existente; unicidade de leaderId nos times garante no máximo uma liderança por agente; unicidade de agentId nos vínculos de colaboradores garante no máximo um time nesse papel.
2. Toda composição valida líder diferente dos colaboradores do mesmo time, agentes ativos e estado final global, inclusive times omitidos. Aplicar alterações em transação, com bloqueio de composição por workspace e constraints diferíveis onde a troca exigir; checar versões antes de escrever. Constraints/locks devem também cobrir criação, cópia, arquivamento e restauração. Não confiar em validação apenas no cliente.
3. Uma troca envolvendo dois times envia a composição final completa dos dois, com suas versões. Times omitidos permanecem intactos. Falha em qualquer parte desfaz tudo. Duplicação de teamId no comando é 400; cardinalidade, ciclo ou conflito de versão na composição é 409.
4. Proposta contra ciclos: grafo agente → líder do time em que ele é colaborador. Validar ausência de ciclos no estado final, mesmo através de times não enviados. Um time de líderes em cadeia é válido; A subordinado a B e B subordinado a A não. Os vínculos de times arquivados também contam. Essa restrição adicional precisa ser revisada pelo usuário.

Papéis em times arquivados continuam reservados; arquivar não libera silenciosamente participação. Não aceitar agentes arquivados em nova composição. Projetos e times permanecem distintos.

## 3. Política de acesso proposta

Bearer opaco individual, mesmo formato do Kanban. Token resolve ator, agente e workspace no servidor; body não define autoria ou privilégios. Provisionamento/revogação confiável de credenciais fica fora destas APIs. CORS não autentica e acesso local não dispensa autorização.

| Sigla | Política proposta |
|---|---|
| R | Proprietário ou ator com `ra:read` no mesmo workspace lê perfis/times. Não concede acesso automático ao Kanban ou a chats privados. |
| O | Somente proprietário: criar/editar/copiar/arquivar perfil, criar/arquivar time, alterar composição e imagens. Não entregar credencial administrativa ao agente por padrão. |
| TL | Proprietário ou líder atual edita nome, propósito e contexto do próprio time; não edita o perfil compartilhado de outro agente. |
| SELF | Proprietário ou próprio agente registra/edita referências de chats e consulta retomada. Liderança não dá acesso automático a essas referências. |
| ACT | R sobre perfil mais autorização de leitura Kanban em cada tarefa, aplicada antes de contar/paginar. |

O próprio agente não altera suas regras/limites nem se promove a líder. Editar o perfil de alguém que também lidera outro time afeta contexto compartilhado; por isso a proposta conservadora restringe essa edição ao proprietário. Delegação granular de administração é pendência, não um novo papel organizacional. O usuário pode revisar essa política sem alterar as cardinalidades confirmadas.

Criar time, copiar com vínculo ou alterar composição exige `coordinationContext`: modo approval com conversationRef/approvalRef, ou autonomous com conversationRef, conforme modo efetivo persistido. Esses campos auditam a conversa, não provam consentimento criptograficamente. Modo autônomo não concede privilégio O. A granularidade workspace/time continua aberta: não introduzir endpoint de configuração global ou escolher precedência silenciosamente. Resolver política efetiva é pré-requisito de implementação; padrão continua approval. Credencial administrativa e mecanismo futuro de delegação precisam ser definidos antes de permitir gestão autônoma de RA por agentes.

O contrato não adiciona superfície operacional no painel. A cópia manual pode ser solicitada na conversa; não autoriza implicitamente botão para gerir times. Os limites de acesso no perfil orientam o agente, mas permissões reais de ferramentas pertencem ao harness.

## 4. Rotas formais

Prefixo `/api/v1`. Sucessos retornam recurso direto; listagens retornam envelope de página. Campos desconhecidos rejeitados. PATCH omite para preservar; `null` só onde explicitamente permitido. IDs UUID; datas RFC3339.

| Método e path | Entrada / resultado | Acesso |
|---|---|---|
| POST `/workspaces/{workspaceId}/agents` | CreateAgent → 201 Agent sem vínculos | O |
| GET `/workspaces/{workspaceId}/agents` | filtros/página → AgentPage | R |
| GET `/agents/{agentId}` | Agent com vínculos derivados | R |
| PATCH `/agents/{agentId}` | PatchAgent → Agent | O |
| PUT `/agents/{agentId}/archive` | `{archived}` → Agent | O |
| POST `/agents/{agentId}/copies` | nome opcional, destino, versão destino, contexto → 201 CopyResult | O |
| POST `/agents/{agentId}/image` | multipart file → 201 Agent | O |
| DELETE `/agents/{agentId}/image` | 204; limpa imagem atual | O |
| GET `/agents/{agentId}/image/content` | bytes autenticados de imagem upload | R |
| POST `/workspaces/{workspaceId}/teams` | nome, líder, membros opcionais, contexto → 201 Team | O |
| GET `/workspaces/{workspaceId}/teams` | filtros/página → TeamPage | R |
| GET `/teams/{teamId}` | Team | R |
| PATCH `/teams/{teamId}` | metadados → Team | TL |
| PUT `/teams/{teamId}/archive` | `{archived}` → Team | O |
| GET `/teams/{teamId}/members` | filtros/página → MemberPage | R |
| POST `/workspaces/{workspaceId}/team-composition-changes` | estados finais/versões/contexto → 200 CompositionResult | O |
| POST `/agents/{agentId}/chat-references` | referência externa → 201 ChatReference | SELF |
| GET `/agents/{agentId}/chat-references` | filtros/página → ChatReferencePage | SELF |
| PATCH `/agents/{agentId}/chat-references/{chatReferenceId}` | label/url/archived → ChatReference | SELF |
| GET `/agents/{agentId}/resumption-context` | taskIds opcionais → ResumeContext | SELF |
| GET `/agents/{agentId}/activities` | filtros/página → ActivityLinkPage | ACT |

Não há DELETE físico de agentes/times: arquivamento é a exclusão lógica proposta, com restauração explícita. POST de composição é um comando atômico que retorna 200, sem Location. Os demais POST retornam 201; imagens retornam perfil atualizado com Location da imagem. Referência de chat usa Location da coleção com fragmento, sem inventar rota de detalhe.

## 5. Concorrência, filtros e páginas

POST exige `Idempotency-Key` UUID: mesma chave/ator/rota/conteúdo por 24h devolve resultado anterior, sem nova identidade ou evento. Conteúdo diferente dá 409. Verificar autorização atual antes do replay.

PATCH/PUT/DELETE e upload exigem If-Match do alvo. Cópia exige If-Match do agente origem e expectedTeamVersion do destino. Criar referência de chat usa If-Match do agente; editar referência usa sua própria versão. Cada mutação de referência incrementa também a versão do agente, para que sua leitura/contexto possa ser revalidada. Resposta individual retorna ETag; após composição consultar agentes para seus novos ETags. Composição usa expectedVersion por time no body; não existe um ETag global artificial. Escrita individual sem versão: 428; divergente: 412. Divergência do batch ou destino da cópia: 409 composition_conflict.

Paginação por `offset` e `limit` confirmada pelo usuário, comum ao RA e ao Kanban. Listagens: `offset=0`, `limit=50`, máximo 100, offset máximo 2147483647. Resposta `{items, offset, limit, total, hasMore, nextOffset}`. Autorização e filtros antes de total/página. Ordenação estável por allowlist e desempate ID na mesma direção; sortOrder asc/desc, padrão asc. Total e itens usam snapshot coerente dentro da resposta, sem snapshot entre páginas. Além do total: items vazio, hasMore false, nextOffset null.

| Listagem | Filtros | sortBy (primeiro é padrão) |
|---|---|---|
| Agentes | name, teamId, role, archived, createdFrom/Before, updatedFrom/Before | createdAt, updatedAt, name |
| Times | name, leaderId, collaboratorId, archived, createdFrom/Before, updatedFrom/Before | createdAt, updatedAt, name |
| Composição | name, role | name, agentId; desempate agentId |
| Chats | label, harness exato, archived, createdFrom/Before, updatedFrom/Before | createdAt, updatedAt, label |
| Atividades | projectId, teamId, title, statusId (exige projectId), relation assigned/worked/either, archived da tarefa, updatedFrom/Before | taskUpdatedAt, title; desempate taskId |

name/title/label são substring literal case-insensitive de 1–200 caracteres. `%`, `_`, `\` são literais; escape no SQL e parâmetros vinculados. Filtros compõem AND. Parâmetros desconhecidos/repetidos e ranges inválidos retornam 400. Datas: From inclusivo, Before exclusivo; From < Before. role enum leader/collaborator; com teamId aplica ao vínculo nesse time. taskIds em retomada é CSV único de até 20 UUIDs, validado como conjunto de IDs autorizados, sem semântica de busca OR. Não há paginação em arrays pequenos embutidos, como os dois vínculos/contextos ou resultado do batch de até 20 times.

## 6. Ciclo de vida, cópia e retomada

Arquivar agente exige ausência de vínculos, inclusive em time arquivado, e ausência de tarefas não finais atribuídas. Antes, transferir/remover vínculos e reatribuir tarefas por seus endpoints autorizados. Não reatribuir/apagar trabalho automaticamente. Tarefas concluídas e eventos continuam referenciando a identidade antiga. Arquivar revoga tokens; restaurar não reativa tokens antigos nem devolve vínculos.

Arquivar time exige ausência de projetos ativos que o referenciem e tarefas não finais do time. Preserva composição histórica e reserva papéis; reativar para alterar composição. Nova tarefa/atribuição deve rejeitar time/agente arquivado. Remover agente de um time na composição exige ausência de tarefas não finais atribuídas naquele time; tarefas finalizadas preservam autoria e assignee histórico. Ser assignee histórico não deve conceder escrita fora do time após a saída: verificar vínculo atual no serviço Kanban antes de autorizar W. Essa é uma adaptação de integração proposta a revisar, não uma alteração já implementada.

Cópia: proprietário envia targetTeamId, expectedTeamVersion, contexto e nome opcional. Copia textos/regras/limites e snapshot da imagem para novo ID ativo como colaborador do destino. O papel de líder da origem não é copiado. Upload recebe imageId independente; URL externa é copiada como valor, mas seu conteúdo remoto pode mudar. Fonte pode estar arquivada, desde que legível ao proprietário. Nenhum histórico, chat, tarefa ou token é clonado. Falha em imagem/vínculo desfaz tudo e limpa bytes temporários. Alterar/deletar imagem da origem não invalida a cópia.

Upload de imagem: 5 MiB de bytes, multipart total até 6 MiB, PNG/JPEG/WebP validados por conteúdo; sem SVG. Armazenar fora da raiz web sob chave gerada; sem paths do usuário. URL externa só HTTPS, armazenada sem fetch servidor. Download autenticado, attachment e nosniff. Geração por IA permanece fora do servidor.

Referência de chat armazena harness, externalId, label e URL opcional (HTTP(S) ou codex); não buscar URL nem salvar credenciais/transcrição. Unicidade `(agentId,harness,externalId)`. Arquivar referência só muda metadado local. O agente pode registrar várias sessões; nenhum campo live/running. Contexto de retomada retorna perfil, no máximo dois contextos de times e links de leitura. taskIds opcionais exigem leitura Kanban de todos; não retornar subset silencioso. Campos updatedAt/generatedAt são datas de registro/consulta, não heartbeat.

## 7. Integração com Kanban sem duplicar histórico

`GET /agents/{id}/activities` é índice de leitura, não outro CRUD de tarefas. Uma linha por taskId em que o agente é responsável atual ou autor de resumo (relation escolhe assigned/worked/either). Projeção consulta os registros reais do Kanban; não replica resumos. Tarefas transferidas ainda aparecem em worked se houver resumo do agente. Agir como líder, comentar ou anexar sem resumo não equivale a execução para esse índice proposto.

ActivityLink contém taskPath e summariesPath (`/tasks/{id}/execution-summaries?actorId={principal}`). Usar endpoints Kanban para detalhes, decisões, entregas, pendências e resumos paginados. Mapeamento de actorId para agente deve preservar toda autoria, mesmo com renovação de credencial; preferir principal estável por agente. O principal do proprietário continua separado do agente em nome de quem consulta. Nunca passar token na URL.

Os contratos Kanban e RA estão alinhados em offset/limit; o endpoint Kanban de resumos aceita actorId, como utilizado nos links do índice RA. O RA reutiliza essas leituras e não implementa um segundo contrato de tarefas. A verificação de vínculo atual na autorização de tarefa continua sendo a proposta de integração de lifecycle a revisar antes da implementação.

## 8. Erros e exemplos

Mesmo envelope Kanban: `{error,code,details}`. 401 token inválido; 403 política RA; 404 inexistente/fora de leitura; 409 conflito de papéis, mesmo time nos dois papéis, time sem líder, ciclo, recurso arquivado/em uso ou composição desatualizada; 412/428 versão individual; 413 tamanho; 415 mídia; 500/503 sem detalhes de driver/segredos. Todos os erros estão formalizados no YAML.

Exemplo: Carlos lidera tecnologia e colabora em coordenação, permitido. Para transferir Carlos de coordenação para operações, enviar os dois estados finais, mantendo líderes:

```json
{
  "teams": [
    {"teamId":"10000000-0000-4000-8000-000000000020","expectedVersion":2,"leaderId":"10000000-0000-4000-8000-000000000002","collaboratorIds":[]},
    {"teamId":"10000000-0000-4000-8000-000000000022","expectedVersion":3,"leaderId":"10000000-0000-4000-8000-000000000003","collaboratorIds":["10000000-0000-4000-8000-000000000001"]}
  ],
  "coordinationContext":{"mode":"approval","conversationRef":"chat-42","approvalRef":"message-18"}
}
```

Adicionar Carlos ao segundo time sem removê-lo do primeiro dá 409 role_cardinality_conflict. Colocá-lo como colaborador de tecnologia, que lidera, dá 409 same_team_roles. Retirar líder sem substituição válida é rejeitado; o schema exige leaderId e a transação garante FK/cardinalidade.

```http
GET /api/v1/workspaces/10000000-0000-4000-8000-000000000010/agents?name=carlos&role=leader&offset=0&limit=25
GET /api/v1/agents/10000000-0000-4000-8000-000000000001/activities?relation=worked&title=api&offset=0&limit=50
```

## 9. Plano futuro e decisões pendentes

Aplicar as mesmas camadas API Rush: routes/ra para HTTP/MCP, dto/ra para contratos, services/ra para perfil/composição/autorização/cópia/retomada, repositories/ra para DB/imagens, migrations para constraints. Não retornar respostas HTTP do repositório nem aceitar autoria livre. Manter módulos abaixo de 1000 linhas.

1. Identidade e autorização: mapear principal estável e escopos; testes de self/owner/líder, revogação, leitura de chats e acesso cruzado entre workspaces.
2. Perfis e imagens: testes de arquivo inválido, isolamento de cópia, metadados arquivados versus execução e versão concorrente.
3. Times/composição: testes de único líder, um vínculo por papel, dual-role em times diferentes, troca atômica, rollback, constraints sob concorrência e ciclos no estado final.
4. Lifecycle e Kanban: testes de tarefas em uso, remoção de membro, histórico preservado, totais autorizados, índice sem duplicação e paginação.
5. Chats/retomada: testes de referência sem execução externa, seleção de tarefas autorizada, ausência de transcrição/segredos e schemas HTTP/MCP equivalentes.

Não executar este plano antes da revisão. Pendências explícitas: política conservadora O/TL/SELF, delegação administrativa para agentes, leitura RA ampla no workspace, ciclos, reserva de papéis em times arquivados, limites de arquivos, integração de lifecycle com autorização Kanban e granularidade de autonomia. Nenhuma dessas propostas altera a decisão já confirmada de perfil único e cardinalidades.
