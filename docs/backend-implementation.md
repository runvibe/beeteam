# Backend: implementação e integração

## Camadas

`routes/` adapta HTTP e rmcp. `dto/` contém comandos/resultados, contexto declarado,
validação JSON Schema dos contratos e catálogo das compostas. `services/backend/`
aplica regras, hierarquia, autonomia, composição, consultas e arquivos.
`repositories/resources.rs` concentra SQLx, transação, recursos persistidos, bytes
e idempotência. Nenhuma rota consulta SQL diretamente; serviços não recebem Request,
Response, headers ou objetos MCP. Contratos são carregados uma vez do YAML compilado.

Tabelas separadas por entidade têm UUIDv7, versão, datas, `archived_at`, `deleted_at`
e conteúdo JSONB validado pelos DTOs. Colunas geradas tipadas implementam FKs,
status do board, origem da task e identidades. Índices únicos parciais reservam
liderança e colaboração inclusive em times arquivados; transferências liberam e
reaplicam os vínculos dentro da mesma transação. Constraint diferível impede os dois
papéis no mesmo time. Não foi adicionada a proposta não confirmada de proibir ciclos
entre lideranças; ciclos **parentais de tasks** são impedidos pela estrutura imutável,
validação da origem e FKs. IDs de contexto são derivados, nunca aceitos do cliente na
criação. Resumos conferem a referência de execução declarada contra a cadeia real.

Os SQLs de dados usam bind parameters. O pequeno conjunto de nomes de tabelas vem
de uma allowlist estática, nunca da requisição. Queries runtime permitem compilar
sem DATABASE_URL e reutilizar o repositório entre tabelas; por isso esse módulo não
usa macros `query!` dependentes de metadados de um banco de build. Migrations são a
única fonte de esquema, sem criação dinâmica de tabelas no runtime.

## Atomicidade e concorrência

Uma transação e advisory lock PostgreSQL abrangem cada caso de uso, inclusive
leituras coerentes de itens/total. Instâncias HTTP/MCP compartilham o lock. O estado
local é carregado em snapshot de registros e somente diferenças são persistidas.
Essa escolha favorece correção do serviço pessoal local; custo de leitura/memória
cresce com o histórico. Não é uma arquitetura validada para alto volume/multi-tenant.
Não se pretende cobrir escritores SQL externos que ignorem o lock do serviço.

Versões são verificadas antes de alterações; conflitos individuais retornam 412,
ausência 428, composição desatualizada 409. Dados e eventos são atômicos. Idempotência
POST dura 24 horas por operação/path/ator declarado/chave/hash de conteúdo (incluindo
bytes quando presentes). Repetição exata retorna a resposta original; conteúdo
diferente retorna 409. IDs das linhas de replay são UUIDv7; a chave fornecida pelo
cliente é uma chave de requisição e pode usar outra versão UUID, conforme contrato.
Expiração desativa o replay por `deleted_at`, sem DELETE. Compostos usam uma única
chave/transação para todo o conjunto, sem commits intermediários.

## Arquivos e histórico

Bytes ficam em `file_contents` (bytea), fora de qualquer raiz web ou path fornecido
pelo cliente. A decisão técnica usa atomicidade PostgreSQL para evitar metadados
publicados sem bytes e órfãos em falhas. Uploads são limitados e mantidos em memória
durante a chamada: anexo 20 MiB/corpo 21 MiB; imagem 5 MiB/corpo 6 MiB. PNG/JPEG/WebP
passam por detecção e decoder limitado a 128 MiB de alocação; SVG é rejeitado.
Substituição/remoção marca imagem e bytes anteriores como excluídos, preservando-os.
Cópia gera registros/bytes independentes. Nome original é metadado, não caminho.

Download de imagem usa o media type validado; anexo usa octet-stream, attachment e
nosniff. Removidos não têm download; `includeRemoved` retorna apenas tombstones.
Sem limpeza física automática. Triggers rejeitam DELETE/TRUNCATE nas tabelas da
aplicação. Migrations iniciais do template são preservadas; registros legados em
authors/posts não têm identidade reescrita. Essas tabelas não são usadas pela API Bee
Team; constraints NOT VALID preservam o histórico já existente e restringem novas
gravações. Não há endpoint de restauração de `deletedAt`; archive possui restauração.

## Frontend

A frente frontend está conectando o transporte real. O preview local usa proxy do Vite de
`/api` para `http://127.0.0.1:59865` e os contratos publicados; configuração e bootstrap em local-integration.md. Consultas não
precisam de headers de identidade. Escritas de configuração usam contexto declarado,
Idempotency-Key nos POST e If-Match nas mutações versionadas. ETag/Location podem ser
lidos no mesmo origin ou via CORS com exposição de headers configurada. UI continua
visualização/configuração; APIs operacionais não autorizam acrescentar despacho,
drag-and-drop, atribuição ou aprovação ao painel. Nenhum arquivo frontend foi alterado.

## Verificação e limites

Testes reais cobrem entrada/saída dos contratos, CRUDs e comandos, arquivos/cópias,
concorrência de versão, composição final/rollback, origem e recursão de 32 níveis
cross-board, matriz de 36 combinações de autonomia, histórico e exclusão lógica.
MCP testa initialize/tools/list/call, resources list/read (incluindo recusa de URI
arbitrária), prompts list/get e compostos com rollback/idempotência.

