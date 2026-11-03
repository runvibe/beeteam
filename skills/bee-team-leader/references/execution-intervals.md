# Execuções e intervalos explícitos por tarefa

## Iniciar antes de trabalhar

Antes de executar trabalho da task atribuída, consulte os registros de execução/intervalo da tarefa e da fonte/sessão pelas leituras realmente anunciadas no contrato. Na retomada de chat, recupere o intervalo ativo antes de criar outro. Se a mesma task/fonte já tiver intervalo aberto válido, continue com executionId/intervalId existentes: não emita outro start ou resume. Resume é para execução pausada, não para mera reabertura do chat. taskId, executionId e intervalId são vínculos técnicos retornados pelo servidor: mantenha-os no contexto permitido e recupere-os da API quando faltarem. Não deduza IDs, pares de fronteiras ou estado a partir do texto de um resumo, status, nome, proximidade de horários ou título do chat.

Investigue no início a fonte permitida de acumulados; preserve fonte, sessão, epoch, escopo, semântica de contador, agente e modelo(s). Colete antes de cada fronteira e resumo. Não converta créditos/contexto em tokens nem instale coletores/integrações ou faça chamadas pagas só para medir sem autorização específica. Não é necessária uma sessão nova por tarefa.

Se não houver intervalo ativo incompatível e o trabalho estiver autorizado/atribuído/preparado, registre resumo de início com evidências reais e ação de início conforme contrato. Só comece depois de confirmar persistência e obter executionId/intervalId reais. Se já existir intervalo aberto da mesma fonte em outra task, não abra sobreposto e não encerre a anterior automaticamente; consulte o conflito e resolva a transição explicitamente. Mudar agente não contorna exclusividade da fonte.

## Checkpoint, troca, retomada e fim

Checkpoint registra nova evidência/resumo no intervalo aberto, preservando seu início; não cria intervalo novo nem declara fim. Parcial é parcial, não consumo final. Nunca some deltas intermediários ao delta final.

Antes de trocar de tarefa, colete e salve pausa ou encerramento do intervalo atual, referenciando seus IDs. Só após confirmação abra o intervalo da próxima tarefa. Pausa fecha o intervalo e mantém execução pausada. Resume abre novo intervalo na mesma execução com nova fronteira inicial; o período parado fica fora do consumo atribuído. Não reutilize intervalId fechado como novo intervalo.

Finish encerra a execução e fecha o intervalo aberto; quando já pausada, não inventa consumo para o período parado. Nesse caso ainda envie usageReport estrito normal no resumo, com evidenceIds vazio e sem intervalId; as observações não criam fronteira nem consumo do período pausado. Finalizar intervalo/execução não significa aprovar entrega ou concluir status da task: revisão humana pode continuar pendente. Preserve status, outcome, currentSummary, summary e aceite como dimensões distintas.

A mudança de status continua exclusivamente via registro de resumo, com usageReport e statusObserved gerado pelo servidor. No rollout aditivo, executionTracking é opcional no servidor: ausência salva resumo sem rastreamento e nunca cria fronteira implícita. Esta skill orienta rastrear o trabalho novo quando a capacidade estiver disponível; não declare intervalo salvo num resumo sem tracking nem trate opcionalidade da API como fronteira automática. Resumo, status, evidências e transição do intervalo precisam ser atômicos e idempotentes. close_activity só pode ser usado quando o contrato suportar essa mesma operação completa; percentual isolado e comentário continuam caminhos separados, sem implicitamente iniciar/fechar intervalo.

## Evidência, cálculo e limites

Acumulado da sessão é diferente de consumo atribuído ao intervalo. O servidor calcula final - inicial apenas entre evidências explicitamente vinculadas e comparáveis. A exclusividade de dedicação à tarefa é declaração do agente, não prova produzida pelos contadores. Consumo até a coleta final não cobre geração ou chamadas posteriores; a mesma limitação vale para a mensagem/ferramenta usada para registrar início. Não prometa precisão por chamada se só há snapshots.

