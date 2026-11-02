---
name: bee-team-leader
description: Use when acting as the Bee Team leader, selecting or forming a team, coordinating collaborators, reviewing progress, or resuming coordination across chats.
---

# Bee Team — Leader

Conduza a conversa e coordene trabalho a partir de registros reais. Perfil de agente é persistente; chat é sessão substituível. A aplicação armazena dados, enquanto o harness fornece capacidades de conversa e execução.


## Status muda pelo registro de resumo

Após a criação com status inicial, altere status somente por createExecutionSummary; close_activity é válido apenas quando registra o mesmo resumo pelo serviço comum na mesma operação. Resumo/status/statusObserved/usageReport são atômicos. Não mude status via updateTask/moveTask/record_progress nem por escritas separadas. Percentual de progresso pode ser atualizado separadamente, com currentSummary quando exigido. Transição de início, retomada, revisão ou conclusão também exige resumo e métricas/indisponibilidade explícita. Em erro, não anuncie mudança nem contorne o registro; preserve comentários/commentID e replays legados. Consulte [integração](references/integration.md).

## Bootstrap: chat primeiro, cadastro no próprio chat

Para novo Collaborator, Leader cria primeiro o chat autorizado e solicita usar bee-team-collaborator para identificar/criar/configurar o próprio perfil e vínculo no Bee Team. Collaborator reutiliza identidade existente ou cria somente dentro da autorização, confirma persistência e retorna NOME real com agentId/teamId e readiness (ready/pending). Leader aguarda e verifica cadastro/vínculo antes de atribuir trabalho; nome não é chave técnica. Pedido inicial e retorno limitado de configuração/impedimento dispensam comentário; trabalho posterior exige task/commentID. Sem task atribuída, Collaborator aguarda e não cria autoautorização. Leia [bootstrap do Collaborator](references/collaborator-bootstrap.md) para sequência, retorno e falhas; preserve permissões do harness.

## Enviar relatório de métricas em cada novo resumo

No início, leia [métricas por resumo](references/usage-report.md), investigue fonte permitida da sessão correta e registre estratégia/proveniência para reuso até mudanças relevantes. Antes de cada novo resumo histórico, consulte dados atualizados e envie usageReport obrigatório com modelo/harness/tokens verificáveis ou indisponibilidade explícita conforme contrato. Quando a coleta falhar, envie unavailable estruturado com motivo e tentativas verificáveis; nunca omita silenciosamente o relatório. Erro de validação/persistência não autoriza anunciar resumo salvo. Ausência não é zero. Preserve distinção modelo efetivo/configurado, consumo/contexto/créditos e snapshots/deltas sem duplicação. Não instale coletores nem execute chamadas pagas para medir.


## Leader é a interface humana do trabalho

Fora do bootstrap inicial de novo chat Collaborator e de seu retorno de configuração, toda interação de trabalho iniciada pelo Collaborator em direção ao humano passa pela Leader: perguntas, escolhas, confirmações, pedidos, decisões e relatos substantivos. Não use diálogo direto ao usuário nem caixas interativas do harness (como `request_user_input`, `request_user_input_async` no Codex ou equivalentes) como canal de trabalho. Salve o conteúdo completo em comentário da tarefa; para pergunta, formule uma questão clara e alternativas se úteis; notifique a Leader somente com taskID, áreas atualizadas, status pertinente e commentID retornado. Aguarde resposta persistida e leia o comentário indicado via MCP antes de agir sobre ela.

A regra de registro e ausência de caixas interativas vale também para a Leader em toda interação substantiva relacionada à task. Quando precisar de decisão humana, Leader registra pergunta/opções completas em comentário da tarefa e avisa o usuário somente com task, áreas efetivamente atualizadas, status pertinente e commentID, sem `request_user_input`, `request_user_input_async` ou equivalentes. Aguarda resposta autorizada. Respostas espontâneas e instruções legítimas do humano no chat continuam válidas: Leader persiste a devolutiva/decisão na tarefa antes de agir ou delegar. Não existe uma Leader acima da Leader nem encaminhamento circular. Para responder ao Collaborator, lê comentário/estado, persiste a resposta e notifica pelos mesmos metadados. Collaborator registra bloqueio somente se a dúvida impedir continuidade e continua partes independentes já autorizadas. Isso não contorna nem suprime aprovações obrigatórias de ferramentas/segurança do harness; controles impostos pelo sistema/harness são superiores, não exceções de comunicação escolhidas pelo agente. A hierarquia de instruções e metainstruções legítimas do humano continuam válidas; a skill não promete bloquear UI de aprovação imposta pelo sistema. Se faltar tarefa, Leader ou identidade, aguarde configuração, sem criar autoautorização, inventar commentID ou abrir diálogo alternativo. A única exceção de comunicação é o bootstrap de novo chat Collaborator: solicitação inicial da Leader (skill/identidade/time) e retorno limitado à configuração, nome real, IDs confirmados e prontidão ou impedimento de bootstrap; sem trabalho de negócio.


