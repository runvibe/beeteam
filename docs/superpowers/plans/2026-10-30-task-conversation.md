# Conversa no detalhe da task — plano para revisão

> **For agentic workers:** Use `superpowers:executing-plans` para executar as etapas somente após autorização de implementação. Este documento não autoriza execução, delegação nem alteração de registros.

**Goal:** Apresentar os comentários persistidos como conversa legível, com Markdown, autoria explícita e alinhamento por papel.

**Architecture:** Manter API/MCP e domínio `comments`; extrair a apresentação da aba para componentes pequenos. Resolver autoria e papel por metadados estruturados, separadamente do corpo Markdown e da política de paginação/scroll.

**Tech Stack:** React, TanStack Query, componentes Radix/shadcn existentes, Motion já instalado, `Markdown` compartilhado com ReactMarkdown/remark-gfm.

**Spec:** Pedido humano de 30/10/2026: planejar, sem implementar, aba “Conversa”; Leader à direita, Collaborators à esquerda; Markdown em todos os comentários. As propostas abaixo ainda dependem da revisão indicada.

## Auditoria confirmada

- `frontend/src/features/task-detail-layout.tsx`: rótulo “Comentários”, valor interno `comments`.
- `frontend/src/features/tasks.tsx`: `Records` lê página de 10 itens, `comments.offset` e `comments.limit`; `RecordContent` usa `Author` + `TextBlock`, não Markdown. `Author` recebe apenas `actorId`, perdendo a distinção explícita de `actorKind` nessa apresentação.
- `frontend/src/api/generated/kanban/Comment.ts`: `id`, `taskId`, `body` (até 16384 bytes UTF-8), `actorKind`, `actorId`, `createdAt`, `deletedAt`. Não existe snapshot do papel/nome/avatar do autor na publicação.
- `Agent.bindings` tem `leaderTeamId` e `collaboratorTeamId`; `Member.role` é contextual ao time. Task tem autor/executor e board atual, mas isso não determina o papel de cada comentarista. Autor da task não deve ser automaticamente tratado como Leader.
- `frontend/contracts/kanban-openapi.yaml`, GET comments: `createdAt` asc/desc, desempate por `id` na mesma direção, offset/limit, total/hasMore/nextOffset e filtros temporais. O contrato declara ausência de snapshot entre requisições; verificar comportamento do runtime antes de implementar a navegação nova.
- `frontend/src/components/markdown.tsx`: GFM, `skipHtml`, links externos com `noopener noreferrer`, tabelas em região rolável acessível, offset de títulos opcional. Não executa HTML nem código. Reutilizar este componente.

## Proposta visual e funcional

1. Rótulo visível **Conversa**, inclusive seletor mobile. Manter `tab=comments`, `comments.offset`, `comments.limit`, IDs e todos os contratos. Não introduzir `tab=conversation` como substituição nem regravar URLs compartilhadas sem necessidade.
2. Mensagens em ordem cronológica crescente no DOM e na tela: antigas acima, recentes abaixo; desempate estável por ID. Nunca usar `column-reverse` ou inverter só a ordem visual.
3. Balão com avatar, nome, papel explícito e `<time dateTime>`; horário local e data completa acessível. Repetir identificação em cada mensagem nesta primeira versão. Não depender de cor/alinhamento para comunicar autoria.
4. Leader à direita, Collaborator à esquerda. Texto dentro de ambos alinhado à esquerda. Balões com largura máxima legível, usando tokens existentes e contraste nos dois temas. No mobile, reduzir margens laterais sem ocultar nome, horário ou papel.
5. `Markdown` para **todos** os corpos, sem alterar a string salva, sem conversão persistida e sem inferir autor/papel pelo texto. Usar `headingOffset={2}`, sem divisores automáticos de documento dentro dos balões. Preservar listas, tarefas, títulos, citações, código literal, links e tabelas.
6. Mensagens longas expandem verticalmente, sem corte silencioso. URLs/palavras longas quebram linha; código e tabelas rolam horizontalmente dentro do balão, nunca a página inteira. Reservar dimensões de avatar; falha de imagem usa o fallback do componente existente. Verificar imagens Markdown e carregamento tardio para não perder âncora de leitura.
7. Sem composer, botão “enviar”, execução de agentes ou sessão de chat: é uma visualização dos comentários já persistidos.

