# Bee Team — especificação do produto

Atualizada em 27 de outubro de 2026. Revisão documental autorizada; implementação frontend/backend e skills permanecem pausadas. Estes documentos não comprovam runtime implementado.

## Objetivo e execução local

Organizar, para uso pessoal, equipes de colaboradores de IA para desenvolvimento, tesouraria, planejamento financeiro, pesquisa, planilhas e outras demandas. O produto reúne uma skill coordenadora e uma aplicação que preserva perfis, tarefas, decisões, entregas e resumos.

Bee Team é instalado no computador do usuário como servidor local com interface web, API e MCP. A IA no Codex ou outro harness consulta configurações e registra trabalho. Bee Team não acessa diretamente recursos da IA, não inicia/controla chats e não executa tarefas por conta própria. A skill orienta o uso dos recursos disponíveis no harness; capacidades ausentes devem ser explicitadas.

## Modelo final

- **Board:** organiza tasks e status configuráveis. Identifica obrigatoriamente seu criador e preserva essa autoria. Tem exatamente um time responsável pela gestão, transferível para outro time. Um time pode gerir vários boards. Transferir gestão não altera autoria, executor, hierarquia ou histórico das tasks.
- **Task:** pertence a um board; tem autor/dono obrigatório (agente que a escreveu) e executor obrigatório (agente que a executará). Ambos podem atuar como líder ou colaborador. Autor é preservado; executor pode ser reatribuído pelo usuário.
- **Subtask:** é Task com parentId. Recursão sem limite fixo de níveis, executor próprio obrigatório, podendo ser diferente do pai, e board próprio, podendo ser diferente do pai. Ciclos parentais são inválidos. Checklist é projeção dos filhos, sem duplicar estado.
- **Time:** grupo organizacional de agentes que o líder utiliza para distribuir demandas. Pode gerir boards, mas tasks não têm vínculo direto de pertencimento ao time. Cada time tem exatamente um líder.
- **Agente:** perfil e identidade persistentes, independentes de chats. No máximo um vínculo como colaborador e um como líder, em times diferentes. Sem papel especial de gerente.
- **Chat:** sessão externa referenciada; não é identidade permanente do agente.

Informações e histórico das tasks estão disponíveis a todos. Mudar o time de um agente não muda suas tarefas, autoria ou acesso ao histórico das tasks. Transferir uma task muda somente seu executor; não copia o histórico interno do agente anterior. Autoria do board é registrada a partir do contexto declarado da criação; detalhes de representação HTTP estão no contrato.

## Coordenação e autonomia

O usuário coordena solicitações e aprovações na conversa com o team leader. Autonomia libera coordenação dentro do escopo concedido e não amplia autorizações externas nem concede recursos ausentes no harness.

Board tem três modos: **totalmente manual**, **padrão** e **totalmente automático**. Task tem modo individual **manual** ou **automático**. O default inicial permanece seguro: aprovação/manual. O nome do modo de board 'padrão' não significa que ele seja escolhido implicitamente como valor inicial.

O contexto de execução é o board que originou a task principal. rootTaskId identifica a task principal; originBoardId identifica esse board. O harness carrega esse contexto por toda a cadeia recursiva, incluindo subtasks em outros boards. O board de destino não substitui o de origem; calcular o modo efetivo não altera configurações salvas.

| Modo do board de origem | Modo efetivo na task atual |
|---|---|
| Totalmente manual | Manual, independentemente da flag individual e do board de destino. |
| Padrão | Usa a flag individual da task atual; não herda automático do pai. |
| Totalmente automático | Automático em toda a cadeia, independentemente das flags individuais e dos boards de destino. |

Sem contexto de execução, manter aprovação. Bee Team armazena configurações e informa o contexto/modo efetivo; o harness executa e cumpre aprovações. O servidor não é um engine executor.

Colaborador trabalha nas tasks que executa. O líder distribui demandas usando agentes geridos, mas não existe 'líder do time da task'. O alcance de edição do líder sobre tasks de executores geridos ainda aguarda decisão; não tratá-lo como permissão confirmada. Não há autenticação ou política de segurança implícita nessa descrição.

## Interface: Tarefas e RA

A área **Tarefas** apresenta Kanban por board. Status têm nomes/ordem configuráveis; fluxo inicial sugerido: Backlog, A fazer, Em andamento, Em revisão, Concluída. Não exigir passagem por todas as etapas. Bloqueio é marca com motivo separada de status. Revisão segue a orientação do usuário, podendo ser pelo líder quando permitido no contexto.

O card mostra título, descrição, autor, executor, status, andamento, planejamentos, filhos/checklist, comentários, arquivos, entregas, pendências e timeline com autoria. Comentários e uploads existem em qualquer nível de task. Vários planejamentos podem ser salvos; versionamento imutável é proposta técnica de preservação de histórico.

Ao encerrar atividade, executor atualiza a task correspondente e salva resumo, resultado/status, entregas, decisões e pendências. Encerrar atividade não significa necessariamente concluir a task. Não há transcrição integral/parcial de conversa nem flag de salvamento por agente; preservar resumos do trabalho por task.

A área **RA — Recursos de Agentes** lista perfis com nome, imagem opcional, atuação, estilo, instruções, regras e limites. Imagem pode ser produzida externamente por IA; servidor não implementa geração. Limites do perfil orientam uso, mas permissões reais dependem do harness. Sem campo de skills no perfil ou task; a skill coordenadora e seus exemplos permanecem.

