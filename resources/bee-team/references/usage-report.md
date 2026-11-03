# Relatório obrigatório por novo resumo de execução

## Descobrir no início e reutilizar a estratégia

No início da atuação, investigue proporcionalmente como capturar dados da sessão correta: ferramentas e APIs expostas pelo harness, arquivos locais permitidos e específicos da sessão e documentação oficial; consulte a web quando não souber o contrato. Não declare indisponibilidade antes dessa investigação. Registre uma estratégia reutilizável com fonte, superfície/harness/versão observados, sessão/ator identificáveis, campos disponíveis, semântica, limitações e data da verificação. Guarde esse contexto operacional no mecanismo permitido disponível, sem inventar campo persistente Bee Team nem instalar coletor. Reuse a estratégia até mudança de versão, fonte, sessão ou semântica exigir revalidação; não reutilize uma medição antiga como se fosse atual.

Uma skill não recebe telemetria por estar instalada. Confira a capacidade efetiva antes de consultar. Não instale hooks, SDKs ou coletores, não altere configurações e não inicie execuções pagas para obter métricas. Não leia segredos, transcrições completas nem outras sessões. Prefira contadores/metadados mínimos. Uma configuração de modelo prova seleção/configuração, não necessariamente o modelo efetivo de cada request; Auto, fallback e subagentes podem usar outros modelos.

## Consultar a cada novo resumo

Antes de inserir cada novo resumo histórico de execução, consulte dados atualizados pela estratégia validada e envie o usageReport obrigatório conforme o contrato real, com acumulado real de tokens da sessão até o resumo, modelo identificado, harness, agente e fonte verificáveis. Preserve múltiplos modelos/harnesses/atores/períodos quando observados, com proveniência verificável. Mantenha o relatório estruturado separado de summary/currentSummary em Markdown; não use comentários ou sidebar como armazenamento de telemetria. Comentário, percentual de progresso isolado ou leitura de prompt não exigem resumo artificial; toda mudança de status, porém, exige registrar resumo atomicamente com statusObserved e usageReport, inclusive início/retomada/revisão.

Esta skill exige acumulado real de tokens da sessão até o resumo, modelo identificado, harness, agente e fonte antes de cada novo resumo, usando o usageReport atual. unavailable, justificativa e número inventado não substituem a coleta. Ausência não é zero. Se não houver fonte confiável ou não for possível identificar modelo/harness/agente/escopo, mantenha o registro e a transição pendentes; salve explicação e tentativas reais em comentário, confirme persistência e notifique com commentID. Bloqueio efetivo pode ser registrado como flag separada conforme contrato, sem mudar status por atalho. Não anuncie resumo salvo. Falha também no comentário exige reconciliação, sem fabricar ID ou aviso de sucesso.

## Semântica antes de contabilizar

Diferencie consumo reportado de estimativa, ocupação de contexto, créditos e custo. Não converta contexto percentual ou créditos em tokens exatos. Preserve categorias input/output/cache e escopo request/turn/session/tree conforme fonte; não some categorias sobrepostas. Modelo configurado não vira modelo observado por inferência.

Contadores cumulativos são snapshots: guarde baseline/época apropriados e só derive delta de medidas comparáveis da mesma fonte/sessão/escopo. Reset, rotação, compaction, troca de modelo, retomada e retry podem invalidar comparação; revalide em vez de produzir delta negativo, somar snapshots ou contar replay duas vezes. Não atribua o acumulado da sessão como consumo da task. Não some totais de árvore com os mesmos subagentes novamente. Use apenas variantes e regras aceitas no contrato abaixo; preserve o escopo comprovado sem forçar atribuição exata à task. Falta de delta inicial não invalida, por si só, um snapshot real.

## Persistir o trabalho continua obrigatório

O relatório obrigatório não substitui os demais registros: descrição/specification, plano, resumo histórico, currentSummary, status e aprovação continuam distintos. Encerrar execução não significa Concluído se validação humana exigida estiver pendente. Depois de confirmar persistência do resumo e relatório válido, siga o protocolo de comentário completo, confirmação de persistência e notificação com commentID; não transporte detalhes/métricas em chat. Leituras e replays legados sem relatório permanecem válidos e não são retropreenchidos por suposição.

## Contrato confirmado para novos resumos

Use `RecordExecution.usageReport: {entries: [...]}` em createExecutionSummary ou close_activity.execution, com 1 a 32 entradas. O contrato de nova gravação é SessionUsageInput, cujas entradas seguem SessionUsageObservation; SummaryUsageInput/UsageObservation genéricos permanecem para compatibilidade de reconciliação/histórico. Cada observação de NOVO resumo exige totalTokens, inputTokens e outputTokens como strings decimais inteiras não negativas em int64 (até 9223372036854775807). totalTokens deve ser exatamente inputTokens + outputTokens inclusivos. Cache/raciocínio são subconjuntos, não parcelas adicionais. Nunca invente decomposição de total isolado nem preencha componente desconhecido com zero. Não crie tokenUsage na raiz.

Novas observações de resumo exigem reportKind cumulative_snapshot, scope session ou session_tree, quality measured, modelId não vazio e actor.kind agent com id UUIDv7 persistido. O agente é metadata do responsável pela observação: confira identidade real, sem inferir que é o executor da task nem usar human/null para contornar a validação. Preserve actorRole real, harness, source, surface, sessionId, epoch e evidenceId observados. Modelo configurado ou último modelo selecionado não prova modelo efetivo do contador. Provider/versão/períodos/subcategorias desconhecidos podem ser null conforme schema; observedAt e períodos usam RFC3339.

