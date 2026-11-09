# Agentes administrados pelo Bee Team — plano de implementação

Status: contratos, serviços, persistência, HTTP/MCP e painel implementados na branch de revisão. O app local usa o banco de revisão preservado. A validação e o aceite humano permanecem separados da implementação; nenhum merge ou release autorizado nesta entrega.

## Objetivo e decisões

O Bee Team administra seus agentes e cria os chats internos usados para executá-los. Painel e assistentes externos via MCP são entradas para os mesmos agentes. Um assistente externo envia pedidos; não assume um agente, não informa um ID de thread do provedor e não substitui sua sessão.

O vínculo interno agente–execução permanece: contém provedor, thread criada pelo Bee Team, contexto e histórico de continuidade. Referências públicas de conversa/pedido pertencem ao Bee Team e não conferem controle sobre threads externas. A primeira implementação continua usando Codex App Server oficial, com adaptadores extensíveis; Claude Code não faz parte desta entrega.

## Estado atual a alterar

- O contrato atual de chat exige bindingId ativo e oferece createIntegratedSession com expectedBindingId. A interface solicita substituição explícita de vínculo externo.
- Há declaração e troca de sessão via HTTP/MCP, histórico de vínculos, turnos persistidos, entrega pela Conversa e notificações de resumo.
- O painel lateral e seus controles de posição são preservados. Não se altera o layout para realizar esta mudança de domínio.
- O modelo externo atual não pode continuar funcionando como executor de um agente depois da retirada desse mecanismo. Preservar leitura do histórico, sem apresentar referências antigas como execução disponível.

## Fluxo proposto

1. Pessoa ou cliente autorizado cria time/agente, definindo função e configuração de execução permitida (provedor, projeto e ferramentas), sem fornecer thread externa.
2. Bee Team prepara a execução e cria sua própria thread. Proposta: criação sob demanda no primeiro pedido, com estado explícito de preparação; aprovar esse detalhe antes de implementar.
3. Painel ou MCP envia mensagem ao agente por identidade Bee Team. O servidor resolve a execução interna e registra origem, conversa, pedido e contexto de tarefa quando houver.
4. O líder decide a delegação. Comunicações entre agentes passam exclusivamente pela Conversa da tarefa e são entregues pelo Bee Team.
5. Resumo de worker produz um aviso idempotente ao líder na mesma conversa; resumo do líder não produz aviso.
6. O chamador externo consulta estado e resposta pelo ID Bee Team do pedido. Não há promessa de push ou controle do chat externo.

## Etapa 1 — Inventário e contratos compartilhados

- [x] Enumerar DTOs, endpoints HTTP, ferramentas MCP, UI, skills, persistência e testes que aceitam/criam/trocam vínculos externos. Mapear consumidores antes de retirar os comandos.
- [x] Definir contratos de criar/configurar agente, enviar pedido e consultar pedido/respostas. Nomes finais saem deste estudo; não publicar nomes provisórios como ferramentas existentes.
- [x] Envio contém agentId, texto, referência opcional à conversa Bee Team e taskId opcional. Origem do pedido é distinta do executor. Repetição da mesma chave e corpo retorna o mesmo pedido; chave reutilizada com outro corpo é conflito.
- [x] Definir estados: aceito, preparando, em fila, executando, aguardando aprovação, concluído, falhou, cancelado e resultado incerto. Especificar paginação, cursores, erros, limites e comportamento após reinício.
- [x] Definir estratégia de concorrência: serialização por execução, fila limitada e isolamento entre agentes. Não iniciar dois turnos na mesma thread nem misturar a correlação entre chamadores.
- [x] Manter aprovação/cancelamento separados do simples envio de mensagem. Actor atual é metadado, não autenticação; explicitar o controle de acesso existente e não inventar autorização baseada em actorId.
- [x] Entregar OpenAPI, schemas MCP, exemplos válidos/inválidos e tipos frontend gerados. Nenhum ID externo do provedor pode ser usado para escolher ou assumir execução.

Aceite: frontend e backend conseguem implementar sobre fixtures iguais, incluindo concorrência, erro, reconexão e aprovação, sem depender de sessão externa fornecida pelo cliente.

## Etapa 2 — Ciclo interno de execução e persistência

- [x] Separar identidade do agente, conversa Bee Team e execução do provedor; manter histórico interno e uma execução ativa controlada por agente.
- [x] Criar/reabrir somente threads cuja criação pelo Bee Team tenha sido registrada. Não importar automaticamente threads do Desktop a partir de IDs legados.
- [x] Manter IDs internos em repositories; DTOs públicos não permitem substituição arbitrária. Configuração de provedor/projeto é operação explícita, com proteção contra trabalho em curso.
- [x] Tratar falha de bootstrap, credenciais indisponíveis, perda do recibo, processo morto e reinício. Resultado desconhecido não autoriza repetir inferência; reconciliar apenas a thread/turno conhecidos.
- [x] Encaminhar ferramentas e aprovações ao turno correto sem aprovação implícita. Preservar limites de rede, arquivos e MCP existentes.

Aceite: dois pedidos concorrentes não criam duas threads para o mesmo agente; reiniciar retoma a execução certa; nenhuma thread externa é capturada.

## Etapa 3 — Entrada por MCP e roteamento de pedidos

