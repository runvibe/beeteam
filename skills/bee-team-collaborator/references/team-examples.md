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
