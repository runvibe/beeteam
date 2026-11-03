# Consumo por tarefa a partir de intervalos da sessão

Data: 2026-11-03. Estado: implementada na branch de integração; ativação depende de executar a API atualizada. Consulte o [contrato final](task-session-intervals-contract.md) e as [verificações de integração](task-session-intervals-implementation.md).

## Objetivo

Medir tokens e duração dos períodos dedicados a uma tarefa, reutilizando uma sessão para tarefas sequenciais. Cada intervalo deve ter início e encerramento explícitos, registrados junto de resumos. Não deduzir início/fim pelo texto, pelo status ou pela proximidade de horários.

## Base atual

- `POST /api/v1/tasks/{taskId}/execution-summaries` e MCP `createExecutionSummary` já vinculam o resumo à tarefa.
- Novos resumos exigem `usageReport.entries` com acumulado medido, `totalTokens = inputTokens + outputTokens`, modelo e agente identificados.
- Cache integra entrada; raciocínio integra saída. Não somar esses subconjuntos novamente.
- O primeiro snapshot é aceito, mas sozinho não informa consumo de um intervalo.
- Status da tarefa e resumo são salvos atomicamente; `statusObserved` preserva o estado histórico. Percentual ainda pode mudar separadamente.

## Conceitos

- **Sessão:** fonte do contador cumulativo; pode executar várias tarefas em sequência.
- **Execução da tarefa:** conjunto de intervalos de uma tarefa para um agente/sessão.
- **Intervalo:** período contínuo dedicado à tarefa entre duas evidências comparáveis.
- **Evidência:** observação imutável do contador, sua fonte, sessão, epoch, escopo, modelo, agente e horário de coleta.
- **Duração observada:** diferença dos horários das evidências; não representa tempo de CPU, raciocínio ativo ou produtividade.

O consumo atribuído corresponde ao intervalo declarado. A exclusividade do trabalho é uma declaração do agente, não algo comprovado pela contagem. Reenvio de contexto e outras operações incluídas pelo harness fazem parte da medição.

## Fluxo funcional

1. Antes de trabalhar, o agente coleta os contadores da sessão e salva um resumo com ação de início para a tarefa.
2. O servidor devolve identificadores da execução e do intervalo. O trabalho começa depois de confirmado o salvamento.
3. Resumos intermediários podem registrar checkpoints do intervalo, preservando seu início.
4. Ao encerrar o trabalho, o agente coleta novamente os contadores e salva um resumo com ação de encerramento, referenciando execução e intervalo.
5. Para trocar de tarefa, pausa/encerra primeiro o intervalo atual. Depois abre o intervalo da próxima tarefa.
6. Ao retomar, abre novo intervalo na mesma execução; o período pausado fica excluído.
7. Uma entrega em revisão pode encerrar o intervalo sem concluir o status da tarefa. Aceite do usuário e término do intervalo são independentes.

O registro de fim cobre o consumo até a coleta final. A geração ou chamada de ferramentas posterior a esse instante não deve ser apresentada como coberta; a mesma limitação vale para a mensagem usada para registrar o início. Não prometer precisão por chamada quando a fonte só oferece snapshots.

## Contrato

Manter a operação existente de resumo e acrescentar `executionTracking` ao corpo. Os campos abaixo resumem o fluxo; o contrato final documenta também o modo do contador, a raiz de cobertura e a recuperação de lacunas. A API mantém o campo opcional no rollout aditivo, enquanto as skills orientam seu uso.

| Campo | Regra |
| --- | --- |
| `action` | `start`, `checkpoint`, `pause`, `resume` ou `finish` |
| `executionId` | Gerado pelo servidor no início; obrigatório nas ações seguintes |
| `intervalId` | Gerado em início/retomada; obrigatório em checkpoint/pausa/fim ativo; omitido no fim pausado |
| `evidenceIds` | Referências explícitas às entradas de `usageReport` usadas como fronteira |