Não somar checkpoints, árvore com filhos, total global com parcelas, nem pares escolhidos por horário. Fonte/sessão/epoch/escopo e semântica devem corresponder. Mudança de modelo não prova reset do contador global: preserve modelos envolvidos e só divida consumo se a fonte fornecer séries realmente disjuntas. Não atribua tudo ao último modelo nem invente uma divisão.

Reset, queda do contador, lacuna ou fonte incompatível produzem cobertura incompleta/indisponível com motivo; nunca delta negativo ou zero fabricado. Sem fim, intervalo permanece aberto; sem início, histórico continua legível sem consumo retroativo inventado. Não reconstrua intervalos legados por status, texto ou horário. Correção/reconciliação precisa de trilha auditável e versão conforme contrato, não edição silenciosa das fronteiras.

Duração observada é diferença entre horários das evidências, não CPU/raciocínio/produtividade. Soma de duração de trabalho e tempo decorrido da task são diferentes, sobretudo com sessões paralelas; não some sobreposições e chame de tempo decorrido.

## Falhas e retomada

Falha de coleta: salve comentário de impedimento com tentativas reais, confirme persistência e notifique por task/commentID. Não invente medição nem declare pausa/fim/resumo salvos; o intervalo fica aberto/incompleto até correção explícita. Queda do agente não fecha intervalo automaticamente. Recuperação consulta estado real e cobertura perdida antes de registrar ação suportada.

Em timeout, consulte os registros e reutilize chave/conteúdo idempotentes quando cabível, recuperando os mesmos IDs. Em conflito de outra task/sessão/agente ou início concorrente, não substitua IDs nem repita criação cegamente. Erro não autoriza alegar efeitos parciais ou mudança de status. Mantêm-se comentário completo e notificação referencial após persistência; executionId/intervalId não são commentID.

## Contrato de escrita e leitura

Contrato alinhado com o Backend; confirme disponibilidade/schema no runtime conectado antes de enviar payload. RecordExecution.executionTracking é opcional no rollout e compartilha transação/chave idempotente com resumo/status/usage. Ações: start, checkpoint, pause, resume, finish. executionId é exigido após start; intervalId é exigido em checkpoint/pause/finish ativo e omitido em start/resume/finish já pausado. evidenceIds seleciona explicitamente entradas do usageReport, não vazias exceto finish pausado. evidenceIds contém strings observation.evidenceId, resolvidas exatamente dentro do usageReport da mesma chamada. reason é opcional; coverageLost true exige reason não vazio e só se aplica em checkpoint/pause/finish ativo: encerra comparabilidade e abre segmento com a nova evidência, preservando fechamento incomplete. Não use para inventar cobertura recuperada.

Start exige counterMode global ou per_model e coverageRootSessionId: identidade real da sessão raiz (sessionId se sessão isolada). global seleciona exatamente um contador; troca de modelo preserva os modelos envolvidos, sem atribuir o delta ao último. per_model declara séries disjuntas reais, não uma divisão estimada. Evidências selecionadas têm attribution unallocated para não duplicar atribuição no ledger legado. Não altere contadores/modelos observados para satisfazer modo ou requisitos.

Execução fixa source/harness/surface/session/scope/agent e raiz de cobertura. O lock source/root não depende de agente/modelo/epoch/scope; árvore e filhos declaram a mesma raiz real. Não troque root, agente ou epoch para contornar intervalo aberto. Metadados não são autenticação nem prova de exclusividade; o servidor não descobre filhos automaticamente. Reset/lacuna encerra comparabilidade com cobertura incompleta e segmento novo conforme operação suportada.

A resposta traz executionSummary.executionTracking com action, executionId, intervalId (null no finish pausado), executionState active/paused/finished e intervalState open/closed/incomplete/null. close_activity também retorna executionSummary, preservando campos anteriores. Guarde os IDs exatos desse resultado; em resposta direta consulte o envelope real em vez de inventar caminho. Replays conservam IDs/resultado. expectedVersion/If-Match nas ações de resumo e close_activity é da task; na reconciliação é a versão do intervalo. Não use executionId como versão nem confunda version com revision.

Leituras anunciadas (confira catálogo e envelopes params/query antes de chamar):

