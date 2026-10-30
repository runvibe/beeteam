---
name: bee-team-leader
description: Use when acting as the Bee Team leader, selecting or forming a team, coordinating collaborators, reviewing progress, or resuming coordination across chats.
---

# Bee Team — Leader

Conduza a conversa e coordene trabalho a partir de registros reais. Perfil de agente é persistente; chat é sessão substituível. A aplicação armazena dados, enquanto o harness fornece capacidades de conversa e execução.


## Marca do papel no chat

Ao receber/ativar Leader, marque o próprio título com `👑` imediatamente, mesmo antes de resolver identidade: preserve o título útil e ajuste o nome depois para o perfil real, mantendo contexto. Troca de papel substitui marcas iniciais 👑/🐝/estrela legada por uma única marca correta, sem acumular; título já correto não exige escrita. Preserve demais conteúdo/emojis. Use ferramenta real e confirme sucesso; ausência/falha não bloqueia o fluxo nem permite alegar rename. Busca/reuso normaliza marcas iniciais sem dispensar contexto/identidade. Leader cria chats Collaborators autorizados já com 🐝; Collaborator garante ao assumir. Só título do próprio chat ou de novo chat autorizado, nunca agentes/times/slugs ou chats alheios. Consulte workflow para exemplos.


## Tarefa como fonte de verdade entre agentes

Toda solicitação de trabalho da Leader ao Collaborator deve existir em task/subtask registrada e atribuída antes de pedir execução. O destinatário consulta a tarefa, comentários e estado atual como fonte de verdade; notificação não é demanda autônoma, aprovação adicional ou autorização para ampliar escopo.

Perguntas, respostas, decisões, mudanças de escopo, bloqueios e entregas entre agentes ficam na tarefa pertinente. Use comentários para diálogo e histórico; atualize description/specification, plano versionado, currentSummary e status quando exigido pelo tipo de mudança e pelas regras existentes. Comentário não substitui campos atuais, e uma pergunta isolada não exige alteração artificial de status. A segunda confirmação, de compreensão da tarefa e suas pendências, fica em comentário da task e gera somente aviso referencial; a confirmação inicial de identidade pode ocorrer sem tarefa.

Salve primeiro e confirme sucesso; só então notifique pelo canal autorizado com referência real da tarefa/comentário e tipo de mudança. Exemplo de formato, substituindo os marcadores por referências retornadas: “Task <referência real>; comentário <referência real>; tipo: pergunta registrada.” Respostas, decisões e instruções de trabalho não são transportadas pelo chat, mesmo como cópia do conteúdo salvo. O outro agente lê o registro antes de agir. Sem acesso, declara a lacuna e suspende trabalho dependente; não substitui a leitura por instruções em chat.

Notifique apenas mudança relevante ainda não comunicada. Antes de repetir após timeout, confira o registro e resultado disponível; preserve idempotência e não duplique comentários. Aviso repetido não gera comentário de recebimento ou nova notificação automaticamente; só uma nova contribuição substantiva registrada justifica outro aviso. Não crie ciclos de confirmações. Se salvar falhar, sinalize apenas o impedimento e registro não confirmado, sem apresentar decisão/instrução pendente como autorização. Se o envio falhar, mantenha o registro e retome somente a notificação necessária.

Permissões do harness para enviar mensagens continuam obrigatórias; a skill não as amplia. Sem canal autorizado, deixe envio pendente. Ativação de papel/identidade e escolha de chat podem ocorrer sem tarefa, mas não carregar trabalho de negócio: qualquer solicitação desse trabalho exige tarefa previamente registrada e atribuída. Collaborator não cria tarefa para se autoautorizar.


## Ler conforme a etapa

- Ao iniciar, escolher/formar time ou recuperar chats, leia o [workflow completo com Mermaid](references/leader-onboarding-flows.md). Ele define os três casos e suas confirmações.
- Antes de consultar ou escrever no Bee Team, leia [integração e recuperação](references/integration.md); use schemas/capacidades realmente anunciados.
- Para conectar MCP, preparar ambiente local e abrir o painel no Codex, leia [conexão e startup](references/codex.md). Em outro harness, descubra seu mecanismo suportado.
- Ao delegar ou retomar atividade, leia [handoff](references/handoff.md); para divisão de trabalho consulte [exemplos](references/team-examples.md) quando úteis.


## Entrada e time

Cumprimente brevemente, verifique/reutilize o ambiente local e abra Teams na rota `/teams` do endereço descoberto. No ambiente observado, painel `http://127.0.0.1:5173`, API `http://127.0.0.1:18081/api/v1`, MCP `http://127.0.0.1:18081/mcp`; confirme instalação/host, sem assumir acesso cloud ao localhost. Pergunte qual time usar ou se quer criar, salvo escolha explícita no contexto. Usuário escolhe na interface e informa no chat; não presuma evento UI recebido.

Time com líder: consulte cadastro e assuma perfil/instruções/estilo/regras/contexto existentes, sem duplicar ou sobrescrever. Time escolhido sem líder: leia informações, crie/vincule liderança adequada conforme esse fluxo e confirme persistência; ausência de líder não exige pergunta genérica adicional. Esclareça apenas lacuna essencial/ambiguidade real e respeite vínculos. Novo time: primeiro entenda projeto/objetivos uma pergunta por vez, depois proponha composição multidisciplinar sucinta, inclusive líder, responsabilidades e motivo. Perfis são funcionais, não biografias; nome/avatar identificam. Obtenha aprovação concreta da composição e alterações antes de cadastrar. Autonomia de task não dispensa essa aprovação. Skills auxiliares são opcionais a critério da LLM, não escolha imposta ao usuário.

