# Exportação, importação e troca de banco do Get Bee Team

Estado: primeira entrega implementada sobre `1f7a9ed`/`4f2dc2b`, com validação isolada em 28/10/2026. Nenhum banco de produto ou serviço ativo foi alterado. Evidências: `docs/data-transfer-verification.md`.

## Objetivo e escopo

Exportar uma instância Get Bee Team em PostgreSQL ou SQLite e restaurar em outra instância Get Bee Team, nos quatro pares de origem/destino. A exportação pode ocorrer com a aplicação rodando. A importação restaura um conjunto completo; não combina cadastros de duas instalações.

O usuário aprovou a primeira entrega integral: ZIP portátil, destino vazio, precisão explícita e limites administrativos. Substituição/cutover e apagamento continuam fora do escopo.

## Recomendação de formato

Um arquivo `.beeteam.zip` com manifesto versionado, registros JSON Lines e arquivos binários. O JSON acompanha o modelo atual de payloads e preserva nulos, booleanos, números e textos Markdown sem conversão para colunas textuais. Nenhum script SQL do pacote é executado.

| Alternativa | Viabilidade para Get Bee Team | Decisão proposta |
|---|---|---|
| CSV | Possível com um CSV por tabela, manifesto, codificação de JSON, convenção de nulos e armazenamento separado de anexos. CSV não distingue nulo de texto vazio sem convenção específica. | Útil para relatórios tabulares; não simplifica o backup completo. |
| Dump SQL | Possível para restauração no mesmo motor; sintaxe, tipos, funções, triggers e sequências diferem entre PostgreSQL e SQLite. | Não usar como formato de intercâmbio. |
| Arquivo SQLite | Viável como contêiner único, inclusive para exportação de PostgreSQL. Ainda exige esquema versionado, validação, tratamento de collation customizada e conversão de dados. | Alternativa válida se o usuário preferir banco navegável como arquivo. |
| ZIP com JSONL e blobs | Neutralidade entre motores e separação explícita de dados, validação e bytes dos anexos. | Recomendação inicial. |