Referências de chats e contexto de retomada reutilizam perfil e leituras de tasks/resumos/decisões/entregas. O perfil consulta suas atividades por relações com tasks, sem replicar histórico. Contexto/histórico interno do agente não é entregue automaticamente ao novo executor de uma task.

## Times, transferência e cópia

Arquivar time preserva time, colaboradores, vínculos e histórico. Não libera vínculos automaticamente. Transferência explícita de agente para outro time é permitida inclusive saindo de time arquivado, mantendo identidade e tasks. Validar cardinalidades de papéis no estado final da transação; não mover nem reatribuir tasks durante essa transferência.

Cópia solicitada cria identidade independente, reutilizando perfil e contexto resumido apenas quando pedido. Não duplica autoria de atividades, tasks, chats ou histórico interno. Os detalhes técnicos de cópia de imagem e referência de resumo são propostas no contrato RA.

## Limites do painel e retomada

Painel visualiza trabalho e configura padrões. Não introduzir despacho operacional de tasks, reorganização de times ou aprovação de execução pela UI sem decisão específica; solicitações e aprovações permanecem na conversa. Website comum pode ser usado no navegador normal ou interno do harness, sem integração visual especial.

Perfis e registros já salvos sobrevivem ao fechamento/exclusão de chat. Retomada recupera objetivo, instruções, responsabilidades, decisões, entregas, referências, pendências e próximo passo. Não presumir recuperação de conversa perdida ou não registrada. Não há conectores de captura contínua. Um chat supervisor adicional é opcional e não requisito.

Datas de atualização e estados ativo/arquivado são registros cadastrais; não comprovam agente vivo ou execução contínua.

## Decisões técnicas e contratos

Backend Rust existente, PostgreSQL >=18. IDs persistidos UUID v7; referências externas de chat/harness são texto opaco. Exclusões de banco são lógicas via deleted_at (JSON deletedAt); preservar dados físicos e histórico. archivedAt é separado de exclusão.

Sem autenticação, tokens, schemes ou modelo de identidade verificada. Autoria declarada na API não prova quem enviou a requisição. O contexto HTTP human/agent é proposta de auditoria, não barreira de acesso.

Listagens usam offset/limit e filtros pertinentes, ordenação estável e totais após filtros/exclusão lógica. Frontend futuro usa mock API conforme contrato. Nesta revisão não se implementa frontend, backend nem skills.

- [Contrato Kanban](docs/kanban-openapi.yaml) e [plano Kanban](docs/kanban-api-plan.md).
- [Contrato RA](docs/ra-openapi.yaml) e [plano RA](docs/ra-api-plan.md).
- [Checklist desta revisão](docs/contracts-checklist.md).

Pendência material encaminhada: edição de task pelo líder via executor gerido. Detalhes técnicos de nomes de campos, arquivamento de agentes, revisão de planejamento, limites de payload e representação do contexto permanecem propostas explicitadas nos contratos, sem reabrir decisões finais acima.

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

## Resumo atual cumulativo (implementado)

Task.currentSummary é string sempre presente em item/listagens/view, inicialmente vazia (incluindo backfill de legadas). Texto explícito do colaborador, máximo 16384 bytes UTF-8, com feito/concluído, trabalho atual e pendências/próximo passo; não se infere descrição, nota de progresso ou histórico. Escrita substitui a síntese inteira, preservando antes/depois nos eventos existentes da timeline.

PatchTask aceita currentSummary não vazio e o exige quando progress é enviado. Position (operação moveTask) o exige ao mudar status, não ao reordenar no mesmo status. RecordExecution exige currentSummary; mantém summary como registro histórico de atividade e salva ambos atomicamente. MCP simples segue os mesmos DTOs; record_progress aceita currentSummary no topo e por descendente, obrigatório com progress; close_activity exige execution.currentSummary. Título/descrição/modo podem ser editados sem enviar resumo; preservam o existente.

Persistência reutiliza tasks.data JSONB (migration 202610270004); nenhuma tabela duplicada ou query por card. Backend não calcula síntese nem cliente precisa ler toda história. Erro de versão, conteúdo, contexto ou descendente reverte todas as alterações compostas; idempotência cobre o texto enviado. Sem alterações na política de edição do líder.

## Especificação própria e Markdown

`Task.specification` é texto Markdown (máximo 65536 bytes UTF-8), sempre presente em leitura/listagem/quadro/contexto MCP. Criação aceita campo opcional, com padrão `""`; PATCH aceita substituição integral, inclusive `""` para limpar. Null/tipo incorreto/excesso de bytes são rejeitados. Migration005 preenche legadas/tombstones sem inventar conteúdo, preservando as especificações existentes.

Especificação define entrega, requisitos, regras e critérios de aceite. `description` apresenta a tarefa, `PlanRevision.content` descreve execução versionada, `currentSummary` relata estado cumulativo atual. Nenhum substitui o outro. Alteração apenas de specification é administrativa e não exige currentSummary; progress conjunto mantém sua exigência. Timeline mantém antes/depois via task.updated. Replays legados recebem vazio explícito no snapshot, mantendo versão e conteúdo anterior.

Especificações e planos/revisões conservam o texto recebido, incluindo Markdown, Unicode, quebras de linha e trechos de código/HTML literais. O backend não renderiza HTML, executa ou transforma conteúdo. Planos continuam com content Markdown limitado a 65536 bytes, revisões imutáveis e conflitos baseRevision existentes. Sem nova entidade ou versionamento exclusivo de especificação. Clientes devem tratar conteúdo como dados e renderizar com segurança quando necessário.
