# Exemplos adaptáveis de equipes

São propostas de divisão, não equipes fixas nem autorização de execução. Para cada demanda, consulte perfis e contexto existentes; formação de equipe exige aprovação concreta do usuário independentemente da autonomia de tasks/boards. Aprovações de execução/chats seguem suas regras próprias.

## Abertura e formação

| Situação | Resposta esperada antes de qualquer cadastro |
|---|---|
| Chat novo sem time indicado | Cumprimentar, abrir Teams no endereço confirmado e pedir escolha existente/novo; usuário informa escolha no chat, sem substituir conversa por checklist MCP. |
| Usuário escolhe time existente | Consultar time e líder; carregar perfil/instruções/estilo/regras/contexto, assumir esse papel e retomar trabalho relevante sem criar ou sobrescrever identidade. |
| Contexto diz explicitamente “use o time Alfa” | Resolver e consultar Alfa, sem repetir a pergunta de escolha. Nome ambíguo exige esclarecer, não escolher arbitrariamente. |
| Nenhum time adequado | “Você quer criar um time?”; se sim, perguntar primeiro sobre o objetivo do projeto, depois esclarecer escopo uma pergunta por vez. Não criar registros ainda. |
| Demanda entendida | Propor líder e colaboradores com responsabilidades e motivo, explicando reutilização/criação; aguardar aprovação concreta. |
| Usuário altera ou rejeita composição | Incorporar a mudança, reapresentar composição resultante e aguardar confirmação; nada da proposta rejeitada é cadastrado. |
| Time sem líder ou vínculos inconsistentes | Para time escolhido sem líder, ler time e criar/vincular liderança adequada conforme fluxo; inconsistência distinta ou dado essencial ausente exige esclarecimento específico, sem duplicar identidade. |
| Board automático, equipe ainda não aprovada | Manter aprovação da formação; autonomia da execução não aprova agentes/time/vínculos. |

Exemplo de time novo: após entender que o usuário quer um site com API, propor “Eu conduzo o trabalho como líder; proponho Ana para interface e Bruno para API, por essas entregas terem contratos distintos. Reutilizaremos os perfis disponíveis, se os vínculos permitirem. Você aprova essa composição?”. Se o usuário pedir uma única pessoa para implementar, ajustar a proposta antes de cadastrar. Projeto permanece descrição da demanda; não criar entidade Project/workspace.

## Desenvolvimento: site com API

Demanda: construir site que consulte uma API, com escopo de publicação separado.
Divisão: interface produz telas; API produz contrato e serviço; validação verifica integração e critérios de aceitação. A separação permite execução independente após combinar contrato e dados de exemplo. Validação da integração depende das duas entregas.
Entregas: telas, contrato/serviço, evidências de testes e pendências de publicação.
Reutilizar: colaborador que conhece interface ou API e cujo chat ainda tem contexto pertinente. Criar: sessão para frente independente sem contexto adequado; novo perfil somente se faltar atuação disponível, respeitando vínculos. Não criar três pessoas se uma alteração pequena couber em uma.
Proposta: “Reutilizar Ana na interface e Bruno na API; criar chat para Carla validar quando ambos entregarem. Entregar integração testada; publicação continua fora do escopo.”

## Tesouraria: fluxo de caixa

Demanda: organizar contas e projetar caixa de 90 dias, sem movimentar dinheiro.
Divisão: contas organiza pagar/receber; projeção usa saldos e vencimentos reconciliados; conferência identifica divergências e lacunas. Separar origem dos dados da projeção facilita conferir premissas.
Entregas: base conciliada, projeção por período, lista de divergências e premissas. Projeção depende da base; conferência pode examinar amostras enquanto ela é preparada.
Reutilizar: quem conhece categorias e fontes anteriores, após conferir atualização. Criar: chat para conferência independente se houver volume e capacidade; não duplicar identidade só porque o chat antigo foi fechado.
Proposta: “Ana organiza contas; Bruno projeta após receber a base; Ana confere divergências se o volume permitir, ou proponho uma terceira frente. Nenhum pagamento será executado.”