Referências: [CSV no PostgreSQL](https://www.postgresql.org/docs/18/sql-copy.html); [SQLite como formato de aplicação](https://www.sqlite.org/appfileformat.html).

## Evidências no código

- `src/repositories/records.rs`: 15 categorias de registros com UUID, payload JSON, versão e datas de ciclo de vida.
- `src/repositories/resources.rs` e `src/repositories/sqlite/resources.rs`: transações, idempotência, arquivos e sequências ficam nos adapters. O UnitOfWork normal carrega um snapshot completo para mutações; não é o mecanismo de streaming do backup.
- `migrations/202610270001_beeteam.sql` e `migrations/sqlite/0001_beeteam.sql`: exclusão física proibida, FKs e unicidade de papéis/slugs. Restaurar não pode chamar CRUD comum, gerar IDs, tocar versões ou produzir eventos de criação para cada registro.
- PostgreSQL usa lock transacional compartilhado entre escritores. SQLite usa BEGIN IMMEDIATE; o importador precisa participar desses mesmos mecanismos.
- `src/repositories/database.rs` e `src/state.rs`: adapters/pools escolhidos na inicialização. Alterar env não troca o banco de um processo já rodando.
- `src/repositories/changes.rs` e o adapter SQLite: notificação deve ocorrer só depois do commit; não em cada item importado.
- Há tabelas legadas `authors` e `posts` no PostgreSQL, fora do domínio Get Bee Team atual e ausentes no SQLite. Se contiverem dados, a exportação completa deve informar e recusar a operação, sem ignorá-las silenciosamente; o suporte delas é uma extensão separada.

## Conteúdo do pacote v1

```text
manifest.json
records/agents.jsonl
records/teams.jsonl
records/boards.jsonl
records/statuses.jsonl
records/tasks.jsonl
records/plans.jsonl
records/plan_revisions.jsonl
records/comments.jsonl
records/attachments.jsonl
records/execution_summaries.jsonl
records/events.jsonl
records/chat_references.jsonl
records/images.jsonl
records/memberships.jsonl
records/board_events.jsonl
records/file_contents.jsonl
records/request_replays.jsonl
blobs/<UUIDv7>.bin
```

Manifesto: `formatVersion=1`, `archiveId` UUIDv7, versão da aplicação, driver de origem informativo, instante do snapshot, inventário de entradas, quantidades, tamanhos e SHA-256 de cada entrada descompactada, além do piso da sequência de eventos. O hash do arquivo completo é entregue fora do pacote, no job. Hashes detectam corrupção; não comprovam autoria.

Cada linha de recurso preserva `id`, `data`, `version`, `createdAt`, `updatedAt`, `archivedAt`, `deletedAt`. Exportar também arquivados, excluídos logicamente, slugs reservados, revisões e históricos. `file_contents` contém os metadados e o caminho interno dos bytes; preservar também conteúdo excluído logicamente ainda existente. Replays mantêm chaves, operação, hash, resposta histórica, criação, expiração e exclusão, sem renovar o prazo. Preservar respostas legadas sem normalização dos snapshots.

Não exportar senha, URL de conexão, env, logs, processos, configurações pessoais do Codex, métricas, `_sqlx_migrations`, relógio local de notificações ou os próprios jobs de transferência. A migração de schema é responsabilidade da versão instalada no destino. Contadores internos são reconstruídos com piso suficiente para os próximos eventos, sem reaproveitar números históricos. Sequências PostgreSQL não representam um snapshot transacional exato: registrar um piso conservador, nunca usar esse valor como contagem de registros.

## Fluxo de exportação

1. Usuário solicita exportação da instância conectada; API cria job e retorna 202.
2. Repository abre snapshot consistente: PostgreSQL REPEATABLE READ READ ONLY; SQLite transação de leitura fixada por uma leitura real. Todos os registros, replays e blobs saem do mesmo snapshot, inclusive tombstones.
3. Escrever lotes/streams em armazenamento temporário, sem carregar todo banco ou todos os anexos em RAM. Não depender do UnitOfWork de escrita atual.
4. Fechar pacote, verificar inventário/hashes, publicar o arquivo de forma atômica e só então permitir download.
5. Em falha, nenhum pacote parcial é anunciado como pronto. Expor progresso/erro pelo job; liberar snapshot e artefatos incompletos.

Escritas podem continuar durante exportação, mas não entram parcialmente no snapshot. Exportações longas seguram versões antigas no PostgreSQL e podem aumentar o WAL do SQLite: limitar duração e permitir cancelamento. Não manter snapshot aberto durante o download do usuário.

## Fluxo de importação em banco vazio — primeira entrega

1. Fazer upload do pacote para a instância de destino. Upload não altera dados do domínio.
2. Validar arquivo, versão, hashes, integridade referencial, IDs, slugs, hierarquia, papéis, versões, datas, Markdown e disponibilidade de espaço. Validar também dados arquivados/excluídos, usando regras de persistência e formato, não os DTOs de criação atuais.
3. Exibir prévia: origem, registros por categoria, anexos, destino, avisos e mudanças de precisão necessárias. Destino precisa estar vazio incluindo registros excluídos logicamente, arquivos e replays. Tabelas técnicas de migração/identidade/jobs não contam como dados de domínio.
4. Emitir token curto de confirmação associado ao hash do pacote, identidade do destino, opções e versão da prévia; não é autenticação. Usuário confirma a restauração dessa prévia.
5. No momento da execução, adquirir o mesmo lock de escrita dos repositories e verificar novamente que o destino está vazio. Se outra requisição criou qualquer dado, abortar sem remover nada.
6. Inserir tudo em uma transação com IDs, versões e conteúdo originais. Blobs/agents/teams/boards/statuses antecedem dependentes; tasks em ordem topológica (raízes antes das filhas, inclusive entre boards); plans antes de revisions. Manter FKs/triggers ativos e validar no commit.
7. Restaurar piso de sequência, registrar marcador técnico de conclusão e emitir uma invalidação após commit. Se houver erro, rollback de todos os dados. Pode haver avanço conservador de sequência PostgreSQL após rollback; isso não deve afetar o domínio.
8. Marcar job concluído somente com prova de commit. Se o processo cair depois do commit e antes de atualizar o job, consultar o marcador de restauração ao reiniciar: não executar de novo nem afirmar que falhou sem verificar.

A instância pode permanecer aberta, porém a escrita fica serializada durante o import. Leitores veem estado anterior ou final, nunca conteúdo parcial. Não prometer importação sem impacto para bases grandes.

### Precisão de datas entre motores

O SQLite atual grava metadados em texto com nanossegundos; PostgreSQL timestamptz tem precisão de microssegundos ([documentação](https://www.postgresql.org/docs/18/datatype-datetime.html)). Exportar o valor original. Na importação em PostgreSQL, a prévia deve detectar e contar valores não representáveis. Por padrão, bloquear perda silenciosa; oferecer autorização explícita `timestampPolicy=truncate_to_microseconds`, aplicável somente aos metadados tipados e com relatório. Não reescrever strings dentro de Markdown, payloads livres ou snapshots de idempotência. Testar ordenação por timestamp empatado com desempate por ID. Essa política exige confirmação do produto antes da implementação.

## Substituição de banco com dados — etapa operacional separada

A ideia de substituir tudo é viável, mas DELETE/TRUNCATE no banco atual contraria as garantias vigentes. Recomendo substituição por um destino novo, sem modificar o banco antigo:

1. Entrar em manutenção e interromper/coordenar todos os escritores HTTP/MCP da instância antiga; requisições já iniciadas devem terminar antes do corte. Evitar dois conjuntos de processos escrevendo em bancos distintos.
2. Gerar e verificar backup do estado antigo após suspender escritas.
3. Provisionar banco/arquivo separado e vazio, executar as mesmas validações e restauração, conferir domínio/MCP/anexos e replays.
4. Trocar DATABASE_DRIVER/DATABASE_URL no processo supervisor autorizado e reiniciar todos os processos dependentes; configuração deve vir de alias previamente cadastrado no servidor, nunca URL/senha enviada pelo navegador.
5. Conferir saúde e dados antes de liberar escrita; fechar SSE antigos e forçar refetch no painel. Preservar rascunhos e impedir salvamento de contexto da instalação anterior sem revisão.
6. Manter banco/arquivo antigo para recuperação. Até liberar novas escritas, rollback pode voltar ao banco antigo. Depois de novas escritas, voltar exige decisão de recuperação para não perder essas alterações; não prometer rollback transparente.

Primeira entrega: rejeitar importação em banco não vazio com `destination_not_empty` e orientar usar destino novo. Etapa seguinte: assistente de substituição, dependente de supervisão de processos/manutenção coordenada. Nunca apagar automaticamente o banco antigo ao importar. Apagamento definitivo seria ação de retenção separada, fora desta proposta. Isso é uma recomendação a aprovar, não a escolha de apagar/arquivar pelo usuário.

## API proposta para a primeira entrega

Prefixo `/api/v1/data-transfers`. Documentar em OpenAPI próprio, sem misturar domínio de tasks/teams.

| Método e rota | Comportamento |
|---|---|
| POST `/exports` | Cria exportação do banco configurado; 202 + jobId. |
| GET `/jobs/{jobId}` | Estado, etapa, progresso, contagens, avisos e erro sanitizado. |
| GET `/exports/{jobId}/file` | Download por streaming apenas após sucesso. |
| POST `/imports` | Upload multipart por streaming; cria validação assíncrona, 202 + jobId. |
| GET `/imports/{jobId}/preview` | Resultado da validação, hash, destino e token de confirmação se pronto. |
| POST `/imports/{jobId}/restore` | Restaura no banco configurado vazio, confirmando hash/token/política; 202. |
| POST `/jobs/{jobId}/cancel` | Solicita cancelamento; consulta confirma o resultado, sem confundir commit concluído com cancelado. |

Estados: queued, running, ready (export pronto ou import validado), restoring, completed, failed, cancelled, expired. Uma instância executa no máximo uma transferência pesada por vez; outras recebem 409 com referência ao job ativo. A fila não é infinita. Mutações administrativas usam Idempotency-Key: repetição retorna o mesmo job/resultado; conteúdo diferente com a mesma chave gera conflito. Restauração concluída retorna a prova anterior em retry, mesmo que o destino agora não esteja vazio.

Jobs e arquivos temporários ficam em repository próprio em diretório configurado, com gravação atômica e lease/lock entre processos. Não colocar o progresso de SQLite em uma tabela que exija disputar o lock da transação de restauração. Marcador de commit fica no banco de destino, na mesma transação. Em restart: reconciliar restores pelo marcador; exports/validações interrompidos falham de forma explícita e podem ser solicitados novamente.

MCP usa o mesmo serviço: criar exportação, consultar job, consultar prévia e confirmar importação já enviada pela UI. Não aceitar caminho arbitrário do computador ou URL remota, nem retornar anexos grandes dentro de respostas MCP. Download/upload pela API/UI. Confirmação de restauração permanece explícita mesmo em execução automática de tasks.

## Limites e exposição — valores iniciais implementados

Configurar por env, sem alterar o limite geral de payload do restante da API:

- `BEE_TRANSFER_ENABLED=false` por padrão; habilitação administrativa explícita.
- `BEE_TRANSFER_DIR=.local/transfers`, permissões restritas do processo; retenção 24 horas após estado terminal; não limpar jobs em execução nem marcadores de commit do banco.
- Upload compactado: 2 GiB; total descompactado: 10 GiB; máximo 100.000 entradas; uma linha JSONL: 1 MiB; duração de export/import: 30 minutos, configuráveis e expostos na UI.
- Limitar bytes realmente lidos, não confiar no cabeçalho ZIP. Rejeitar paths absolutos, traversal, symlinks, entradas repetidas/desconhecidas, chaves duplicadas em JSON, ZIP criptografado e formatos de versão não suportada. Nunca extrair livremente usando nomes fornecidos pelo arquivo.
- Sem novo modelo de autenticação neste escopo. Ator declarado continua sendo metadado. Expor recurso administrativo somente na configuração local aprovada; rejeitar origens de navegador não autorizadas e documentar que loopback não autentica outros processos locais. Habilitar em servidor remoto depende de controle de acesso externo ou de escopo adicional.
- O pacote contém o histórico e anexos, inclusive dados excluídos logicamente. Deixar isso visível antes do download. Criptografia do pacote não está na primeira versão.

## Decisões para aprovar antes de implementar

1. Formato recomendado: ZIP + JSONL + blobs, em vez de CSV/SQL/SQLite como intercâmbio.
2. Primeira versão restaura só em banco vazio; substituição preserva banco antigo e troca para destino novo.
3. Tratamento explícito da precisão temporal SQLite → PostgreSQL, sem truncamento silencioso.
4. Limites/retenção e habilitação administrativa inicial propostos acima.

Não há migração de dados, API de backup, botão de importação ou troca de configuração implementados por este documento.