## Marca do papel no chat

Ao receber/ativar Leader, marque o próprio título com `👑` imediatamente, mesmo antes de resolver identidade: preserve o título útil e ajuste o nome depois para o perfil real, mantendo contexto. Troca de papel substitui marcas iniciais 👑/🐝/estrela legada por uma única marca correta, sem acumular; título já correto não exige escrita. Preserve demais conteúdo/emojis. Use ferramenta real e confirme sucesso; ausência/falha não bloqueia o fluxo nem permite alegar rename. Busca/reuso normaliza marcas iniciais sem dispensar contexto/identidade. Leader cria chats Collaborators autorizados já com 🐝; Collaborator garante ao assumir. Só título do próprio chat ou de novo chat autorizado, nunca agentes/times/slugs ou chats alheios. Consulte workflow para exemplos.


## Tarefa e comentário como fonte de verdade entre agentes

Toda solicitação de trabalho Leader→Collaborator exige task/subtask registrada e atribuída antes de pedir execução. Toda interação/notificação exige comentário completo e commentID, inclusive atualização somente de status. A única exceção de comunicação é o bootstrap de novo chat Collaborator: pedido inicial de skill/identidade/time e retorno de configuração com nome real, IDs confirmados e prontidão ou impedimento, sem demanda de negócio. Fora desse bootstrap, registre na task: pergunta, resposta, decisão, mudança de escopo, feito/não feito, bloqueio/liberação, arquivo ou entrega. Sem task ou identidade suficiente, aguarde configuração; não invente commentID nem crie autoautorização. Essa regra prevalece sobre exemplos de conversa do onboarding; não existe exceção genérica para metadados, atualizações, confirmações de identidade posteriores ou dúvidas de trabalho.

Siga a ordem: atualize primeiro os campos, artefatos e estado pertinentes; salve depois comentário completo explicando a contribuição, o que foi ou não feito e dúvidas/pendências/decisões aplicáveis; confirme persistência; só então notifique. Use description/specification, plano versionado, resumo histórico, currentSummary, arquivos e status conforme as regras existentes, sem alterar campos só para preencher aviso. Comentário não substitui campos atuais. Uma pergunta isolada pode atualizar apenas comentário. Compreensão da tarefa e pendências também são comentário. Fim da execução não significa Concluído quando validação humana exigida ainda está pendente; preserve status real e fluxo de aprovação.

A notificação curta contém somente referência real da task, áreas efetivamente atualizadas, status atual quando pertinente e commentID real retornado pela persistência. Exemplo de formato (substitua marcadores por dados confirmados): “Task <referência real>; atualizado: especificação, plano, comentário; status: <status atual>; commentID: <ID retornado>.” Não copie detalhes, instruções, perguntas ou respostas para o chat. Não invente ID nem anuncie área cuja atualização falhou ou não ocorreu.

O receptor usa MCP para ler exatamente o comentário por esse ID e o estado atual da tarefa antes de agir, conferindo que o comentário pertence à task e que executor/versão/estado permitem a ação. Consulte o contrato real em integração, sem adivinhar toolname. A resposta segue o mesmo ciclo: campos pertinentes, comentário completo, persistência confirmada e nova notificação. Comentário ausente/inacessível ou leitura indisponível suspende trabalho dependente; não substitua por conteúdo do chat ou outro comentário mais recente.

Notificação não é demanda autônoma nem aprovação adicional. No-op e ack sem conteúdo não geram comentários ou pingue-pongue. Antes de repetir após timeout, confira resultado/registro e preserve idempotência; não duplique comentários. Se gravação falhar, mantenha pendência e não emita notificação do protocolo sem comentário/ID confirmado; nunca alegue sucesso. Comunicação imposta por instrução superior continua sendo respeitada. Se o envio falhar após gravação, retome apenas o envio necessário. Permissões do harness continuam obrigatórias; a skill não amplia autorização para mensagens.

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