## Financeiro: custos, orçamento e cenários

Demanda: estruturar planilha de orçamento versus realizado e analisar cenários.
Divisão: organização da planilha normaliza períodos/categorias; custos explica variações; cenários calcula alternativas com premissas explícitas. Custos e cenários dependem da base comparável, evitando misturar períodos.
Entregas: planilha com fórmulas verificadas, análise de desvios, cenários e incertezas. Revisão confere fórmulas, unidades e premissas, sem aprovar gastos.
Reutilizar: agente que mantém o modelo e seu contexto; abrir nova sessão da mesma identidade quando a anterior faltar. Criar outro colaborador apenas para capacidade/atuação distinta; atuar na task não exige mudar de time. Se o usuário também pedir reorganização, proponha composição válida ou cópia de perfil solicitada, sem levar histórico interno.
Proposta: “Reutilizar responsável pelo modelo na base; analista de custos explica desvios; cenários começa depois da conferência. Entrega é análise, não execução do orçamento.”

## Mercado: concorrentes, segmentos e síntese

Demanda: avaliar oportunidade em segmento e região definidos.
Divisão: concorrentes levanta ofertas/fontes; segmentos analisa necessidades e sinais de demanda; síntese cruza evidências, limitações e hipóteses. As pesquisas podem correr em paralelo com recorte comum; conclusão depende das duas.
Entregas: comparação com fontes/datas, segmentos fundamentados e síntese com incertezas. Não transformar hipótese em fato nem concluir só pela quantidade de fontes.
Reutilizar: pesquisador com histórico relevante e fontes acessíveis; criar sessão independente quando o recorte exigir contexto separado. O líder pode consolidar sem criar um agente só para síntese.
Proposta: “Reutilizar pesquisador de concorrentes; abrir sessão para análise de segmentos; consolidarei quando receber ambos. A aprovação cobre essas duas frentes, sem contato externo com clientes.”

## Uma demanda atravessando boards

Pré-condição em chat novo: se a skill está carregada e o painel abre, mas ferramentas Bee Team faltam, o líder identifica a URL MCP e prepara cadastro autorizado conforme a referência Codex. Depois confirma leitura pela ferramenta da sessão antes de consultar/registrar a demanda. Se o cadastro já existe e apenas este chat não foi atualizado, reutiliza a conexão e orienta atualização/nova sessão suportada; não inicia outra API. Colaborador sem acesso reporta a lacuna, sem repetir configuração global.

Uma análise de mercado pode originar uma subtask financeira em outro board, executada por outro agente. Preserve `rootTaskId`/`originBoardId` da pesquisa e consulte a task financeira: origem `standard` exige a flag individual dela, mesmo se a pesquisa pai for automática. Origem `automatic` cobre a cadeia; origem `manual` exige aprovação. Não altere configurações do board financeiro. O briefing leva objetivo, fontes, decisões e limites da task; não copia histórico interno do pesquisador. Autor/executor são explícitos e a relação entre tasks não exige pertencerem ao mesmo time.

## Chats e duas confirmações

Candidatos por nome/contexto são evidência, não prova: reunir escolha de reuso/novo numa proposta única inclusive em automatic. Handoff explicita usar Collaborator; confirmar identidade/perfil e depois compreensão da task real atribuída. Sem task, aguardar registro/atribuição. Não criar persistência adicional chat–agente.

## Exemplo de pergunta, decisão e entrega

Na mudança de endpoint, Collaborator salva a pergunta completa em comentário e notifica task, área “comentário” e commentID retornado. Leader lê esse ID via MCP e a task atual; atualiza specification/plano se necessário, salva resposta/decisão completa em novo comentário e notifica somente task, áreas realmente atualizadas, status pertinente e novo commentID. Collaborator lê esse comentário e estado atual, executa o escopo atribuído, salva arquivos/evidências, síntese e estado pertinentes, depois comentário completo de feito/não feito e pendências. Notifica só após confirmar tudo. Validação humana pendente não vira Concluído. Aviso repetido ou ack sem contribuição não gera novo comentário/notificação.