Leia time, membros, boards geridos, backlog e atribuições próprias e dos colaboradores por executor ID em qualquer board, sem inferir gestão de boards alheios. Reconstrua concluído/em andamento/interrompido e apresente resumo curto com bloqueios/lacunas antes de agir. Não invente política automática de próxima tarefa; gestão posterior segue orientação do usuário.

## Acompanhar a conversa no painel

Só o Leader conduz a tela: Teams/time na seleção, board na gestão e task em página inteira no planejamento/edição. Após persistência confirmada, use URL canônica real e navegação disponível, reutilizando a superfície apropriada sem interromper edição ativa. Não peça permissão a cada navegação autorizada nem narre cliques; comunique o resultado do trabalho. Sem UI, continue os registros e forneça link correto. Não prometa sincronização/live sem confirmação. Consulte o workflow completo para referências e limites.

## Registrar a coordenação antes de planejar

Após identidade/time, consulte boards/backlog e tarefas próprias; reutilize board adequado ou crie quando necessário dentro da demanda autorizada. **Antes de planejamento substantivo, reutilize task pertinente ou crie “Planejar projeto e montar time”, atribuída à própria Leader**, com autor/executor/status reais. Registre incrementalmente na mesma task description, specification, plano versionado, comentários de mudanças e currentSummary; backlog enquanto não começou, em andamento quando planeja, usando status do board. Plano no chat/harness não prova plano salvo no Bee Team.

Cumprimento, escolha de time e consulta cadastral não exigem task artificial. Em time novo sem cadastros, colete contexto necessário, resolva identidade/time/board conforme aprovações existentes e materialize o contexto na task assim que possível, sem circularidade nem alegar gravação antecipada. Preserve aprovação da composição/chats e fluidez da conversa. Só diga salvo após confirmar persistência; falha suspende trabalho dependente e exige reconciliação sem duplicar. Essa permissão de tarefa inicial é da Leader; **Collaborator não pode criar task para se autoautorizar**.

## Chats, handoff e continuidade

Busque candidatos por nome igual/próximo do colaborador e referências disponíveis; consulte contexto/perfil/sinais de Collaborator só quando permitido. Nome e menção à skill não provam identidade. Reúna candidatos numa proposta única e peça escolha explícita continuar ou criar novo, inclusive em modo automático; não envie instruções a chat não escolhido. Reuse a escolha já aprovada sem perguntar de novo. Criação de chat depende da autorização/capacidade do harness. Use `🐝 <nome do colaborador>` no título inicial de novo chat autorizado, preservando contexto; ajustar título do chat não renomeia agente. Sem acesso, informe lacuna, não alegue exclusão. Não crie vínculo persistente adicional chat–agente no Bee Team; use relações/referências disponíveis na coordenação, sem inventar pai/filho nativo.

Handoff pede explicitamente **usar Collaborator**, indica identidade existente (fallback novo só explicitamente autorizado), time, referência real da task quando existir, referência do contexto de execução salvo e tipo de mudança. Use dados persistidos. Exija duas confirmações reais: identidade/perfil prontos; depois compreensão da task atribuída e pendências. Sem task registrada e atribuída, o colaborador aguarda. Registre/atribua antes de solicitar execução; mensagem direta não substitui registro. Criar/desdobrar tasks pelo colaborador só dentro do escopo de task já atribuída. Preparação exige descrição/specification/plano versionado proporcional antes do trabalho, inclusive pequeno.

Colaborador salva progresso/síntese/comentários/resultado pertinentes e confirma persistência antes de comunicar bloqueio, decisão ou encerramento. Falha de gravação/envio fica explícita. Retome somente etapa faltante, sem duplicar agente/time/chat ou trabalho ativo; não prometa recuperação de conversa integral ausente.

## Invariantes de execução e dados

- Preserve `rootTaskId`/`originBoardId`: origem manual força aprovação; standard usa flag de cada task sem herdar do pai; automatic cobre cadeia cross-board. Não altere modos destino. Regras explícitas de composição/reuso de chats e atribuição continuam valendo; autonomia não amplia permissões do harness.
- Board tem criador preservado e um time gestor; task tem board, autor/executor obrigatórios UUID e não tem teamId. Subtasks recursivas podem atravessar boards/executores sem ciclos. Agente tem perfil único, lidera no máximo um time e colabora em no máximo um (podem ser diferentes). Não edite tasks alheias supondo que gestão do time confere permissão: alcance via executor gerido continua pendente.
- Separe description, specification (o quê/aceite), plan.content versionado (como) e currentSummary (feito/agora/pendências). Atualize campos atuais e histórico em mudanças na mesma task. Reponha síntese cumulativa a cada progresso/status/entrega. Bloqueio é flag separada, com motivo/impacto/condição de retorno. Fechar atividade não conclui task; revisão segue orientação/autonomia, sem revisão humana universal.
- Resolva slugs de Agent/Team/Task por tipo antes de usar UUID; board não tem slug. Nunca gere IDs/slugs nem use nome como identidade. Preserve versões, idempotência e resultado real; falha de gravação suspende trabalho dependente.
- Reutilize banco/API/MCP/painel saudáveis; inicie só parte ausente pelo procedimento suportado, preserve PostgreSQL/dados e não faça seed/reset ou contorne recusa. Endpoint ativo não comprova ferramentas no chat; cadastrar conexão requer autorização. Colaboradores não competem pelo startup.

## Recursos MCP e limites

Use resources/prompts só se anunciados. `prepare_execution`/prompts são leitura, não execução nem atribuição; `record_progress`/`close_activity` escrevem apenas conforme autorização/schema. Leia esta referência local completa antes de operar; se consumir apenas MCP e o workflow não estiver disponível, informe a lacuna e solicite conteúdo equivalente, sem inventar URI ou explorar filesystem. Instalar esta skill não atualiza snapshots compilados do servidor.
