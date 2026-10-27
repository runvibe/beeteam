# Briefing e encerramento

## Briefing para execução ou retomada

Transfira o contexto completo relevante, fiel ao usuário, nesta ordem:

- Identidade/perfil e regras/limites; board e tarefa/subtarefa, autor/executor, vínculos organizacionais relevantes, com IDs conhecidos.
- Demanda original e objetivo; escopo aprovado e o que ainda é somente planejamento.
- Decisões aceitas, alternativas rejeitadas e motivos; restrições que precisam sobreviver à troca de chat.
- Entrega esperada, critérios de aceitação, evidências necessárias e responsável pela revisão.
- Trabalho anterior confirmado, arquivos/fontes acessíveis, dependências e contribuições de outros agentes.
- Contexto `rootTaskId`, `originBoardId`, `originBoardMode`, `effectiveMode`, modo individual atual e autorização aplicável, incluindo a proposta aprovada e limites de reutilização/transferência.
- Pendências/bloqueios, dúvidas não resolvidas e próximo passo concreto.
- Obrigação de atualizar a própria tarefa ao encerrar e capacidades de API/harness realmente disponíveis.

Esse formato é um briefing de trabalho, não uma transcrição. Links complementam o contexto; não omita decisões essenciais atrás de links inacessíveis. Se um dado não existe, diga que falta. Não delegue novamente a descoberta que o líder já fez com o usuário.

## Registro obrigatório ao encerrar atividade

Mesmo que a tarefa continue, produza e persista na tarefa/subtarefa correspondente:

| Informação | Conteúdo |
|---|---|
| Identidade e alvo | Autor declarado e IDs reais da tarefa/board e referência de contexto de execução |
| Status e resultado | Status configurado adequado; avanço, conclusão ou bloqueio com motivo |
| Resumo | O que foi feito e como foi verificado; separar tentativa de resultado confirmado |
| Decisões | Escolhas relevantes e razões, preservando limites do briefing |
| Entregas | Arquivos, referências ou anexos existentes; limitações de acesso |
| Pendências | Trabalho restante, revisão, dependências e bloqueios; explicitar quando não houver |
| Próximo passo | Ação seguinte e responsável conhecido, sem atribuir trabalho novo implicitamente |

Encerrar atividade não é concluir tarefa. Revisão pendente deve aparecer no status/pendências conforme o board. Conclusão de subtarefa não altera parentes ou irmãos. Resumo na conversa não comprova gravação; confirme a escrita ou entregue o registro pendente descrito em [integração](integration.md).

Na transferência, leve contexto e histórico da task, sem copiar histórico interno do agente anterior. Transferir agente de time não reatribui suas tasks. Preserve origem da raiz mesmo quando a subtarefa estiver em outro board.