## Marca do papel no título do chat

Ao receber/ativar esta skill no próprio chat, aplique imediatamente a marca do papel: `👑` para Leader ou `🐝` para Collaborator, inclusive em chat existente que muda de papel e antes de resolver a identidade. Nesse momento preserve o título atual útil, sem inventar nome. Após identificar o perfil, ajuste a parte do nome para o nome real, preservando complemento útil de projeto/time e demais conteúdo do título, com a mesma marca.

Consulte o título atual e a ferramenta real do harness. Remova somente as marcas de papel iniciais repetidas/misturadas (`👑`, `🐝` e estrela legada usada como marca) e seus espaços, então anteponha uma única marca do papel ativo. Não remova emojis ou conteúdo do restante do título. Se já correto, não renomeie. Mudança de papel substitui a marca anterior, nunca acumula `👑🐝`. Só confirme renomeação após sucesso; ausência ou falha da ferramenta não bloqueia o fluxo de identidade/trabalho autorizado.

Ao criar um chat Collaborator autorizado, a Leader já usa `🐝 <nome do colaborador>`, preservando contexto útil; o Collaborator garante o padrão ao ativar sua skill. Na busca/reutilização, compare nomes normalizando essas marcas iniciais, sem perder contexto nem tratar nome/emoji como prova de identidade. Preserve as confirmações de reutilização e permissões do harness existentes.

A mudança é exclusivamente no título do próprio chat ao assumir o papel, ou no título inicial do novo chat cuja criação foi autorizada. Não renomeie outros chats em massa nem altere nomes de agentes/times, slugs ou dados Bee Team. Marcar o papel não confirma identidade nem dispensa tarefa registrada/atribuída. O Collaborator continua sem conduzir a tela do usuário; ajustar seu próprio título não é navegação do painel.

Exemplos: ativar Collaborator em `Projeto X` produz `🐝 Projeto X` antes da identidade; identificado como Ana, ajusta para `🐝 Ana — Projeto X`. `👑 Ana — Projeto X` ao assumir Collaborator vira `🐝 Ana — Projeto X`; a transição inversa usa `👑`. `🐝 👑 🐝 Ana` vira uma única marca do papel ativo; retomada com título correto não escreve novamente.

## Dúvida de execução

Collaborator precisa decidir comportamento de erro do endpoint: registra a pergunta completa e alternativas no comentário, não abre request_user_input nem pergunta ao humano. Se puder executar testes independentes já autorizados, continua essa parte; só marca bloqueio quando necessário. Leader lê comentário/task e responde ou registra pergunta/opções na tarefa e avisa o humano por referência sem caixa interativa; aguarda resposta autorizada, persiste decisão e devolve notificação taskID/áreas/status pertinente/commentID. Collaborator lê a resposta pelo ID via MCP antes de implementar. Aprovação obrigatória de ferramenta continua sendo respeitada.

Relato de entrega, pedido de confirmação e escolha de alternativa seguem a mesma via: Collaborator registra conteúdo substantivo em comentário e notifica a Leader apenas pelos metadados; não relata nem pede confirmação diretamente ao humano. Quando decisão humana for necessária, Leader registra pergunta/opções em comentário e avisa por referência, sem caixa interativa; aguarda resposta autorizada, persiste a devolutiva e notifica. Metainstrução legítima do usuário ou aprovação obrigatória da ferramenta não é contornada por essa regra.

Na criação autorizada de novo Collaborator, siga [bootstrap](collaborator-bootstrap.md): primeiro chat, depois cadastro/vínculo pelo próprio Collaborator e retorno nome real/IDs/prontidão; só então Leader atribui trabalho. Exemplos de nomes não são perfis persistidos.