## Autoria e fallbacks propostos

| Caso | Apresentação proposta |
|---|---|
| `actorKind=agent`, binding de Leader confirmado | Direita, nome/avatar do agente e papel “Leader”. |
| Agente com binding apenas de Collaborator | Esquerda, nome/avatar e papel “Collaborator”. |
| Agente simultaneamente Leader e Collaborator | Prioridade de Leader, direita; confirmar política abaixo. |
| Vários Leaders comentando | Todos à direita, cada um com identidade própria; nunca fundir em um “Leader” genérico. |
| `actorKind=human`, ID nulo ou não resolvível como pessoa | Esquerda com tratamento neutro, “Pessoa · identidade não informada”; não chamar de Collaborator nem de usuário atual. |
| Agente sem binding, perfil excluído/indisponível ou erro de consulta | Esquerda neutra, “Agente indisponível” ou nome conhecido, “Papel não identificado”; ID abreviado disponível como detalhe acessível, sem link quebrado. |
| Dados de autoria inconsistentes | Preservar conteúdo e metadados recebidos; fallback neutro, sem inventar perfil ou papel. |

Resolver perfis somente dos autores das páginas carregadas, com cache compartilhado por UUID, deduplicação e requisições limitadas; não carregar o catálogo inteiro. Na carga inicial, resolver papel antes de posicionar o lote ou usar placeholder estável; não animar balões de um lado para o outro enquanto o perfil chega. Falha de perfil não pode impedir a leitura da conversa. Os papéis exibidos serão **atuais**, não históricos, pois o contrato não guarda esse histórico.

## Paginação e preservação de leitura

- Proposta: abrir na janela mais recente quando não há offset explícito; respeitar exatamente a janela ascendente de um link legado com `comments.offset`. Consultar o total e buscar a última janela de forma limitada, sem percorrer todo o histórico. Revalidar total quando necessário; não assumir snapshot estável.
- “Carregar anteriores” no topo, acionável por teclado, acrescenta páginas anteriores antes das mensagens existentes. Usar ID da primeira mensagem visível e sua distância ao viewport para restaurar a âncora após prepend; não depender só da diferença de scrollHeight.
- Novas mensagens: se o leitor estiver no fim (limiar proposto: 48px), acompanhar o fim. Se estiver lendo acima, preservar a âncora e oferecer “Novas mensagens” para ir ao fim. Não usar anúncio automático de todo o histórico como `role=log`; anunciar apenas contagem de novas mensagens em região discreta para leitor de tela.
- Preservar janela carregada, âncora e seleção ao alternar abas/voltar à task, com estado por task. Não remontar o painel por mudanças de query, paginação ou atualizações. Respeitar os contêineres desktop/mobile existentes; não criar rolagem aninhada desnecessária.
- Reutilizar loader compartilhado (100ms) e slot estável; manter mensagens existentes durante loading/erro e oferecer retry. Dedupe por ID, cancelar/ignorar respostas da task anterior, impedir requisições concorrentes do mesmo intervalo e interromper no fim.
- Offset sem snapshot pode deslocar páginas sob exclusões/novos registros. Ao detectar mudanças, revalidar janelas sobrepostas e preservar âncora por ID; não prometer ausência absoluta de lacunas com esse contrato. Testar especialmente timestamps iguais e exclusão do item âncora. Não inventar cursor ou alterar backend nesta entrega.
- Fade existente apenas ao trocar de aba; nenhum fade do histórico a cada append/prepend, filtro, refresh ou perfil resolvido. Reduced motion instantâneo.

## Decisões realmente abertas

