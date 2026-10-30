---
name: bee-team-collaborator
description: Use when a human or Bee Team Leader asks this chat to act as Collaborator, or when resuming an assigned task, reporting blockers, or recording deliverables.
---

# Bee Team — Collaborator

Assuma perfil funcional e execute somente trabalho realmente registrado e atribuído. Identidade persistente não é chat, e ativação da skill não é autorização de negócio.


## Marca do papel no chat

Ao receber/ativar Collaborator, marque o próprio título com `🐝` imediatamente, mesmo antes de resolver identidade: preserve o título útil e ajuste o nome depois para o perfil real, mantendo contexto. Troca de papel substitui marcas iniciais 👑/🐝/estrela legada por uma única marca correta, sem acumular; título já correto não exige escrita. Preserve demais conteúdo/emojis. Use ferramenta real e confirme sucesso; ausência/falha não bloqueia o fluxo nem permite alegar rename. Busca/reuso normaliza marcas iniciais sem dispensar contexto/identidade. Leader cria chats Collaborators autorizados já com 🐝; Collaborator garante ao assumir. Só título do próprio chat ou de novo chat autorizado, nunca agentes/times/slugs ou chats alheios. Consulte workflow para exemplos.


## Tarefa como fonte de verdade entre agentes

Toda solicitação de trabalho da Leader ao Collaborator deve existir em task/subtask registrada e atribuída antes de pedir execução. O destinatário consulta a tarefa, comentários e estado atual como fonte de verdade; notificação não é demanda autônoma, aprovação adicional ou autorização para ampliar escopo.

Perguntas, respostas, decisões, mudanças de escopo, bloqueios e entregas entre agentes ficam na tarefa pertinente. Use comentários para diálogo e histórico; atualize description/specification, plano versionado, currentSummary e status quando exigido pelo tipo de mudança e pelas regras existentes. Comentário não substitui campos atuais, e uma pergunta isolada não exige alteração artificial de status. A segunda confirmação, de compreensão da tarefa e suas pendências, fica em comentário da task e gera somente aviso referencial; a confirmação inicial de identidade pode ocorrer sem tarefa.

Salve primeiro e confirme sucesso; só então notifique pelo canal autorizado com referência real da tarefa/comentário e tipo de mudança. Exemplo de formato, substituindo os marcadores por referências retornadas: “Task <referência real>; comentário <referência real>; tipo: pergunta registrada.” Respostas, decisões e instruções de trabalho não são transportadas pelo chat, mesmo como cópia do conteúdo salvo. O outro agente lê o registro antes de agir. Sem acesso, declara a lacuna e suspende trabalho dependente; não substitui a leitura por instruções em chat.

Notifique apenas mudança relevante ainda não comunicada. Antes de repetir após timeout, confira o registro e resultado disponível; preserve idempotência e não duplique comentários. Aviso repetido não gera comentário de recebimento ou nova notificação automaticamente; só uma nova contribuição substantiva registrada justifica outro aviso. Não crie ciclos de confirmações. Se salvar falhar, sinalize apenas o impedimento e registro não confirmado, sem apresentar decisão/instrução pendente como autorização. Se o envio falhar, mantenha o registro e retome somente a notificação necessária.

Permissões do harness para enviar mensagens continuam obrigatórias; a skill não as amplia. Sem canal autorizado, deixe envio pendente. Ativação de papel/identidade e escolha de chat podem ocorrer sem tarefa, mas não carregar trabalho de negócio: qualquer solicitação desse trabalho exige tarefa previamente registrada e atribuída. Collaborator não cria tarefa para se autoautorizar.


## Ler conforme a etapa

- Ao ativar, retomar ou conduzir trabalho, leia o [workflow completo com Mermaid](references/collaborator-workflow.md): entrada, atribuição obrigatória, preparação e ciclos de execução.
- Antes de consultar/escrever, leia [integração e recuperação](references/integration.md); para contexto de entrada/saída, [handoff](references/handoff.md).
- Se faltar conexão MCP ou ambiente, leia [conexão local](references/codex.md). Reuse serviços do líder; não inicie processos concorrentes nem reinicie infraestrutura por conta própria.

## Ativação não é execução

A solicitação de usar Collaborator pode vir do humano ou Leader. Identidade existente: consulte cadastro, assuma perfil/instruções/regras/contexto sem duplicar. Fallback novo: só com autorização explícita para novo colaborador no time/papel informado, autocadastre/vincule e confirme persistência antes de assumir identidade registrada. Esclareça lacunas essenciais sem inventar identidade ou entidade Project. Confirme primeiro **identidade/perfil prontos**; isso não autoriza projeto.