Não há autenticação nem isolamento de segurança por ator; existência de um ID não
comprova quem o enviou. Escopo de edição do líder segue pendente, sem restrição
inventada. Aprovações conversacionais são referências auditadas, não consentimento
criptograficamente comprovado. Serviço não chama IA, não cria/controla chats e não
executa os prompts/skills que publica.

## Resumo atual cumulativo (implementado)

Task.currentSummary é string sempre presente em item/listagens/view, inicialmente vazia (incluindo backfill de legadas). Texto explícito do colaborador, máximo 16384 bytes UTF-8, com feito/concluído, trabalho atual e pendências/próximo passo; não se infere descrição, nota de progresso ou histórico. Escrita substitui a síntese inteira, preservando antes/depois nos eventos existentes da timeline.

PatchTask aceita currentSummary não vazio e o exige quando progress é enviado. Position (operação moveTask) o exige ao mudar status, não ao reordenar no mesmo status. RecordExecution exige currentSummary; mantém summary como registro histórico de atividade e salva ambos atomicamente. MCP simples segue os mesmos DTOs; record_progress aceita currentSummary no topo e por descendente, obrigatório com progress; close_activity exige execution.currentSummary. Título/descrição/modo podem ser editados sem enviar resumo; preservam o existente.

Persistência reutiliza tasks.data JSONB (migration 202610270004); nenhuma tabela duplicada ou query por card. Backend não calcula síntese nem cliente precisa ler toda história. Erro de versão, conteúdo, contexto ou descendente reverte todas as alterações compostas; idempotência cobre o texto enviado. Sem alterações na política de edição do líder.

## Especificação própria e Markdown

`Task.specification` é texto Markdown (máximo 65536 bytes UTF-8), sempre presente em leitura/listagem/quadro/contexto MCP. Criação aceita campo opcional, com padrão `""`; PATCH aceita substituição integral, inclusive `""` para limpar. Null/tipo incorreto/excesso de bytes são rejeitados. Migration005 preenche legadas/tombstones sem inventar conteúdo, preservando as especificações existentes.

Especificação define entrega, requisitos, regras e critérios de aceite. `description` apresenta a tarefa, `PlanRevision.content` descreve execução versionada, `currentSummary` relata estado cumulativo atual. Nenhum substitui o outro. Alteração apenas de specification é administrativa e não exige currentSummary; progress conjunto mantém sua exigência. Timeline mantém antes/depois via task.updated. Replays legados recebem vazio explícito no snapshot, mantendo versão e conteúdo anterior.

Especificações e planos/revisões conservam o texto recebido, incluindo Markdown, Unicode, quebras de linha e trechos de código/HTML literais. O backend não renderiza HTML, executa ou transforma conteúdo. Planos continuam com content Markdown limitado a 65536 bytes, revisões imutáveis e conflitos baseRevision existentes. Sem nova entidade ou versionamento exclusivo de especificação. Clientes devem tratar conteúdo como dados e renderizar com segurança quando necessário.

## Slugs de agentes, times e tasks

Agent.slug, Team.slug e Task.slug (incluindo subtasks) são gerados, sempre presentes e não editáveis. UUIDv7 permanece identidade interna e parâmetro das APIs existentes. Boards não possuem slug. Resolvers GET /api/v1/agents/by-slug/{slug}, /teams/by-slug/{slug}, /tasks/by-slug/{slug} retornam {id,slug}; no MCP: resolveAgentSlug/resolveTeamSlug/resolveTaskSlug com params.slug. Usar o UUID retornado nas APIs/prompts seguintes; não enviar slug onde se exige UUID. Retorno404 para ausente/excluído; arquivados continuam resolvendo. Formato inválido ou não canônico retorna400; não há redirect/normalização implícita no resolver.

Normalização única no PostgreSQL: lowercase+NFKD, remoção de marcas combinantes U+0300..036F, ß/æ/œ para ss/ae/oe, demais caracteres fora de a-z0-9 viram separador, hifens colapsados/sem bordas. Nomes sem caracteres úteis usam agent/team/task; não há transliteração universal de alfabetos não latinos. Máximo80 caracteres ASCII, truncando base para caber sufixos -2,-3... . Reservados new/edit/create/by-slug/resolve/search/archive/settings/api/mcp/agents/teams/tasks e strings em formato UUID recebem prefixo agent-/team-/task-.

Slugs são estáveis ao renomear e únicos por tipo, inclusive archived/deleted. Excluídos nunca liberam o nome para outra identidade; cópia cria novo slug. Migration006 usa created_at,id para backfill determinístico, incluindo tombstones sem alterar conteúdo prévio, versão ou datas. Coluna gerada/index único/trigger de imutabilidade e lock transacional coordenam concorrência. Resolvers consultam índice diretamente, sem snapshot completo ou enumeração de listas. A geração e o backfill compartilham a mesma função SQL, sem algoritmos divergentes.

Replays históricos sem slug ganham o slug canônico imutável do registro correspondente, inclusive tombstones; conservam a versão e demais campos do snapshot original. Não se reconstrói slug pelo nome antigo nem atual. Sem auth/políticas novas; alteração visual/integração frontend não validada nesta frente.