O `taskId` continua no caminho HTTP ou em `params.taskId` no MCP; não duplicá-lo no texto como vínculo técnico. Agente, sessão e contador vêm das evidências referenciadas e devem corresponder à execução. `statusId`, `currentSummary` e demais campos de resumo mantêm suas regras atuais.

`start` cria execução e intervalo. `pause` fecha o intervalo e deixa a execução pausada. `resume` cria outro intervalo da mesma execução. `finish` fecha intervalo aberto e encerra a execução; se já pausada, encerra sem inventar consumo para o período parado. `checkpoint` não encerra o intervalo.

Cada chamada deve salvar resumo, mudança de status, evidências e transição do intervalo na mesma transação e sob a mesma chave de idempotência. A resposta inclui o resumo e os identificadores/estado resultantes. Erros não podem deixar status, resumo ou intervalo parcialmente persistidos.

## Modelo de persistência

Criar estruturas relacionais próprias, mantendo os resumos e evidências existentes:

### `task_executions`

- `id` UUIDv7, `task_id`, `agent_id` com referências persistidas;
- identidade da fonte/sessão/escopo, estado `active | paused | finished`;
- resumo de abertura/encerramento e metadados de versão e auditoria.

### `task_execution_intervals`

- `id`, `execution_id`, estado `open | closed | incomplete | invalid`;
- `start_summary_id`, `end_summary_id` opcional;
- início/fim observados e recebidos, separadamente;
- motivo de pausa, encerramento ou invalidação quando aplicável.

### `task_execution_interval_counters`

- `interval_id`, chave canônica do contador;
- referências a evidências inicial/final e suas revisões imutáveis;
- totais inicial/final, componentes, delta, qualidade e motivo de ausência;
- identidade de modelo/harness/agente preservada para consulta histórica.

Chaves estrangeiras e índices por tarefa, sessão, agente e tempo. Garantir no banco e no serviço que uma mesma fonte de consumo não tenha intervalos abertos sobrepostos, mesmo em requisições concorrentes de agentes diferentes. O identificador do agente não deve permitir burlar essa exclusividade.

Migrações independentes para SQLite e PostgreSQL, sem reset, inferência retroativa ou alteração de dados reais. Seguir a separação routes/dto/services/repositories e o UnitOfWork existente.

## Cálculo e integridade

Para um contador comparável: `tokensIntervalo = totalFinal - totalInicial`. Aplicar a mesma diferença aos componentes conhecidos; ausência permanece ausência. Inteiros decimais devem preservar precisão e respeitar limites verificados, inclusive na soma de intervalos.

- Só parear evidências da mesma fonte, sessão, epoch, escopo e semântica de contador.
- Modelo pode ser dimensão de contador ou apenas identificação da execução: não presumir que o acumulado global se reinicia ao trocar de modelo.
- Se houver contador global comparável com troca de modelo, o total do intervalo pode existir sem divisão exata por modelo. Mostrar os modelos envolvidos sem atribuir tudo ao último.
- Se a fonte fornecer contadores disjuntos por modelo, calcular por série e agregar apenas séries comprovadamente disjuntas.
- Nunca somar contador de árvore com seus filhos, total global com suas parcelas, snapshots repetidos ou deltas intermediários com o delta final.
- Reset, epoch diferente, contador decrescente, lacuna ou fonte incompatível: resultado incompleto/indisponível com motivo; nunca negativo nem zero fabricado. Abrir novo segmento comparável quando houver evidência.
- Sem fim: mostrar intervalo em aberto. Um checkpoint pode fornecer consumo parcial claramente identificado, sem alegar encerramento.
- Sem início: preservar o resumo, mas não inventar consumo anterior nem atribuição retroativa. Exibir ausência de fronteira.
- Reenvio idempotente retorna os mesmos IDs e resultado; mesmo identificador de evidência com conteúdo diferente conflita.
- Evidência corrigida/reconciliada deve gerar versão auditável e recomputação determinística, preservando o cálculo anteriormente exibido para auditoria.

