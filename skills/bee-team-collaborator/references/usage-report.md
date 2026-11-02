# Relatório obrigatório por novo resumo de execução

## Descobrir no início e reutilizar a estratégia

No início da atuação, investigue proporcionalmente como capturar dados da sessão correta: ferramentas e APIs expostas pelo harness, arquivos locais permitidos e específicos da sessão e documentação oficial; consulte a web quando não souber o contrato. Não declare indisponibilidade antes dessa investigação. Registre uma estratégia reutilizável com fonte, superfície/harness/versão observados, sessão/ator identificáveis, campos disponíveis, semântica, limitações e data da verificação. Guarde esse contexto operacional no mecanismo permitido disponível, sem inventar campo persistente Bee Team nem instalar coletor. Reuse a estratégia até mudança de versão, fonte, sessão ou semântica exigir revalidação; não reutilize uma medição antiga como se fosse atual.

Uma skill não recebe telemetria por estar instalada. Confira a capacidade efetiva antes de consultar. Não instale hooks, SDKs ou coletores, não altere configurações e não inicie execuções pagas para obter métricas. Não leia segredos, transcrições completas nem outras sessões. Prefira contadores/metadados mínimos. Uma configuração de modelo prova seleção/configuração, não necessariamente o modelo efetivo de cada request; Auto, fallback e subagentes podem usar outros modelos.

## Consultar a cada novo resumo

Antes de inserir cada novo resumo histórico de execução, consulte dados atualizados pela estratégia validada e envie o usageReport obrigatório conforme o contrato real, com medições verificadas ou indisponibilidade explícita. Preserve múltiplos modelos/harnesses/atores/períodos quando observados, com proveniência verificável. Mantenha o relatório estruturado separado de summary/currentSummary em Markdown; não use comentários ou sidebar como armazenamento de telemetria. Comentário, percentual de progresso isolado ou leitura de prompt não exigem resumo artificial; toda mudança de status, porém, exige registrar resumo atomicamente com statusObserved e usageReport, inclusive início/retomada/revisão.

Todo novo resumo precisa de usageReport. Se a coleta falhar ou não produzir os dados exigidos, envie unavailable estruturado com motivo e tentativas verificáveis; não omita silenciosamente o relatório. Ausência não é zero. Nunca invente números, modelo efetivo, IDs de evidência ou investigação não realizada. Se nem a indisponibilidade puder ser representada validamente, mantenha o registro pendente, exponha a limitação pelo protocolo vigente e não anuncie salvamento. Em erro de validação/persistência, corrija ou reconcilie antes de tentar novamente, sem contornar o requisito.

## Semântica antes de contabilizar

Diferencie consumo reportado de estimativa, ocupação de contexto, créditos e custo. Não converta contexto percentual ou créditos em tokens exatos. Preserve categorias input/output/cache e escopo request/turn/session/tree conforme fonte; não some categorias sobrepostas. Modelo configurado não vira modelo observado por inferência.

Contadores cumulativos são snapshots: guarde baseline/época apropriados e só derive delta de medidas comparáveis da mesma fonte/sessão/escopo. Reset, rotação, compaction, troca de modelo, retomada e retry podem invalidar comparação; revalide em vez de produzir delta negativo, somar snapshots ou contar replay duas vezes. Não atribua consumo de sessão compartilhada a uma task/ator sem evidência. Não some totais de árvore com os mesmos subagentes novamente. Use apenas variantes e regras aceitas no contrato abaixo; se não puder atribuir com confiança, preserve a limitação na atribuição/indisponibilidade estruturada, sem omitir o relatório nem fabricar precisão.

## Persistir o trabalho continua obrigatório

O relatório obrigatório não substitui os demais registros: descrição/specification, plano, resumo histórico, currentSummary, status e aprovação continuam distintos. Encerrar execução não significa Concluído se validação humana exigida estiver pendente. Depois de confirmar persistência do resumo e relatório válido, siga o protocolo de comentário completo, confirmação de persistência e notificação com commentID; não transporte detalhes/métricas em chat. Leituras e replays legados sem relatório permanecem válidos e não são retropreenchidos por suposição.

## Contrato estruturado confirmado com o Backend

Confira o schema do runtime conectado antes de escrever: atualizar a skill não publica ferramentas. Nas novas gravações, `RecordExecution.usageReport` é obrigatório em `createExecutionSummary` e em `close_activity.execution`; ausência/null não substituem um relatório válido. `SummaryUsageInput` contém `entries` com 1 a 32 observações; array vazio não declara indisponibilidade. Preserve os demais campos de negócio obrigatórios. Leituras antigas e replay idempotente de gravações legadas não exigem inventar ou retropreencher dados.

Cada `UsageObservation` declara todos os campos do exemplo abaixo. `modelId`, `provider`, `harnessVersion`, `previousEvidenceId`, `periodStart`, `periodEnd`, os quatro contadores e `discovery` aceitam null. `source`, `harness`, `surface`, `sessionId`, `epoch` e `evidenceId` precisam ser strings não vazias. Para medições, use identificadores observados; indisponibilidade usa os marcadores explícitos descritos abaixo, sem fingir que são IDs de execução. `actor` contém `kind` (agent/human) e `id`: agent exige UUIDv7 de agente persistido; human permite null. Não use human para contornar identificação de um agente real; `actorRole` aceita leader/collaborator/human/unknown. `observedAt` e datas de período usam RFC3339.