O primeiro snapshot real é aceito com previousEvidenceId null e delta null. totalTokens é o acumulado até observedAt no escopo source/session/epoch/actor/model, não consumo exato da tarefa. Não exija predecessor/delta para admitir a primeira leitura e não some snapshots ao longo dos resumos. Múltiplas sessões ou modelos disjuntos são entradas separadas; contador misto sem divisão real não pode receber o nome do último modelo por inferência. Ausência de fonte/modelo ou de componentes reais impede fabricar um relatório: salve comentário de impedimento e notifique, sem alegar resumo/status salvo.

Cada observação declara source, harness, surface, harnessVersion, sessionId, epoch, evidenceId, previousEvidenceId, actor, actorRole, provider, modelId, scope, reportKind, quality, attribution, observedAt, periodStart, periodEnd, inputTokens, outputTokens, cachedInputTokens, reasoningOutputTokens, totalTokens e discovery. Preserve attribution conforme evidência, sem forçar exact; mesmo um snapshot atribuído ao agente não é consumo exato da task. Árvore e shared/unallocated não entram como total exato da tarefa.

Nos checkpoints seguintes, siga a validação de comparabilidade do contrato: predecessor existente/anterior quando informado, sem fork, sobreposição, delta negativo ou época fictícia. Reset ou mudança de fonte/modelo/escopo exige revalidar a estratégia. Evidência usa source + sessionId + epoch + evidenceId: retry conserva identidade/conteúdo; replay não soma e mudança de conteúdo conflita. Relatório persistido tem limite de 65536 bytes e 256 entradas incluindo suplementos; não fabrique resumos para contornar limites.

unavailable, modelId ausente/vazio, totalTokens ausente ou componentes inválidos falham na nova gravação (400). Trate o erro sem anunciar efeitos parciais nem fazer fallback para mudança direta de status. Leituras históricas e replays salvos são preservados pelo serviço; não os reescreva nem use a exceção como atalho para novo resumo. `reconcileSummaryUsage` usa schema genérico com total opcional para compatibilidade legada, anexando evidência com taskId/summaryId reais e expectedVersion da summary, sem alterar narrativa/status; não o use para burlar o requisito do novo resumo. statusObserved é snapshot gerado pelo servidor, nunca campo enviado pelo agente.

Atualizar arquivos de skill não publica validação no servidor conectado. Confira catálogo/schema e informe incompatibilidade de runtime, sem voltar silenciosamente ao contrato anterior.

## Exemplo sintético de primeiro snapshot

Não executar nem copiar os IDs/valores como evidência real. Exemplo supõe agente persistido e modelo observado com acumulado real input 1000/output 200 até observedAt; total 1200 é da sessão e não da tarefa. previousEvidenceId null é válido, sem exigir delta.

```json
{
  "usageReport": {
    "entries": [
      {
        "source": "example-session-log",
        "harness": "example-harness",
        "surface": "cli",
        "harnessVersion": null,
        "sessionId": "example-session",
        "epoch": "example-epoch",
        "evidenceId": "example-snapshot-1",
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
        "attribution": "shared",
        "observedAt": "2026-11-02T22:00:00Z",
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
  }
}
```

## Origem e escopo da medição

Registre a estratégia/proveniência permitida com fonte real, sessão, agente, período, escopo e semântica dos contadores. Colete novamente antes de cada resumo; uma leitura antiga ou configuração de modelo não prova consumo atual. Um acumulado da sessão não é consumo exato da task: compare apenas checkpoints compatíveis com cobertura e atribuição demonstradas, sem cruzar reset, mudança de semântica, qualidade ou autoria incompatíveis. Troca de modelo só impede comparar quando o modelo define a série do contador; contador global comparável pode atravessar modelos, preservando os modelos envolvidos sem divisão inventada. Se a fonte abranger várias tasks, preserve esse escopo e sua limitação, sem rotular o total como consumo exato da tarefa. Se nem sessão/ator/modelo ou a medição forem confiáveis, registre o impedimento por comentário. O requisito é acumulado da sessão, não consumo exclusivo da tarefa.

Contadores de cache e raciocínio podem ser subconjuntos de input/output; não some categorias sobrepostas, snapshots cumulativos, replays ou total de árvore com seus próprios subagentes. Zero só é válido quando observado de fato na fonte. Não converta contexto percentual, créditos ou custo em tokens exatos. Não copie transcrições/segredos, não consulte sessões alheias nem instale coletores ou faça chamadas pagas para produzir um número.

## Intervalos explícitos da execução

Siga [execuções e intervalos](beeteam://references/execution-intervals): ler intervalo ativo na retomada, registrar início antes do trabalho, checkpoint sem fechar, pausa antes da troca, resume em novo intervalo e finish independente do aceite/status final. Conservar taskId/executionId/intervalId retornados; não inferir fronteiras por texto/horário nem somar snapshots/checkpoints. Contrato de payload e leituras precisa ser confirmado antes de uso; evidência de sessão e consumo por intervalo são distintos.

Quando uma observação for selecionada como fronteira em executionTracking.evidenceIds, attribution deve ser unallocated, separando o ledger de intervalos da atribuição legada. O exemplo genérico shared acima não pode ser selecionado como fronteira sem representar corretamente esse papel no contrato. counterMode global/per_model e coverageRootSessionId são declarações da fonte real, não mecanismos para fabricar exclusividade ou dividir um contador misto.
