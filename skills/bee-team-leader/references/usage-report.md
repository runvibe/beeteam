# Relatório obrigatório por novo resumo de execução

## Descobrir no início e reutilizar a estratégia

No início da atuação, investigue proporcionalmente como capturar dados da sessão correta: ferramentas e APIs expostas pelo harness, arquivos locais permitidos e específicos da sessão e documentação oficial; consulte a web quando não souber o contrato. Não declare indisponibilidade antes dessa investigação. Registre uma estratégia reutilizável com fonte, superfície/harness/versão observados, sessão/ator identificáveis, campos disponíveis, semântica, limitações e data da verificação. Guarde esse contexto operacional no mecanismo permitido disponível, sem inventar campo persistente Bee Team nem instalar coletor. Reuse a estratégia até mudança de versão, fonte, sessão ou semântica exigir revalidação; não reutilize uma medição antiga como se fosse atual.

Uma skill não recebe telemetria por estar instalada. Confira a capacidade efetiva antes de consultar. Não instale hooks, SDKs ou coletores, não altere configurações e não inicie execuções pagas para obter métricas. Não leia segredos, transcrições completas nem outras sessões. Prefira contadores/metadados mínimos. Uma configuração de modelo prova seleção/configuração, não necessariamente o modelo efetivo de cada request; Auto, fallback e subagentes podem usar outros modelos.

## Consultar a cada novo resumo

Antes de inserir cada novo resumo histórico de execução, consulte dados atualizados pela estratégia validada e envie o usageReport obrigatório conforme o contrato real, com tokens reais, modelo identificado, harness, agente e fonte verificáveis. Preserve múltiplos modelos/harnesses/atores/períodos quando observados, com proveniência verificável. Mantenha o relatório estruturado separado de summary/currentSummary em Markdown; não use comentários ou sidebar como armazenamento de telemetria. Comentário, percentual de progresso isolado ou leitura de prompt não exigem resumo artificial; toda mudança de status, porém, exige registrar resumo atomicamente com statusObserved e usageReport, inclusive início/retomada/revisão.

Esta skill exige tokens reais, modelo identificado, harness, agente e fonte antes de cada novo resumo, usando o usageReport atual. unavailable, justificativa e número inventado não substituem a coleta. Ausência não é zero. Se não houver fonte confiável ou não for possível identificar modelo/harness/agente/escopo, mantenha o registro e a transição pendentes; salve explicação e tentativas reais em comentário, confirme persistência e notifique com commentID. Bloqueio efetivo pode ser registrado como flag separada conforme contrato, sem mudar status por atalho. Não anuncie resumo salvo. Falha também no comentário exige reconciliação, sem fabricar ID ou aviso de sucesso.

## Semântica antes de contabilizar

Diferencie consumo reportado de estimativa, ocupação de contexto, créditos e custo. Não converta contexto percentual ou créditos em tokens exatos. Preserve categorias input/output/cache e escopo request/turn/session/tree conforme fonte; não some categorias sobrepostas. Modelo configurado não vira modelo observado por inferência.

Contadores cumulativos são snapshots: guarde baseline/época apropriados e só derive delta de medidas comparáveis da mesma fonte/sessão/escopo. Reset, rotação, compaction, troca de modelo, retomada e retry podem invalidar comparação; revalide em vez de produzir delta negativo, somar snapshots ou contar replay duas vezes. Não atribua consumo de sessão compartilhada a uma task/ator sem evidência. Não some totais de árvore com os mesmos subagentes novamente. Use apenas variantes e regras aceitas no contrato abaixo; preserve o escopo comprovado sem forçar atribuição exata à task. Falta de delta inicial não invalida, por si só, um snapshot real.

## Persistir o trabalho continua obrigatório

O relatório obrigatório não substitui os demais registros: descrição/specification, plano, resumo histórico, currentSummary, status e aprovação continuam distintos. Encerrar execução não significa Concluído se validação humana exigida estiver pendente. Depois de confirmar persistência do resumo e relatório válido, siga o protocolo de comentário completo, confirmação de persistência e notificação com commentID; não transporte detalhes/métricas em chat. Leituras e replays legados sem relatório permanecem válidos e não são retropreenchidos por suposição.

## Contrato atual e obrigação da skill

Use `RecordExecution.usageReport: {entries: [...]}` em createExecutionSummary ou close_activity.execution, com 1 a 32 entradas por chamada. Não adicione tokenUsage, totalTokens ou qualquer campo novo ao payload. As instruções de coleta desta skill são mais exigentes que a validação atual do servidor: o schema existente ainda contempla campos anuláveis, medições parciais, human/null e unavailable. Isso não autoriza esta skill a inventar dados ou usar justificativa para substituir a medição solicitada. Compatibilidade histórica/replay permanece responsabilidade do serviço; não use formato legado como atalho de nova gravação.