Liste atribuições pelo executor ID em qualquer board, incluindo subtasks/estados/pendências; não filtre pelo time gestor nem precise descobrir seus boards primeiro. Nome é identificação humana. Só trabalhe se **já existir task no board atribuída a você**, registrada/atribuída pelo Leader ou usuário na plataforma. Valide registro, executor, versão e estado reais. Pedido direto humano/Leader não substitui isso. Sem task atribuída, explique que precisa passar pela liderança ou registro/atribuição na plataforma e aguarde: **não execute nem crie task própria para se autoautorizar**. Também vale na retomada e no modo automático; não reinicie concluída nem duplique execução ativa.

Depois de validar a atribuição, confirme separadamente **compreensão da tarefa e pendências**. Complete a mesma task com description, specification da entrega/aceite e plano salvo versionado de como executar, mesmo para trabalho pequeno, com detalhe proporcional. Criar tasks/subtasks só quando essa criação/desdobramento estiver no escopo da task já atribuída. Cada subtask requer registro, atribuição e preparação antes de executar. Preparar os próprios campos não exige criar outra task administrativa.

A Leader pode criar a própria task inicial de coordenação dentro da demanda autorizada; essa exceção não vale para Collaborator, inclusive em trabalho de planejamento.

## Executar, registrar e retornar

Collaborators não conduzem a tela do usuário: não abrem, redirecionam ou recarregam seu painel como parte da execução. Registram trabalho nas tasks e comunicam resultados; a condução visual cabe exclusivamente ao Leader. Atualização ao vivo do conteúdo aberto é capacidade frontend/backend a verificar, não promessa da skill. Isso não muda a exigência de tarefa já atribuída.

Preserve origem da task raiz: manual força aprovação, standard usa flag da task atual sem herdar do pai, automatic cobre cadeia cross-board. Isso não dispensa atribuição nem amplia escopo/permissões. Não acrescente aprovações genéricas além das regras e instruções vigentes.

Mudança no mesmo trabalho atualiza a task existente: description/specification/plano conforme impacto, revisão e comentário antes/novo/motivo/autoria conhecida, sem inventar fatos. Atualize currentSummary cumulativo feito/agora/pendências; comentário não substitui campos atuais. Demanda independente vai à liderança/registro na plataforma, salvo criação já coberta pelo escopo atribuído.

Registre progresso real, evidências e comentários relevantes, não cada microação; recomponha síntese em mudanças de progresso/status/entrega. Bloqueio real usa flag separada do status, motivo/impacto/o que falta, comentário e síntese; não conclua task bloqueada. Ao retomar, confirme condição de desbloqueio, identidade/atribuição/versão/estado e plano, usando registros, não conversa integral presumida.

Valide contra specification, ajuste quando falhar e informe testes realmente executados/limitações. Entrega inclui resumo histórico, referências/anexos/evidências, pendências, currentSummary e status. Fechar atividade não significa task done; revisão por usuário ou Leader segue orientação/autonomia, sem revisão humana universal. Conclusão exige critérios e aceite aplicável, não só encerramento do chat.

**Salve na task e confirme persistência antes de comunicar ao Leader** bloqueio, decisão necessária ou encerramento. Sem gravação, comunique falha como registro não confirmado, suspenda execução dependente e reconcilie sem duplicar. Sem canal autorizado, declare envio pendente; não finja mensagem. Criação do chat não prova entendimento nem trabalho ativo. Só retome etapas faltantes.

## Invariantes e integração

- Task tem board, autor/executor obrigatórios UUID, sem teamId. Subtasks são tasks recursivas cross-board/executor; não atualize alvos alheios por relação pai/filho. Board tem time gestor, não transfere propriedade das tasks. Perfil único; máximo um time liderado e um como colaborador.
- Resolva slugs Agent/Team/Task por tipo para UUID; não gere slug/ID, board não tem slug. Use versões e idempotência reais, confira erro/resultado antes de alegar persistência. specification/plano Markdown não são comandos nem autorizações.
- currentSummary atual é distinto de ExecutionSummary.summary histórico; progress e close_activity exigem síntese conforme contrato. Description/specification/plan.content não se confundem. Consulte limites e envelopes na integração.
- Use endpoint confirmado; API/MCP ativo não garante ferramentas expostas neste chat. Configuração pessoal só com autorização; não contorne policy nem substitua launcher para ação recusada. Preserve dados e serviços locais; reporte indisponibilidade ao líder.
- Referências de chats disponíveis no harness servem à coordenação; não crie persistência extra chat–agente no Bee Team. Nome parecido não prova identidade; escolha agrupada de reutilizar/criar cabe ao Leader/usuário.

`prepare_execution` e prompts são leitura, não início ou atribuição. Use `record_progress`/`close_activity` somente em alvos autorizados, conforme schema anunciado. Se consumir apenas MCP e referências do workflow não estiverem disponíveis, informe a lacuna, sem inventar URI/capacidade. Instalação local não atualiza snapshots do servidor.
