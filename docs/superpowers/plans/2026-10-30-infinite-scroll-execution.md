# Execução: scroll infinito e Conversa

Autorização humana transmitida pela coordenação em 30/10/2026: implementar diretamente neste worktree, sem assumir perfil Demo; registro Bee Team pendente de identidade legítima. Sem push/merge ou alteração de dados de produto.

1. Extrair controlador de sentinel com root independente, trava por progresso, autofill após páginas/resize, parada em erro/fim/offset repetido e cleanup. Preservar cancelamento das queries via AbortSignal.
2. Migrar cards, Kanban, navegação de planos e histórico, mantendo layouts, âncoras, URLs, seleção e loader de 100ms.
3. Testar concorrência, autofill, fim, retry, cancelamento e estabilidade; validar build e desktop/mobile; commit local.
4. Executar o plano existente de Conversa, com papel atual (Leader prioritário à direita), humanos/desconhecidos neutros, janela recente por padrão e offsets legados preservados, prepend ancorado e Markdown seguro.

Ruling: o registro antigo de backlog não representa a autorização atual. A execução ocorre como chat técnico, sem actorId/commentID inventados.

Estado: implementação iniciada; validações pendentes.

Base compartilhada implementada: quatro consumidores migrados; revisão histórica transmite AbortSignal. Testes: 190/190 frontend, build frontend, cargo build com mcp, 20/20 testes lib Rust. QA real no preview 5176: agentes com limit=1 carregaram sete páginas sem rolagem, pararam com scrollHeight 1202/clientHeight 819 e scrollTop 0. Integração PostgreSQL completa permanece dependente de infraestrutura isolada; nenhum dado de produto alterado.
