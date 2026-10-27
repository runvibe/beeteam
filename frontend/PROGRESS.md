# Frontend — acompanhamento

Escopo: React/Vite/shadcn/ui/Zustand, API mockada substituível, sem autenticação. UI de leitura/configuração; sem dispatch/aprovação. Mudanças apenas em frontend/.

- [x] 1. Revisar os seis documentos atuais, congelar referência e regenerar tipos.
- [x] 2. Adaptar mock e testes: paginação, domínio final e autonomia recursiva.
- [x] 3. Navegação, boards, filtros e detalhe recursivo de tasks.
- [x] 4. RA, perfis, times e configurações contratuais.
- [x] 5. Testes/build, verificação visual, documentação e commits locais.

## Revisão de 27/10/2026

Referências copiadas do checkout fonte para contracts/, sem editar a fonte. 81 schemas gerados em módulos separados. Dependências alinhadas com TypeScript 5.9; shadcn Radix instalado pelo CLI.

Diferenças a adaptar: remover workspace; Board.teamId gestor único e createdBy preservado; Task.authorAgentId/executorAgentId obrigatórios e sem teamId; filhos globais recursivos cross-board; origem da raiz preservada no executionContext. Board manual/standard/automatic; task manual/automatic. Origem manual força manual, automatic força automatic, standard lê a flag da task atual sem herdar a do pai. Exclusão lógica distinta de arquivamento.

Não implementar política pendente de edição pelo líder. UI não terá reatribuição, composição operacional de times ou execução. Configurações se limitam aos metadados, perfis, status e modos previstos.

## Evidências anteriores preservadas

- Mock inicial: 4 testes passaram antes da revisão final; não comprova aderência ao domínio atual.
- Instalação acidental na raiz foi movida para .setup-residue/ ignorada; nada incluído no commit fora de frontend/.

- Tarefa 2: 12 testes passaram; tsc -b passou. Filhos cross-board e 6 combinações de autonomia verificadas. Mock em memória, reset ao recarregar; sem API real.

- Tarefas 3/4: boards/tasks e RA/configurações implementados. 29 testes passam; inclui schemas exatos, autonomia e proteção de status. npm run build passou. cargo build --locked passou; cargo test --locked: 12 unitários passaram, 3 integrações falharam ao criar PostgreSQL por Docker indisponível (erro de sistema 2). Sem mudanças Rust.

## Revisão final

- Revisor independente (skill requesting-code-review) encontrou perda de draft em BoardForm e divergência do default archived. Ambos reproduzidos em testes RED, corrigidos e GREEN.
- Ruling: a sugestão de proibir edição da flag individual fora de standard foi rejeitada: a regra do contrato restringe o cálculo efetivo, não a configuração salva. UI mostra ambos; origem continua prevalecendo. Custo: usuário pode salvar flag sem efeito imediato; explicação visível informa a precedência.
- Correção menor: IDs de busca agora únicos para não associar labels ao campo atrás de um modal.
- Itens menores reclassificados como aderência ao contrato e corrigidos: imagens de upload pelo adapter, filtros/ordem de revisões e escolha do último resumo não excluído. Três testes RED→GREEN adicionados.
- Revisão visual: desktop e 390x844; navegação, colunas e modal/abas legíveis. Sem APIs reais.

- Tarefa 5 concluída: 35 testes frontend passam; typecheck/build produção passam; lint sem erros, 9 avisos de Fast Refresh. Todos os módulos fonte abaixo de 1000 linhas. Referências conferidas novamente por SHA256 e iguais à fonte. Prévia local em http://127.0.0.1:5173. Commit local somente frontend/, sem push/merge/deploy. Nenhum achado de correção permanece aberto; limitações de escopo mock estão no README.

## Tema claro/escuro — 27/10/2026

- [x] Sistema como default, mudanças do SO e preferência explícita persistida.
- [x] Bootstrap antes do React e paletas centralizadas; seletor shadcn acessível no topo.
- [x] 52 testes frontend, typecheck e build passam. Lint sem erros; avisos preexistentes de Fast Refresh e Blob avatar.
- [x] Revisão independente sem defeitos acionáveis. OS e falha de storage verificados por testes; Claro/Escuro e reload verificados no navegador.
- [x] Desktop: Kanban, task/abas, agentes/perfis/configuração, times. Viewport estreito: seletor, Kanban, task e agentes.
- [x] cargo build --locked passou; 12 unitários Rust passaram. Três integrações impedidas por Docker indisponível (CreateContainer, OS 2).
- [x] Preview local mantido em http://127.0.0.1:5173/. Sem backend, push, merge ou deploy.

Redesign monocromático será proposta separada; não aplicado nesta mudança de tema.