Os contadores atuais são strings decimais inteiras não negativas até 9223372036854775807, não números JSON: inputTokens/outputTokens são inclusivos, cachedInputTokens/reasoningOutputTokens são subconjuntos. Quando ambos os totais inclusivos forem conhecidos, input + output informa o total daquele escopo sem somar cache/raciocínio novamente. Não preencha componente desconhecido com zero nem invente decomposição para um total isolado. Use somente o que a fonte e o contrato conseguem representar; explique lacunas por comentário. O eventual campo novo de total ainda não está definido.

Cada observação declara source, harness, surface, harnessVersion, sessionId, epoch, evidenceId, previousEvidenceId, actor, actorRole, provider, modelId, scope, reportKind, quality, attribution, observedAt, periodStart, periodEnd, os quatro contadores e discovery. Para o agente atuante, actor é kind agent com UUIDv7 persistido e actorRole leader/collaborator conforme papel real; não use human/null para contornar identificação. modelId identifica modelo observado; harness/source/surface/session/epoch/evidenceId vêm de evidência real. Provider/versão/períodos/subcategorias desconhecidos podem permanecer null conforme schema, sem transformar configuração em observação. observedAt e períodos usam RFC3339.

`period_delta` exige scope request e previousEvidenceId null. `cumulative_snapshot` aceita session/session_tree: o primeiro snapshot real é baseline com delta null, sem consumo histórico inferido. Não o rejeite apenas por ser inicial. A decisão de exigir consumo exclusivo da task versus aceitar acumulado por escopo ainda está pendente; não a resolva por suposição nem transforme baseline em delta de tarefa. Preserve explicitamente scope e attribution reais (exact/shared/unallocated); árvore, shared e unallocated ficam fora do total exato da task. Um baseline pode ser evidência válida sem contribuir para o total da tarefa.

Snapshots seguintes avançam o último checkpoint comparável, com previousEvidenceId existente, tempo anterior e mesma fonte/sessão/época/ator/harness/escopo/provider/modelo, além de versão/qualidade/atribuição compatíveis. Mudança exige baseline apropriado; não crie fork, delta negativo ou época fictícia. Evidência usa source + sessionId + epoch + evidenceId: retry preserva identidade/conteúdo, replay não soma; alteração conflita. Relatório persistido tem limite de 65536 bytes e 256 entradas com suplementos. Não fabrique resumos para contornar limites.

`reconcileSummaryUsage` anexa evidências com taskId/summaryId reais, SummaryUsageInput e expectedVersion da summary (não da task), preservando narrativa/status. statusObserved é snapshot gerado pelo servidor, nunca campo enviado pelo agente.

## Exemplos sintéticos do formato atual

Não executar nem copiar os IDs/valores como evidência real. O exemplo de request abaixo supõe fonte que de fato mediu input/output e modelo e agente persistido confirmado; o total desse request seria 120, sem campo adicional no payload.

```json
{
  "usageReport": {
    "entries": [
      {
        "source": "example-api",
        "harness": "example-harness",
        "surface": "api",
        "harnessVersion": null,
        "sessionId": "example-session",
        "epoch": "example-epoch",
        "evidenceId": "example-request-1",
        "previousEvidenceId": null,
        "actor": {
          "kind": "agent",
          "id": "10000000-0000-7000-8000-000000000002"
        },
        "actorRole": "collaborator",
        "provider": "example-provider",
        "modelId": "example-observed-model",
        "scope": "request",
        "reportKind": "period_delta",
        "quality": "measured",
        "attribution": "exact",
        "observedAt": "2026-11-02T20:00:00Z",
        "periodStart": null,
        "periodEnd": null,
        "inputTokens": "100",
        "outputTokens": "20",
        "cachedInputTokens": null,
        "reasoningOutputTokens": null,
        "discovery": null
      }
    ]
  }
}
```

Para um primeiro snapshot real da sessão, preserve os valores observados e use scope session, reportKind cumulative_snapshot, previousEvidenceId null e attribution conforme evidência (por exemplo shared se abranger várias tarefas). Isso registra baseline, não 120 tokens exatos da task por inferência. Não altere escopo/atribuição para aumentar o total exibido.

## Origem e escopo da medição

Registre a estratégia/proveniência permitida com fonte real, sessão, agente, período, escopo e semântica dos contadores. Colete novamente antes de cada resumo; uma leitura antiga ou configuração de modelo não prova consumo atual. Um acumulado da sessão não é consumo exato da task: compare apenas checkpoints compatíveis com cobertura e atribuição demonstradas, sem cruzar reset, modelo, qualidade ou autoria. Se a fonte abranger várias tasks, preserve esse escopo e sua limitação, sem rotular o total como consumo exato da tarefa. Se nem sessão/ator/modelo ou a medição forem confiáveis, registre o impedimento por comentário. A exclusividade por tarefa ainda depende da decisão do usuário.

Contadores de cache e raciocínio podem ser subconjuntos de input/output; não some categorias sobrepostas, snapshots cumulativos, replays ou total de árvore com seus próprios subagentes. Zero só é válido quando observado de fato na fonte. Não converta contexto percentual, créditos ou custo em tokens exatos. Não copie transcrições/segredos, não consulte sessões alheias nem instale coletores ou faça chamadas pagas para produzir um número.