| Necessidade | HTTP GET | Operação MCP |
| --- | --- | --- |
| Execuções da task | /api/v1/tasks/{taskId}/executions | listTaskExecutions |
| Intervalos da task | /api/v1/tasks/{taskId}/execution-intervals | listTaskExecutionIntervals |
| Eventos explícitos | /api/v1/tasks/{taskId}/execution-tracking-events | listTaskExecutionTrackingEvents |
| Total completo, independente da página | /api/v1/tasks/{taskId}/execution-interval-usage | getTaskExecutionIntervalUsage |
| Intervalos abertos entre tasks | /api/v1/execution-intervals | listOpenExecutionIntervals |
| Revisões auditáveis | /api/v1/tasks/{taskId}/execution-intervals/{intervalId}/revisions | listTaskExecutionIntervalRevisions |

A consulta global usa source/sessionId/coverageRootSessionId/agentId e retorna abertos por padrão. listTaskExecutions filtra state; listTaskExecutionIntervals filtra state/executionId. As listas e revisões aceitam offset/limit; eventos e totais usam os parâmetros anunciados no catálogo, sem filtros inventados. Para detectar sobreposição, não limite a busca ao próprio agente se isso ocultar a mesma fonte em uso por outro. Pagine offset/limit com items/total/hasMore/nextOffset; IDs e startSummaryId/endSummaryId fornecem vínculos, não horários. Guarde também IDs de evidência e cobertura de fronteiras confirmadas.

Totais: validTotalTokens exclui intervalos open/incomplete/invalid; partes conhecidas ficam em partialTotalTokens. Durações observedDurationMs (soma) e elapsedDurationMs (união dos períodos fechados) são distintas. Valores são strings decimais; ausência null, zero real "0". Use o agregado completo, não some apenas a página listada. coverage inclui contagens de intervalos válidos, abertos, incompletos, inválidos e resumos sem rastreamento.

reconcileTaskExecutionInterval corresponde a POST /api/v1/tasks/{taskId}/execution-intervals/{intervalId}/revisions: referencia fronteiras por summaryId/evidenceId, reason e expectedVersion, preservando revisão anterior. O corpo ReconcileExecutionInterval aceita reason, invalidate, startEvidence e endEvidence; fronteiras são arrays de {summaryId,evidenceId}, se fornecidas. expectedVersion fica no envelope/If-Match, não no corpo. Confira o catálogo antes de enviar. Correção não muda evidência/resumo original nem reabre silenciosamente intervalo fechado; preserva identidade/não sobreposição. Perdida cobertura não vira zero nem preenchimento retroativo presumido.

## Exemplos de sequência (sem payload inventado)

Start: coletar snapshot real; selecionar sua evidência com attribution unallocated, counterMode correspondente à fonte e raiz real; enviar resumo com start; confirmar executionId/intervalId antes de trabalhar. Checkpoint: enviar IDs ativos e nova evidência sem fechar. Pause: coletar fronteira e fechar intervalo ativo antes de trocar. Resume: mesma executionId, sem intervalId antigo; nova evidência inicial e novo intervalId retornado. Finish ativo: executionId/intervalId e fronteira final; finish pausado: executionId sem intervalId e sem inventar evidência de período parado. Finish pausado ainda exige usageReport estrito normal, porém evidenceIds vazio não cria nova fronteira. Em todos os casos mantêm-se os campos obrigatórios do resumo e a versão da task.

Retomada: consultar listOpenExecutionIntervals e registros da task; se ativo válido da mesma task/fonte, continuar com seus IDs, não start/resume novo. Se fonte ocupada por outra task, tratar conflito e fechar/pausar explicitamente só quando autorizado, sem fechamento automático. Falha de coleta mantém aberto/incompleto e produz comentário/aviso de impedimento, nunca resumo/fim fictícios. Obter prompts permanece leitura, sem executar essas sequências.

Cenário conceitual, sem chamada de API: A inicia em1000 e pausa em1300; B usa a sessão; A retoma em2000 e termina em2200. A tem dois intervalos e300+200=500, não1200. Em outra sequência, A fecha em1600 e B abre em1650: os50 entre fronteiras não pertencem a nenhuma tarefa. Os números não são evidências reais nem devem ser enviados ao servidor.

## Exemplos sintéticos de corpo e fragmentos

