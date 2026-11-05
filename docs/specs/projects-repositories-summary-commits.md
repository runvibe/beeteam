# Projetos, repositórios e commits por resumo

Estado: implementação autorizada pelo usuário em 03/11/2026 após revisão da especificação, incluindo filtros em Arquivos. Backend e Frontend responsáveis nos chats existentes.

## Revisão autorizada: descoberta local de Git

Esta revisão substitui a entrada manual de repositórios descrita abaixo. Novas tarefas devem declarar ao menos um projeto com nome e caminho absoluto da pasta raiz. O chamador informa somente os projetos efetivamente envolvidos; repositórios são resultados da descoberta feita pelo Bee Team na máquina do servidor.

- Inspecionar cada pasta declarada em modo somente leitura para identificar checkout, branch, worktree e remotes. Reconhecer `.git` como arquivo e diretório. Não incluir outras worktrees automaticamente como envolvidas.
- Projeto sem Git é válido. Pasta inacessível ou inspeção indisponível preserva o cadastro e expõe a condição de descoberta; não equivale a ausência de Git.
- Não executar fetch, hooks ou comandos construídos por shell. Limitar tempo e saída da inspeção, remover credenciais dos remotes e manter acesso ao sistema de arquivos/Git em um adapter de repositório. A descoberta não deve prender a transação de gravação.
- O card de Projetos identifica as pastas/worktrees usadas. O card de Repositórios aparece somente quando houver repositórios identificados. Condições de descoberta ficam junto do projeto.
- Preservar dados antigos, respostas idempotentes e snapshots dos commits já registrados. Atualizações não relacionadas de tarefas antigas não devem forçar preenchimento retroativo. O contrato final deve explicitar atualização de escopo e nova descoberta.
- Skills orientam declarar as raízes reais utilizadas e consultar os identificadores de repositório retornados antes de registrar commits. Não enviar remotes ou repositórios como entrada do escopo.

Implementação: Backend define entrada/saída e descoberta local; Frontend adapta apresentação e contratos; skills recebem exemplos somente após estabilizar os campos. Validação inclui Git comum, worktree, ausência de Git, pasta inacessível, múltiplos projetos, legado, idempotência e paridade HTTP/MCP, além do layout desktop/mobile. A revisão não autoriza alterar bancos reais ou reiniciar serviços para testes.

## Escopo da tarefa
A especificação Markdown permanece independente. A tarefa terá metadados estruturados de projetos envolvidos e repositórios relacionados, sem extrair vínculos automaticamente do texto.

- Projeto: nome e pasta raiz local do checkout (a raiz de trabalho, inclusive worktrees cujo .git seja arquivo). Não listar arquivos/pastas modificados.
- Repositório: nome, URL remota e URL web quando disponível; relação explícita com projetos. Aceitar múltiplos projetos e repositórios.
- A declaração do escopo distingue identificado, a identificar e não se aplica. Não inventar caminhos/repositórios para pesquisas ou trabalho sem Git.
- Preservar registros existentes sem exigir preenchimento retroativo nem migrar dados por inferência.

## Apresentação na aba Especificação
Desktop: texto Markdown à esquerda; dois cards à direita, Projetos e Repositórios. Projetos listam nomes/pastas raiz; repositórios exibem nomes com links web seguros quando disponíveis. Coluna de leitura rola normalmente; os cards permanecem acessíveis na coluna lateral, sem sobrepor conteúdo ou abas. Mobile: empilhar os cards e o conteúdo; não exigir duas colunas.

## Evidências em novos resumos
Toda nova gravação de resumo declara explicitamente se houve commit no trabalho relatado. O contrato final deverá documentar essa declaração booleana e sua validação condicional em HTTP, MCP e skills.

- Não houve commit: lista de commits vazia; nenhuma seção de commits no card. Investigação, documentação não comitada ou checkpoint continuam válidos.
- Houve commit: ao menos uma referência completa, com repositório, branch informada no momento do registro e hash completo. Aceitar vários commits em vários repositórios. Campos vazios/incompletos rejeitam a operação inteira, sem gravação parcial de resumo/status.
- O hash identifica o commit; branch é contexto histórico, não prova de que o commit ainda pertença àquela branch ou esteja publicado. Não substituir o hash por posição na branch.
- A declaração é evidência fornecida pelo agente, não autenticação ou verificação remota automática. Reenvios idempotentes não duplicam referências.
- Dados antigos sem declaração seguem legíveis como legado; não interpretar ausência como false nem exigir commits retroativos.
- No modo detached HEAD ou ambiente sem branch identificável, definir representação explícita antes da implementação; não fabricar nome de branch.

## Links e UI dos resumos
Mostrar repositório, branch e hash curto; preservar hash completo para copiar/inspecionar. Links de commit são opcionais e dependem de URL web e disponibilidade remota confirmada. Suportar GitHub e GitLab, inclusive hosts próprios quando reconhecidos/configurados. Não converter URL SSH em link web cegamente, não expor credenciais embutidas, não renderizar esquemas executáveis. Commit somente local: mostrar referência sem anunciar disponibilidade remota.

## Critérios de aceite
1. Escopo estruturado aparece nos dois cards, preservando Markdown e layout responsivo.
2. Novo resumo sem declaração é rejeitado; false com lista vazia é aceito; true exige referências completas; false com referências contraditórias é rejeitado.
3. HTTP/MCP validam as mesmas regras atomicamente e preservam replays/legados.
4. Múltiplos repositórios, branches e commits ficam no resumo original sem serem substituídos por estado atual.
5. Resumo sem commit não mostra seção vazia; links seguros abrem commit correto quando publicado.
6. Skills orientam coleta real por Git e nunca criar commit somente para preencher formulário.
7. Testes isolados de compatibilidade, validação, links, desktop/mobile e acessibilidade. Não alterar dados reais.

## Pendência posterior: Arquivos
Usuário pediu anotar filtros na aba Arquivos e carregamento infinito pelo controlador compartilhado. A aba já usa TaskRecordList; validar root, lotes e continuidade antes de afirmar uma implementação nova. Definir filtros úteis com base nos metadados/contrato existentes, preservar combinações/limpar/URL e padrão mobile. Implementação autorizada junto com projetos, repositórios e commits.
