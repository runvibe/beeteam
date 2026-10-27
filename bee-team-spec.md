# Bee Team — especificação do produto

Atualizada em 27 de outubro de 2026.

Estado: planejamento consolidado. Esta especificação não constitui a skill implementada nem a aplicação pronta.

## Objetivo

Organizar, para uso pessoal, equipes de colaboradores de IA que executam demandas em diferentes áreas: desenvolvimento, tesouraria, planejamento financeiro, pesquisa, criação e análise de planilhas, entre outras.

O produto reúne uma skill de coordenação e uma aplicação que preserva perfis, tarefas, decisões, entregas e resumos do trabalho por tarefa. A primeira plataforma será o Codex, mantendo o modelo independente de plataforma. Particularidades de outros ambientes, como Claude Code e Copilot, poderão ser documentadas separadamente conforme seus recursos disponíveis.

O Bee Team será instalado e executado no computador do usuário como um servidor local, oferecendo interface web, API e MCP locais. A IA executada no Codex ou em outro harness consulta as configurações e utiliza a API ou o MCP para registrar colaboradores, organizar demandas e salvar dados, resultados e resumos nas tarefas correspondentes.

A aplicação Bee Team não acessa diretamente recursos da IA nem inicia ou controla chats por conta própria. A criação e a condução dos chats cabem à IA e às ferramentas disponíveis no harness, conforme as autorizações do usuário.

## Estrutura organizacional

- Workspace: espaço organizacional da conta, contendo times e seus registros. O uso inicial é pessoal; isso não implica um produto multiusuário.
- Time: possui propósito, contexto, colaboradores, demandas e um team leader próprio.
- Team leader: conversa com o usuário, ajuda a definir e organizar o time, preserva o contexto e coordena sua execução.
- Colaborador: possui identidade e perfil persistentes, com nome, imagem opcional, atuação, estilo de trabalho, regras e limites de acesso. Seu trabalho é consultável pelas tarefas vinculadas e respectivos resumos.
- Tarefa: reúne planejamento, descrição ou resumo, responsável quando atribuído, status, andamento da execução, decisões, entregas, pendências e histórico das atividades, incluindo os resumos do trabalho realizado.
- Chat: sessão de trabalho vinculada a um colaborador; não é a identidade permanente dele.

Um team leader pode atuar como colaborador em outro time. Assim, o usuário pode organizar um time de líderes usando a mesma estrutura, sem introduzir um tipo especial de gerente. Essa decisão substitui a proposta inicial de um único coordenador responsável diretamente por vários times.

Os times são elaborados com o usuário durante a conversa e podem evoluir e ser reorganizados, preservando seus registros. Não há necessidade confirmada de uma camada separada de projetos neste momento.

## Coordenação e autorização

O team leader ajuda no planejamento, propõe a divisão do trabalho, acompanha dependências, bloqueios e entregas e reúne os resultados para o usuário. Os colaboradores podem ser escolhidos por contexto ou tarefa, sem departamentos fixos.

Existem dois modos selecionáveis:

| Modo | Comportamento |
|---|---|
| Com aprovação — padrão inicial | Apresenta quais colaboradores e chats pretende reutilizar ou criar, qual tarefa caberá a cada um e os motivos. Aguarda autorização antes de criar chats, distribuir ou transferir tarefas. |
| Autônomo | Decide como organizar a equipe, cria e reutiliza chats, distribui tarefas e muda responsáveis sem solicitar aprovação a cada ação, dentro da demanda autorizada. Registra e informa suas decisões. |

Acompanhar o andamento e esclarecer uma tarefa já autorizada fazem parte da execução. O modo autônomo diz respeito à organização e delegação do trabalho; não amplia por si só o escopo autorizado da demanda.

O modo escolhido deve ficar persistido na aplicação e ser consultável pela API ou pelo MCP, independentemente do chat do líder. Ainda está em aberto se essa configuração será única por workspace ou configurável por time.

As solicitações de trabalho e as aprovações de execução acontecem na conversa com o team leader. Os modos acima orientam a atuação da IA no harness; a aplicação armazena as configurações e os registros, sem executar a coordenação por conta própria.

## Memória persistente e retomada

A aplicação preserva perfis e registros das tarefas mesmo quando um chat é fechado ou excluído. A retomada utiliza o perfil textual do colaborador e suas tarefas, resumos, decisões e entregas já salvos na aplicação, sem depender de transcrições das conversas ou presumir recuperação de informações não registradas.

Para retomar um colaborador em um novo chat, os registros devem permitir recuperar:

- Objetivo e contexto do trabalho.
- Responsabilidades e decisões relevantes.
- Atividades realizadas e entregas produzidas.
- Localização ou referências dos arquivos e resultados.
- Pendências, bloqueios e próximo passo.

## Aplicação e painel

A interface tem duas áreas principais: **Tarefas** e **RA — Recursos de Agentes**. A aplicação guarda colaboradores, times, tarefas, decisões, entregas e histórico das atividades por tarefa. O painel permite visualizar times, líderes, colaboradores e chats vinculados ao trabalho, além da última atualização recebida, para não apresentar um registro antigo como confirmação de atividade ao vivo.

### Tarefas

Um quadro Kanban, inspirado conceitualmente em Trello e Jira, apresenta o planejamento e o acompanhamento das tarefas. A conversa com o team leader gera o planejamento que os agentes registram no quadro pela API ou pelo MCP.

Ao abrir um card, o usuário consulta:

- Descrição ou resumo da tarefa.
- Responsável, quando atribuído.
- Status da tarefa e andamento da execução.
- Entregas, pendências e bloqueios.
- Decisões e histórico pertencente à tarefa, incluindo os resumos do trabalho realizado.

Ao encerrar uma atividade, o colaborador atualiza o status e as informações pertinentes e salva o resumo do trabalho na própria tarefa.

### RA — Recursos de Agentes

A área RA apresenta a lista de colaboradores e seus perfis. Cada perfil reúne nome, imagem opcional, atuação, estilo de trabalho, regras e limites de acesso. A imagem pode ser gerada por IA, sem que esta definição implique implementar geração de imagens agora.

O perfil textual pode ser reutilizado como contexto e instruções para retomar o colaborador em um novo chat. Os limites registrados orientam sua atuação; as permissões reais dependem do harness.

A relação entre tarefa e colaborador permite consultar no perfil todas as tarefas realizadas e seus respectivos resumos. Os resumos e o histórico permanecem nas tarefas, sem duplicação no perfil. O perfil não possui campo de skills; também não está previsto um campo de skills por tarefa nesta definição. A skill coordenadora Bee Team permanece parte do produto.

### Limites e configurações do painel

O painel também permite configurar padrões que os agentes consultam e seguem. Não é uma superfície para despachar tarefas, reorganizar operacionalmente os times ou conceder aprovações de execução; essas interações permanecem na conversa com o team leader.

A interface web pode ser um website comum, acessível em um navegador normal ou no navegador interno do harness, quando disponível. Não exige integração visual específica com Codex ou outro harness.

A escolha entre aplicação própria e adaptação de ferramenta existente permanece em aberto.

## API, MCP e rotina de atualização

A aplicação disponibiliza API e MCP locais para que os próprios colaboradores consultem configurações, registrem colaboradores, organizem demandas e atualizem dados, resultados e resumos por tarefa. A IA no harness inicia essas interações com o servidor local, utilizando os recursos disponíveis em seu ambiente.

Ao encerrar uma atividade, o colaborador salva na tarefa correspondente um resumo do que fez e atualiza o status resultante, o andamento da execução, as entregas e referências, as decisões relevantes e eventuais pendências ou próximos passos. Se estiver bloqueado, registra o bloqueio. Encerrar uma atividade não implica necessariamente concluir a tarefa.

Essa rotina será descrita na skill e cumprida sem exigir um novo pedido do usuário a cada encerramento.

Não haverá, no escopo inicial, conectores específicos de captura nem integração direta monitorando continuamente os chats. O colaborador utiliza os recursos disponíveis em seu ambiente e envia os dados à aplicação. Capacidades indisponíveis devem ser explicitadas, sem presumir que todos os ambientes oferecem os mesmos recursos.

## Resumos por tarefa

A primeira versão guarda resumos do trabalho nas tarefas em substituição ao histórico de conversas. Não inclui salvamento de transcrições integrais ou parciais nem opção por colaborador para habilitar esse salvamento.

O histórico consultável registra as atividades da tarefa, seus resumos, decisões e entregas. A atualização ao encerrar uma atividade faz parte da rotina do colaborador, sem um novo pedido do usuário; não significa sincronização contínua nem manter chats fechados executando.

## Supervisão adicional

Um chat dedicado a acompanhar o quadro pode ser considerado futuramente. Ele não é necessário ao funcionamento básico: colaboradores atualizam suas demandas e o team leader acompanha e confere as entregas. Sua criação segue o modo de autorização vigente.

## Pontos em aberto

- Construir uma aplicação própria ou adaptar uma ferramenta existente.
- Plataformas de instalação suportadas, stack técnica e funcionalidades detalhadas da primeira versão, mantendo a execução como servidor local no computador do usuário.
- Contratos técnicos da API e do MCP e modelo de armazenamento.
- Configuração de autonomia por workspace ou por time.

## Anexo A — exemplos de organização de equipes

A skill deverá incluir exemplos de diferentes casos de uso. Cada exemplo explicará a demanda inicial, a distribuição proposta, o motivo da divisão, as dependências, as entregas e os critérios para reutilizar colaboradores ou propor novos.

As organizações abaixo são referências adaptáveis. Não impõem departamentos ou quantidades fixas de colaboradores; uma demanda pequena pode ficar com apenas um responsável. A distribuição segue o modo de autonomia configurado, com aprovação como padrão.

| Área | Demanda de exemplo | Possível organização | Dependências e entregas |
|---|---|---|---|
| Tecnologia | Desenvolver um site com API | Interface, API e validação distribuídas conforme a independência das frentes. | Combinar contratos entre interface e API; entregar componentes integrados e resultados da validação. |
| Tesouraria | Organizar o fluxo de caixa | Organização de contas a pagar e receber, projeção de caixa e conferência de divergências. | A projeção depende dos dados organizados; entregar visão de caixa e divergências identificadas. |
| Planejamento financeiro | Elaborar orçamento e analisar custos | Estruturação da planilha, análise de orçamento versus realizado e elaboração de cenários. | Usar períodos e categorias compatíveis; entregar planilha, análise e premissas dos cenários. |
| Análise de mercado | Avaliar uma oportunidade | Pesquisa de concorrentes, análise de clientes e segmentos e consolidação das conclusões. | Definir escopo comum de pesquisa; entregar análise com fontes e incertezas. |

Os exemplos completos da skill deverão mostrar quando o contexto existente favorece reutilizar um colaborador e quando uma frente independente justifica propor outro.
