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

A frente frontend atual é mockada. Para conexão futura, configurar proxy do Vite de
`/api/v1` para `http://127.0.0.1:8080` e usar os contratos publicados. Consultas não
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