- [x] Implementar envio/consulta com os mesmos serviços usados pelo painel. Separar routes, dto, services e repositories conforme AGENTS.md.
- [x] Registrar pedido antes de despachar; preservar idempotência e correlação em fila, resposta, erro e cancelamento.
- [x] Permitir destinatário líder ou worker. Contatar um worker não concede ao chamador poder de mudar atribuição, status, permissões ou configuração; essas ações continuam nas operações específicas.
- [x] Definir quando um pedido sem tarefa inicia uma conversa e quando precisa ser associado a tarefa. Não criar tarefas silenciosamente como efeito de enviar texto.
- [x] Preservar Conversa como canal entre agentes e aviso automático para cada resumo de worker. Uma resposta não pode iniciar loops de notificações.

Aceite: dois assistentes externos enviam pedidos ao mesmo agente, consultam os respectivos resultados sem trocar respostas; líder e workers executam em threads administradas pelo Bee Team.

## Etapa 4 — Frontend em paralelo após contratos

- [x] Remover formulário de informar/substituir vínculo e textos de assumir sessão; apresentar configuração do agente e disponibilidade da execução.
- [ ] Adaptar chat lateral para enviar/acompanhar pedidos sem bindingId fornecido pelo cliente, mantendo rascunho, navegação, lado e largura.
- [x] Mostrar preparação, fila, execução, aprovação, falha e resultado incerto sem sugerir que toda mensagem já foi entregue.
- [x] Garantir leitura dos históricos anteriores e estados claros para agentes legados ainda sem execução configurada.
- [ ] Validar PT/EN, teclado, mobile, streaming, cancelamento e retomada com fixtures compartilhadas.

Aceite: usuário configura agente e conversa sem copiar IDs de sessão; ausência de autenticação/ferramenta é explicada e não inicia substituição silenciosa.

## Etapa 5 — Transição dos contratos e dados legados

- [ ] Definir a versão que retira escrita de vínculos externos e uma resposta explícita de operação removida, sem fallback silencioso. Atualizar capabilities para clientes identificarem o novo fluxo.
- [x] Preservar registros, mensagens, resumos, IDs Bee Team e referências antigas como histórico. Não apagar, resetar nem reatribuir autoria histórica.
- [ ] Preservar execuções comprovadamente criadas pelo Bee Team; referências externas ficam históricas/inativas para execução até configuração explícita.
- [x] Planejar cutover de trabalho em curso: drenar ou bloquear a transição; resultado incerto permanece rastreável. Não migrar turnos aceitos para outra thread.
- [ ] Criar migrações independentes SQLite/PostgreSQL quando necessárias e validar backup/exportação, reabertura e rollback de aplicação compatível em cópias isoladas.

Aceite: dados anteriores continuam legíveis e íntegros; clientes antigos não conseguem reativar a associação externa; nenhum teste usa banco do usuário.

## Etapa 6 — Skills, documentação e validação integrada

- [x] Atualizar setup, líder e worker: assistente externo envia/consulta pedidos; agentes executados pelo Bee Team usam o contexto interno emitido pelo servidor, sem reivindicar identidade por ID de thread.
- [ ] Revisar orientações para não manter instruções contraditórias de assumir/revincular agente. Atualizar snapshot/proveniência, catálogo MCP, README, changelog e tutoriais.
- [ ] Testar criação, dois workers, delegação, resposta, resumo com aviso único, fila, múltiplos chamadores, reinício, cancelamento, aprovação e falha de autenticação.
- [ ] Provar no Codex real que sessões pertencem ao Bee Team; provar separadamente que MCP externo envia e consulta, sem controlar o Desktop. Testes simulados não substituem aceitação real.
- [ ] Rodar build/test exigidos pelo projeto, ambos os drivers quando houver persistência, validação de contratos e testes de instalação isolada das skills.
- [ ] Entregar PR com alterações incompatíveis, migração, evidências e limitações. Sem merge/release automático; aceite humano antes de Concluído.

## Ordem de execução

Contratos primeiro. Depois, ciclo interno e transição de dados no backend; frontend e revisão de documentação podem avançar em paralelo usando fixtures. Integração e aceitação real fecham a entrega. Métricas de tokens, Claude Code e hospedagem em nuvem permanecem fora do escopo.

## Decisões ainda a fechar no estudo

- Preparação sob demanda versus antecipada; proposta inicial: sob demanda com estado observável.
- Reutilização de contexto entre conversas com o mesmo agente, política de fila e limites por chamador. Não confundir correlação de resposta com isolamento/confidencialidade de contexto.
- Tratamento dos consumidores antigos e versão de retirada das ferramentas de associação. Não manter um modo externo que contradiga a decisão de propriedade interna dos agentes.

## Checkpoint da implementação para revisão — 2026-11-09

- Cada conversa tem uma thread própria; a fila serializa pedidos do mesmo agente. Criar uma conversa nova separa o contexto; continuar uma existente preserva o histórico.
- A configuração explícita aplica o novo modo por agente e impede suas escritas legadas. Agentes ainda não configurados mantêm compatibilidade. A retirada global e a capability definitiva seguem pendentes de aceite; não declarar o cutover global concluído.
- O painel mostra líder e workers, configuração, conversas/pedidos, resposta, cancelamento, aprovação e reconciliação. Históricos antigos permanecem somente para leitura.
- A prova nativa isolada confirmou envio, recibo idempotente, eventos SSE e retomada após reiniciar. Aprovações são verificadas com provedor controlado; não se afirma aceite nativo de todas as ferramentas.
- Banco local de revisão preservado, com backup antes da migração aditiva: 5 boards, 167 tarefas e 107 agentes. Nenhuma fixture foi inserida nesse banco.
- A avaliação humana do fluxo com um projeto real e o cutover global continuam pendentes. Tudo permanece no PR65, sem merge na main.