Não executar estes exemplos nem copiar IDs, nomes, contadores ou fontes para registros reais. O primeiro JSON é somente RecordExecution (corpo de createExecutionSummary ou valor execution em close_activity), não o envelope de ator/versão/idempotência. taskId continua no caminho/params; executionContext preserva a raiz/origem real. Os demais JSONs mostram somente a propriedade executionTracking: completar o restante do resumo e usageReport válido, com cada evidenceId selecionado presente naquela chamada. UUIDs de execution/interval devem vir da resposta real, nunca destes marcadores sintéticos.

```json
{
  "currentSummary": "Exemplo sintético: preparação concluída; início pendente de confirmação.",
  "summary": "Exemplo sintético de fronteira inicial.",
  "outcome": "progress",
  "statusId": "10000000-0000-7000-8000-000000000003",
  "deliverables": [],
  "pending": [
    "Executar somente após confirmar início"
  ],
  "executionContext": {
    "rootTaskId": "10000000-0000-7000-8000-000000000001",
    "originBoardId": "10000000-0000-7000-8000-000000000004"
  },
  "usageReport": {
    "entries": [
      {
        "source": "example-session-log",
        "harness": "example-harness",
        "surface": "cli",
        "harnessVersion": null,
        "sessionId": "example-session",
        "epoch": "example-epoch",
        "evidenceId": "example-start",
        "previousEvidenceId": null,
        "actor": {
          "kind": "agent",
          "id": "10000000-0000-7000-8000-000000000002"
        },
        "actorRole": "collaborator",
        "provider": "example-provider",
        "modelId": "example-observed-model",
        "scope": "session",
        "reportKind": "cumulative_snapshot",
        "quality": "measured",
        "attribution": "unallocated",
        "observedAt": "2026-11-03T10:00:00Z",
        "periodStart": null,
        "periodEnd": null,
        "inputTokens": "1000",
        "outputTokens": "200",
        "cachedInputTokens": null,
        "reasoningOutputTokens": null,
        "totalTokens": "1200",
        "discovery": null
      }
    ]
  },
  "executionTracking": {
    "action": "start",
    "evidenceIds": [
      "example-start"
    ],
    "counterMode": "global",
    "coverageRootSessionId": "example-session"
  }
}
```

Checkpoint sem fechar:

```json
{
  "executionTracking": {
    "action": "checkpoint",
    "executionId": "10000000-0000-7000-8000-000000000005",
    "intervalId": "10000000-0000-7000-8000-000000000006",
    "evidenceIds": [
      "example-checkpoint"
    ]
  }
}
```

Pausa antes de trocar tarefa:

```json
{
  "executionTracking": {
    "action": "pause",
    "executionId": "10000000-0000-7000-8000-000000000005",
    "intervalId": "10000000-0000-7000-8000-000000000006",
    "evidenceIds": [
      "example-pause"
    ]
  }
}
```

Retomada: novo intervalId será retornado:

```json
{
  "executionTracking": {
    "action": "resume",
    "executionId": "10000000-0000-7000-8000-000000000005",
    "evidenceIds": [
      "example-resume"
    ]
  }
}
```

Fim ativo, independente de aceite/status final:

```json
{
  "executionTracking": {
    "action": "finish",
    "executionId": "10000000-0000-7000-8000-000000000005",
    "intervalId": "10000000-0000-7000-8000-000000000006",
    "evidenceIds": [
      "example-finish"
    ]
  }
}
```

Fim já pausado: usageReport continua obrigatório, sem fronteira adicional:

```json
{
  "executionTracking": {
    "action": "finish",
    "executionId": "10000000-0000-7000-8000-000000000005",
    "evidenceIds": []
  }
}
```

Checkpoint com lacuna explicitamente declarada; não completa cobertura perdida:

```json
{
  "executionTracking": {
    "action": "checkpoint",
    "executionId": "10000000-0000-7000-8000-000000000005",
    "intervalId": "10000000-0000-7000-8000-000000000006",
    "evidenceIds": [
      "example-after-gap"
    ],
    "coverageLost": true,
    "reason": "Exemplo sintético: intervalo sem observação verificável antes desta evidência."
  }
}
```