Contadores são strings decimais inteiras entre 0 e 9223372036854775807 ou null: `inputTokens` e `outputTokens` são inclusivos; `cachedInputTokens` e `reasoningOutputTokens` são subconjuntos, nunca somas adicionais. Em measured/estimated, ao menos inputTokens OU outputTokens deve ser conhecido; preserve null para categoria não observada. modelId/provider/harnessVersion desconhecidos permanecem null, sem inferir modelo efetivo de configuração. `quality` aceita measured/estimated/unavailable; `attribution` aceita exact/shared/unallocated. Totais session_tree e atribuições shared/unallocated ficam fora do total da task; não force exact para fazê-los entrar.

`reportKind: period_delta` só aceita `scope: request`, com evidenceId estável e previousEvidenceId null. `cumulative_snapshot` só aceita session/session_tree: o primeiro snapshot estabelece baseline com delta null. A referência previousEvidenceId precisa existir para a mesma fonte/sessão/época/ator/modelo/harness, ser anterior e não criar fork ou sobreposição. Avance o último checkpoint comparável, sem contornar baseline mais recente; scope/provider, harnessVersion, quality e attribution também precisam ser comparáveis. Modelo diferente ou mudança de comparabilidade precisa de baseline próprio. Use nova época real após reset; não reinicie arbitrariamente a cadeia para reutilizar consumo. A identidade global da evidência é source + sessionId + epoch + evidenceId: conteúdo alterado retorna 409; referência repetida não soma de novo. Não derive delta local incompatível com essas regras.

Quando não houver medição válida, envie `reportKind: unavailable`, quatro contadores null, quality unavailable e discovery com reason e attempts factuais (ao menos uma tentativa). Não use essa alternativa sem investigar e tentar coletar; falha não autoriza omitir usageReport. A coleta real pode ser indisponível, mas a declaração explícita precisa atender ao contrato. Quando a sessão/época não forem observáveis, use sessionId e epoch iguais a "unavailable"; evidenceId identifica unicamente a tentativa de coleta, não uma execução fabricada, e permanece estável no retry da mesma tentativa. Use harness/surface efetivos quando conhecidos; "unknown" somente com explicação em discovery. source identifica a fonte/tentativa de descoberta. Modelo/provider/versão desconhecidos ficam null. Cada item de attempts precisa ser factual e não vazio; não use arrays vazios ou texto em branco. Falha de coleta não impede enviar esse relato explícito.

Exemplo sintético apenas da propriedade usageReport, não de uma requisição completa nem de dados reais; nunca copie os identificadores/valores para um registro de trabalho:

```json
{
  "usageReport": {
    "entries": [{
      "source": "example-api", "harness": "example-harness", "surface": "api",
      "harnessVersion": null, "sessionId": "example-session", "epoch": "example-epoch",
      "evidenceId": "example-request-1", "previousEvidenceId": null,
      "actor": {"kind": "human", "id": null}, "actorRole": "human",
      "provider": null, "modelId": null, "scope": "request",
      "reportKind": "period_delta", "quality": "measured", "attribution": "unallocated",
      "observedAt": "2026-10-31T00:00:00Z", "periodStart": null, "periodEnd": null,
      "inputTokens": "100", "outputTokens": "20",
      "cachedInputTokens": null, "reasoningOutputTokens": null, "discovery": null
    }]
  }
}
```

Exemplo sintético de indisponibilidade, também sem enviar a API. Substitua motivo/tentativas por observações reais; não copie a investigação fictícia:

```json
{
  "usageReport": {
    "entries": [
      {
        "source": "example-discovery",
        "harness": "example-harness",
        "surface": "api",
        "harnessVersion": null,
        "sessionId": "unavailable",
        "epoch": "unavailable",
        "evidenceId": "example-collection-attempt-1",
        "previousEvidenceId": null,
        "actor": {
          "kind": "human",
          "id": null
        },
        "actorRole": "human",
        "provider": null,
        "modelId": null,
        "scope": "session",
        "reportKind": "unavailable",
        "quality": "unavailable",
        "attribution": "unallocated",
        "observedAt": "2026-10-31T00:00:00Z",
        "periodStart": null,
        "periodEnd": null,
        "inputTokens": null,
        "outputTokens": null,
        "cachedInputTokens": null,
        "reasoningOutputTokens": null,
        "discovery": {
          "reason": "Exemplo sintético: superfície consultada não expõe sessão nem consumo.",
          "attempts": [
            "Exemplo sintético: consulta das capacidades expostas retornou ausência de telemetria."
          ]
        }
      }
    ]
  }
}
```

Evidência posterior pode ser anexada via `reconcileSummaryUsage`, com taskId e summaryId reais, corpo SummaryUsageInput e expectedVersion da própria summary (If-Match no HTTP), além de ator/idempotência conforme catálogo. HTTP: POST `/api/v1/tasks/{taskId}/execution-summaries/{summaryId}/usage-revisions`. Isso não altera status nem texto narrativo; não crie novo resumo artificial ou reenvie encerramento para preencher métricas. Reconcile versão/conflito antes de retry e preserve o protocolo de comentário/notificação quando houver comunicação substantiva de trabalho.

O relatório persistido completo aceita até 65536 bytes UTF-8 e 256 entradas incluindo suplementos (32 por requisição). Não crie resumo artificial nem descarte evidência para contornar limites; trate a falha e registre a limitação.