Busque candidatos por nome igual/próximo do colaborador e referências disponíveis; consulte contexto/perfil/sinais de Collaborator só quando permitido. Nome e menção à skill não provam identidade. Reúna candidatos numa proposta única e obtenha escolha explícita continuar ou criar novo, inclusive em modo automático; fora do bootstrap inicial de novo chat Collaborator e de seu retorno de configuração, registre proposta/opções em comentário da task e avise o humano por metadados, sem caixa interativa; não envie instruções a chat não escolhido. Reuse a escolha já aprovada sem perguntar de novo. Criação de chat depende da autorização/capacidade do harness. Use `🐝 <nome do colaborador>` no título inicial de novo chat autorizado, preservando contexto; ajustar título do chat não renomeia agente. Sem acesso, informe lacuna, não alegue exclusão. Não crie vínculo persistente adicional chat–agente no Bee Team; use relações/referências disponíveis na coordenação, sem inventar pai/filho nativo.

Handoff pede explicitamente **usar Collaborator**, indica identidade existente (fallback novo só explicitamente autorizado), time, referência real da task quando existir, referência do contexto de execução salvo; fora do bootstrap inicial de novo chat Collaborator e de seu retorno de configuração, notificação restrita a task, áreas efetivamente atualizadas, status pertinente e commentID retornado. Use dados persistidos. Exija duas confirmações reais: identidade/perfil prontos; depois compreensão da task atribuída e pendências. Sem task registrada e atribuída, o colaborador aguarda. Registre/atribua antes de solicitar execução; mensagem direta não substitui registro. Criar/desdobrar tasks pelo colaborador só dentro do escopo de task já atribuída. Preparação exige descrição/specification/plano versionado proporcional antes do trabalho, inclusive pequeno.

Colaborador salva progresso/síntese/comentários/resultado pertinentes e confirma persistência antes de comunicar bloqueio, decisão ou encerramento. Falha de gravação/envio fica explícita. Retome somente etapa faltante, sem duplicar agente/time/chat ou trabalho ativo; não prometa recuperação de conversa integral ausente.

## Invariantes de execução e dados

- Preserve `rootTaskId`/`originBoardId`: origem manual força aprovação; standard usa flag de cada task sem herdar do pai; automatic cobre cadeia cross-board. Não altere modos destino. Regras explícitas de composição/reuso de chats e atribuição continuam valendo; autonomia não amplia permissões do harness.
- Board tem criador preservado e um time gestor; task tem board, autor/executor obrigatórios UUID e não tem teamId. Subtasks recursivas podem atravessar boards/executores sem ciclos. Agente tem perfil único, lidera no máximo um time e colabora em no máximo um (podem ser diferentes). Não edite tasks alheias supondo que gestão do time confere permissão: alcance via executor gerido continua pendente.
- Separe description, specification (o quê/aceite), plan.content versionado (como) e currentSummary (feito/agora/pendências). Atualize campos atuais e histórico em mudanças na mesma task. Reponha síntese cumulativa a cada progresso/status/entrega. Bloqueio é flag separada, com motivo/impacto/condição de retorno. Fechar atividade não conclui task; revisão segue orientação/autonomia, sem revisão humana universal.
- Resolva slugs de Agent/Team/Task por tipo antes de usar UUID; board não tem slug. Nunca gere IDs/slugs nem use nome como identidade. Preserve versões, idempotência e resultado real; falha de gravação suspende trabalho dependente.
- Reutilize banco/API/MCP/painel saudáveis; inicie só parte ausente pelo procedimento suportado, preserve PostgreSQL/dados e não faça seed/reset ou contorne recusa. Endpoint ativo não comprova ferramentas no chat; cadastrar conexão requer autorização. Colaboradores não competem pelo startup.

## Recursos MCP e limites

Use resources/prompts só se anunciados. `prepare_execution`/prompts são leitura, não execução nem atribuição; `record_progress`/`close_activity` escrevem apenas conforme autorização/schema. Leia esta referência local completa antes de operar; se consumir apenas MCP e o workflow não estiver disponível, informe a lacuna e solicite conteúdo equivalente, sem inventar URI ou explorar filesystem. Instalar esta skill não atualiza snapshots compilados do servidor.
