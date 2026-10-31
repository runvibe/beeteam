# Métricas opcionais por resumo de execução

## Descobrir no início e reutilizar a estratégia

No início da atuação, investigue proporcionalmente como capturar dados da sessão correta: ferramentas e APIs expostas pelo harness, arquivos locais permitidos e específicos da sessão e documentação oficial; consulte a web quando não souber o contrato. Não declare indisponibilidade antes dessa investigação. Registre uma estratégia reutilizável com fonte, superfície/harness/versão observados, sessão/ator identificáveis, campos disponíveis, semântica, limitações e data da verificação. Guarde esse contexto operacional no mecanismo permitido disponível, sem inventar campo persistente Bee Team nem instalar coletor. Reuse a estratégia até mudança de versão, fonte, sessão ou semântica exigir revalidação; não reutilize uma medição antiga como se fosse atual.

Uma skill não recebe telemetria por estar instalada. Confira a capacidade efetiva antes de consultar. Não instale hooks, SDKs ou coletores, não altere configurações e não inicie execuções pagas para obter métricas. Não leia segredos, transcrições completas nem outras sessões. Prefira contadores/metadados mínimos. Uma configuração de modelo prova seleção/configuração, não necessariamente o modelo efetivo de cada request; Auto, fallback e subagentes podem usar outros modelos.

## Consultar a cada novo resumo

Antes de inserir cada novo resumo histórico de execução, consulte dados atualizados pela estratégia validada e anexe somente métricas opcionais suportadas pelo contrato real. Preserve múltiplos modelos/harnesses/atores/períodos quando observados, com proveniência verificável. Mantenha o relatório estruturado separado de summary/currentSummary em Markdown; não use comentários ou sidebar como armazenamento de telemetria. Uma edição de comentário/status ou leitura de prompt não exige criar resumo artificial.

Resumo pode ser salvo SEM modelo, harness, tokens ou usageReport. Falha de coleta NÃO bloqueia o resumo: omita os dados não comprovados; não é obrigatório enviar sequer uma declaração unavailable. Ausência não é zero. Explique limitação factual quando pertinente ao resultado, sem inventar números, IDs de evidência, modelos efetivos ou uma investigação não realizada. Só represente unavailable se o contrato suportar e houver evidência da tentativa, nunca como requisito para salvar.

## Semântica antes de contabilizar

Diferencie consumo reportado de estimativa, ocupação de contexto, créditos e custo. Não converta contexto percentual ou créditos em tokens exatos. Preserve categorias input/output/cache e escopo request/turn/session/tree conforme fonte; não some categorias sobrepostas. Modelo configurado não vira modelo observado por inferência.

Contadores cumulativos são snapshots: guarde baseline/época apropriados e só derive delta de medidas comparáveis da mesma fonte/sessão/escopo. Reset, rotação, compaction, troca de modelo, retomada e retry podem invalidar comparação; revalide em vez de produzir delta negativo, somar snapshots ou contar replay duas vezes. Não atribua consumo de sessão compartilhada a uma task/ator sem evidência. Não some totais de árvore com os mesmos subagentes novamente. Use apenas variantes e regras aceitas no contrato abaixo; se não puder atribuir com confiança, preserve a limitação e omita o dado em vez de fabricar precisão.

## Persistir o trabalho continua obrigatório

Métricas são opcionais; descrição/specification, plano, resumo histórico, currentSummary, status e aprovação continuam distintos. Encerrar execução não significa Concluído se validação humana exigida estiver pendente. Depois de salvar resumo e dados opcionais válidos, siga o protocolo de comentário completo, confirmação de persistência e notificação com commentID; não transporte detalhes/métricas em chat. Leituras e replays legados sem relatório permanecem válidos e não são retropreenchidos por suposição.

## Contrato estruturado confirmado com o Backend

Confira o schema do runtime conectado antes de escrever: atualizar a skill não publica ferramentas. `RecordExecution.usageReport` é opcional ou null em `createExecutionSummary` e em `close_activity.execution`. Para salvar sem métricas, omita essa propriedade e mantenha os demais campos de negócio obrigatórios. Quando presente, `SummaryUsageInput` contém `entries` com 1 a 32 observações; não envie array vazio como declaração de ausência.

Cada `UsageObservation` declara todos os campos do exemplo abaixo. `modelId`, `provider`, `harnessVersion`, `previousEvidenceId`, `periodStart`, `periodEnd`, os quatro contadores e `discovery` aceitam null. `source`, `harness`, `surface`, `sessionId`, `epoch` e `evidenceId` precisam ser strings não vazias observadas; não invente esses identificadores para preencher o schema. `actor` contém `kind` (agent/human) e `id`: agent exige UUIDv7 de agente persistido; human permite null. Não use human para contornar identificação de um agente real; `actorRole` aceita leader/collaborator/human/unknown. `observedAt` e datas de período usam RFC3339.

Contadores são strings decimais inteiras não negativas ou null: `inputTokens` e `outputTokens` são inclusivos; `cachedInputTokens` e `reasoningOutputTokens` são subconjuntos, nunca somas adicionais. Preserve null para categoria não observada. `quality` aceita measured/estimated/unavailable; `attribution` aceita exact/shared/unallocated. Totais session_tree e atribuições shared/unallocated ficam fora do total da task; não force exact para fazê-los entrar.

`reportKind: period_delta` só aceita `scope: request`, com evidenceId estável e previousEvidenceId null. `cumulative_snapshot` só aceita session/session_tree: o primeiro snapshot estabelece baseline com delta null. A referência previousEvidenceId precisa existir para a mesma fonte/sessão/época/ator/modelo/harness, ser anterior e não criar fork ou sobreposição. Modelo diferente precisa de baseline próprio. Use nova época real após reset; não reinicie arbitrariamente a cadeia para reutilizar consumo. A identidade global da evidência é source + sessionId + epoch + evidenceId: conteúdo alterado retorna 409; referência repetida não soma de novo. Não derive delta local incompatível com essas regras.

`unavailable` é opcional. Se escolhido, exige quatro contadores null, quality unavailable e discovery com reason e attempts factuais (ao menos uma tentativa). A alternativa normal continua sendo omitir usageReport e salvar o resumo, sem declarar unavailable.

Exemplo sintético apenas da propriedade opcional, não de uma requisição completa nem de dados reais; nunca copie os identificadores/valores para um registro de trabalho:

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

Evidência posterior pode ser anexada via `reconcileSummaryUsage`, com taskId e summaryId reais, corpo SummaryUsageInput e expectedVersion da própria summary (If-Match no HTTP), além de ator/idempotência conforme catálogo. HTTP: POST `/api/v1/tasks/{taskId}/execution-summaries/{summaryId}/usage-revisions`. Isso não altera status nem texto narrativo; não crie novo resumo artificial ou reenvie encerramento para preencher métricas. Reconcile versão/conflito antes de retry e preserve o protocolo de comentário/notificação quando houver comunicação substantiva de trabalho.