1. **Qual Leader determina a direita?** Recomendação: qualquer agente com `leaderTeamId` atual, com prioridade de Leader se também for Collaborator. Alternativa: papel no time do board atual; isso muda a classificação de agentes de outros times e exige uma política explícita. Em ambos os casos, não há base para reconstruir papel histórico sem mudança de contrato.
2. **Abertura padrão:** recomendação é janela mais recente, com anteriores acima e links legados preservados. Alternativa de menor mudança: manter primeira página antiga como hoje. A ordem interna permanece crescente nas duas opções.

Humanos/desconhecidos à esquerda neutra são a proposta de fallback, não uma inferência de papel. Não há decisão de API, execução de agentes ou criação de chat a aprovar neste plano.

## Etapas de implementação futura

- [ ] **1 — Autoria:** criar `frontend/src/features/task-conversation-author.ts` com classificador puro, e testes para toda a tabela acima, mudança de papel, múltiplos Leaders, autor/executor diferentes e falha de perfil. Integrar resolução limitada usando hooks/cache existentes. Entrega revisável: papel explícito sem inferência textual.
- [ ] **2 — Mensagens:** criar `task-conversation.tsx` e `task-conversation.css`; extrair apenas o ramo comments de `tasks.tsx`; trocar o rótulo em `task-detail-layout.tsx`. Reusar `AgentAvatar`, navegação por agente e `Markdown`; não modificar outras listas de registros. Testar Markdown/HTML bloqueado/URLs perigosas/código literal, nome/avatar fallback e semântica de data. Entrega revisável: apresentação de conversa com contratos legados intactos.
- [ ] **3 — Histórico:** separar `use-task-conversation.ts` para páginas e âncoras. Testar ascendente com empates, janela legada, prepend, novas mensagens no fim/acima, falha/retry, fim, duplicação, exclusões e respostas atrasadas após troca de task. Entrega revisável: navegação limitada e leitura preservada.
- [ ] **4 — Aceite:** validar desktop e 320/390px, ambos os temas, teclado/leitor de tela, reduced motion, mensagens de 16KiB, tabelas/código largos, imagens tardias, rede rápida/lenta e leitura de histórico real sem alterar registros. Conferir geometria em ambos os eixos e ausência de scrollbar externa do loader. Validar fade só por aba e ausência de perda de drafts/autosave.
- [ ] Executar testes frontend pertinentes e suite/build; `cargo build` e `cargo test` conforme AGENTS, com integração apenas em banco isolado disponível. Não reiniciar produto/Docker instável; registrar limitações. Atualizar README quando implementado e fazer commits locais revisáveis; push/merge apenas com autorização.

## Critério de revisão deste plano

Documento apenas: nenhum código de produto, comentário, configuração, API/MCP ou dado foi alterado. Antes da execução, fechar as duas políticas acima; depois validar visualmente com o usuário. `PROJECT.md` não foi encontrado na raiz desta worktree durante a auditoria.

## Autorização e decisões posteriores (30/10/2026)

Implementação autorizada pelo usuário via coordenação; não recriar este plano. Fechadas as decisões: papel atual, prioridade Leader quando ambos vínculos, humanos/desconhecidos neutros; janela recente por padrão com offset legado preservado. Autorizados filtro por autor e busca TEXTUAL literal no servidor (não semântica), em combinação AND. Backend alinhou actorId/actorKind/text, case-sensitive, espaços e caracteres %/_ literais, total filtrado e contratos HTTP/MCP. Nenhum embedding/provedor foi introduzido.

Implementação: componentes separados de autoria/apresentação/paginação/âncora, loader compacto100ms, sentinel vazio1px para eliminar vão superior, shared infinite scroll nos dois sentidos. Revisão independente encontrou e corrigiu rebind mobile/desktop, identidade do filtro de cards e clipping horizontal do autofill. Testes de regressão adicionados.

Registro Bee Team pendente por ausência de identidade legítima; execução técnica autorizada explicitamente sem assumir Demo. QA de comentários reais é leitura; fixture temporária em memória para Markdown longo rejeita mutações.
