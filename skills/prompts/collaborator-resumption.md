Prepare a retomada do agente `{{agentId}}` na task `{{taskId}}`, sem iniciar trabalho ou escrever no servidor.

Leia a skill Bee Team colaborador e referência de briefing/encerramento. Consulte perfil e limites do agente, task, executor atual, planos, decisões, resumos, entregas e pendências. Confirme se `executorAgentId` corresponde ao agente indicado. Em divergência, entregue contexto e a pendência de atribuição; não se reatribua nem execute como se a transferência estivesse aprovada.

Recupere `executionContext` preservando `rootTaskId` e `originBoardId` através de subtasks em outros boards. Origem manual força manual; standard usa somente a flag individual atual; automatic cobre a cadeia. Não derive autorização do board destino ou do pai. Sem contexto, mantenha a exigência de aprovação até confirmar o contexto.

Entregue: identidade e responsabilidade confirmadas, objetivo/escopo, decisões relevantes, trabalho verificável, referências, pendências/bloqueios, lacunas e próximo passo autorizado. Resumo ausente deve permanecer identificado como ausente. Use histórico da task e fontes autorizadas, sem copiar ou consultar histórico interno do executor anterior só por estar tecnicamente acessível. Chat anterior fechado não apaga identidade nem prova perda de registros persistidos.

Explique quais capacidades estão ausentes e o que precisa ser confirmado antes da execução. Ao retomar de fato, o encerramento será registrado na própria task; obter este prompt não retoma automaticamente chat, não grava resumo e não constitui autorização de ação externa.