O total da tarefa é a soma dos intervalos válidos e não sobrepostos; indicar cobertura e parcelas incompletas. Sessões independentes podem trabalhar em paralelo na mesma tarefa. Duração de trabalho somada e tempo decorrido da tarefa são métricas distintas; não somar sobreposições e chamar de tempo decorrido.

## Regras de exclusividade e erros

- Iniciar tarefa B enquanto houver intervalo aberto da mesma fonte na tarefa A retorna conflito com referência ao intervalo ativo. Não fechar A automaticamente.
- Identificadores de execução/intervalo de outra tarefa, sessão ou agente são rejeitados.
- Fim anterior ao início e evidências comparáveis fora de ordem são rejeitados.
- Falha de coleta não autoriza inventar tokens: registrar comentário de impedimento; o intervalo permanece aberto/incompleto até correção explícita.
- Queda do agente não cria fim automático. Recuperação usa evidência verificável e registra a cobertura perdida.

## Skills e MCP

Leader e Collaborator devem registrar início antes do trabalho e fim/pausa antes da troca de tarefa, manter os IDs retornados e coletar em cada fronteira. Ao retomar um chat, consultar o intervalo aberto antes de criar outro. As instruções do MCP devem explicar exemplos de sucesso, conflito, indisponibilidade e recuperação, sem inferir medição de créditos ou tamanho do contexto.

Não exigir nova sessão por tarefa. Não iniciar coletores, instalar integrações ou executar chamadas pagas apenas para obter medição sem autorização específica.

## Interface

- Visão geral: tokens atribuídos por intervalos, cobertura, duração observada e intervalos abertos/incompletos.
- Linha do tempo: início, checkpoints, pausa, retomada e fim. Cada ponto mostra resumo, status histórico, agente, modelo(s), fonte e acumulado.
- Detalhe do intervalo: fronteiras, diferença calculada, duração e limitações. Acesso aos resumos correspondentes.
- Consumo da sessão permanece separado do consumo por intervalos da tarefa.
- Gráficos permanecem visíveis quando vazios; ausência não vira zero. Mouse, teclado e toque acessíveis.

## Compatibilidade e implantação

Resumos históricos permanecem legíveis sem execução/intervalo. Replays antigos continuam exatos. Não vincular automaticamente eventos de progresso antigos a resumos por horário. Definir rollout coordenado de API, MCP, skills e frontend antes de tornar a marcação obrigatória para novos fluxos. Leituras antigas toleram campos adicionais; clientes antigos recebem erro claro se acionarem fluxo já obrigatório, nunca marcação fictícia.

## Critérios de aceite

1. Sessão inicia tarefa A com 1.000 tokens e encerra com 1.600: A recebe 600.
2. A mesma sessão inicia B com 1.650 e encerra com 2.000: B recebe 350; os 50 entre tarefas não entram em nenhuma.
3. A pausa com 1.300, outra tarefa usa a sessão, A retoma com 2.000 e termina com 2.200: A recebe 300 + 200, não 1.200.
4. Apenas início não gera total final; checkpoints produzem parcial sem duplicação.
5. Duas chamadas concorrentes de início na mesma fonte não criam intervalos sobrepostos.
6. Reenvio de início/fim não duplica intervalos, resumos ou consumo.
7. Reset, troca de modelo, árvore/filhos e evidência repetida não fabricam diferença ou soma.
8. HTTP, MCP direto e operações compostas têm paridade e rollback atômico.
9. Dados antigos e replays antigos preservados; testes usam bancos isolados.
10. UI distingue acumulado da sessão, delta do intervalo, cobertura e duração; validação desktop/mobile, incluindo valores grandes e zero real.

## Fora do escopo

Cobrança financeira, preços por provedor, atribuição retroativa sem evidências, monitoramento automático do harness e divisão arbitrária de tokens entre tarefas.
